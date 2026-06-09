"use client";

const agents = [
  "Kuro Core",
  "Research Agent",
  "Browser Agent",
  "Memory Agent",
  "Approval Layer",
  "Execution Guard",
];

export default function AgentNetworkCard() {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
      <p className="text-sm text-white/40">Agent Network</p>
      <h3 className="mt-2 text-2xl font-semibold">Operating system online</h3>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {agents.map((agent, index) => (
          <div
            key={agent}
            className="rounded-3xl border border-white/10 bg-black/35 p-4"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="h-2 w-2 rounded-full bg-white/70 shadow-[0_0_14px_rgba(255,255,255,0.8)]" />
              <span className="text-xs text-white/25">0{index + 1}</span>
            </div>
            <p className="text-sm font-medium text-white/80">{agent}</p>
            <p className="mt-1 text-xs text-white/35">standing by</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/35 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-white/30">
          Safety
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Kuro will always ask for approval before booking, purchasing, sending,
          or submitting anything.
        </p>
      </div>
    </aside>
  );
}