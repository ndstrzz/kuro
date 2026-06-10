"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  CalendarDays,
  CheckCircle2,
  Compass,
  ExternalLink,
  Mail,
  Music,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
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

const suggestions = [
  {
    icon: Mail,
    title: "Morning Brief",
    prompt: "Good morning Kuro, prepare my executive brief",
  },
  {
    icon: Mail,
    title: "Gmail",
    prompt: "Open Gmail and summarize my inbox",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    prompt: "Open my calendar and help me plan my day",
  },
  {
    icon: Search,
    title: "Research",
    prompt: "Research the best tools for AI agents",
  },
  {
    icon: Music,
    title: "Spotify",
    prompt: "Create a trendy K-pop Spotify playlist",
  },
];

const emptyBrowserStatus: BrowserStatus = {
  connected: false,
  surface: "Waiting for approval",
  currentAction: "No browser action started yet",
  target: "Not connected",
  status: "waiting",
};

type ChatRole = "user" | "kuro";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type DesktopPlanStep = {
  id: string;
  title: string;
  description: string;
  action:
    | "open_url"
    | "open_gmail"
    | "open_calendar"
    | "search_web"
    | "extract_text"
    | "wait_for_user";
  value?: string;
  requiresApproval?: boolean;
  safetyLevel: "safe" | "approval_required" | "blocked";
};

type DesktopPlanResponse = {
  success: boolean;
  prompt: string;
  plan: DesktopPlanStep[];
  approvalRequired: boolean;
  message: string;
  error?: string;
};

