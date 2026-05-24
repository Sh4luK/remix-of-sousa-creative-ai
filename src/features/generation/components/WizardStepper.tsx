import { Check } from "lucide-react";

interface StepperProps {
  step: 1 | 2 | 3;
}

export function WizardStepper({ step }: StepperProps) {
  const steps = [
    { n: 1, label: "Produto" },
    { n: 2, label: "Preço" },
    { n: 3, label: "Estilo" },
  ];
  return (
    <div className="flex items-center gap-2 mb-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
      {steps.map((s, i) => {
        const isDone = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition",
                  isDone ? "bg-emerald-500 text-white" :
                  isActive ? "bg-sky-500 text-white shadow-md shadow-sky-200" : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span className={["text-sm font-medium hidden sm:inline", isActive ? "text-slate-900" : "text-slate-500"].join(" ")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={["flex-1 h-1 mx-3 rounded-full", step > s.n ? "bg-emerald-500" : "bg-slate-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
