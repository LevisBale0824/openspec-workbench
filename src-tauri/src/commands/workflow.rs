use crate::services::workflow_engine::{StepPhase, WorkflowState, WorkflowEngine};
use std::sync::Mutex;
use tauri::State;

pub struct WorkflowStateStore(pub Mutex<WorkflowEngine>);

#[tauri::command]
pub fn get_workflow_state(engine: State<WorkflowStateStore>) -> WorkflowState {
    engine.0.lock().unwrap().state()
}

#[tauri::command]
pub fn set_phase(phase: String, engine: State<WorkflowStateStore>) -> Result<WorkflowState, String> {
    let p = match phase.as_str() {
        "idle" => StepPhase::Idle,
        "input" => StepPhase::Input,
        "executing" => StepPhase::Executing,
        "reviewing" => StepPhase::Reviewing,
        "done" => StepPhase::Done,
        _ => return Err(format!("Unknown phase: {}", phase)),
    };
    let e = engine.0.lock().unwrap();
    e.set_phase(p);
    Ok(e.state())
}

#[tauri::command]
pub fn advance_step(engine: State<WorkflowStateStore>) -> Result<WorkflowState, String> {
    let e = engine.0.lock().unwrap();
    e.advance_step()?;
    Ok(e.state())
}

#[tauri::command]
pub fn reset_workflow(engine: State<WorkflowStateStore>) -> WorkflowState {
    let e = engine.0.lock().unwrap();
    e.reset();
    e.state()
}
