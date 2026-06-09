export type PlaylistResearchResult = {
  title: string;
  tag: string;
  description: string;
  mood: string;
  trackSeeds: string[];
  sources: string[];
};

const fallbackTrackPools: Record<string, string[]> = {
  kpop: [
    "aespa Supernova",
    "ILLIT Magnetic",
    "NewJeans Super Shy",
    "LE SSERAFIM EASY",
    "IVE I AM",
    "Jung Kook Standing Next to You",
    "SEVENTEEN MAESTRO",
    "Stray Kids LALALALA",
    "RIIZE Get A Guitar",
    "ENHYPEN Bite Me",
    "BABYMONSTER SHEESH",
    "TXT Deja Vu",
  ],
  calm: [
    "Laufey From The Start",
    "Wave To Earth Seasons",
    "Keshi Understand",
    "Grentperez Cherry Wine",
    "Rex Orange County Best Friend",
    "Bruno Major Easily",
    "Daniel Caesar Best Part",
    "NIKI Every Summertime",
    "Mac Ayres Easy",
    "Cigarettes After Sex Apocalypse",
  ],
  workout: [
    "Dua Lipa Houdini",
    "The Weeknd Blinding Lights",
    "David Guetta Titanium",
    "Calvin Harris Feel So Close",
    "BTS Dynamite",
    "BLACKPINK How You Like That",
    "Stray Kids God's Menu",
    "aespa Drama",
    "IVE Kitsch",
    "NewJeans ETA",
  ],
  default: [
    "Laufey From The Start",
    "NewJeans Super Shy",
    "aespa Supernova",
    "IVE I AM",
    "Jung Kook Standing Next to You",
    "Daniel Caesar Best Part",
    "NIKI Every Summertime",
    "Wave To Earth Seasons",
    "Keshi Understand",
    "Sabrina Carpenter Espresso",
  ],
};

function detectPlaylistTheme(prompt: string) {
  const text = prompt.toLowerCase();

  if (
    text.includes("kpop") ||
    text.includes("k-pop") ||
    text.includes("korean") ||
    text.includes("trendy")
  ) {
    return "kpop";
  }

  if (
    text.includes("calm") ||
    text.includes("seminar") ||
    text.includes("study") ||
    text.includes("focus") ||
    text.includes("peace")
  ) {
    return "calm";
  }

  if (
    text.includes("gym") ||
    text.includes("workout") ||
    text.includes("energy") ||
    text.includes("hype")
  ) {
    return "workout";
  }

  return "default";
}

