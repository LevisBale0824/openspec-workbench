import { useAgentStore } from "../stores/agent";

export function SettingsPage() {
  const { registry, activeAgent, setActive } = useAgentStore();
  const agents = registry.list();

  return (
    <div className="h-screen bg-slate-950 text-slate-200 p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-6">设置</h1>

      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">AI Agent</h2>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.name}
                onClick={() => setActive(agent.name)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeAgent?.name === agent.name
                    ? "border-sky-400 bg-sky-950"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {agent.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
