mod commands;
pub mod services;

use commands::workflow::WorkflowStateStore;
use services::workflow_engine::WorkflowEngine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(WorkflowStateStore(std::sync::Mutex::new(
            WorkflowEngine::new(),
        )))
        .invoke_handler(tauri::generate_handler![
            commands::workflow::get_workflow_state,
            commands::workflow::set_phase,
            commands::workflow::advance_step,
            commands::workflow::reset_workflow,
            commands::files::scan_artifacts,
            commands::files::read_file_content,
            commands::files::write_file_content,
            commands::files::list_directory,
            commands::config::load_config,
            commands::config::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