type DesktopExecuteResponse = {
  success: boolean;
  results: Array<{
    step: DesktopPlanStep;
    success: boolean;
    message: string;
    waitingForUser?: boolean;
    blocked?: boolean;
    extractedText?: string;
    url?: string;
  }>;
  currentUrl: string;
  message: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isSpotifyPrompt(prompt: string) {
  const text = prompt.toLowerCase();

  return (
    text.includes("spotify") ||
    text.includes("playlist") ||
    text.includes("songs") ||
    text.includes("music")
  );
}

function getDesktopSurface(prompt: string) {
  const text = prompt.toLowerCase();

  if (text.includes("gmail") || text.includes("email") || text.includes("inbox")) {
    return "Gmail";
  }

  if (text.includes("calendar") || text.includes("schedule")) {
    return "Google Calendar";
  }

  if (text.includes("search") || text.includes("research") || text.includes("find")) {
    return "Google Search";
  }

  return "Desktop Agent";
}

function buildFallbackDesktopPlan(prompt: string): DesktopPlanStep[] {
  const surface = getDesktopSurface(prompt);

  return [
    {
      id: "step_001",
      title: "Understand request",
      description: "Kuro will analyse your request and choose the safest action.",
      action: "wait_for_user",
      safetyLevel: "safe",
    },
    {
      id: "step_002",
      title: `Open ${surface}`,
      description: `Kuro will open ${surface} in a controlled browser window.`,
      action:
        surface === "Gmail"
          ? "open_gmail"
          : surface === "Google Calendar"
            ? "open_calendar"
            : surface === "Google Search"
              ? "search_web"
              : "open_url",
      value:
        surface === "Gmail"
          ? "https://mail.google.com"
          : surface === "Google Calendar"
            ? "https://calendar.google.com"
            : prompt,
      safetyLevel: "safe",
    },
    {
      id: "step_999",
      title: "Stop before sensitive action",
      description:
        "Kuro will not send, delete, purchase, pay, submit, or change anything without approval.",
      action: "wait_for_user",
      requiresApproval: true,
      safetyLevel: "safe",
    },
  ];
}

export default function KuroHome() {
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  const [desktopPrompt, setDesktopPrompt] = useState("");
  const [desktopPlan, setDesktopPlan] = useState<DesktopPlanStep[]>([]);
  const [desktopMode, setDesktopMode] = useState(false);

  const [planningLoading, setPlanningLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionComplete, setExecutionComplete] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>(emptyBrowserStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "kuro",
      content:
        "Hi Andy. Tell me what you want me to do. For normal requests, I will stay on this screen and work like a ChatGPT-style executive agent. For Spotify, I will keep the existing playlist automation flow.",
    },
  ]);

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

  const missionTitle =
    operation?.userPrompt || desktopPrompt || message || "Waiting for executive request";

  const actionLabel = useMemo(() => {
    if (executionComplete) return "Mission complete";
    if (executing && isSpotifyOperation) return "Creating playlist...";
    if (executing && desktopMode) return "Executing desktop plan...";
    if (isSpotifyOperation) return "Create Playlist";
    if (desktopMode) return "Approve & Run";
    return "Approve Mission";
  }, [desktopMode, executionComplete, executing, isSpotifyOperation]);

  const timelineSteps: TimelineStep[] = useMemo(() => {
    if (!operation && !desktopMode) {
      return [
        {
          id: "intake",
          title: "Request intake",
          description: "Waiting for your instruction.",
          status: "active",
        },
        {
          id: "planning",
          title: "Kuro Planner",
          description: "Standing by.",
          status: "waiting",
        },
        {
          id: "approval",
          title: "Approval Layer",
          description: "No action will run without approval.",
          status: "waiting",
        },
        {
          id: "execution",
          title: "Desktop Agent",
          description: "Browser handoff has not started.",
          status: "waiting",
        },
      ];
    }

    if (desktopMode) {
      return [
        {
          id: "intake",
          title: "Request intake",
          description: "Kuro received your instruction.",
          status: "done",
        },
        {
          id: "planning",
          title: "Desktop Plan",
          description: planningLoading
            ? "Kuro is creating a permission-first action plan."
            : "Kuro prepared the desktop action plan.",
          status: planningLoading ? "active" : "done",
        },
        {
          id: "approval",
          title: "Approval Layer",
          description: executionComplete
            ? "Approved safe steps completed."
            : executing
              ? "Approval received. Running only safe actions."
              : "Waiting for approval before controlling browser.",
          status: executionComplete || executing ? "done" : "active",
        },
        {
          id: "execution",
          title: "Desktop Execution",
          description: executionComplete
            ? "Kuro completed the safe browser steps."
            : executing
              ? "Kuro is opening and reading the approved workspace."
              : "Ready to run approved steps.",
          status: executionComplete ? "done" : executing ? "active" : "waiting",
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
        title: "Playlist Research",
        description: planningLoading
          ? "Preparing Spotify playlist recommendations."
          : "Spotify-ready playlist options prepared.",
        status: planningLoading ? "active" : "done",
      },
      {
        id: "approval",
        title: "Approval Layer",
        description: executionComplete
          ? "Human approval received and recorded."
          : executing
            ? "Approval received. Creating playlist safely."
            : planningLoading
              ? "Waiting for playlist options."
              : "Waiting for approval before Spotify action.",
        status: executionComplete || executing ? "done" : planningLoading ? "waiting" : "active",
      },
      {
        id: "execution",
        title: "Spotify Execution",
        description: executionComplete
          ? "Spotify playlist mission completed."
          : executing
            ? "Chrome is creating the Spotify playlist."
            : "Ready to create selected playlist.",
        status: executionComplete ? "done" : executing ? "active" : "waiting",
      },
    ];
  }, [
    operation,
    desktopMode,
    planningLoading,
    executing,
    executionComplete,
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
    if (!operation && !desktopMode) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [operation, desktopMode]);

  function resetExecutionState() {
    clearScheduledLogs();

    setOperation(null);
    setSelectedRecommendationId(null);
    setDesktopPrompt("");
    setDesktopPlan([]);
    setDesktopMode(false);
    setPlanningLoading(false);
    setExecuting(false);
    setExecutionComplete(false);
    setExecutionMessage("");
    setBrowserStatus(emptyBrowserStatus);
    setElapsedSeconds(0);
    setLogs([]);
  }

  async function handleSubmit() {
    if (!message.trim()) return;

    const prompt = message.trim();

    resetExecutionState();

    setChatMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-user`,
        role: "user",
        content: prompt,
      },
    ]);

    setMessage("");

    pushLog("kuro", "Executive request received.", "done");

    if (isSpotifyPrompt(prompt)) {
      await handleSpotifyPlanning(prompt);
      return;
    }

    await handleDesktopPlanning(prompt);
  }

  async function handleDesktopPlanning(prompt: string) {
    setDesktopMode(true);
    setDesktopPrompt(prompt);
    setPlanningLoading(true);
    setExecutionMessage("Kuro is preparing a permission-first desktop plan...");

    setBrowserStatus({
      connected: false,
      surface: getDesktopSurface(prompt),
      currentAction: "Preparing approval-safe action plan",
      target: LOCAL_BROWSER_AGENT_URL,
      status: "running",
    });

    scheduleLog(300, "planning", "Analysing request.");
    scheduleLog(850, "planning", "Checking safety boundaries.");
    scheduleLog(1400, "approval", "Preparing permission-first execution plan.");

    try {
      const response = await fetch(`${LOCAL_BROWSER_AGENT_URL}/desktop/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = (await response.json()) as DesktopPlanResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to prepare desktop plan.");
      }

      await sleep(900);

      setDesktopPlan(data.plan);
      setPlanningLoading(false);
      setExecutionMessage("");

      setBrowserStatus({
        connected: true,
        surface: getDesktopSurface(prompt),
        currentAction: "Desktop plan ready for approval",
        target: LOCAL_BROWSER_AGENT_URL,
        status: "done",
      });

      pushLog("planning", data.message || "Desktop plan prepared.", "done");
      pushLog("approval", "Waiting for approval before browser control.", "done");

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content:
            "I prepared a safe desktop action plan. I can open and read approved apps or websites, but I will stop before sending, deleting, paying, submitting, or changing anything.",
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to prepare desktop plan.";

      const fallbackPlan = buildFallbackDesktopPlan(prompt);

      setDesktopPlan(fallbackPlan);
      setPlanningLoading(false);
      setExecutionMessage(
        `${errorMessage} I prepared a local fallback plan instead.`
      );

      setBrowserStatus({
        connected: false,
        surface: getDesktopSurface(prompt),
        currentAction: errorMessage,
        target: LOCAL_BROWSER_AGENT_URL,
        status: "error",
      });

      pushLog("planning", errorMessage, "error");

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content:
            "I could not reach the local desktop agent, so I prepared a fallback plan on-screen. Make sure `kuro-browser-agent` is running on localhost:4000 before executing.",
        },
      ]);
    }
  }

  async function handleSpotifyPlanning(prompt: string) {
    setPlanningLoading(true);
    setExecutionMessage("Kuro is preparing Spotify playlist options...");

    scheduleLog(350, "research", "Activating music research agent.");
    scheduleLog(900, "research", "Preparing Spotify-ready track seeds.");
    scheduleLog(1450, "planning", "Ranking playlist options by mood and usefulness.");

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
        throw new Error(data.error || "Failed to create Spotify operation.");
      }

      const nextOperation = data.operation as Operation;

      setOperation(nextOperation);
      setSelectedRecommendationId(nextOperation.recommendations[0]?.id ?? null);
      setExecutionMessage("");
      setPlanningLoading(false);

      setBrowserStatus({
        connected: true,
        surface: "Spotify",
        currentAction: "Spotify playlist options prepared",
        target: "Spotify OAuth + Browser Agent",
        status: "done",
      });

      scheduleLog(
        300,
        "research",
        "Broad music research complete. Spotify-ready track seeds prepared.",
        "done"
      );

      scheduleLog(
        700,
        "planning",
        "Approval layer is ready. No Spotify action will run without confirmation.",
        "done"
      );

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content:
            "I prepared Spotify playlist options. Choose one, then approve when you want me to create it.",
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create Spotify operation.";

      setPlanningLoading(false);
      setExecutionMessage(errorMessage);
      pushLog("kuro", errorMessage, "error");

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content: errorMessage,
        },
      ]);
    }
  }

  function handleReset() {
    clearScheduledLogs();

    setMessage("");
    setOperation(null);
    setSelectedRecommendationId(null);
    setDesktopPrompt("");
    setDesktopPlan([]);
    setDesktopMode(false);
    setPlanningLoading(false);
    setExecuting(false);
    setExecutionComplete(false);
    setExecutionMessage("");
    setLogs([]);
    setBrowserStatus(emptyBrowserStatus);
    setElapsedSeconds(0);
    setChatMessages([
      {
        id: "welcome",
        role: "kuro",
        content:
          "New task ready. Tell me what you want me to do, and I will plan it safely first.",
      },
    ]);
  }

  async function handleApprove() {
    if (isSpotifyOperation) {
      await executeSpotifyPlaylist();
      return;
    }

    if (desktopMode) {
      await executeDesktopPlan();
      return;
    }

    setExecutionMessage("No mission selected.");
    pushLog("kuro", "No mission selected.", "error");
  }

  async function executeDesktopPlan() {
    if (!desktopPrompt || !desktopPlan.length) {
      setExecutionMessage("No desktop plan found.");
      pushLog("browser", "No desktop plan found.", "error");
      return;
    }

    clearScheduledLogs();

    setExecuting(true);
    setExecutionComplete(false);
    setExecutionMessage("Kuro is executing the approved safe desktop steps...");

    setBrowserStatus({
      connected: false,
      surface: getDesktopSurface(desktopPrompt),
      currentAction: "Calling localhost desktop agent",
      target: `${LOCAL_BROWSER_AGENT_URL}/desktop/execute`,
      status: "running",
    });

    pushLog("approval", "Human approval received for desktop agent execution.", "done");
    scheduleLog(350, "browser", "Opening controlled Chrome session.");
    scheduleLog(1000, "browser", "Running approved safe actions only.");
    scheduleLog(1700, "browser", "Stopping before sensitive actions.");

    try {
      const executablePlan = desktopPlan.filter(
        (step) => step.action !== "wait_for_user" && step.safetyLevel !== "blocked"
      );

      const response = await fetch(`${LOCAL_BROWSER_AGENT_URL}/desktop/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: desktopPrompt,
          plan: executablePlan,
        }),
      });

      const data = (await response.json()) as DesktopExecuteResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Local desktop agent failed.");
      }

      const extractedText = data.results
        .map((result) => result.extractedText)
        .filter(Boolean)
        .join("\n")
        .slice(0, 900);

      const finalMessage =
        extractedText.length > 0
          ? `Done. I opened the workspace and extracted visible text. Summary preview: ${extractedText}`
          : data.message || "Kuro completed the approved desktop steps.";

      setExecutionMessage(data.message || "Desktop mission completed safely.");
      setExecuting(false);
      setExecutionComplete(true);

      setBrowserStatus({
        connected: true,
        surface: getDesktopSurface(desktopPrompt),
        currentAction: "Safe desktop execution completed",
        target: data.currentUrl || LOCAL_BROWSER_AGENT_URL,
        status: "done",
      });

      pushLog("browser", data.message || "Desktop execution completed.", "done");
      pushLog("kuro", "Desktop mission complete.", "done");

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content: finalMessage,
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to execute desktop plan.";

      setExecutionMessage(errorMessage);
      setExecuting(false);

      setBrowserStatus({
        connected: false,
        surface: getDesktopSurface(desktopPrompt),
        currentAction: errorMessage,
        target: LOCAL_BROWSER_AGENT_URL,
        status: "error",
      });

      pushLog("browser", errorMessage, "error");

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content: errorMessage,
        },
      ]);
    }
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

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content: agentData.message || "Spotify playlist created successfully.",
        },
      ]);
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

      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-kuro`,
          role: "kuro",
          content: errorMessage,
        },
      ]);
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
        {!operation && !desktopMode ? (
          <>
            <div className="scale-[1.35] md:scale-[1.55]">
              <KuroMascot status={planningLoading ? "thinking" : "idle"} />
            </div>

            <div className="mt-14 text-center">
              <p className="mb-3 text-xs uppercase tracking-[0.35em] text-white/35">
                Kuro Executive OS
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Good evening, Andy.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/45 md:text-base">
                Ask anything. I will plan it safely, ask for approval, then use the desktop agent only when needed.
              </p>
            </div>

            <ChatPanel messages={chatMessages} />

            <div className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-5">
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
        ) : desktopMode ? (
          <div className="grid w-full max-w-7xl gap-5 xl:grid-cols-[1fr_380px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="scale-110">
                    <KuroMascot status={planningLoading || executing ? "thinking" : "idle"} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                      ChatGPT-style desktop agent
                    </p>
                    <h2 className="mt-1 text-xl font-semibold md:text-2xl">
                      {getDesktopSurface(desktopPrompt)}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/45 transition hover:border-white/30 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  New task
                </button>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                  Current request
                </p>
                <h1 className="mt-3 text-2xl font-semibold md:text-4xl">
                  “{desktopPrompt}”
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-white/45">
                  Kuro will keep this request on one screen, show the plan, ask for permission, and only then control the browser safely.
                </p>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                      Permission plan
                    </p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/45">
                      {planningLoading
                        ? "Planning"
                        : executionComplete
                          ? "Completed"
                          : executing
                            ? "Executing"
                            : "Approval needed"}
                    </span>
                  </div>

                  {planningLoading ? (
                    <DesktopLoadingPanel />
                  ) : (
                    <DesktopPlanPanel plan={desktopPlan} />
                  )}
                </section>

                <aside className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Safety layer
                  </p>

                  <h3 className="mt-3 text-2xl font-semibold">
                    Permission-first control
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-white/45">
                    Kuro can open approved websites, search, read visible text, and help you prepare next steps. It stops before sensitive actions.
                  </p>

                  <div className="mt-5 space-y-3">
                    <SafetyItem text="Can open Gmail, Calendar, Google, and web apps" done />
                    <SafetyItem text="Can read visible page text after approval" done />
                    <SafetyItem text="Will not send emails without approval" />
                    <SafetyItem text="Will not delete, pay, buy, submit, or install" />
                  </div>

                  <button
                    onClick={handleApprove}
                    disabled={planningLoading || executing || executionComplete || !desktopPlan.length}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:bg-white/20 disabled:text-white/35"
                  >
                    {executionComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    {actionLabel}
                  </button>

                  {executionMessage && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-white/50">
                      {executionMessage}
                    </div>
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
        ) : (
          <div className="grid w-full max-w-7xl gap-5 xl:grid-cols-[1fr_380px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl md:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KuroMascot status={planningLoading || executing ? "thinking" : "idle"} />
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                      Spotify automation
                    </p>
                    <h2 className="mt-1 text-xl font-semibold md:text-2xl">
                      Playlist Mission
                    </h2>
                  </div>
                </div>

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
                  “{operation?.userPrompt}”
                </h2>
              </div>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_340px]">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                      Playlist options
                    </p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/45">
                      {planningLoading
                        ? "Planning"
                        : executionComplete
                          ? "Completed"
                          : executing
                            ? "Executing"
                            : "Ready"}
                    </span>
                  </div>

                  {planningLoading ? (
                    <SpotifyLoadingPanel />
                  ) : (
                    <RecommendationGrid
                      recommendations={operation?.recommendations || []}
                      selectedId={selectedRecommendationId}
                      onSelect={setSelectedRecommendationId}
                    />
                  )}
                </section>

                <aside className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Spotify flow
                  </p>

                  {!selectedRecommendation ? (
                    <>
                      <h3 className="mt-3 text-2xl font-semibold">
                        Create playlist safely
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/45">
                        Kuro prepares choices first, then asks for approval before creating the playlist.
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

                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs leading-relaxed text-white/45">
                          Kuro will create the Spotify playlist, then call localhost:4000 to open Chrome, search each track, and press Add.
                        </p>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={executing || executionComplete}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:bg-white/20 disabled:text-white/35"
                      >
                        <Music className="h-4 w-4" />
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
              placeholder="ask Kuro anything..."
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

function ChatPanel({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="mt-8 w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((item) => (
          <div
            key={item.id}
            className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                item.role === "user"
                  ? "bg-white text-black"
                  : "border border-white/10 bg-black/40 text-white/65"
              }`}
            >
              {item.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopPlanPanel({ plan }: { plan: DesktopPlanStep[] }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Approval-ready plan</h3>
          <p className="mt-1 text-sm text-white/45">
            Kuro will only run the safe approved steps.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {plan.map((step, index) => (
          <div
            key={step.id}
            className="rounded-3xl border border-white/10 bg-black/30 p-4"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-white/85">{step.title}</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      step.safetyLevel === "blocked"
                        ? "bg-red-400/15 text-red-200"
                        : step.safetyLevel === "approval_required"
                          ? "bg-yellow-400/15 text-yellow-100"
                          : "bg-green-400/15 text-green-100"
                    }`}
                  >
                    {step.safetyLevel.replace("_", " ")}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-white/45">
                  {step.description}
                </p>

                {step.value && (
                  <p className="mt-2 truncate text-xs text-white/30">
                    Target: {step.value}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopLoadingPanel() {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>

        <div>
          <h3 className="text-xl font-semibold">Preparing desktop plan</h3>
          <p className="mt-1 text-sm text-white/45">
            Kuro is checking the request, app target, and safety rules.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <LoadingStep text="Understanding task" done />
        <LoadingStep text="Choosing app or website" done />
        <LoadingStep text="Checking sensitive actions" active />
        <LoadingStep text="Preparing approval layer" />
      </div>
    </div>
  );
}

function SpotifyLoadingPanel() {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>

        <div>
          <h3 className="text-xl font-semibold">Preparing Spotify playlist</h3>
          <p className="mt-1 text-sm text-white/45">
            Kuro is choosing tracks and preparing a Spotify-ready playlist.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <LoadingStep text="Reading playlist mood" done />
        <LoadingStep text="Choosing track seeds" active />
        <LoadingStep text="Preparing Spotify handoff" />
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

function SafetyItem({
  text,
  done = false,
}: {
  text: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-200" />
      ) : (
        <Sparkles className="h-4 w-4 text-white/35" />
      )}
      <span className={done ? "text-white/75" : "text-white/45"}>{text}</span>
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