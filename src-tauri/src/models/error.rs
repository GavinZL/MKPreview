use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 应用统一错误类型
#[derive(Debug, Error)]
pub enum AppError {
    // ── 文件系统相关 (FS_*) ──
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Path not allowed: {path}")]
    PathNotInScope { path: String },

    #[error("Invalid path: {path}")]
    InvalidPath { path: String },

    #[error("Not a Markdown file: {path}")]
    NotAMarkdownFile { path: String },

    #[error("Not a directory: {path}")]
    NotADirectory { path: String },

    #[error("File too large: {size} bytes (limit 10MB)")]
    FileTooLarge { size: usize },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },

    // ── 配置相关 (CFG_*) ──
    #[error("Config serialization failed: {0}")]
    ConfigSerialize(String),

    #[error("Config deserialization failed: {0}")]
    ConfigDeserialize(String),

    #[error("Invalid config value: {0}")]
    InvalidSettings(String),

    #[error("Failed to get app data directory")]
    AppDataDirNotFound,

    // ── 监控相关 (WATCH_*) ──
    #[error("File watcher start failed: {0}")]
    WatcherStart(String),

    #[error("File watcher runtime error: {0}")]
    WatcherRuntime(String),

    #[error("Watched path no longer exists: {path}")]
    WatcherPathGone { path: String },

    // ── 搜索相关 (SEARCH_*) ──
    #[error("Invalid search directory: {path}")]
    InvalidSearchDirectory { path: String },

    #[error("Search timeout")]
    SearchTimeout,

    // ── IPC / 通用 ──
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    /// 获取错误码
    pub fn error_code(&self) -> &'static str {
        use AppError::*;
        match self {
            Io(_) => "FS_IO_ERROR",
            FileNotFound { .. } => "FS_NOT_FOUND",
            PathNotInScope { .. } => "FS_OUT_OF_SCOPE",
            InvalidPath { .. } => "FS_INVALID_PATH",
            NotAMarkdownFile { .. } => "FS_NOT_MD",
            NotADirectory { .. } => "FS_NOT_DIR",
            FileTooLarge { .. } => "FS_TOO_LARGE",
            PermissionDenied { .. } => "FS_NO_PERMISSION",
            ConfigSerialize(_) => "CFG_SERIALIZE",
            ConfigDeserialize(_) => "CFG_DESERIALIZE",
            InvalidSettings(_) => "CFG_INVALID_VALUE",
            AppDataDirNotFound => "CFG_NO_DATA_DIR",
            WatcherStart(_) => "WATCH_START_FAIL",
            WatcherRuntime(_) => "WATCH_RUNTIME",
            WatcherPathGone { .. } => "WATCH_PATH_GONE",
            InvalidSearchDirectory { .. } => "SEARCH_INVALID_DIR",
            SearchTimeout => "SEARCH_TIMEOUT",
            Internal(_) => "INTERNAL",
        }
    }

    /// 获取额外细节信息
    pub fn details(&self) -> Option<serde_json::Value> {
        use AppError::*;
        match self {
            FileNotFound { path }
            | PathNotInScope { path }
            | InvalidPath { path }
            | NotAMarkdownFile { path }
            | NotADirectory { path }
            | PermissionDenied { path }
            | WatcherPathGone { path }
            | InvalidSearchDirectory { path } => {
                Some(serde_json::json!({"path": path}))
            }
            FileTooLarge { size } => {
                Some(serde_json::json!({"size": size, "limit": 10 * 1024 * 1024}))
            }
            _ => None,
        }
    }
}

/// 统一错误响应结构（序列化后传给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl From<AppError> for ErrorResponse {
    fn from(err: AppError) -> Self {
        let code = err.error_code().to_string();
        let message = err.to_string();
        let details = err.details();
        ErrorResponse { code, message, details }
    }
}

