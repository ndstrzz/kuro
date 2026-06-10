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

const LOCAL_BROWSER_AGENT_URL = "http://localhost:4000";

const suggestions = [
  {
    icon: Plane,
    title: "Book Flight",
    prompt: "Find me the cheapest flight to Jakarta tomorrow",
  },
  {
    icon: Music,
    title: "Create Playlist",
    prompt: "Create a trendy K-pop Spotify playlist",
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

  const operationType = operation?.type;
  const isSpotifyOperation =
    operationType === "spotify" || operationType === "playlist";
  const isTripOperation = operationType === "trip" || operationType === "flight";

  const missionTitle =
    operation?.userPrompt || message || "Waiting for executive request";

  const actionLabel = useMemo(() => {
    if (executionComplete) return "Mission complete";
    if (executing && isSpotifyOperation) return "Creating playlist...";
    if (executing && isTripOperation) return "Opening Trip.com...";
    if (isSpotifyOperation) return "Create Playlist";
    if (isTripOperation) return "Book Flight";
    return "Approve Mission";
  }, [executionComplete, executing, isSpotifyOperation, isTripOperation]);

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
        description: isSpotifyOperation
          ? "Exa searched broadly across music trends and prepared Spotify-ready tracks."
          : isTripOperation
            ? "Flight-only Trip.com planning completed."
            : "Research plan completed.",
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
            ? isSpotifyOperation
              ? "Chrome is creating the Spotify playlist."
              : "Chrome is executing the approved travel task."
            : "Ready to open the selected external workflow.",
        status: executionComplete ? "done" : executing ? "active" : "waiting",
      },
    ];
  }, [
    operation,
    selectedRecommendation,
    executing,
    executionComplete,
    isSpotifyOperation,
    isTripOperation,
  ]);

  const pushLog = useCallback(
    (
      agent: OperationLog["agent"],
      logMessage: string,
      status: OperationLog["status"] = "running"
    ) => {
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
          message: logMessage,
          status,
        },
      ]);
    },
    []
  );

  function clearScheduledLogs() {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }

  const scheduleLog = useCallback(
    (
      delay: number,
      agent: OperationLog["agent"],
      logMessage: string,
      status: OperationLog["status"] = "running"
    ) => {
      const id = window.setTimeout(() => {
        pushLog(agent, logMessage, status);
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
    scheduleLog(900, "research", "Searching and extracting useful options.");
    scheduleLog(
      1450,
      "planning",
      "Ranking recommendations by usefulness, speed, and demo safety."
    );

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

    const nextOperation = data.operation as Operation;

    setOperation(nextOperation);
    setSelectedRecommendationId(nextOperation.recommendations[0]?.id ?? null);

    if (nextOperation.type === "spotify" || nextOperation.type === "playlist") {
      scheduleLog(
        300,
        "research",
        "Broad music research complete. Spotify-ready track seeds prepared.",
        "done"
      );
    } else if (nextOperation.type === "trip" || nextOperation.type === "flight") {
      scheduleLog(300, "research", "Flight-only Trip.com planning complete.", "done");
    } else {
      scheduleLog(300, "research", "Research plan complete.", "done");
    }

    scheduleLog(
      700,
      "planning",
      "Approval layer is ready. No external action will run without confirmation.",
      "done"
    );
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
    if (!operation || !selectedRecommendation) {
      setExecutionMessage("No recommendation selected.");
      return;
    }

    if (isSpotifyOperation) {
      await executeSpotifyPlaylist();
      return;
    }

    if (isTripOperation) {
      await executeTripFlight();
      return;
    }

    setExecutionMessage("This mission is research-only for now.");
    pushLog("kuro", "Research-only mission prepared. No browser action required.", "done");
  }

  async function executeSpotifyPlaylist() {
    if (!operation || !selectedRecommendation) return;

    const trackSeeds =
      selectedRecommendation.playlistDetails?.trackSeeds ||
      selectedRecommendation.tracks ||
      selectedRecommendation.spotifyDetails?.tracks ||
      [];

    if (!trackSeeds.length) {
      setExecutionMessage("No Spotify track seeds found for this playlist.");
      pushLog("browser", "No Spotify track seeds found for this playlist.", "error");
      return;
    }

    clearScheduledLogs();

    setExecuting(true);
    setExecutionComplete(false);
    setExecutionMessage("Creating Spotify playlist...");

    setBrowserStatus({
      connected: false,
      surface: "Spotify",
      currentAction: "Creating playlist with Spotify OAuth",
      target: "Vercel Spotify API",
      status: "running",
    });

    pushLog("approval", "Human approval received for Spotify playlist creation.", "done");
    scheduleLog(350, "browser", "Creating Spotify playlist through the Spotify API.");
    scheduleLog(900, "browser", "Preparing direct browser-to-localhost agent handoff.");
    scheduleLog(1400, "browser", `Local target: ${LOCAL_BROWSER_AGENT_URL}`);
    scheduleLog(2100, "browser", `First Exa track seed: ${trackSeeds[0]}`);

    try {
      const playlistResponse = await fetch("/api/spotify/create-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: operation.userPrompt,
          playlistName: selectedRecommendation.title,
          selectedMood:
            selectedRecommendation.playlistDetails?.mood ||
            selectedRecommendation.spotifyDetails?.mood ||
            selectedRecommendation.tag ||
            selectedRecommendation.kind ||
            "Kuro Playlist",
          trackSeeds,
          tracks: trackSeeds,
          recommendationId: selectedRecommendation.id,
          recommendationTitle: selectedRecommendation.title,
        }),
      });

      const playlistData = await playlistResponse.json();

      if (!playlistResponse.ok) {
        const loginUrl =
          playlistData.loginUrl ||
          playlistData.authUrl ||
          "/api/spotify/login";

        if (
          playlistResponse.status === 401 ||
          playlistData.needsAuth ||
          playlistData.requiresAuth
        ) {
          setExecutionMessage("Spotify login required. Redirecting...");
          window.location.href = loginUrl;
          return;
        }

        throw new Error(
          playlistData.error || "Failed to create Spotify playlist."
        );
      }

      const playlistUrl =
        playlistData.playlistUrl ||
        playlistData.url ||
        playlistData.externalUrl ||
        playlistData.playlist?.external_urls?.spotify ||
        playlistData.playlist?.url ||
        playlistData.data?.playlistUrl;

      if (!playlistUrl || typeof playlistUrl !== "string") {
        throw new Error("Spotify playlist was created, but no playlist URL was returned.");
      }

      setExecutionMessage("Playlist created. Sending task to local browser agent...");

      setBrowserStatus({
        connected: true,
        surface: "Spotify",
        currentAction: "Calling local browser agent directly from your browser",
        target: LOCAL_BROWSER_AGENT_URL,
        status: "running",
      });

      const statusOne = window.setTimeout(() => {
        setBrowserStatus({
          connected: true,
          surface: "Spotify",
          currentAction: "Opening playlist in persistent Chrome",
          target: playlistUrl,
          status: "running",
        });
      }, 900);

      const statusTwo = window.setTimeout(() => {
        setBrowserStatus({
          connected: true,
          surface: "Spotify",
          currentAction: "Searching Exa-researched tracks and pressing Add",
          target: `${trackSeeds.length} track seeds`,
          status: "running",
        });
      }, 2000);

      timeoutRefs.current.push(statusOne, statusTwo);

      const agentResponse = await fetch(
        `${LOCAL_BROWSER_AGENT_URL}/spotify/browser-add-tracks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playlistUrl,
            playlistName: selectedRecommendation.title,
            prompt: operation.userPrompt,
            selectedMood:
              selectedRecommendation.playlistDetails?.mood ||
              selectedRecommendation.spotifyDetails?.mood ||
              selectedRecommendation.tag ||
              selectedRecommendation.kind ||
              "Kuro Playlist",
            trackSeeds,
          }),
        }
      );

      const agentData = await agentResponse.json();

      if (!agentResponse.ok) {
        throw new Error(agentData.error || "Local browser agent failed.");
      }

      setExecutionMessage(agentData.message || "Spotify playlist created successfully.");
      setExecuting(false);
      setExecutionComplete(true);

      setBrowserStatus({
        connected: true,
        surface: "Spotify",
        currentAction: "Playlist created and tracks added successfully",
        target: playlistUrl,
        status: "done",
      });

      pushLog("browser", agentData.message || "Spotify playlist created successfully.", "done");
      pushLog("kuro", "Playlist mission complete.", "done");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create Spotify playlist.";

      setExecutionMessage(message);
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: "Spotify",
        currentAction: message,
        target: LOCAL_BROWSER_AGENT_URL,
        status: "error",
      });

      pushLog("browser", message, "error");
    }
  }

  async function executeTripFlight() {
    if (!selectedRecommendation) return;

    const tripUrl = selectedRecommendation.flightDetails?.tripUrl;

    if (!tripUrl) {
      setExecutionMessage("No Trip.com URL found for this option.");
      pushLog("browser", "No Trip.com URL found for this option.", "error");
      return;
    }

    clearScheduledLogs();

    setExecuting(true);
    setExecutionComplete(false);
    setExecutionMessage("Sending Trip.com task to local browser agent...");

    setBrowserStatus({
      connected: false,
      surface: "Trip.com",
      currentAction: "Calling localhost:4000 directly from your browser",
      target: "http://localhost:4000/trip/open-flight",
      status: "running",
    });

    pushLog("approval", "Human approval received for Trip.com flight workflow.", "done");
    scheduleLog(350, "browser", "Connecting to local browser agent on localhost:4000.");
    scheduleLog(900, "browser", "Opening Trip.com in persistent Chrome.");
    scheduleLog(1400, "browser", "Finding matching flight row by airline, time, route, and price.");
    scheduleLog(2000, "browser", "Clicking Select / View Details for the selected option.");

    try {
      const response = await fetch("http://localhost:4000/trip/open-flight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripUrl,
          recommendationId: selectedRecommendation.id,
          recommendationTitle: selectedRecommendation.title,
          selectedFlight: selectedRecommendation.flightDetails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Local Trip.com browser agent failed.");
      }

      setExecutionMessage(
        data.message || "Trip.com opened and matching flight selected."
      );
      setExecuting(false);
      setExecutionComplete(true);

      setBrowserStatus({
        connected: true,
        surface: "Trip.com",
        currentAction: "Matching flight selected successfully",
        target: data.openedUrl || selectedRecommendation.title,
        status: "done",
      });

      pushLog("browser", data.message || "Matching Trip.com flight selected.", "done");
      pushLog("kuro", "Trip.com selection complete. Ready for next step.", "done");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to open Trip.com with local browser agent.";

      setExecutionMessage(message);
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: "Trip.com",
        currentAction: message,
        target: "localhost:4000",
        status: "error",
      });

      pushLog("browser", message, "error");
    }
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

                      {selectedRecommendation.playlistDetails && (
                        <div className="mt-5 space-y-3">
                          <Detail label="Mood" value={selectedRecommendation.playlistDetails.mood} />
                          <Detail label="Duration" value={selectedRecommendation.playlistDetails.duration} />
                          <Detail label="Source" value={selectedRecommendation.playlistDetails.source} />
                          <Detail
                            label="Tracks"
                            value={`${selectedRecommendation.playlistDetails.trackSeeds.length} seeds`}
                            strong
                          />

                          <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                            <p className="text-xs text-white/35">Track seeds</p>
                            <div className="mt-2 space-y-1">
                              {selectedRecommendation.playlistDetails.trackSeeds
                                .slice(0, 6)
                                .map((track: string) => (
                                  <p key={track} className="text-xs text-white/65">
                                    • {track}
                                  </p>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

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
                          <Detail label="Source" value="Trip.com flights only" />
                        </div>
                      )}

                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs leading-relaxed text-white/45">
                          {isSpotifyOperation
                            ? "Kuro will create the Spotify playlist, then your browser will call localhost:4000 directly to open Chrome, search each Exa-researched track, and press Add."
                            : isTripOperation
                              ? "Kuro will open Trip.com for this flight option. It will stop before payment or final booking confirmation."
                              : "Kuro will prepare this mission safely and wait for your next instruction."}
                        </p>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={executing || executionComplete}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:bg-white/20 disabled:text-white/35"
                      >
                        {isSpotifyOperation ? (
                          <Music className="h-4 w-4" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        {actionLabel}
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