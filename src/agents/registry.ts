import { AgentAdapter } from "./types";

export class AgentRegistry {
  private agents = new Map<string, AgentAdapter>();
  private activeName: string | null = null;

  register(agent: AgentAdapter): void {
    this.agents.set(agent.name, agent);
  }

  get(name: string): AgentAdapter | undefined {
    return this.agents.get(name);
  }

  list(): AgentAdapter[] {
    return Array.from(this.agents.values());
  }

  setActive(name: string): void {
    if (!this.agents.has(name)) {
      throw new Error(`Agent "${name}" is not registered`);
    }
    this.activeName = name;
  }

  getActive(): AgentAdapter | undefined {
    if (!this.activeName) return undefined;
    return this.agents.get(this.activeName);
  }

  unregister(name: string): void {
    this.agents.delete(name);
    if (this.activeName === name) {
      this.activeName = null;
    }
  }
}
