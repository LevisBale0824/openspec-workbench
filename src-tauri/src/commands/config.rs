use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    #[serde(rename = "type")]
    pub agent_type: String,
    pub cli_path: Option<String>,
    pub server_url: Option<String>,
    pub mode: Option<String>,
    pub auto_start: Option<bool>,
    pub config_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub active_agent: String,
    pub agents: HashMap<String, AgentConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut agents = HashMap::new();
        agents.insert(
            "opencode".into(),
            AgentConfig {
                agent_type: "sdk".into(),
                cli_path: None,
                server_url: None,
                mode: None,
                auto_start: Some(true),
                config_path: Some(".opencode/oh-my-opencode.json".into()),
            },
        );
        agents.insert(
            "zero".into(),
            AgentConfig {
                agent_type: "cli".into(),
                cli_path: Some("zero".into()),
                server_url: Some("http://localhost:8080".into()),
                mode: Some("server".into()),
                auto_start: None,
                config_path: None,
            },
        );
        Self {
            active_agent: "opencode".into(),
            agents,
        }
    }
}

#[command]
pub fn load_config(config_dir: String) -> Result<AppConfig, String> {
    let config_path = PathBuf::from(&config_dir).join("workbench.config.json");
    if !config_path.exists() {
        let default = AppConfig::default();
        save_config(config_dir.clone(), default.clone())?;
        return Ok(default);
    }
    let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[command]
pub fn save_config(config_dir: String, config: AppConfig) -> Result<(), String> {
    let dir = PathBuf::from(&config_dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config_path = dir.join("workbench.config.json");
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, content).map_err(|e| e.to_string())
}
