use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 主题偏好
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

/// 窗口状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: 0,
            y: 0,
            maximized: false,
        }
    }
}

/// 用户配置（完整结构）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub theme: ThemePreference,
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    #[serde(default = "default_code_font_size")]
    pub code_font_size: u8,
    #[serde(default)]
    pub recent_directories: Vec<String>,
    #[serde(default)]
    pub last_directory: Option<String>,
    #[serde(default)]
    pub tree_expanded_state: HashMap<String, bool>,
    #[serde(default)]
    pub window_state: WindowState,
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: u16,
    #[serde(default = "default_true")]
    pub show_line_numbers: bool,
    #[serde(default = "default_false")]
    pub auto_save: bool,
    #[serde(default = "default_auto_save_interval")]
    pub auto_save_interval: u16,
    #[serde(default = "default_true")]
    pub enable_mermaid: bool,
    #[serde(default = "default_true")]
    pub enable_katex: bool,
    #[serde(default = "default_true")]
    pub enable_folding: bool,
    #[serde(default)]
    pub font_body: String,
    #[serde(default)]
    pub font_code: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            font_size: default_font_size(),
            code_font_size: default_code_font_size(),
            recent_directories: Vec::new(),
            last_directory: None,
            tree_expanded_state: HashMap::new(),
            window_state: WindowState::default(),
            sidebar_width: default_sidebar_width(),
            show_line_numbers: default_true(),
            auto_save: default_false(),
            auto_save_interval: default_auto_save_interval(),
            enable_mermaid: default_true(),
            enable_katex: default_true(),
            enable_folding: default_true(),
            font_body: String::new(),
            font_code: String::new(),
        }
    }
}

fn default_font_size() -> u8 { 16 }
fn default_code_font_size() -> u8 { 14 }
fn default_sidebar_width() -> u16 { 260 }
fn default_true() -> bool { true }
fn default_false() -> bool { false }
fn default_auto_save_interval() -> u16 { 3 }
