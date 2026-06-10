export function WelcomeTab() {
  return (
    <div className="h-full flex items-center justify-center text-slate-600">
      <div className="text-center">
        <div className="text-5xl mb-4 opacity-30">📝</div>
        <h2 className="text-lg font-light text-slate-500 mb-2">OpenSpec Workbench</h2>
        <p className="text-sm text-slate-600">从左侧文件浏览器选择文件开始编辑</p>
        <div className="mt-6 text-xs text-slate-700 space-y-1">
          <p>Ctrl+S — 保存文件</p>
          <p>Tab — 插入缩进</p>
        </div>
      </div>
    </div>
  );
}
