import { CodeIcon } from "../common/Icons";

export function WelcomeTab() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-950">
      <div className="text-center max-w-xs">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 mb-4">
          <CodeIcon size={28} className="text-slate-600" />
        </div>
        <h2 className="text-base font-medium text-slate-400 mb-1.5">
          OpenSpec Workbench
        </h2>
        <p className="text-xs text-slate-600 mb-5 leading-relaxed">
          从左侧文件浏览器选择文件开始编辑
        </p>
        <div className="space-y-1.5 text-xs text-slate-700">
          <p>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-600 font-mono text-[10px]">
              Ctrl+S
            </kbd>
            {" "}保存文件
          </p>
          <p>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-600 font-mono text-[10px]">
              Tab
            </kbd>
            {" "}插入缩进
          </p>
        </div>
      </div>
    </div>
  );
}
