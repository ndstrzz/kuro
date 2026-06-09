"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarDays,
  Compass,
  ExternalLink,
  Music,
  Plane,
  RotateCcw,
  Search,
} from "lucide-react";
import KuroMascot from "@/components/mascot/KuroMascot";
import ExecutiveTimeline, {
  type BrowserStatus,
  type OperationLog,
  type TimelineStep,
} from "@/components/operation/ExecutiveTimeline";
import AgentNetworkCard from "@/components/cards/AgentNetworkCard";
import RecommendationGrid from "@/components/recommendations/RecommendationGrid";
import type { Operation } from "@/types/operation";

const suggestions = [
  {
    icon: Plane,
    title: "Book Flight",
    prompt: "Find me the cheapest flight to Jakarta tomorrow",
  },
  {
    icon: Music,
    title: "Create Playlist",
    prompt: "Create a calm Spotify playlist for my seminar",
  },
  {
    icon: CalendarDays,
    title: "Plan Schedule",
    prompt: "Help me plan my day tomorrow",
  },
  {
    icon: Search,
    title: "Research",
    prompt: "Research the best tools for AI agents",
  },
];

const emptyBrowserStatus: BrowserStatus = {
  connected: false,
  surface: "Waiting for approval",
  currentAction: "No browser action started yet",
  target: "Not connected",
  status: "waiting",
};

