pub mod commands;
pub mod models;
pub mod services;

use commands::watcher::WatcherState;
use services::file_watcher::FileWatcherService;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(WatcherState(Mutex::new(FileWatcherService::new())))
        .setup(|app| {
            // --- File menu ---
            let open_dir_item = MenuItem::with_id(
                app,
                "open_dir",
                "Open Directory...",
                true,
                Some("CmdOrCtrl+O"),
            )?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open_dir_item)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            // --- Edit menu ---
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // --- View menu ---
            let preview_mode_item = MenuItem::with_id(
                app,
                "preview_mode",
                "Preview Mode",
                true,
                Some("CmdOrCtrl+1"),
            )?;
            let source_mode_item = MenuItem::with_id(
                app,
                "source_mode",
                "Source Mode",
                true,
                Some("CmdOrCtrl+2"),
            )?;
            let split_mode_item = MenuItem::with_id(
                app,
                "split_mode",
                "Split Mode",
                true,
                Some("CmdOrCtrl+3"),
            )?;
            let toggle_sidebar_item = MenuItem::with_id(
                app,
                "toggle_sidebar",
                "Toggle Sidebar",
                true,
                Some("CmdOrCtrl+B"),
            )?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&preview_mode_item)
                .item(&source_mode_item)
                .item(&split_mode_item)
                .separator()
                .item(&toggle_sidebar_item)
                .build()?;

            // --- Help menu ---
            let about_item = MenuItem::with_id(
                app,
                "about",
                "About MKPreview",
                true,
                None::<&str>,
            )?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&about_item)
                .build()?;

            // --- Assemble menu bar ---
            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "open_dir" => {
                    let _ = app.emit("menu:open-directory", ());
                }
                "preview_mode" => {
                    let _ = app.emit("menu:set-mode", "preview");
                }
                "source_mode" => {
                    let _ = app.emit("menu:set-mode", "source");
                }
                "split_mode" => {
                    let _ = app.emit("menu:set-mode", "split");
                }
                "toggle_sidebar" => {
                    let _ = app.emit("menu:toggle-sidebar", ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_system::scan_directory,
            commands::file_system::read_file,
            commands::file_system::get_file_meta,
            commands::file_system::write_file,
            commands::search::search_files,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::watcher::start_watching,
            commands::watcher::stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MKPreview application");
}
