use crate::models::error::AppError;
use crate::models::settings::Settings;
use crate::services::config_store;

#[tauri::command]
pub async fn get_settings(app: tauri::AppHandle) -> Result<Settings, AppError> {
    config_store::get_settings(&app)
}

#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), AppError> {
    config_store::save_settings(&app, &settings)
}