export default function KuroHome() {
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionComplete, setExecutionComplete] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>(emptyBrowserStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timeoutRefs = useRef<number[]>([]);

  const selectedRecommendation = useMemo(() => {
    if (!operation) return null;

    return (
      operation.recommendations.find(
        (item) => item.id === selectedRecommendationId
      ) || operation.recommendations[0]
    );
  }, [operation, selectedRecommendationId]);

  const missionTitle = operation?.userPrompt || message || "Waiting for executive request";

  const timelineSteps: TimelineStep[] = useMemo(() => {
    if (!operation) {
      return [
        {
          id: "intake",
          title: "Request intake",
          description: "Waiting for your instruction.",
          status: "active",
        },
        {
          id: "research",
          title: "Research Agent",
          description: "Standing by for Exa research.",
          status: "waiting",
        },
        {
          id: "planning",
          title: "Planning Agent",
          description: "Waiting to compare recommendations.",
          status: "waiting",
        },
        {
          id: "browser",
          title: "Browser Agent",
          description: "Chrome handoff has not started.",
          status: "waiting",
        },
      ];
    }

    return [
      {
        id: "intake",
        title: "Request intake",
        description: "Kuro received and understood the objective.",
        status: "done",
      },
      {
        id: "research",
        title: "Research Agent",
        description: "Exa research and recommendation generation completed.",
        status: "done",
      },
      {
        id: "planning",
        title: "Planning Agent",
        description: selectedRecommendation
          ? `Selected option: ${selectedRecommendation.title}`
          : "Comparing available recommendations.",
        status: executing || executionComplete ? "done" : "active",
      },
      {
        id: "approval",
        title: "Approval Layer",
        description: executionComplete
          ? "Human approval received and recorded."
          : executing
            ? "Approval received. Executing safely."
            : "Waiting for approval before browser action.",
        status: executionComplete || executing ? "done" : "active",
      },
      {
        id: "browser",
        title: "Browser Agent",
        description: executionComplete
          ? "Browser handoff completed."
          : executing
            ? "Chrome is executing the approved task."
            : "Ready to open the selected external workflow.",
        status: executionComplete ? "done" : executing ? "active" : "waiting",
      },
    ];
  }, [operation, selectedRecommendation, executing, executionComplete]);

  const pushLog = useCallback((agent: OperationLog["agent"], message: string, status: OperationLog["status"] = "running") => {
    setLogs((current) => [
      ...current.slice(-14),
      {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        agent,
        message,
        status,
      },
    ]);
  }, []);

  function clearScheduledLogs() {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }

  const scheduleLog = useCallback(
    (
      delay: number,
      agent: OperationLog["agent"],
      message: string,
      status: OperationLog["status"] = "running"
    ) => {
      const id = window.setTimeout(() => {
        pushLog(agent, message, status);
      }, delay);

      timeoutRefs.current.push(id);
    },
    [pushLog]
  );

  useEffect(() => {
    return () => clearScheduledLogs();
  }, []);

  useEffect(() => {
    if (!operation) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [operation]);

  async function handleSubmit() {
    if (!message.trim()) return;

    clearScheduledLogs();

    setOperation(null);
    setSelectedRecommendationId(null);
    setExecuting(false);
    setExecutionComplete(false);
    setExecutionMessage("");
    setBrowserStatus(emptyBrowserStatus);
    setElapsedSeconds(0);
    setLogs([]);

    pushLog("kuro", "Executive request received.", "done");
    scheduleLog(350, "research", "Activating Exa research agent.");
    scheduleLog(900, "research", "Searching live sources and extracting useful options.");
    scheduleLog(1450, "planning", "Ranking recommendations by usefulness, speed, and demo safety.");

    const response = await fetch("/api/operations/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: message }),
    });

    const data = await response.json();

    if (!response.ok) {
      pushLog("kuro", data.error || "Failed to create operation.", "error");
      setExecutionMessage(data.error || "Failed to create operation.");
      return;
    }

    setOperation(data.operation);
    setSelectedRecommendationId(data.operation.recommendations[0]?.id ?? null);

    scheduleLog(300, "research", "Research complete. Recommendation cards prepared.", "done");
    scheduleLog(700, "planning", "Approval layer is ready. No external action will run without confirmation.", "done");
  }

  function handleReset() {
    clearScheduledLogs();

    setMessage("");
    setOperation(null);
    setSelectedRecommendationId(null);
    setExecuting(false);
    setExecutionComplete(false);
    setExecutionMessage("");
    setLogs([]);
    setBrowserStatus(emptyBrowserStatus);
    setElapsedSeconds(0);
  }

  async function handleApprove() {
    const tripUrl = selectedRecommendation?.flightDetails?.tripUrl;

    if (!tripUrl) {
      setExecutionMessage("No Trip.com URL found for this option.");
      pushLog("browser", "No Trip.com URL found for this option.", "error");
      return;
    }

    clearScheduledLogs();

    setExecuting(true);
    setExecutionComplete(false);
    setExecutionMessage("Preparing browser handoff...");

    setBrowserStatus({
      connected: false,
      surface: "Chrome",
      currentAction: "Preparing local browser agent",
      target: "localhost:4000",
      status: "running",
    });

    pushLog("approval", "Human approval received.", "done");
    scheduleLog(350, "browser", "Connecting to local browser agent on localhost:4000.");
    scheduleLog(900, "browser", "Launching persistent Google Chrome profile.");
    scheduleLog(1400, "browser", "Opening the exact selected Trip.com URL.");
    scheduleLog(2000, "browser", "Kuro will stop before payment or final booking confirmation.", "running");

    const browserStatusOne = window.setTimeout(() => {
      setBrowserStatus({
        connected: true,
        surface: "Trip.com",
        currentAction: "Opening selected flight option",
        target: "Selected recommendation URL",
        status: "running",
      });
    }, 900);

    const browserStatusTwo = window.setTimeout(() => {
      setBrowserStatus({
        connected: true,
        surface: "Trip.com",
        currentAction: "Preparing passenger workflow",
        target: selectedRecommendation.title,
        status: "running",
      });
    }, 1900);

    timeoutRefs.current.push(browserStatusOne, browserStatusTwo);

    const response = await fetch("/api/operations/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripUrl,
        recommendationId: selectedRecommendation.id,
        recommendationTitle: selectedRecommendation.title,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setExecutionMessage(data.error || "Failed to open Trip.com.");
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: "Browser Agent",
        currentAction: data.error || "Failed to open Trip.com.",
        target: "localhost:4000",
        status: "error",
      });

      pushLog("browser", data.error || "Browser handoff failed.", "error");
      return;
    }

    setExecutionMessage(data.message || "Trip.com opened successfully.");
    setExecuting(false);
    setExecutionComplete(true);

    setBrowserStatus({
      connected: true,
      surface: "Trip.com",
      currentAction: "Selected Trip.com option opened successfully",
      target: data.openedUrl || selectedRecommendation.title,
      status: "done",
    });

    pushLog("browser", "Selected Trip.com option opened successfully.", "done");
    pushLog("kuro", "Mission handoff complete. Awaiting human review before payment.", "done");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.13),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,black_82%)]" />

      <header className="fixed left-7 top-6 z-30 flex items-center gap-2">
        <img
          src="/mascot/kuro_waving.gif"
          alt="kuro"
          className="h-8 w-8 object-contain"
        />
        <span className="text-lg font-bold tracking-tight">kuro</span>
      </header>

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-24">
        {!operation ? (
          <>
            <KuroMascot status="idle" />

            <div className="mt-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
                Good evening, Andy.
              </h1>
              <p className="mt-3 text-sm text-white/45 md:text-base">
                I can research, recommend, ask for approval, then execute safely.
              </p>
            </div>

            <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
              {suggestions.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.title}
                    onClick={() => setMessage(item.prompt)}
                    className="group rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <Icon className="mb-5 h-5 w-5 text-white/45 transition group-hover:text-white" />
                    <p className="text-sm font-medium text-white/80">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/35">
                      {item.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid w-full max-w-7xl gap-5 xl:grid-cols-[1fr_380px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <KuroMascot
                  status={executing ? "executing" : executionComplete ? "idle" : "thinking"}
                  small
                />

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/45 transition hover:border-white/30 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  New task
                </button>
              </div>

              <div className="mt-4 text-center">
                <p className="text-sm text-white/40">Current request</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  “{operation.userPrompt}”
                </h2>
              </div>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_340px]">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                      Recommendations
                    </p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/45">
                      {executionComplete ? "Completed" : executing ? "Executing" : "Ready"}
                    </span>
                  </div>

                  <RecommendationGrid
                    recommendations={operation.recommendations}
                    selectedId={selectedRecommendationId}
                    onSelect={setSelectedRecommendationId}
                  />
                </section>

                <aside className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Operating model
                  </p>

                  {!selectedRecommendation ? (
                    <>
                      <h3 className="mt-3 text-2xl font-semibold">
                        Research. Recommend. Approve. Execute.
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/45">
                        Kuro prepares choices first, then asks for approval before any browser action.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="mt-3 text-2xl font-semibold">
                        {selectedRecommendation.title}
                      </h3>

                      <p className="mt-3 text-sm leading-relaxed text-white/45">
                        {selectedRecommendation.description}
                      </p>

                      {selectedRecommendation.flightDetails && (
                        <div className="mt-5 space-y-3">
                          <Detail
                            label="Price"
                            value={selectedRecommendation.flightDetails.price}
                            strong
                          />
                          <Detail
                            label="Route"
                            value={selectedRecommendation.flightDetails.route}
                          />
                          <Detail
                            label="Flight"
                            value={selectedRecommendation.flightDetails.airline}
                          />
                          <Detail
                            label="Time"
                            value={selectedRecommendation.flightDetails.departureTime}
                          />
                          <Detail label="Source" value="Trip.com only" />
                        </div>
                      )}

                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs leading-relaxed text-white/45">
                          Kuro will open Trip.com for this option. It will stop before payment or final booking confirmation.
                        </p>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={executing || executionComplete}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:bg-white/20 disabled:text-white/35"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {executionComplete
                          ? "Browser handoff complete"
                          : executing
                            ? "Executing with browser agent..."
                            : "Approve and continue"}
                      </button>

                      {executionMessage && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/50">
                          {executionMessage}
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>

              <div className="mt-5">
                <ExecutiveTimeline
                  mission={missionTitle}
                  steps={timelineSteps}
                  logs={logs}
                  browserStatus={browserStatus}
                  elapsedSeconds={elapsedSeconds}
                  executing={executing}
                  completed={executionComplete}
                />
              </div>
            </div>

            <AgentNetworkCard />
          </div>
        )}

        <div className="mt-8 w-full max-w-3xl rounded-full border border-white/35 bg-black/50 px-3 py-2 shadow-[0_0_50px_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Compass className="ml-2 h-4 w-4 text-white/35" />
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
              }}
              placeholder="type your message here..."
              className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              onClick={handleSubmit}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Detail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs">
      <span className="text-white/35">{label}</span>
      <span
        className={`max-w-[60%] text-right ${
          strong ? "text-lg font-bold text-white" : "font-medium text-white/70"
        }`}
      >
        {value}
      </span>
    </div>
  );
}