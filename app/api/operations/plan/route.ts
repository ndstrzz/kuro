import { NextResponse } from "next/server";
import { researchPlaylist } from "@/lib/operations/playlistResearch";
import { researchTripFlights } from "@/lib/operations/tripResearch";
import type { Operation, OperationType, Recommendation } from "@/types/operation";

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
    "c-pop",
    "cpop",
    "mandarin",
    "chinese songs",
    "lofi",
    "jazz",
    "rnb",
    "r&b",
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
    "new york",
    "tokyo",
    "bangkok",
    "jakarta",
    "seoul",
  ];

  if (playlistKeywords.some((keyword) => text.includes(keyword))) {
    return "spotify";
  }

  if (flightKeywords.some((keyword) => text.includes(keyword))) {
    return "trip";
  }

  return "general";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getApproxUserLocation(request: Request) {
  const headers = request.headers;

  const city =
    headers.get("x-vercel-ip-city") ||
    headers.get("x-forwarded-city") ||
    "";

  const country =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    "";

  const region =
    headers.get("x-vercel-ip-country-region") ||
    headers.get("x-vercel-ip-region") ||
    "";

  const latitude = headers.get("x-vercel-ip-latitude") || "";
  const longitude = headers.get("x-vercel-ip-longitude") || "";

  return {
    city: decodeURIComponent(city),
    country,
    region,
    latitude,
    longitude,
  };
}

async function createSpotifyRecommendations(prompt: string): Promise<Recommendation[]> {
  const researchedPlaylists = await researchPlaylist(prompt);

  return researchedPlaylists.map((item, index) => ({
    id: `spotify-${index + 1}-${slugify(item.title)}`,
    kind: item.tag,
    title: item.title,
    subtitle: item.mood,
    description: item.description,
    metadata: [
      `Tracks: ${item.trackSeeds.length} Exa songs`,
      "Source: Exa broad web research",
      "Action: Spotify browser agent",
    ],
    tag: item.tag,
    tracks: item.trackSeeds,
    playlistDetails: {
      mood: item.mood,
      duration: "35m – 50m",
      source: "Exa + Broad Web + Spotify",
      trackSeeds: item.trackSeeds,
      sources: item.sources,
    },
    spotifyDetails: {
      mood: item.mood,
      estimatedTracks: `${item.trackSeeds.length}`,
      estimatedDuration: "35m – 50m",
      source: "Exa + Broad Web + Spotify",
      playlistName: item.title,
      tracks: item.trackSeeds,
    },
  }));
}

async function createTripRecommendations(
  prompt: string,
  userLocation: ReturnType<typeof getApproxUserLocation>
): Promise<Recommendation[]> {
  const flightOptions = await researchTripFlights(prompt, userLocation);

  return flightOptions.map((item, index) => ({
    id: `trip-${index + 1}-${slugify(item.title)}`,
    kind: item.tag,
    title: item.title,
    subtitle: `${item.route} · ${item.price}`,
    description: item.description,
    metadata: [
      item.price,
      `${item.departureTime} → ${item.arrivalTime}`,
      item.airline,
      item.stops,
    ],
    tag: item.tag,
    flightDetails: {
      price: item.price,
      route: item.route,
      airline: item.airline,
      departureTime: item.departureTime,
      arrivalTime: item.arrivalTime,
      duration: item.duration,
      stops: item.stops,
      tripUrl: item.tripUrl,
    },
  }));
}

function createGeneralRecommendations(prompt: string): Recommendation[] {
  return [
    {
      id: "general-executive-research",
      kind: "KURO",
      title: "Executive Research Brief",
      subtitle: "Research-only mission",
      description: `Kuro can research, summarise, and prepare an approval-ready plan for: ${prompt}`,
      metadata: ["Research", "Planning", "Approval-first"],
    },
    {
      id: "general-agent-workflow",
      kind: "MULTI-AGENT",
      title: "Agent Workflow",
      subtitle: "Research → Planning → Approval",
      description:
        "Kuro will split the task into research, planning, approval, and browser execution where applicable.",
      metadata: ["Multi-agent", "Safe execution", "Demo-ready"],
    },
    {
      id: "general-safe-handoff",
      kind: "APPROVAL FIRST",
      title: "Safe Handoff",
      subtitle: "Human-in-the-loop",
      description:
        "Kuro will not purchase, submit, pay, or finalise anything without explicit human approval.",
      metadata: ["Safety", "Approval", "Control"],
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
    const userLocation = getApproxUserLocation(request);

    let recommendations: Recommendation[];

    if (type === "spotify") {
      recommendations = await createSpotifyRecommendations(prompt);
    } else if (type === "trip") {
      recommendations = await createTripRecommendations(prompt, userLocation);
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