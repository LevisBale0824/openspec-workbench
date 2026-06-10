import { useEditorStore } from "../../stores/editor";
import { EditorTabBar } from "./EditorTabBar";
import { EditorContent } from "./EditorContent";
import { WelcomeTab } from "./WelcomeTab";

export function EditorArea() {
  const { openFiles, activeFilePath } = useEditorStore();
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  if (openFiles.length === 0) {
    return <WelcomeTab />;
  }

  return (
    <div className="h-full flex flex-col">
      <EditorTabBar />
      <div className="flex-1 overflow-hidden">
        {activeFile ? <EditorContent file={activeFile} /> : <WelcomeTab />}
      </div>
    </div>
  );
}
