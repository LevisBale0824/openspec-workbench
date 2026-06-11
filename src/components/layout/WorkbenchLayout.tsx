import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { EditorArea } from "../editor/EditorArea";
import { WorkflowPanel } from "../workflow/WorkflowPanel";
import { useUIStore } from "../../stores/ui";

export function WorkbenchLayout() {
  const {
    sidebarVisible,
    sidebarWidth,
    setSidebarWidth,
    editorVisible,
    workflowPanelVisible,
    workflowPanelWidth,
    setWorkflowPanelWidth,
  } = useUIStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Left Sidebar */}
        {sidebarVisible && (
          <>
            <div
              className="flex-shrink-0 bg-slate-950 border-r border-slate-800 overflow-hidden"
              style={{ width: sidebarWidth }}
            >
              <Sidebar />
            </div>
            <PanelResizeHandle
              side="left"
              currentWidth={sidebarWidth}
              onResize={setSidebarWidth}
            />
          </>
        )}

        {/* Editor Area — hidden when editorVisible is false */}
        {editorVisible && (
          <div className="flex-1 overflow-hidden bg-slate-950">
            <EditorArea />
          </div>
        )}

        {/* Workflow Panel — expands to fill when editor hidden */}
        {workflowPanelVisible && (
          <>
            {editorVisible && (
              <PanelResizeHandle
                side="right"
                currentWidth={workflowPanelWidth}
                onResize={setWorkflowPanelWidth}
              />
            )}
            <div
              className={`bg-slate-950 border-l border-slate-800 overflow-hidden ${
                editorVisible ? "flex-shrink-0" : "flex-1"
              }`}
              style={editorVisible ? { width: workflowPanelWidth } : undefined}
            >
              <WorkflowPanel />
            </div>
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
