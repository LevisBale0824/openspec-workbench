import { useState } from "react";
import { ProjectSelect } from "./pages/ProjectSelect";
import { WorkbenchLayout } from "./components/layout/WorkbenchLayout";
import { SettingsModal } from "./components/settings/SettingsModal";
import { OpenCodeAdapter } from "./agents/opencode";
import { ZeroAdapter } from "./agents/zero";
import { useAgentStore } from "./stores/agent";

export default function App() {
  const [projectOpened, setProjectOpened] = useState(false);
  const { initialize } = useAgentStore();

  const handleProjectSelected = () => {
    initialize(
      [new OpenCodeAdapter(), new ZeroAdapter()],
      "opencode",
    );
    setProjectOpened(true);
  };

  if (!projectOpened) {
    return <ProjectSelect onProjectSelected={handleProjectSelected} />;
  }

  return (
    <>
      <WorkbenchLayout />
      <SettingsModal />
    </>
  );
}
