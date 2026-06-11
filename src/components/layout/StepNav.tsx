import { STEP_ORDER, StepName } from "../../stores/workflow";
import {
  CompassIcon,
  FileTextIcon,
  LightningIcon,
  ArchiveIcon,
  CheckIcon,
} from "../common/Icons";

const STEP_CONFIG: Record<
  StepName,
  { label: string; icon: typeof CompassIcon }
> = {
  explore: { label: "Explore", icon: CompassIcon },
  propose: { label: "Propose", icon: FileTextIcon },
  apply: { label: "Apply", icon: LightningIcon },
  archive: { label: "Archive", icon: ArchiveIcon },
};

interface StepNavProps {
  steps?: StepName[];
  currentStep: StepName;
}

export function StepNav({ steps = STEP_ORDER, currentStep }: StepNavProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <nav className="px-4 py-3 flex-shrink-0">
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const isCurrent = step === currentStep;
          const isDone = idx < currentIdx;
          const isLast = idx === steps.length - 1;
          const { label, icon: StepIcon } = STEP_CONFIG[step];

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isCurrent
                        ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/50"
                        : "bg-slate-800 text-slate-600"
                  }`}
                >
                  {isDone ? (
                    <CheckIcon size={14} />
                  ) : (
                    <StepIcon size={14} />
                  )}
                </div>
                <span
                  className={`mt-1 text-[10px] transition-colors duration-300 ${
                    isDone
                      ? "text-emerald-500"
                      : isCurrent
                        ? "text-sky-400 font-medium"
                        : "text-slate-600"
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-px mx-1 -mt-4">
                  <div
                    className={`h-full transition-colors duration-300 rounded ${
                      isDone ? "bg-emerald-500/50" : "bg-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
