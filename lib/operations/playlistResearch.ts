export type PlaylistResearchResult = {
  title: string;
  tag: string;
  description: string;
  mood: string;
  trackSeeds: string[];
  sources: string[];
};

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
};

type GeneratedPlaylist = {
  title: string;
  tag: string;
  description: string;
  mood: string;
  trackSeeds: string[];
};

function cleanText(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTrackSeed(value: string) {
  return cleanText(value)
    .replace(/^[\d\-•.\s]+/, "")
    .replace(/^n\d+\.?/i, "")
    .replace(/\(official.*?\)/gi, "")
    .replace(/\(lyrics.*?\)/gi, "")
    .replace(/\(music video.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .trim();
}

function isBadTrack(value: string) {
  const text = value.toLowerCase();

  return (
    value.length < 4 ||
    value.length > 80 ||
    text.includes("playlist") ||
    text.includes("http") ||
    text.includes("lyrics") ||
    text.includes("video") ||
    text.includes("album") ||
    text.includes("chart") ||
    text.includes("reddit") ||
    text.includes("spotify") ||
    text.includes("youtube") ||
    text.includes("billboard") ||
    text.includes("tiktok") ||
    /^n\d+/i.test(value)
  );
}

function dedupeTracks(tracks: string[]) {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    const key = track.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン]/g, "");

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function extractTracksFromResearchText(text: string) {
  const candidates = new Set<string>();

  const patterns = [
    /"([^"]{2,50})"\s*(?:by|-|–|—)\s*([^"',.]{2,40})/g,
    /“([^”]{2,50})”\s*(?:by|-|–|—)\s*([^"',.]{2,40})/g,
    /([A-Za-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン&().,'’\s]{2,40})\s+(?:by)\s+([A-Za-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン&().,'’\s]{2,35})/g,
    /([A-Za-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン&().,'’\s]{2,35})\s*[-–—]\s*([A-Za-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン&().,'’\s]{2,45})/g,
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const first = cleanTrackSeed(match[1] || "");
      const second = cleanTrackSeed(match[2] || "");

      const artistTitle = cleanTrackSeed(`${second} ${first}`);
      const titleArtist = cleanTrackSeed(`${first} ${second}`);

      if (!isBadTrack(artistTitle)) candidates.add(artistTitle);
      if (!isBadTrack(titleArtist)) candidates.add(titleArtist);
    }
  }

  return dedupeTracks(Array.from(candidates)).slice(0, 30);
}

function getPromptKeywords(prompt: string) {
  return prompt
    .replace(/[^\w\s\u4e00-\u9fff가-힣ぁ-んァ-ン]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .filter(
      (word) =>
        ![
          "create",
          "playlist",
          "songs",
          "song",
          "music",
          "spotify",
          "please",
          "want",
          "need",
          "make",
          "for",
          "the",
          "and",
          "with",
        ].includes(word.toLowerCase())
    )
    .slice(0, 4);
}

function makeDynamicPlaylistTitle(prompt: string, tracks: string[], index: number) {
  const keywords = getPromptKeywords(prompt);
  const keyword = keywords[index] || keywords[0] || "Kuro";
  const trackAnchor = tracks[index]?.split(" ").slice(0, 2).join(" ") || "Signal";

  const titleStyles = [
    `${keyword} Trend Radar`,
    `${trackAnchor} Rotation`,
    `${keyword} Current Mix`,
  ];

  return titleStyles[index] || `${keyword} Mix`;
}

function makeMood(prompt: string, index: number) {
  const keywords = getPromptKeywords(prompt);
  const base = keywords.length ? keywords.join(" · ") : "Fresh · Curated";

  if (index === 0) return `${base} · Trendy`;
  if (index === 1) return `${base} · Refined`;
  return `${base} · High Energy`;
}

function makeDescription(index: number) {
  if (index === 0) {
    return "Kuro searched broadly across music trends, playlists, charts, articles, and social music discussions before preparing this Spotify-ready set.";
  }

  if (index === 1) {
    return "A cleaner variation of the researched tracks, built from the same Exa research but arranged to feel more polished and demo-ready.";
  }

  return "A stronger, more energetic version of the researched tracks for a playlist that feels current and lively.";
}

function shuffleTracks(tracks: string[]) {
  return [...tracks].sort(() => Math.random() - 0.5);
}

async function searchExa(prompt: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("EXA_API_KEY is missing.");
  }

  const query = `
Find real current song recommendations for this exact playlist request:

"${prompt}"

Search broadly across the web, including Spotify playlists, YouTube Music, Apple Music, Billboard, TikTok music trends, Reddit music discussions, music blogs, and music charts.

Return real song title and artist pairs only.
Do not return playlist names.
Do not return generic article summaries.
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
      numResults: 12,
      contents: {
        text: true,
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa search failed with status ${response.status}.`);
  }

  return response.json();
}

