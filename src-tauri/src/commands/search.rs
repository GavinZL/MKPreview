use crate::models::error::AppError;
use crate::models::search_result::SearchResult;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[tauri::command]
pub async fn search_files(dir: String, query: String) -> Result<Vec<SearchResult>, AppError> {
    // 路径校验
    if dir.contains("..") {
        return Err(AppError::InvalidPath { path: dir });
    }
    let root = Path::new(&dir);
    if !root.is_dir() {
        return Err(AppError::InvalidSearchDirectory { path: dir });
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    let max_results = 100;
    let max_per_file = 10;

    // 递归遍历目录
    for entry in walkdir::WalkDir::new(root)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if results.len() >= max_results {
            break;
        }

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let path_str = path.to_string_lossy().to_string();

        // 文件名匹配（所有文件类型）
        if name.to_lowercase().contains(&query_lower) {
            results.push(SearchResult {
                path: path_str.clone(),
                name: name.clone(),
                line_number: None,
                context: None,
                match_type: "filename".to_string(),
            });
        }

        // 全文搜索（仅 .md 文件）
        if !name.to_lowercase().ends_with(".md") {
            continue;
        }

        let file = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);
        let mut file_matches = 0;

        for (line_idx, line_result) in reader.lines().enumerate() {
            if file_matches >= max_per_file || results.len() >= max_results {
                break;
            }

            let line = match line_result {
                Ok(l) => l,
                Err(_) => continue,
            };

            if line.to_lowercase().contains(&query_lower) {
                results.push(SearchResult {
                    path: path_str.clone(),
                    name: name.clone(),
                    line_number: Some(line_idx + 1),
                    context: Some(line.trim().chars().take(200).collect()),
                    match_type: "content".to_string(),
                });
                file_matches += 1;
            }
        }
    }

    // 排序：文件名匹配优先于内容匹配
    results.sort_by(|a, b| {
        let type_ord = |t: &str| if t == "filename" { 0 } else { 1 };
        type_ord(&a.match_type).cmp(&type_ord(&b.match_type))
    });

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_files_filename_match() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("hello.md"), "# Greeting\n").unwrap();
        std::fs::write(dir.path().join("world.txt"), "world\n").unwrap();

        let results = search_files(
            dir.path().to_string_lossy().to_string(),
            "hello".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "hello.md");
        assert_eq!(results[0].match_type, "filename");
    }

    #[tokio::test]
    async fn test_search_files_content_match() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("readme.md"), "# README\nMKPreview is great\n").unwrap();

        let results = search_files(
            dir.path().to_string_lossy().to_string(),
            "MKPreview".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "readme.md");
        assert_eq!(results[0].match_type, "content");
        assert_eq!(results[0].line_number, Some(2));
        assert_eq!(results[0].context.as_deref(), Some("MKPreview is great"));
    }

    #[tokio::test]
    async fn test_search_files_empty_result() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("note.md"), "# Note\n").unwrap();

        let results = search_files(
            dir.path().to_string_lossy().to_string(),
            "nonexistent".to_string(),
        )
        .await
        .unwrap();

        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_search_files_invalid_directory() {
        let result = search_files("/nonexistent/dir".to_string(), "test".to_string()).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error_code(), "SEARCH_INVALID_DIR");
    }
}
