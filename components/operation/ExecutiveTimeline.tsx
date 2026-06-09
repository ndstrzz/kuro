"use client";

import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";

export type TimelineStepStatus = "done" | "active" | "waiting";

export type TimelineStep = {
  id: string;
  title: string;
  description: string;
  status: TimelineStepStatus;
};

type ExecutiveTimelineProps = {
  mission: string;
  steps: TimelineStep[];
};

export default function ExecutiveTimeline({
  mission,
  steps,
}: ExecutiveTimelineProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/45 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-white/35">
        Kuro Executive Timeline
      </p>

      <h3 className="mt-3 text-xl font-semibold text-white">Mission</h3>

      <p className="mt-2 text-sm leading-relaxed text-white/45">
        {mission}
      </p>

      <div className="mt-5 space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex gap-3 rounded-2xl border p-3 transition ${
              step.status === "active"
                ? "border-white/25 bg-white/[0.08]"
                : "border-white/10 bg-white/[0.035]"
            }`}
          >
            <div className="mt-0.5">
              {step.status === "done" && (
                <CheckCircle2 className="h-5 w-5 text-green-300" />
              )}

              {step.status === "active" && (
                <CircleDashed className="h-5 w-5 animate-spin text-white" />
              )}

              {step.status === "waiting" && (
                <Clock3 className="h-5 w-5 text-white/30" />
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-white/85">
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}