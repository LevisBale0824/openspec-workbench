export interface AgentAdapter {
  name: string;
  type: "sdk" | "cli" | "http";

  start(): Promise<void>;
  stop(): Promise<void>;
  isAvailable(): Promise<boolean>;

  execute(req: AgentRequest): Promise<AgentResponse>;
  executeStream(req: AgentRequest): AsyncIterable<string>;
  chat(messages: ChatMessage[]): AsyncIterable<string>;

  getConfig(): Promise<AgentConfig>;
}

export interface AgentRequest {
  prompt: string;
  projectPath: string;
  workflow?: "explore" | "propose" | "apply" | "archive";
  files?: string[];
}

export interface AgentResponse {
  content: string;
  success: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Artifact {
  id: string;
  fileName: string;
  filePath: string;
  content: string;
  lastModified: number;
}

export interface AgentConfig {
  model?: string;
  provider?: string;
  [key: string]: unknown;
}
