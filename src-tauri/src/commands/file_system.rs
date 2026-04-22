use crate::models::error::AppError;
use crate::models::file_tree::{FileMeta, FileTreeNode};
use crate::services::dir_scanner;

#[tauri::command]
pub async fn scan_directory(path: String) -> Result<Vec<FileTreeNode>, AppError> {
    let root = std::path::Path::new(&path);
    dir_scanner::scan_directory(root)
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, AppError> {
    // 路径校验：拒绝 ..
    if path.contains("..") {
        return Err(AppError::InvalidPath { path });
    }
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::FileNotFound { path });
    }
    if !p.is_file() {
        return Err(AppError::FileNotFound { path });
    }
    // 只读取 .md 文件（检查扩展名）
    if !path.to_lowercase().ends_with(".md") {
        return Err(AppError::NotAMarkdownFile { path });
    }
    // lossy UTF-8 读取
    let bytes = std::fs::read(p).map_err(AppError::Io)?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
pub async fn get_file_meta(path: String) -> Result<FileMeta, AppError> {
    // 路径校验：拒绝 ..
    if path.contains("..") {
        return Err(AppError::InvalidPath { path });
    }
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::FileNotFound { path });
    }
    let metadata = std::fs::metadata(p).map_err(AppError::Io)?;
    let modified = metadata
        .modified()
        .map_err(AppError::Io)?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| AppError::Internal("Invalid modified time".to_string()))?
        .as_secs();
    let created = metadata
        .created()
        .map_err(AppError::Io)?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| AppError::Internal("Invalid created time".to_string()))?
        .as_secs();
    Ok(FileMeta {
        path,
        size: metadata.len(),
        modified,
        created,
        is_dir: metadata.is_dir(),
    })
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    // 1. 路径安全校验：拒绝 ..
    if path.contains("..") {
        return Err(AppError::InvalidPath { path });
    }
    // 2. 内容大小限制 10MB
    if content.len() > 10 * 1024 * 1024 {
        return Err(AppError::FileTooLarge { size: content.len() });
    }
    let p = std::path::Path::new(&path);
    // 3. 确保父目录存在
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            return Err(AppError::FileNotFound {
                path: parent.to_string_lossy().to_string(),
            });
        }
    }
    // 4. 原子写入：先写 .tmp 再 rename
    let temp_path = p.with_extension("md.tmp");
    std::fs::write(&temp_path, &content).map_err(AppError::Io)?;
    std::fs::rename(&temp_path, p).map_err(AppError::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_write_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        let path_str = file_path.to_string_lossy().to_string();
        let content = "Hello, MKPreview!".to_string();

        let result = write_file(path_str.clone(), content.clone()).await;
        assert!(result.is_ok());

        let written = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(written, content);
    }

    #[tokio::test]
    async fn test_write_file_rejects_path_traversal() {
        let result = write_file("/etc/../etc/passwd".to_string(), "x".to_string()).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error_code(), "FS_INVALID_PATH");
    }

    #[tokio::test]
    async fn test_write_file_rejects_oversized_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("big.md");
        let path_str = file_path.to_string_lossy().to_string();
        let huge_content = "x".repeat(10 * 1024 * 1024 + 1);

        let result = write_file(path_str, huge_content).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error_code(), "FS_TOO_LARGE");
    }
}
