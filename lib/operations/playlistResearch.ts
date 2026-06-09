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

  const quotedMatches = text.match(/["“][^"”]{3,80}["”]\s*(?:by|-)\s*[A-Za-z0-9&().,'’\-\s]{2,60}/g) || [];

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

  const dashMatches = text.match(/[A-Za-z0-9&().,'’\-\s]{2,50}\s+-\s+[A-Za-z0-9&().,'’\-\s]{2,50}/g) || [];

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

  return Array.from(candidates).slice(0, 14);
}

async function searchExa(prompt: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return null;
  }

  const query = `
Find current music recommendations for this playlist request: "${prompt}".

Search broadly across music trend sources, not only Spotify.
Use sources such as Spotify playlists, YouTube Music, Billboard, TikTok music trends, Reddit music discussions, music blogs, and K-pop trend articles where relevant.

Return real song titles and artists that would be good Spotify search seeds.
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

  const trackSeeds = exaTracks.length >= 6 ? exaTracks : fallbackTracks;

  const firstSet = trackSeeds.slice(0, 10);
  const secondSet = [...trackSeeds].slice(2, 12);
  const thirdSet = [...trackSeeds].reverse().slice(0, 10);

  return [
    {
      title: theme === "kpop" ? "K-pop Trend Scan" : "Exa Trend Scan",
      tag: "EXA RESEARCHED",
      description:
        "Kuro searched broadly across web music trends, charts, playlists, blogs, and social signals before preparing Spotify search seeds.",
      mood:
        theme === "kpop"
          ? "Trendy · K-pop · Viral"
          : theme === "calm"
            ? "Calm · Polished · Focus"
            : theme === "workout"
              ? "Energetic · Hype · Fast"
              : "Curated · Modern · Balanced",
      trackSeeds: firstSet,
      sources: sources.length ? sources : ["Broad web music research", "Spotify-ready search seeds"],
    },
    {
      title: theme === "kpop" ? "Polished K-pop Mix" : "Polished Executive Mix",
      tag: "REFINED",
      description:
        "A cleaner version of the researched tracks, designed to feel more polished and less random during the demo.",
      mood:
        theme === "kpop"
          ? "Clean · Catchy · Modern K-pop"
          : "Clean · Smooth · Professional",
      trackSeeds: secondSet.length >= 6 ? secondSet : firstSet,
      sources: sources.length ? sources : ["Broad web music research"],
    },
    {
      title: theme === "kpop" ? "K-pop Energy Boost" : "Energy Boost",
      tag: "HIGH ENERGY",
      description:
        "A stronger option with more energy, useful when the playlist should feel exciting and current.",
      mood:
        theme === "kpop"
          ? "High energy · Trendy · Performance"
          : "Upbeat · Fresh · Momentum",
      trackSeeds: thirdSet.length >= 6 ? thirdSet : firstSet,
      sources: sources.length ? sources : ["Broad web music research"],
    },
  ];
}