/// 将 AppError 转为 Tauri InvokeError（结构化 JSON 传给前端）
impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        let resp: ErrorResponse = err.into();
        tauri::ipc::InvokeError(
            serde_json::to_value(&resp)
                .unwrap_or_else(|_| serde_json::json!({"code": "INTERNAL", "message": "序列化失败"}))
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        assert_eq!(
            AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, "x")).error_code(),
            "FS_IO_ERROR"
        );
        assert_eq!(
            AppError::FileNotFound { path: "".to_string() }.error_code(),
            "FS_NOT_FOUND"
        );
        assert_eq!(
            AppError::PathNotInScope { path: "".to_string() }.error_code(),
            "FS_OUT_OF_SCOPE"
        );
        assert_eq!(
            AppError::InvalidPath { path: "".to_string() }.error_code(),
            "FS_INVALID_PATH"
        );
        assert_eq!(
            AppError::NotAMarkdownFile { path: "".to_string() }.error_code(),
            "FS_NOT_MD"
        );
        assert_eq!(
            AppError::NotADirectory { path: "".to_string() }.error_code(),
            "FS_NOT_DIR"
        );
        assert_eq!(AppError::FileTooLarge { size: 0 }.error_code(), "FS_TOO_LARGE");
        assert_eq!(
            AppError::PermissionDenied { path: "".to_string() }.error_code(),
            "FS_NO_PERMISSION"
        );
        assert_eq!(
            AppError::ConfigSerialize("".to_string()).error_code(),
            "CFG_SERIALIZE"
        );
        assert_eq!(
            AppError::ConfigDeserialize("".to_string()).error_code(),
            "CFG_DESERIALIZE"
        );
        assert_eq!(
            AppError::InvalidSettings("".to_string()).error_code(),
            "CFG_INVALID_VALUE"
        );
        assert_eq!(AppError::AppDataDirNotFound.error_code(), "CFG_NO_DATA_DIR");
        assert_eq!(
            AppError::WatcherStart("".to_string()).error_code(),
            "WATCH_START_FAIL"
        );
        assert_eq!(
            AppError::WatcherRuntime("".to_string()).error_code(),
            "WATCH_RUNTIME"
        );
        assert_eq!(
            AppError::WatcherPathGone { path: "".to_string() }.error_code(),
            "WATCH_PATH_GONE"
        );
        assert_eq!(
            AppError::InvalidSearchDirectory { path: "".to_string() }.error_code(),
            "SEARCH_INVALID_DIR"
        );
        assert_eq!(AppError::SearchTimeout.error_code(), "SEARCH_TIMEOUT");
        assert_eq!(AppError::Internal("".to_string()).error_code(), "INTERNAL");
    }

    #[test]
    fn test_error_display() {
        let err = AppError::FileNotFound { path: "/a.md".to_string() };
        assert_eq!(err.to_string(), "File not found: /a.md");

        let err = AppError::FileTooLarge { size: 1024 };
        assert_eq!(err.to_string(), "File too large: 1024 bytes (limit 10MB)");

        let err = AppError::Internal("oops".to_string());
        assert_eq!(err.to_string(), "Internal error: oops");

        let err = AppError::InvalidPath { path: "/bad".to_string() };
        assert_eq!(err.to_string(), "Invalid path: /bad");
    }

    #[test]
    fn test_error_details_with_path() {
        let cases = vec![
            AppError::FileNotFound { path: "/a.md".to_string() },
            AppError::PathNotInScope { path: "/b.md".to_string() },
            AppError::InvalidPath { path: "/c.md".to_string() },
            AppError::NotAMarkdownFile { path: "/d.txt".to_string() },
            AppError::NotADirectory { path: "/e.md".to_string() },
            AppError::PermissionDenied { path: "/f.md".to_string() },
            AppError::WatcherPathGone { path: "/g".to_string() },
            AppError::InvalidSearchDirectory { path: "/h".to_string() },
        ];

        for err in cases {
            let details = err.details().expect("应返回 details");
            let obj = details.as_object().unwrap();
            assert!(obj.contains_key("path"), "details 应包含 path 字段");
        }
    }

    #[test]
    fn test_error_details_file_too_large() {
        let err = AppError::FileTooLarge { size: 15_000_000 };
        let details = err.details().expect("应返回 details");
        let obj = details.as_object().unwrap();
        assert_eq!(obj["size"], 15_000_000);
        assert_eq!(obj["limit"], 10 * 1024 * 1024);
    }

    #[test]
    fn test_error_details_none() {
        assert!(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, "x")).details().is_none());
        assert!(AppError::Internal("err".to_string()).details().is_none());
        assert!(AppError::SearchTimeout.details().is_none());
        assert!(AppError::AppDataDirNotFound.details().is_none());
        assert!(AppError::ConfigSerialize("e".to_string()).details().is_none());
        assert!(AppError::WatcherStart("e".to_string()).details().is_none());
    }

    #[test]
    fn test_error_response_from_app_error() {
        let err = AppError::FileNotFound { path: "/test.md".to_string() };
        let resp: ErrorResponse = err.into();
        assert_eq!(resp.code, "FS_NOT_FOUND");
        assert_eq!(resp.message, "File not found: /test.md");
        assert!(resp.details.is_some());
        let details = resp.details.unwrap();
        assert_eq!(details["path"], "/test.md");
    }

    #[test]
    fn test_invoke_error_json() {
        let err = AppError::FileNotFound { path: "/test.md".to_string() };
        let invoke_err: tauri::ipc::InvokeError = err.into();
        // Tauri 2.0 InvokeError 内部为 serde_json::Value
        // 验证转换不 panic，且内部值是对象
        let parsed = &invoke_err.0;
        assert!(parsed.is_object(), "InvokeError 内部应为 JSON 对象");
        assert_eq!(parsed["code"], "FS_NOT_FOUND");
        assert!(parsed["message"].as_str().unwrap().contains("/test.md"));
    }
}
