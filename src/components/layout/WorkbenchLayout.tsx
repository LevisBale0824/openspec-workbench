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

        {/* Editor Area */}
        <div className="flex-1 overflow-hidden bg-slate-950">
          <EditorArea />
        </div>

        {/* Workflow Panel */}
        {workflowPanelVisible && (
          <>
            <PanelResizeHandle
              side="right"
              currentWidth={workflowPanelWidth}
              onResize={setWorkflowPanelWidth}
            />
            <div
              className="flex-shrink-0 bg-slate-950 border-l border-slate-800 overflow-hidden"
              style={{ width: workflowPanelWidth }}
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
