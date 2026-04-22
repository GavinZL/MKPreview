use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify::event::ModifyKind;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, FileIdMap};
use crate::models::file_tree::{FsChangeEvent, FsChangeType, FsErrorEvent};
use crate::models::error::AppError;

pub struct FileWatcherService {
    debouncer: Option<Debouncer<RecommendedWatcher, FileIdMap>>,
    watched_path: Option<PathBuf>,
}

impl Default for FileWatcherService {
    fn default() -> Self {
        Self::new()
    }
}

impl FileWatcherService {
    pub fn new() -> Self {
        Self {
            debouncer: None,
            watched_path: None,
        }
    }

    pub fn start(&mut self, path: PathBuf, app_handle: AppHandle) -> Result<(), AppError> {
        self.stop();

        if !path.exists() || !path.is_dir() {
            return Err(AppError::WatcherStart(format!(
                "路径不存在或不是目录: {}",
                path.display()
            )));
        }

        let app = app_handle.clone();
        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            None,
            move |result: notify_debouncer_full::DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events {
                            process_event(&app, &event);
                        }
                    }
                    Err(errors) => {
                        for err in errors {
                            emit_error(&app, &format!("Watcher error: {}", err));
                        }
                    }
                }
            },
        )
        .map_err(|e| AppError::WatcherStart(e.to_string()))?;

        debouncer
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| AppError::WatcherStart(e.to_string()))?;

        self.debouncer = Some(debouncer);
        self.watched_path = Some(path);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(ref mut debouncer) = self.debouncer {
            if let Some(ref path) = self.watched_path {
                let _ = debouncer.watcher().unwatch(path);
            }
        }
        self.debouncer = None;
        self.watched_path = None;
    }
}

fn process_event(app_handle: &AppHandle, event: &DebouncedEvent) {
    let change_type = match event.kind {
        EventKind::Create(_) => FsChangeType::Created,
        EventKind::Modify(ModifyKind::Data(_)) => FsChangeType::Modified,
        EventKind::Modify(ModifyKind::Name(_)) => FsChangeType::Renamed,
        EventKind::Remove(_) => FsChangeType::Deleted,
        _ => return,
    };

    let paths = &event.paths;
    if paths.is_empty() {
        return;
    }

    let (path, old_path) = if matches!(change_type, FsChangeType::Renamed) && paths.len() >= 2 {
        let old = paths[0].to_string_lossy().to_string();
        let new = paths.last().unwrap().to_string_lossy().to_string();
        (new, Some(old))
    } else {
        let p = paths.last().unwrap().to_string_lossy().to_string();
        (p, None)
    };

    if should_ignore(&path) {
        return;
    }

    let is_dir = std::path::Path::new(&path).is_dir();

    if !is_dir && !path.ends_with(".md") {
        return;
    }

    let fs_event = FsChangeEvent {
        change_type,
        path,
        old_path,
        is_dir,
    };

    let _ = app_handle.emit("fs:change", fs_event);
}

fn should_ignore(path: &str) -> bool {
    for component in path.split(&['/', '\\']) {
        if component.is_empty() {
            continue;
        }

        if component.starts_with('.') {
            return true;
        }

        if component.eq_ignore_ascii_case("node_modules") {
            return true;
        }
    }

    false
}

fn emit_error(app_handle: &AppHandle, message: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let error_event = FsErrorEvent {
        message: message.to_string(),
        timestamp,
    };

    let _ = app_handle.emit("fs:error", error_event);
}