async function generatePlaylistsWithOpenAI(
  prompt: string,
  researchText: string,
  extractedTracks: string[]
): Promise<GeneratedPlaylist[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are Kuro, an executive AI music curator. Return only valid JSON. No markdown.",
        },
        {
          role: "user",
          content: `
Create 3 unique Spotify playlist options for this request:

${prompt}

Use the Exa research below and the extracted track candidates.
Do not invent fake song names.
Do not use playlist names from articles.
Each playlist must have:
- title
- tag
- description
- mood
- trackSeeds: 8 to 10 Spotify search queries in "artist song title" format

Exa research text:
${researchText.slice(0, 12000)}

Extracted candidates:
${JSON.stringify(extractedTracks.slice(0, 30))}

Return JSON:
{
  "playlists": [
    {
      "title": "...",
      "tag": "...",
      "description": "...",
      "mood": "...",
      "trackSeeds": ["artist song", "..."]
    }
  ]
}
`,
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const playlists = parsed.playlists;

    if (!Array.isArray(playlists)) return null;

    return playlists
      .map((playlist) => ({
        title: cleanText(String(playlist.title || "")),
        tag: cleanText(String(playlist.tag || "EXA RESEARCHED")),
        description: cleanText(String(playlist.description || "")),
        mood: cleanText(String(playlist.mood || "")),
        trackSeeds: dedupeTracks(
          Array.isArray(playlist.trackSeeds)
            ? playlist.trackSeeds.map((track: string) => cleanTrackSeed(String(track)))
            : []
        ).filter((track) => !isBadTrack(track)),
      }))
      .filter((playlist) => playlist.title && playlist.trackSeeds.length >= 4)
      .slice(0, 3);
  } catch {
    return null;
  }
}

function generatePlaylistsWithoutHardcodedFallback(
  prompt: string,
  tracks: string[]
): GeneratedPlaylist[] {
  const safeTracks = dedupeTracks(tracks.filter((track) => !isBadTrack(track)));

  const setOne = shuffleTracks(safeTracks).slice(0, 10);
  const setTwo = shuffleTracks(safeTracks).slice(0, 10);
  const setThree = shuffleTracks(safeTracks).slice(0, 10);

  return [setOne, setTwo, setThree].map((trackSet, index) => ({
    title: makeDynamicPlaylistTitle(prompt, trackSet, index),
    tag: index === 0 ? "EXA RESEARCHED" : index === 1 ? "REFINED" : "HIGH ENERGY",
    description: makeDescription(index),
    mood: makeMood(prompt, index),
    trackSeeds: trackSet,
  }));
}

export async function researchPlaylist(prompt: string): Promise<PlaylistResearchResult[]> {
  const data = await searchExa(prompt);
  const results: ExaResult[] = data.results || [];

  const sources = results
    .map((result) => result.title || result.url)
    .filter(Boolean)
    .slice(0, 5) as string[];

  const researchText = results
    .map((result) =>
      [
        result.title || "",
        result.url || "",
        result.text || "",
        Array.isArray(result.highlights) ? result.highlights.join(" ") : "",
      ].join(" ")
    )
    .join("\n\n");

  const extractedTracks = extractTracksFromResearchText(researchText);

  if (extractedTracks.length < 4) {
    throw new Error(
      "Exa research did not return enough usable song titles. Try a more specific playlist request."
    );
  }

  const aiPlaylists =
    (await generatePlaylistsWithOpenAI(prompt, researchText, extractedTracks)) || [];

  const playlists =
    aiPlaylists.length >= 3
      ? aiPlaylists
      : generatePlaylistsWithoutHardcodedFallback(prompt, extractedTracks);

  return playlists.slice(0, 3).map((playlist) => ({
    title: playlist.title,
    tag: playlist.tag,
    description: playlist.description,
    mood: playlist.mood,
    trackSeeds: playlist.trackSeeds.slice(0, 10),
    sources: sources.length ? sources : ["Exa web research"],
  }));
}