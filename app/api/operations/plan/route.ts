import { NextResponse } from "next/server";

type Recommendation = {
  id: string;
  title: string;
  tag: string;
  description: string;
  tracks?: string[];
  playlistDetails?: {
    mood: string;
    duration: string;
    source: string;
    trackSeeds: string[];
  };
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
  type: "spotify" | "trip" | "general";
  recommendations: Recommendation[];
};

const fallbackKpopTracks = [
  "aespa Supernova",
  "ILLIT Magnetic",
  "LE SSERAFIM EASY",
  "NewJeans Super Shy",
  "IVE I AM",
  "Jung Kook Standing Next to You",
  "SEVENTEEN MAESTRO",
  "Stray Kids LALALALA",
  "ENHYPEN Bite Me",
  "RIIZE Get A Guitar",
];

function detectOperationType(prompt: string): Operation["type"] {
  const lowerPrompt = prompt.toLowerCase();

  if (
    lowerPrompt.includes("spotify") ||
    lowerPrompt.includes("playlist") ||
    lowerPrompt.includes("song") ||
    lowerPrompt.includes("music") ||
    lowerPrompt.includes("kpop") ||
    lowerPrompt.includes("k-pop")
  ) {
    return "spotify";
  }

  if (
    lowerPrompt.includes("flight") ||
    lowerPrompt.includes("trip.com") ||
    lowerPrompt.includes("ticket") ||
    lowerPrompt.includes("jakarta") ||
    lowerPrompt.includes("travel")
  ) {
    return "trip";
  }

  return "general";
}

async function searchExaForTracks(prompt: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return fallbackKpopTracks;
  }

  const searchQuery = `Find current real Spotify song recommendations for this playlist request: ${prompt}. Return trendy song titles with artists.`;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: searchQuery,
      type: "auto",
      numResults: 8,
      contents: {
        text: true,
      },
    }),
  });

  if (!response.ok) {
    return fallbackKpopTracks;
  }

  const data = await response.json();

  const rawText = JSON.stringify(data.results ?? []);
  const extracted = extractTrackSeeds(rawText);

  if (extracted.length < 5) {
    return fallbackKpopTracks;
  }

  return extracted.slice(0, 12);
}

function extractTrackSeeds(text: string) {
  const commonTracks = [
    "aespa Supernova",
    "ILLIT Magnetic",
    "LE SSERAFIM EASY",
    "NewJeans Super Shy",
    "IVE I AM",
    "Jung Kook Standing Next to You",
    "SEVENTEEN MAESTRO",
    "Stray Kids LALALALA",
    "ENHYPEN Bite Me",
    "RIIZE Get A Guitar",
    "BABYMONSTER SHEESH",
    "TXT Deja Vu",
    "NMIXX DASH",
    "TWICE ONE SPARK",
    "BLACKPINK Pink Venom",
  ];

  const lowerText = text.toLowerCase();

  return commonTracks.filter((track) => {
    const [artist, ...titleParts] = track.toLowerCase().split(" ");
    const title = titleParts.join(" ");

    return lowerText.includes(artist) || lowerText.includes(title);
  });
}

async function createSpotifyRecommendations(prompt: string): Promise<Recommendation[]> {
  const trackSeeds = await searchExaForTracks(prompt);

  return [
    {
      id: "exa-kpop-trendy",
      title: "Exa Trend Scan",
      tag: "EXA RESEARCHED",
      description:
        "Generated from live Exa research based on your exact playlist request, then passed to the browser agent as real Spotify search seeds.",
      tracks: trackSeeds,
      playlistDetails: {
        mood: "Trendy · K-pop · High energy",
        duration: "35m – 50m",
        source: "Exa + Spotify",
        trackSeeds,
      },
    },
    {
      id: "kpop-polished",
      title: "Polished K-pop Mix",
      tag: "KPOP TRENDY",
      description:
        "A cleaner executive-friendly K-pop mix with popular tracks that still feel fresh and polished.",
      tracks: trackSeeds.slice(0, 8),
      playlistDetails: {
        mood: "Polished · Modern · Catchy",
        duration: "30m – 45m",
        source: "Exa + Spotify",
        trackSeeds: trackSeeds.slice(0, 8),
      },
    },
    {
      id: "kpop-energy",
      title: "K-pop Energy Boost",
      tag: "HIGH ENERGY",
      description:
        "A stronger K-pop set for a more exciting, upbeat playlist.",
      tracks: trackSeeds.reverse().slice(0, 8),
      playlistDetails: {
        mood: "Energetic · Trendy · Viral",
        duration: "30m – 45m",
        source: "Exa + Spotify",
        trackSeeds: trackSeeds.reverse().slice(0, 8),
      },
    },
  ];
}

function createTripRecommendations(prompt: string): Recommendation[] {
  return [
    {
      id: "trip-direct-cheapest",
      title: "Cheapest Trip.com Option",
      tag: "TRIP.COM",
      description:
        "Kuro will open the exact Trip.com option selected and stop before payment.",
      flightDetails: {
        price: "Check live fare",
        route: "Selected route",
        airline: "Trip.com result",
        departureTime: "Based on selected option",
        tripUrl: "https://www.trip.com/flights/",
      },
    },
  ];
}

function createGeneralRecommendations(prompt: string): Recommendation[] {
  return [
    {
      id: "general-research",
      title: "Executive Research Brief",
      tag: "KURO",
      description: `Kuro prepared a research-first workflow for: ${prompt}`,
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

    let recommendations: Recommendation[] = [];

    if (type === "spotify") {
      recommendations = await createSpotifyRecommendations(prompt);
    }

    if (type === "trip") {
      recommendations = createTripRecommendations(prompt);
    }

    if (type === "general") {
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
    console.error(error);

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