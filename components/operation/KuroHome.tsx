"use client";

import { useEffect, useMemo, useState } from "react";
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
import OperationTimeline from "@/components/timeline/OperationTimeline";
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

type SpotifyResult = {
  playlistName: string;
  playlistUrl: string;
  tracksAdded: number;
};

type PendingSpotifyTask = {
  prompt: string;
  playlistName: string;
  selectedMood: string;
};

export default function KuroHome() {
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [spotifyResult, setSpotifyResult] = useState<SpotifyResult | null>(null);

  const selectedRecommendation = useMemo(() => {
    if (!operation) return null;

    return (
      operation.recommendations.find(
        (item) => item.id === selectedRecommendationId,
      ) || operation.recommendations[0]
    );
  }, [operation, selectedRecommendationId]);

  useEffect(() => {
    async function continueSpotifyAfterLogin() {
      const params = new URLSearchParams(window.location.search);
      const spotifyStatus = params.get("spotify");

      if (spotifyStatus !== "connected") {
        if (spotifyStatus === "denied") {
          setExecutionMessage("Spotify connection was denied.");
          window.history.replaceState({}, "", "/");
        }

        if (spotifyStatus === "error" || spotifyStatus === "invalid_state") {
          setExecutionMessage("Spotify connection failed. Please try again.");
          window.history.replaceState({}, "", "/");
        }

        return;
      }

      const pendingTask = localStorage.getItem("kuro_pending_spotify_task");

      window.history.replaceState({}, "", "/");

      if (!pendingTask) {
        setExecutionMessage("Spotify connected. Please approve the playlist again.");
        return;
      }

      try {
        const parsedTask = JSON.parse(pendingTask) as PendingSpotifyTask;

        localStorage.removeItem("kuro_pending_spotify_task");

        setExecuting(true);
        setCompleted(false);
        setSpotifyResult(null);
        setExecutionMessage("Spotify connected. Creating playlist now...");

        const response = await fetch("/api/spotify/create-playlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsedTask),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create playlist.");
        }

        setSpotifyResult({
          playlistName: data.playlistName,
          playlistUrl: data.playlistUrl,
          tracksAdded: data.tracksAdded,
        });

        setExecutionMessage("Playlist created successfully.");
        setCompleted(true);
      } catch (error) {
        console.error(error);
        setExecutionMessage("Spotify connected, but playlist creation failed.");
      } finally {
        setExecuting(false);
      }
    }

    continueSpotifyAfterLogin();
  }, []);

  async function handleSubmit() {
    if (!message.trim()) return;

    setOperation(null);
    setSelectedRecommendationId(null);
    setExecuting(false);
    setCompleted(false);
    setExecutionMessage("");
    setSpotifyResult(null);

    const response = await fetch("/api/operations/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: message }),
    });

    const data = await response.json();

    if (!response.ok) {
      setExecutionMessage(data.error || "Failed to create operation.");
      return;
    }

    setOperation(data.operation);
    setSelectedRecommendationId(data.operation.recommendations[0]?.id ?? null);
  }

  function handleReset() {
    setMessage("");
    setOperation(null);
    setSelectedRecommendationId(null);
    setExecuting(false);
    setCompleted(false);
    setExecutionMessage("");
    setSpotifyResult(null);
    localStorage.removeItem("kuro_pending_spotify_task");
  }

  async function handleApprove() {
    if (!operation || !selectedRecommendation) {
      setExecutionMessage("Please select an option first.");
      return;
    }

    if (operation.type === "spotify") {
      await handleSpotifyApprove();
      return;
    }

    await handleTripApprove();
  }

  async function handleTripApprove() {
    const tripUrl =
      selectedRecommendation?.flightDetails?.tripUrl ||
      selectedRecommendation?.sourceUrl;

    if (!selectedRecommendation) {
      setExecutionMessage("Please select a Trip.com option first.");
      return;
    }

    if (!tripUrl) {
      setExecutionMessage("No Trip.com URL found for this option.");
      return;
    }

    setExecuting(true);
    setCompleted(false);
    setExecutionMessage("Opening the selected Trip.com option...");

    const response = await fetch("/api/operations/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recommendationId: selectedRecommendation.id,
        recommendationTitle: selectedRecommendation.title,
        tripUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setExecutionMessage(data.error || "Failed to open Trip.com.");
      setExecuting(false);
      return;
    }

    setExecutionMessage(data.message || "Trip.com opened successfully.");
    setExecuting(false);
    setCompleted(true);
  }

  async function handleSpotifyApprove() {
    if (!operation || !selectedRecommendation?.spotifyDetails) {
      setExecutionMessage("Please select a Spotify playlist option first.");
      return;
    }

    setExecuting(true);
    setCompleted(false);
    setSpotifyResult(null);
    setExecutionMessage("Connecting Spotify and creating playlist...");

    try {
      const spotifyTask: PendingSpotifyTask = {
        prompt: operation.userPrompt,
        playlistName: selectedRecommendation.spotifyDetails.playlistName,
        selectedMood: selectedRecommendation.spotifyDetails.mood,
      };

      const response = await fetch("/api/spotify/create-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(spotifyTask),
      });

      const data = await response.json();

      if (response.status === 401 && data.needsAuth && data.authUrl) {
        localStorage.setItem(
          "kuro_pending_spotify_task",
          JSON.stringify(spotifyTask),
        );

        setExecutionMessage("Redirecting to Spotify login...");
        window.location.href = data.authUrl;
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create playlist.");
      }

      setSpotifyResult({
        playlistName: data.playlistName,
        playlistUrl: data.playlistUrl,
        tracksAdded: data.tracksAdded,
      });

      setExecutionMessage("Playlist created successfully.");
      setCompleted(true);
    } catch (error) {
      console.error(error);
      setExecutionMessage("Could not create the Spotify playlist. Please try again.");
    } finally {
      setExecuting(false);
    }
  }

  const approveLabel = useMemo(() => {
    if (executing && operation?.type === "spotify") return "Creating playlist...";
    if (executing && operation?.type === "flight") return "Opening Trip.com...";
    if (operation?.type === "spotify") return "Approve and create Spotify playlist";
    return "Approve and continue";
  }, [executing, operation?.type]);

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
            <KuroMascot status={executing ? "executing" : "idle"} />

            <div className="mt-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
                Good evening, Andy.
              </h1>
              <p className="mt-3 text-sm text-white/45 md:text-base">
                I can research, recommend, ask for approval, then execute safely.
              </p>

              {executionMessage && (
                <div className="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
                  {executionMessage}
                </div>
              )}

              {spotifyResult && (
                <div className="mx-auto mt-5 max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Operation completed
                  </p>

                  <h3 className="mt-3 text-xl font-semibold">
                    {spotifyResult.playlistName}
                  </h3>

                  <p className="mt-2 text-sm text-white/45">
                    {spotifyResult.tracksAdded} tracks added successfully.
                  </p>

                  <a
                    href={spotifyResult.playlistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]"
                  >
                    Open Spotify
                  </a>
                </div>
              )}
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
                    <p className="text-sm font-medium text-white/80">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/35">
                      {item.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid w-full max-w-7xl gap-5 xl:grid-cols-[1fr_360px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <KuroMascot status={executing ? "executing" : "thinking"} small />

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
                      {executing ? "Approved" : "3 prepared"}
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
                        Kuro prepares choices first, then asks for approval before any action.
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

                      {selectedRecommendation.spotifyDetails && (
                        <div className="mt-5 space-y-3">
                          <Detail
                            label="Playlist"
                            value={selectedRecommendation.spotifyDetails.playlistName}
                            strong
                          />
                          <Detail
                            label="Mood"
                            value={selectedRecommendation.spotifyDetails.mood}
                          />
                          <Detail
                            label="Tracks"
                            value={selectedRecommendation.spotifyDetails.estimatedTracks}
                          />
                          <Detail
                            label="Duration"
                            value={selectedRecommendation.spotifyDetails.estimatedDuration}
                          />
                          <Detail label="Source" value="Spotify" />
                        </div>
                      )}

                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs leading-relaxed text-white/45">
                          {operation.type === "spotify"
                            ? "Kuro will connect to Spotify, create a playlist, search suitable tracks, add them, and return the playlist link."
                            : "Kuro will open Trip.com for this option. It will stop before payment or final booking confirmation."}
                        </p>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={executing}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:bg-white/20 disabled:text-white/35"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {approveLabel}
                      </button>

                      {executionMessage && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/50">
                          {executionMessage}
                        </div>
                      )}

                      {spotifyResult && (
                        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                            Operation completed
                          </p>

                          <h4 className="mt-3 text-lg font-semibold">
                            {spotifyResult.playlistName}
                          </h4>

                          <p className="mt-2 text-sm text-white/45">
                            {spotifyResult.tracksAdded} tracks added successfully.
                          </p>

                          <a
                            href={spotifyResult.playlistUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 flex w-full items-center justify-center rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
                          >
                            Open Spotify
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>

              <OperationTimeline
                type={operation.type}
                executing={executing}
                completed={completed}
              />
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