import { useState, useRef, useEffect } from "react";
import { useWorkflowStore } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { useProjectStore } from "../../stores/project";
import { ChatMessage } from "../../agents/types";

export function ChatPanel() {
  const { chatHistory, addChatMessage, currentPhase } = useWorkflowStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const { projectPath } = useProjectStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim() || !activeAgent) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput("");

    let aiContent = "";
    const aiMsg: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    addChatMessage(aiMsg);

    try {
      for await (const chunk of activeAgent.chat([...chatHistory, userMsg], projectPath)) {
        aiContent += chunk;
        // Update last message
        const { chatHistory: history } = useWorkflowStore.getState();
        const updated = [...history];
        updated[updated.length - 1] = { ...aiMsg, content: aiContent };
        useWorkflowStore.setState({ chatHistory: updated });
      }
    } catch (err) {
      const { chatHistory: history } = useWorkflowStore.getState();
      const updated = [...history];
      updated[updated.length - 1] = {
        ...aiMsg,
        content: `Error: ${err}`,
      };
      useWorkflowStore.setState({ chatHistory: updated });
    }
  };

  const isDisabled = currentPhase !== "reviewing" || !isAvailable;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-100">💬 对话纠正</span>
        {activeAgent && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700">
            {activeAgent.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-8">
            执行完成后，在这里对话修改产物
          </div>
        )}
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[90%] p-3 rounded-xl text-xs leading-relaxed ${
              msg.role === "user"
                ? "self-end bg-slate-800 border border-slate-700 text-slate-200 ml-auto"
                : "self-start bg-sky-950 border border-sky-900 text-slate-300"
            }`}
          >
            <div className="text-[10px] text-slate-500 mb-1">
              {msg.role === "user" ? "你" : "AI"}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={isDisabled}
          placeholder={
            isDisabled ? "执行完成后可对话修改..." : "输入修改意见..."
          }
          className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-sky-400 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          className="px-3 py-2 rounded-lg bg-sky-400 text-slate-900 font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </div>
  );
}
