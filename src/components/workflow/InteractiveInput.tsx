interface InteractiveInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  mode: "hidden" | "ready" | "prompted";
  disabled: boolean;
}

export function InteractiveInput({ value, onChange, onSubmit, mode, disabled }: InteractiveInputProps) {
  if (mode === "hidden") return null;

  const isPrompted = mode === "prompted";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 ${
        isPrompted
          ? "border-sky-500 bg-sky-500/5 animate-pulse"
          : "border-slate-700 bg-slate-800/50"
      }`}
    >
      {isPrompted && (
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSubmit();
          }
        }}
        disabled={disabled}
        placeholder={isPrompted ? "AI 在等你回答..." : "输入消息回复 AI..."}
        className="flex-1 px-2 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-sky-400 disabled:opacity-50 placeholder:text-slate-600"
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="px-3 py-1.5 rounded-md bg-sky-500 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-400 transition-colors"
      >
        发送
      </button>
    </div>
  );
}
