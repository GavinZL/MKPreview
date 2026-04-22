use crate::models::error::AppError;
use crate::models::settings::Settings;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// 获取配置文件路径
fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("无法获取应用数据目录: {}", e)))?;
    Ok(app_data_dir.join("settings.json"))
}

/// 读取用户配置，文件不存在或解析失败时返回默认值
pub fn get_settings(app_handle: &tauri::AppHandle) -> Result<Settings, AppError> {
    let path = config_path(app_handle)?;
    if !path.exists() {
        let default_settings = Settings::default();
        // 自动创建默认配置文件
        save_settings_internal(&path, &default_settings)?;
        return Ok(default_settings);
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<Settings>(&content) {
            Ok(settings) => Ok(settings),
            // JSON 解析失败返回默认值，不报错
            Err(_) => Ok(Settings::default()),
        },
        // 读取失败返回默认值，不报错
        Err(_) => Ok(Settings::default()),
    }
}

/// 保存用户配置（原子写入）
pub fn save_settings(app_handle: &tauri::AppHandle, settings: &Settings) -> Result<(), AppError> {
    let path = config_path(app_handle)?;
    save_settings_internal(&path, settings)
}

fn save_settings_internal(path: &Path, settings: &Settings) -> Result<(), AppError> {
    // 确保目录存在
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }
    // 序列化为 pretty JSON
    let json =
        serde_json::to_string_pretty(settings).map_err(|e| AppError::ConfigSerialize(e.to_string()))?;
    // 原子写入：先写 .tmp，再 rename
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, json).map_err(AppError::Io)?;
    std::fs::rename(&tmp_path, path).map_err(AppError::Io)?;
    Ok(())
}