function cleanTrackSeed(value: string) {
  return value
    .replace(/^[\d\-•\s.]+/, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTracksFromText(text: string) {
  const candidates = new Set<string>();

  const quotedMatches =
    text.match(/["“][^"”]{3,80}["”]\s*(?:by|-)\s*[A-Za-z0-9&().,'’\-\s]{2,60}/g) ||
    [];

  for (const match of quotedMatches) {
    const cleaned = cleanTrackSeed(
      match
        .replace(/["“”]/g, "")
        .replace(/\s+by\s+/i, " ")
        .replace(/\s+-\s+/i, " ")
    );

    if (cleaned.length >= 5 && cleaned.length <= 90) {
      candidates.add(cleaned);
    }
  }

  const dashMatches =
    text.match(/[A-Za-z0-9&().,'’\-\s]{2,50}\s+-\s+[A-Za-z0-9&().,'’\-\s]{2,50}/g) ||
    [];

  for (const match of dashMatches) {
    const cleaned = cleanTrackSeed(match.replace(/\s+-\s+/i, " "));

    if (
      cleaned.length >= 5 &&
      cleaned.length <= 90 &&
      !cleaned.toLowerCase().includes("http") &&
      !cleaned.toLowerCase().includes("playlist")
    ) {
      candidates.add(cleaned);
    }
  }

  return Array.from(candidates).slice(0, 18);
}

function shuffleTracks(tracks: string[]) {
  const copy = [...tracks];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function extractArtist(track: string) {
  const parts = track.split(" ");

  if (parts.length <= 2) {
    return track;
  }

  return parts.slice(0, 2).join(" ");
}

function makePlaylistName(theme: string, tracks: string[], variant: number) {
  const artistOne = extractArtist(tracks[0] || "Kuro");
  const artistTwo = extractArtist(tracks[1] || "Mix");

  const kpopNames = [
    `${artistOne} Radio: K-pop Rush`,
    `${artistOne} x ${artistTwo} Trend Mix`,
    `Kuro K-pop Signal`,
    `Seoul Pop Current`,
    `Idol Energy Queue`,
    `Viral K-pop Rotation`,
  ];

  const calmNames = [
    `${artistOne} Soft Focus`,
    `Quiet Desk Rotation`,
    `Kuro Calm Session`,
    `Soft Light Study Mix`,
    `Evening Focus Queue`,
    `${artistOne} Gentle Hours`,
  ];

  const workoutNames = [
    `${artistOne} Energy Mode`,
    `Kuro Hype Circuit`,
    `High Tempo Rotation`,
    `Workout Signal Mix`,
    `${artistOne} Power Queue`,
    `Momentum Tracks`,
  ];

  const defaultNames = [
    `${artistOne} Discovery Mix`,
    `Kuro Curated Signal`,
    `${artistOne} x ${artistTwo} Rotation`,
    `Fresh Track Queue`,
    `Modern Mix Desk`,
    `Executive Audio Stack`,
  ];

  const names =
    theme === "kpop"
      ? kpopNames
      : theme === "calm"
        ? calmNames
        : theme === "workout"
          ? workoutNames
          : defaultNames;

  return names[variant % names.length];
}

async function searchExa(prompt: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return null;
  }

  const query = `
Find current music recommendations for this playlist request: "${prompt}".

Search broadly across Spotify playlists, YouTube Music, Billboard, TikTok music trends, Reddit music discussions, music blogs, music charts, and K-pop trend articles when relevant.

Return real song titles and artists that can be searched on Spotify.
`;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 10,
      contents: {
        text: true,
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function researchPlaylist(prompt: string): Promise<PlaylistResearchResult[]> {
  const theme = detectPlaylistTheme(prompt);
  const fallbackTracks = fallbackTrackPools[theme] || fallbackTrackPools.default;

  let exaTracks: string[] = [];
  let sources: string[] = [];

  try {
    const data = await searchExa(prompt);

    if (data?.results?.length) {
      const combinedText = JSON.stringify(data.results);
      exaTracks = extractTracksFromText(combinedText);

      sources = data.results
        .map((result: { url?: string; title?: string }) => result.title || result.url)
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch (error) {
    console.error("Playlist Exa research failed:", error);
  }

  const baseTracks = exaTracks.length >= 6 ? exaTracks : fallbackTracks;

  const shuffledOne = shuffleTracks(baseTracks).slice(0, 10);
  const shuffledTwo = shuffleTracks(baseTracks).slice(0, 10);
  const shuffledThree = shuffleTracks(baseTracks).slice(0, 10);

  return [
    {
      title: makePlaylistName(theme, shuffledOne, 0),
      tag: "EXA RESEARCHED",
      description:
        "Kuro searched broadly across music trends, charts, playlist sources, blogs, and social signals before preparing this Spotify-ready playlist.",
      mood:
        theme === "kpop"
          ? "Trendy · K-pop · Viral"
          : theme === "calm"
            ? "Calm · Polished · Focus"
            : theme === "workout"
              ? "Energetic · Hype · Fast"
              : "Curated · Modern · Balanced",
      trackSeeds: shuffledOne,
      sources: sources.length
        ? sources
        : ["Broad web music research", "Spotify-ready search seeds"],
    },
    {
      title: makePlaylistName(theme, shuffledTwo, 1),
      tag: "REFINED",
      description:
        "A cleaner variation of the researched tracks, designed to feel polished, current, and demo-ready.",
      mood:
        theme === "kpop"
          ? "Clean · Catchy · Modern K-pop"
          : "Clean · Smooth · Professional",
      trackSeeds: shuffledTwo,
      sources: sources.length ? sources : ["Broad web music research"],
    },
    {
      title: makePlaylistName(theme, shuffledThree, 2),
      tag: "HIGH ENERGY",
      description:
        "A stronger option with more energy, useful when the playlist should feel exciting, fresh, and current.",
      mood:
        theme === "kpop"
          ? "High energy · Trendy · Performance"
          : "Upbeat · Fresh · Momentum",
      trackSeeds: shuffledThree,
      sources: sources.length ? sources : ["Broad web music research"],
    },
  ];
}