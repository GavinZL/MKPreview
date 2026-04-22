use serde::{Deserialize, Serialize};

/// 文件树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_count: Option<u32>,
}

/// 文件元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    pub path: String,
    pub size: u64,
    /// Unix timestamp (seconds since epoch)
    pub modified: u64,
    /// Unix timestamp (seconds since epoch)
    pub created: u64,
    pub is_dir: bool,
}

/// 文件系统变更类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FsChangeType {
    Created,
    Modified,
    Deleted,
    Renamed,
}

/// 文件系统变更事件（Rust → Frontend via Tauri Event）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEvent {
    pub change_type: FsChangeType,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    pub is_dir: bool,
}

/// 文件系统错误事件（Rust → Frontend via Tauri Event）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsErrorEvent {
    pub message: String,
    pub timestamp: u64,
}
