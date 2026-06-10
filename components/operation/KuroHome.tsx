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
import type { Operation, Recommendation } from "@/types/operation";

const LOCAL_BROWSER_AGENT_URL = "http://localhost:4000";
const MINIMUM_LOADING_MS = 5200;

const suggestions = [
  {
    icon: Plane,
    title: "Book Flight",
    prompt: "Book me the cheapest flight to New York tonight",
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isFlightPrompt(prompt: string) {
  const text = prompt.toLowerCase();

  return (
    text.includes("flight") ||
    text.includes("flights") ||
    text.includes("airfare") ||
    text.includes("air ticket") ||
    text.includes("ticket to") ||
    text.includes("fly to") ||
    text.includes("book me a flight")
  );
}

export default function KuroHome() {
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
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
      ) || operation.recommendations[0] || null
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
    if (executing && isTripOperation) return "Selecting flight...";
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
          description: "Standing by.",
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
        id: "browser-search",
        title: isTripOperation ? "Travel Browser Agent" : "Research Agent",
        description: planningLoading
          ? isTripOperation
            ? "Opening Trip.com and reading live flight rows."
            : "Researching and preparing recommendation cards."
          : isTripOperation
            ? "Live Trip.com flight options retrieved."
            : "Research completed.",
        status: planningLoading ? "active" : "done",
      },
      {
        id: "ranking",
        title: "Ranking Agent",
        description: planningLoading
          ? "Ranking options by price, timing, and convenience."
          : selectedRecommendation
            ? `Selected option: ${selectedRecommendation.title}`
            : "Recommendation cards prepared.",
        status: planningLoading ? "waiting" : executing || executionComplete ? "done" : "active",
      },
      {
        id: "approval",
        title: "Approval Layer",
        description: executionComplete
          ? "Human approval received and recorded."
          : executing
            ? "Approval received. Executing safely."
            : planningLoading
              ? "Waiting for ranked options."
              : "Waiting for approval before browser action.",
        status: executionComplete || executing ? "done" : planningLoading ? "waiting" : "active",
      },
      {
        id: "execution",
        title: "Browser Execution",
        description: executionComplete
          ? "Browser handoff completed."
          : executing
            ? isSpotifyOperation
              ? "Chrome is creating the Spotify playlist."
              : "Chrome is selecting the matching Trip.com flight."
            : "Ready to execute selected option.",
        status: executionComplete ? "done" : executing ? "active" : "waiting",
      },
    ];
  }, [
    operation,
    planningLoading,
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

    const prompt = message.trim();

    setOperation(null);
    setSelectedRecommendationId(null);
    setPlanningLoading(false);
    setExecuting(false);
    setExecutionComplete(false);
    setExecutionMessage("");
    setBrowserStatus(emptyBrowserStatus);
    setElapsedSeconds(0);
    setLogs([]);

    pushLog("kuro", "Executive request received.", "done");

    if (isFlightPrompt(prompt)) {
      const startedAt = Date.now();

      setPlanningLoading(true);
      setExecutionMessage("Kuro is retrieving live Trip.com flight options...");

      setOperation({
        id: `operation-${Date.now()}`,
        userPrompt: prompt,
        type: "trip",
        recommendations: [],
      });

      setBrowserStatus({
        connected: true,
        surface: "Trip.com",
        currentAction: "Opening live Trip.com flight search",
        target: LOCAL_BROWSER_AGENT_URL,
        status: "running",
      });

      pushLog("planning", "Detected this as a flight booking request.", "done");
      scheduleLog(400, "browser", "Opening Trip.com with the local browser agent.");
      scheduleLog(1300, "browser", "Reading visible airline, time, terminal, and price rows.");
      scheduleLog(2500, "planning", "Ranking live options by cheapest, balanced, and convenient.");
      scheduleLog(3800, "approval", "Preparing approval-ready flight cards.");

      try {
        const response = await fetch(`${LOCAL_BROWSER_AGENT_URL}/trip/search-flights`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        const data = await response.json();
        const elapsed = Date.now() - startedAt;

        if (elapsed < MINIMUM_LOADING_MS) {
          await sleep(MINIMUM_LOADING_MS - elapsed);
        }

        if (!response.ok) {
          throw new Error(data.error || "Failed to retrieve live Trip.com flights.");
        }

        const recommendations: Recommendation[] = data.flights.map(
          (flight: any, index: number) => ({
            id: `trip-live-${index + 1}`,
            kind: flight.tag,
            title: flight.title,
            subtitle: `${flight.route} · ${flight.price}`,
            description: flight.description,
            metadata: [
              flight.price,
              `${flight.departureTime} → ${flight.arrivalTime}`,
              flight.airline,
              flight.stops,
            ],
            tag: flight.tag,
            flightDetails: {
              price: flight.price,
              route: flight.route,
              airline: flight.airline,
              departureTime: flight.departureTime,
              arrivalTime: flight.arrivalTime,
              departureTerminal: flight.departureTerminal,
              arrivalTerminal: flight.arrivalTerminal,
              duration: flight.duration,
              stops: flight.stops,
              tripUrl: flight.tripUrl,
            },
          })
        );

        const nextOperation: Operation = {
          id: `operation-${Date.now()}`,
          userPrompt: prompt,
          type: "trip",
          recommendations,
        };

        setOperation(nextOperation);
        setSelectedRecommendationId(nextOperation.recommendations[0]?.id ?? null);
        setPlanningLoading(false);
        setExecutionMessage("");

        setBrowserStatus({
          connected: true,
          surface: "Trip.com",
          currentAction: `Retrieved ${recommendations.length} live flight options`,
          target: data.tripUrl,
          status: "done",
        });

        pushLog("browser", data.message || "Live Trip.com options retrieved.", "done");
        pushLog("planning", "Flight cards prepared with live price, time, route, and airline.", "done");
        return;
      } catch (error) {
        const elapsed = Date.now() - startedAt;

        if (elapsed < MINIMUM_LOADING_MS) {
          await sleep(MINIMUM_LOADING_MS - elapsed);
        }

        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to retrieve live Trip.com flights.";

        setPlanningLoading(false);
        setExecutionMessage(errorMessage);

        setBrowserStatus({
          connected: false,
          surface: "Trip.com",
          currentAction: errorMessage,
          target: LOCAL_BROWSER_AGENT_URL,
          status: "error",
        });

        pushLog("browser", errorMessage, "error");
        return;
      }
    }

    setPlanningLoading(true);
    setExecutionMessage("Kuro is preparing recommendations...");

    scheduleLog(350, "research", "Activating research agent.");
    scheduleLog(900, "research", "Searching and extracting useful options.");
    scheduleLog(1450, "planning", "Ranking recommendations by usefulness, speed, and demo safety.");

    try {
      const response = await fetch("/api/operations/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create operation.");
      }

      const nextOperation = data.operation as Operation;

      setOperation(nextOperation);
      setSelectedRecommendationId(nextOperation.recommendations[0]?.id ?? null);
      setExecutionMessage("");
      setPlanningLoading(false);

      if (nextOperation.type === "spotify" || nextOperation.type === "playlist") {
        scheduleLog(
          300,
          "research",
          "Broad music research complete. Spotify-ready track seeds prepared.",
          "done"
        );
      } else {
        scheduleLog(300, "research", "Research plan complete.", "done");
      }

      scheduleLog(
        700,
        "planning",
        "Approval layer is ready. No external action will run without confirmation.",
        "done"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create operation.";

      setPlanningLoading(false);
      setExecutionMessage(errorMessage);
      pushLog("kuro", errorMessage, "error");
    }
  }

  function handleReset() {
    clearScheduledLogs();

    setMessage("");
    setOperation(null);
    setSelectedRecommendationId(null);
    setPlanningLoading(false);
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
    scheduleLog(2100, "browser", `First track seed: ${trackSeeds[0]}`);

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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create Spotify playlist.";

      setExecutionMessage(errorMessage);
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: "Spotify",
        currentAction: errorMessage,
        target: LOCAL_BROWSER_AGENT_URL,
        status: "error",
      });

      pushLog("browser", errorMessage, "error");
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
      target: `${LOCAL_BROWSER_AGENT_URL}/trip/open-flight`,
      status: "running",
    });

    pushLog("approval", "Human approval received for Trip.com flight workflow.", "done");
    scheduleLog(350, "browser", "Opening Trip.com in persistent Chrome.");
    scheduleLog(1000, "browser", "Matching airline, price, route, and timing.");
    scheduleLog(1700, "browser", "Clicking Select / View Details for the selected option.");

    try {
      const response = await fetch(`${LOCAL_BROWSER_AGENT_URL}/trip/open-flight`, {
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to open Trip.com with local browser agent.";

      setExecutionMessage(errorMessage);
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: "Trip.com",
        currentAction: errorMessage,
        target: LOCAL_BROWSER_AGENT_URL,
        status: "error",
      });

      pushLog("browser", errorMessage, "error");
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
                  status={planningLoading || executing ? "executing" : executionComplete ? "idle" : "thinking"}
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
                      {planningLoading
                        ? "Searching"
                        : executionComplete
                          ? "Completed"
                          : executing
                            ? "Executing"
                            : "Ready"}
                    </span>
                  </div>

                  {planningLoading ? (
                    <TravelLoadingPanel />
                  ) : (
                    <RecommendationGrid
                      recommendations={operation.recommendations}
                      selectedId={selectedRecommendationId}
                      onSelect={setSelectedRecommendationId}
                    />
                  )}
                </section>

                <aside className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Operating model
                  </p>

                  {planningLoading ? (
                    <>
                      <h3 className="mt-3 text-2xl font-semibold">
                        Kuro Travel Agent is working
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/45">
                        Reading live Trip.com results and preparing 3 ranked options with real price, time, airline, and route.
                      </p>
                      <div className="mt-5 space-y-3">
                        <LoadingStep text="Parsing destination and origin" done />
                        <LoadingStep text="Opening Trip.com live search" done />
                        <LoadingStep text="Reading visible flight rows" active />
                        <LoadingStep text="Ranking by price and timing" />
                      </div>
                    </>
                  ) : !selectedRecommendation ? (
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
                            value={`${selectedRecommendation.flightDetails.departureTime} → ${selectedRecommendation.flightDetails.arrivalTime || ""}`}
                          />
                          <Detail
                            label="Stops"
                            value={selectedRecommendation.flightDetails.stops || "Live result"}
                          />
                          <Detail label="Source" value="Trip.com live scrape" />
                        </div>
                      )}

                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs leading-relaxed text-white/45">
                          {isSpotifyOperation
                            ? "Kuro will create the Spotify playlist, then call localhost:4000 to open Chrome, search each track, and press Add."
                            : isTripOperation
                              ? "Kuro will open Trip.com, match this exact live flight row, and click Select / View Details. It will stop before payment."
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
                  executing={planningLoading || executing}
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
              disabled={planningLoading || executing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function TravelLoadingPanel() {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>

        <div>
          <h3 className="text-xl font-semibold">Searching live Trip.com results</h3>
          <p className="mt-1 text-sm text-white/45">
            Kuro is retrieving real airline, time, route, and price details.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <SkeletonFlightCard />
        <SkeletonFlightCard />
        <SkeletonFlightCard />
      </div>
    </div>
  );
}

function SkeletonFlightCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="h-7 w-24 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

function LoadingStep({
  text,
  done = false,
  active = false,
}: {
  text: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          done ? "bg-green-300" : active ? "animate-pulse bg-white" : "bg-white/20"
        }`}
      />
      <span className={done || active ? "text-white/75" : "text-white/35"}>
        {text}
      </span>
    </div>
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