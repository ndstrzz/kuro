"use client";

import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Cpu,
  Globe2,
  Radio,
  ShieldCheck,
  TerminalSquare,
  XCircle,
} from "lucide-react";

export type TimelineStepStatus = "done" | "active" | "waiting";

export type TimelineStep = {
  id: string;
  title: string;
  description: string;
  status: TimelineStepStatus;
};

export type OperationLog = {
  id: string;
  time: string;
  agent: "kuro" | "research" | "planning" | "approval" | "browser";
  message: string;
  status: "running" | "done" | "error";
};

export type BrowserStatus = {
  connected: boolean;
  surface: string;
  currentAction: string;
  target: string;
  status: "waiting" | "running" | "done" | "error";
};

type ExecutiveTimelineProps = {
  mission: string;
  steps: TimelineStep[];
  logs: OperationLog[];
  browserStatus: BrowserStatus;
  elapsedSeconds: number;
  executing: boolean;
  completed: boolean;
};

export default function ExecutiveTimeline({
  mission,
  steps,
  logs,
  browserStatus,
  elapsedSeconds,
  executing,
  completed,
}: ExecutiveTimelineProps) {
  const progress = getProgress(steps);
  const elapsed = formatElapsed(elapsedSeconds);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/55 backdrop-blur-xl">
      <div className="border-b border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <Cpu className="h-4 w-4 text-white/70" />
              </div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                Kuro Executive OS
              </p>
            </div>

            <h3 className="mt-3 text-xl font-semibold text-white">Mission</h3>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
              {mission}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Status" value={completed ? "Complete" : executing ? "Running" : "Ready"} />
            <Metric label="Elapsed" value={elapsed} />
            <Metric label="Progress" value={`${progress}%`} />
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.25em] text-white/35">
              Agent Timeline
            </p>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">
              {steps.filter((step) => step.status === "done").length}/{steps.length} done
            </span>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex gap-3 rounded-2xl border p-3 transition ${
                  step.status === "active"
                    ? "border-white/25 bg-white/[0.08] shadow-[0_0_30px_rgba(255,255,255,0.06)]"
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

          <BrowserPanel browserStatus={browserStatus} />
        </section>

        <section className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.25em] text-white/35">
              Live Operation Console
            </p>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">
              <Radio className={`h-3.5 w-3.5 ${executing ? "animate-pulse text-green-300" : "text-white/35"}`} />
              {executing ? "streaming" : completed ? "completed" : "standby"}
            </div>
          </div>

          <div className="min-h-[325px] rounded-3xl border border-white/10 bg-black/70 p-4">
            {logs.length === 0 ? (
              <div className="flex h-[295px] flex-col items-center justify-center text-center">
                <TerminalSquare className="h-8 w-8 text-white/20" />
                <p className="mt-3 text-sm font-medium text-white/55">
                  Waiting for operation logs
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/30">
                  Once Kuro starts researching or executing, the agent thinking process will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-[58px_82px_1fr_22px] items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-white/30">{log.time}</span>
                    <span className="font-medium capitalize text-white/55">
                      {agentLabel(log.agent)}
                    </span>
                    <span className="leading-relaxed text-white/70">
                      {log.message}
                    </span>
                    <span className="flex justify-end pt-0.5">
                      {log.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-green-300" />
                      )}
                      {log.status === "running" && (
                        <Activity className="h-4 w-4 animate-pulse text-white/70" />
                      )}
                      {log.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-300" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function BrowserPanel({ browserStatus }: { browserStatus: BrowserStatus }) {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.25em] text-white/35">
          Browser Agent
        </p>

        <span
          className={`rounded-full px-3 py-1 text-xs ${
            browserStatus.status === "done"
              ? "bg-green-300/10 text-green-200"
              : browserStatus.status === "error"
                ? "bg-red-300/10 text-red-200"
                : browserStatus.status === "running"
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.04] text-white/35"
          }`}
        >
          {browserStatus.connected ? "connected" : "standby"}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <BrowserDetail
          icon={<Globe2 className="h-4 w-4" />}
          label="Surface"
          value={browserStatus.surface}
        />
        <BrowserDetail
          icon={<Activity className="h-4 w-4" />}
          label="Current action"
          value={browserStatus.currentAction}
        />
        <BrowserDetail
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Target"
          value={browserStatus.target}
        />
      </div>
    </div>
  );
}

function BrowserDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-black/35 px-3 py-3">
      <div className="mt-0.5 text-white/35">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/25">
          {label}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/65">{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[86px] rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white/80">{value}</p>
    </div>
  );
}

function getProgress(steps: TimelineStep[]) {
  if (steps.length === 0) return 0;

  const done = steps.filter((step) => step.status === "done").length;
  const active = steps.some((step) => step.status === "active") ? 0.5 : 0;

  return Math.min(100, Math.round(((done + active) / steps.length) * 100));
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function agentLabel(agent: OperationLog["agent"]) {
  if (agent === "kuro") return "Kuro";
  if (agent === "research") return "Research";
  if (agent === "planning") return "Planning";
  if (agent === "approval") return "Approval";
  return "Browser";
}