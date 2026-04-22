use std::sync::Mutex;
use tauri::State;
use crate::models::error::AppError;
use crate::services::file_watcher::FileWatcherService;

// Tauri managed state
pub struct WatcherState(pub Mutex<FileWatcherService>);

#[tauri::command]
pub async fn start_watching(
    app: tauri::AppHandle,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), AppError> {
    let mut watcher = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    watcher.start(std::path::PathBuf::from(path), app)
}

#[tauri::command]
pub async fn stop_watching(
    state: State<'_, WatcherState>,
) -> Result<(), AppError> {
    let mut watcher = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    watcher.stop();
    Ok(())
}
