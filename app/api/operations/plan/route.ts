import { NextRequest, NextResponse } from "next/server";
import { createMockOperation } from "@/lib/agents/mockOperation";

export const runtime = "nodejs";

type ExaSearchResult = {
  title?: string;
  text?: string;
  url?: string;
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
};

function extractTrackCandidates(text: string) {
  const candidates = new Set<string>();

  const knownTracks = [
    "Ludovico Einaudi Nuvole Bianche",
    "Yiruma River Flows In You",
    "Nils Frahm Says",
    "Ólafur Arnalds Near Light",
    "Max Richter On The Nature Of Daylight",
    "Joep Beving Ab Ovo",
    "Hania Rani Glass",
    "Dustin O'Halloran Opus 55",
    "Brian Eno An Ending Ascent",
    "Tycho A Walk",
    "Ólafur Arnalds Saman",
    "Nils Frahm Ambre",
    "Ludovico Einaudi Experience",
    "Yann Tiersen Comptine d'un autre été",
    "Explosions In The Sky Your Hand In Mine",
  ];

  for (const track of knownTracks) {
    if (text.toLowerCase().includes(track.toLowerCase())) {
      candidates.add(track);
    }
  }

  const quoted = text.match(/["“]([^"”]{6,80})["”]/g) || [];

  for (const item of quoted) {
    const cleaned = item.replace(/["“”]/g, "").trim();

    if (
      cleaned.length >= 6 &&
      cleaned.length <= 80 &&
      !cleaned.toLowerCase().includes("playlist") &&
      !cleaned.toLowerCase().includes("spotify")
    ) {
      candidates.add(cleaned);
    }
  }

  return Array.from(candidates).slice(0, 10);
}

async function researchSpotifyTracksWithExa(prompt: string) {
  const exaApiKey = process.env.EXA_API_KEY;

  if (!exaApiKey) {
    return [];
  }

  try {
    const query = [
      "best calm professional instrumental Spotify tracks for seminar presentation",
      prompt,
      "specific song titles artists piano ambient focus coffeehouse jazz",
    ].join(" ");

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaApiKey,
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        type: "auto",
        contents: {
          text: true,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Exa research failed:", text);
      return [];
    }

    const data = (await response.json()) as ExaSearchResponse;

    const combinedText = (data.results || [])
      .map((result) => `${result.title || ""}\n${result.text || ""}`)
      .join("\n");

    return extractTrackCandidates(combinedText);
  } catch (error) {
    console.error("Exa research error:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const prompt =
      typeof body?.prompt === "string" && body.prompt.trim().length > 0
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        {
          error: "Prompt is required.",
        },
        { status: 400 },
      );
    }

    const lowerPrompt = prompt.toLowerCase();

    const shouldUseExa =
      lowerPrompt.includes("spotify") ||
      lowerPrompt.includes("playlist") ||
      lowerPrompt.includes("music") ||
      lowerPrompt.includes("song");

    const exaTracks = shouldUseExa
      ? await researchSpotifyTracksWithExa(prompt)
      : [];

    const operation = createMockOperation(prompt, exaTracks);

    return NextResponse.json({
      operation,
      exaTracks,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to create operation plan.",
      },
      { status: 500 },
    );
  }
}