import { STEP_ORDER, StepName } from "../../stores/workflow";

const STEP_LABELS: Record<StepName, string> = { explore: "Explore", propose: "Propose", apply: "Apply", archive: "Archive" };
const STEP_ICONS: Record<StepName, string> = { explore: "🔍", propose: "📋", apply: "⚡", archive: "📦" };

interface StepNavProps {
  steps?: StepName[];
  currentStep: StepName;
}

export function StepNav({ steps = STEP_ORDER, currentStep }: StepNavProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <nav className="flex items-center gap-1 bg-slate-900 p-1.5 mx-3 my-2 rounded-lg">
      {steps.map((step, idx) => {
        const isCurrent = step === currentStep;
        const isDone = idx < currentIdx;
        return (
          <div key={step} className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded text-[10px] transition-all ${
            isCurrent ? "bg-slate-800 text-sky-400 font-semibold" : isDone ? "text-emerald-400" : "text-slate-600"
          }`}>
            <span className="text-sm">{isDone ? "✓" : STEP_ICONS[step]}</span>
            <span className="mt-0.5">{STEP_LABELS[step]}</span>
          </div>
        );
      })}
    </nav>
  );
}
