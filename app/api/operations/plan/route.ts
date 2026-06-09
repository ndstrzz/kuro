import { NextResponse } from "next/server";
import { researchPlaylist } from "@/lib/operations/playlistResearch";
import { researchTripFlights } from "@/lib/operations/tripResearch";

type OperationType = "spotify" | "trip" | "general";

type Recommendation = {
  id: string;
  title: string;
  tag: string;
  description: string;
  playlistDetails?: {
    mood: string;
    duration: string;
    source: string;
    trackSeeds: string[];
    sources?: string[];
  };
  tracks?: string[];
  flightDetails?: {
    price: string;
    route: string;
    airline: string;
    departureTime: string;
    tripUrl: string;
  };
};

type Operation = {
  id: string;
  userPrompt: string;
  type: OperationType;
  recommendations: Recommendation[];
};

function detectOperationType(prompt: string): OperationType {
  const text = prompt.toLowerCase();

  const playlistKeywords = [
    "playlist",
    "spotify",
    "song",
    "songs",
    "music",
    "track",
    "tracks",
    "kpop",
    "k-pop",
    "lofi",
    "jazz",
    "rnb",
    "r&b",
    "workout music",
  ];

  const flightKeywords = [
    "flight",
    "flights",
    "airfare",
    "air ticket",
    "ticket to",
    "fly to",
    "trip.com",
    "depart",
    "arrival",
    "book ticket",
  ];

  if (playlistKeywords.some((keyword) => text.includes(keyword))) {
    return "spotify";
  }

  if (flightKeywords.some((keyword) => text.includes(keyword))) {
    return "trip";
  }

  return "general";
}

async function createSpotifyRecommendations(prompt: string): Promise<Recommendation[]> {
  const researchedPlaylists = await researchPlaylist(prompt);

  return researchedPlaylists.map((item, index) => ({
    id: `spotify-${index + 1}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: item.title,
    tag: item.tag,
    description: item.description,
    tracks: item.trackSeeds,
    playlistDetails: {
      mood: item.mood,
      duration: "35m – 50m",
      source: "Exa + Broad Web + Spotify",
      trackSeeds: item.trackSeeds,
      sources: item.sources,
    },
  }));
}

async function createTripRecommendations(prompt: string): Promise<Recommendation[]> {
  const flightOptions = await researchTripFlights(prompt);

  return flightOptions.map((item, index) => ({
    id: `trip-${index + 1}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: item.title,
    tag: item.tag,
    description: item.description,
    flightDetails: {
      price: item.price,
      route: item.route,
      airline: item.airline,
      departureTime: item.departureTime,
      tripUrl: item.tripUrl,
    },
  }));
}

function createGeneralRecommendations(prompt: string): Recommendation[] {
  return [
    {
      id: "general-executive-research",
      title: "Executive Research Brief",
      tag: "KURO",
      description: `Kuro can research, summarise, and prepare an approval-ready plan for: ${prompt}`,
    },
    {
      id: "general-agent-workflow",
      title: "Agent Workflow",
      tag: "MULTI-AGENT",
      description:
        "Kuro will split the task into research, planning, approval, and browser execution where applicable.",
    },
    {
      id: "general-safe-handoff",
      title: "Safe Handoff",
      tag: "APPROVAL FIRST",
      description:
        "Kuro will not purchase, submit, pay, or finalise anything without explicit human approval.",
    },
  ];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const type = detectOperationType(prompt);

    let recommendations: Recommendation[];

    if (type === "spotify") {
      recommendations = await createSpotifyRecommendations(prompt);
    } else if (type === "trip") {
      recommendations = await createTripRecommendations(prompt);
    } else {
      recommendations = createGeneralRecommendations(prompt);
    }

    const operation: Operation = {
      id: `operation-${Date.now()}`,
      userPrompt: prompt,
      type,
      recommendations,
    };

    return NextResponse.json({
      success: true,
      operation,
    });
  } catch (error) {
    console.error("Operation planning failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create operation plan.",
      },
      { status: 500 }
    );
  }
}