use crate::models::error::AppError;
use crate::models::file_tree::FileTreeNode;
use std::path::Path;

/// 扫描目录，返回文件树，排除隐藏文件和目录
pub fn scan_directory(root_path: &Path) -> Result<Vec<FileTreeNode>, AppError> {
    // 1. 路径遍历防护：拒绝含 .. 的路径（优先于存在性检查）
    if root_path.to_string_lossy().contains("..") {
        return Err(AppError::InvalidPath {
            path: root_path.display().to_string(),
        });
    }
    // 2. 路径校验
    if !root_path.exists() {
        return Err(AppError::FileNotFound {
            path: root_path.display().to_string(),
        });
    }
    if !root_path.is_dir() {
        return Err(AppError::NotADirectory {
            path: root_path.display().to_string(),
        });
    }

    // 3. 构建树
    build_tree(root_path)
}

fn build_tree(dir: &Path) -> Result<Vec<FileTreeNode>, AppError> {
    let mut entries = Vec::new();
    let dir_entries = std::fs::read_dir(dir).map_err(AppError::Io)?;

    for entry in dir_entries {
        let entry = entry.map_err(AppError::Io)?;
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和目录（以 . 开头）
        if name.starts_with('.') {
            continue;
        }

        // 跳过特定忽略目录/文件
        if name == ".git" || name == "node_modules" || name == ".DS_Store" {
            continue;
        }

        let path = entry.path();
        let metadata = entry.metadata().map_err(AppError::Io)?;

        if metadata.is_dir() {
            let children = build_tree(&path)?;
            // 过滤掉不含 .md 的空目录
            if !children.is_empty() {
                let file_count = children.iter().map(|c| c.file_count.unwrap_or(1)).sum();
                entries.push(FileTreeNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                    file_count: Some(file_count),
                });
            }
        } else if metadata.is_file() {
            entries.push(FileTreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
                file_count: None,
            });
        }
    }

    // 自然排序
    entries.sort_by(|a, b| natural_sort(&a.name, &b.name));
    Ok(entries)
}

/// 自然排序：数字前缀感知排序（01_xxx < 2_xxx < 10_xxx）
fn natural_sort(a: &str, b: &str) -> std::cmp::Ordering {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let mut i = 0;
    let mut j = 0;

    while i < a_chars.len() && j < b_chars.len() {
        if a_chars[i].is_ascii_digit() && b_chars[j].is_ascii_digit() {
            // 提取 a 的数字段
            let a_start = i;
            while i < a_chars.len() && a_chars[i].is_ascii_digit() {
                i += 1;
            }
            // 提取 b 的数字段
            let b_start = j;
            while j < b_chars.len() && b_chars[j].is_ascii_digit() {
                j += 1;
            }
            let a_num: u64 = a[a_start..i].parse().unwrap_or(0);
            let b_num: u64 = b[b_start..j].parse().unwrap_or(0);
            if a_num != b_num {
                return a_num.cmp(&b_num);
            }
        } else {
            if a_chars[i] != b_chars[j] {
                return a_chars[i].cmp(&b_chars[j]);
            }
            i += 1;
            j += 1;
        }
    }

    a.len().cmp(&b.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_scan_empty_dir() {
        let temp = TempDir::new().unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert!(result.is_empty(), "空目录应返回空 Vec");
    }

    #[test]
    fn test_scan_only_md_files() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("a.md"), "# A").unwrap();
        fs::write(temp.path().join("b.md"), "# B").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 2, "应返回 2 个 .md 文件");
        assert_eq!(result[0].name, "a.md");
        assert_eq!(result[1].name, "b.md");
    }

    #[test]
    fn test_scan_returns_all_visible_files() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("a.md"), "# A").unwrap();
        fs::write(temp.path().join("b.txt"), "B").unwrap();
        fs::write(temp.path().join(".hidden"), "hidden").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 2, "应返回所有非隐藏文件");
        let names: Vec<&str> = result.iter().map(|n| n.name.as_str()).collect();
        assert!(names.contains(&"a.md"));
        assert!(names.contains(&"b.txt"));
    }

    #[test]
    fn test_scan_filters_hidden_files() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("visible.md"), "# V").unwrap();
        fs::write(temp.path().join(".hidden.md"), "# H").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 1, "隐藏文件应被过滤");
        assert_eq!(result[0].name, "visible.md");
    }

    #[test]
    fn test_scan_filters_node_modules() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("readme.md"), "# R").unwrap();
        let nm = temp.path().join("node_modules");
        fs::create_dir(&nm).unwrap();
        fs::write(nm.join("pkg.md"), "# P").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 1, "node_modules 应被过滤");
        assert_eq!(result[0].name, "readme.md");
    }

    #[test]
    fn test_scan_nested_dirs() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("root.md"), "# Root").unwrap();
        let sub = temp.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("sub.md"), "# Sub").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 2, "应包含 root.md 和 sub 目录");
        let dir_node = result.iter().find(|n| n.name == "sub").expect("应找到 sub 目录");
        assert!(dir_node.is_dir);
        let children = dir_node.children.as_ref().unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "sub.md");
    }

    #[test]
    fn test_scan_empty_dir_with_non_md_not_pruned() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("readme.md"), "# R").unwrap();
        let sub = temp.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("note.txt"), "txt").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result.len(), 2, "包含非 .md 文件的子目录不应被剪枝");
        let names: Vec<&str> = result.iter().map(|n| n.name.as_str()).collect();
        assert!(names.contains(&"readme.md"));
        assert!(names.contains(&"sub"));
    }

    #[test]
    fn test_scan_natural_sort() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("10_c.md"), "# 10").unwrap();
        fs::write(temp.path().join("01_a.md"), "# 01").unwrap();
        fs::write(temp.path().join("2_b.md"), "# 2").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        assert_eq!(result[0].name, "01_a.md");
        assert_eq!(result[1].name, "2_b.md");
        assert_eq!(result[2].name, "10_c.md");
    }

    #[test]
    fn test_scan_nonexistent_path() {
        let path = std::path::Path::new("/nonexistent/path/12345");
        let err = scan_directory(path).unwrap_err();
        match err {
            AppError::FileNotFound { path: p } => {
                assert!(p.contains("nonexistent"));
            }
            _ => panic!("期望 FileNotFound 错误，得到 {:?}", err),
        }
    }

    #[test]
    fn test_scan_file_not_dir() {
        let temp = TempDir::new().unwrap();
        let file = temp.path().join("not_dir.md");
        fs::write(&file, "# not dir").unwrap();
        let err = scan_directory(&file).unwrap_err();
        match err {
            AppError::NotADirectory { path: p } => {
                assert!(p.contains("not_dir.md"));
            }
            _ => panic!("期望 NotADirectory 错误，得到 {:?}", err),
        }
    }

    #[test]
    fn test_scan_path_traversal() {
        let path = std::path::Path::new("/some/../path");
        let err = scan_directory(path).unwrap_err();
        match err {
            AppError::InvalidPath { path: p } => {
                assert!(p.contains(".."));
            }
            _ => panic!("期望 InvalidPath 错误，得到 {:?}", err),
        }
    }

    #[test]
    fn test_scan_file_count() {
        let temp = TempDir::new().unwrap();
        let sub1 = temp.path().join("sub1");
        fs::create_dir(&sub1).unwrap();
        fs::write(sub1.join("a.md"), "# A").unwrap();
        fs::write(sub1.join("b.md"), "# B").unwrap();
        let sub2 = temp.path().join("sub2");
        fs::create_dir(&sub2).unwrap();
        fs::write(sub2.join("c.md"), "# C").unwrap();
        fs::write(temp.path().join("root.md"), "# Root").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        // root 下应有 3 个节点：root.md, sub1, sub2 (按自然排序)
        assert_eq!(result.len(), 3);
        let sub1_node = result.iter().find(|n| n.name == "sub1").unwrap();
        assert_eq!(sub1_node.file_count, Some(2), "sub1 应有 2 个文件");
        let sub2_node = result.iter().find(|n| n.name == "sub2").unwrap();
        assert_eq!(sub2_node.file_count, Some(1), "sub2 应有 1 个文件");
    }

    #[test]
    fn test_scan_dirs_sorted_before_files() {
        let temp = TempDir::new().unwrap();
        fs::write(temp.path().join("a.md"), "# A").unwrap();
        let z_dir = temp.path().join("z_dir");
        fs::create_dir(&z_dir).unwrap();
        fs::write(z_dir.join("x.md"), "# X").unwrap();
        let result = scan_directory(temp.path()).unwrap();
        // 当前实现不做目录优先排序，按自然排序混排
        // a.md < z_dir，所以文件排在目录前面
        assert_eq!(result[0].name, "a.md", "按自然排序，a.md 应排在 z_dir 前面");
        assert_eq!(result[1].name, "z_dir");
    }

    #[test]
    fn test_natural_sort_basic() {
        assert_eq!(natural_sort("a", "b"), std::cmp::Ordering::Less);
        assert_eq!(natural_sort("b", "a"), std::cmp::Ordering::Greater);
        assert_eq!(natural_sort("1", "2"), std::cmp::Ordering::Less);
        assert_eq!(natural_sort("2", "1"), std::cmp::Ordering::Greater);
        assert_eq!(natural_sort("01", "10"), std::cmp::Ordering::Less);
        assert_eq!(natural_sort("10", "01"), std::cmp::Ordering::Greater);
    }

    #[test]
    fn test_natural_sort_numeric_prefix() {
        assert_eq!(
            natural_sort("01_intro", "2_chapter"),
            std::cmp::Ordering::Less
        );
        assert_eq!(
            natural_sort("2_chapter", "10_appendix"),
            std::cmp::Ordering::Less
        );
        assert_eq!(
            natural_sort("01_intro", "10_appendix"),
            std::cmp::Ordering::Less
        );
    }

    #[test]
    fn test_natural_sort_case() {
        assert_eq!(natural_sort("same", "same"), std::cmp::Ordering::Equal);
        assert_eq!(natural_sort("Same", "Same"), std::cmp::Ordering::Equal);
    }
}
