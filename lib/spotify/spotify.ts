import { cookies } from "next/headers";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
};

type SpotifySearchResponse = {
  tracks: {
    items: {
      uri: string;
      name: string;
    }[];
  };
};

export const spotifyScopes = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-private",
  "user-read-email",
].join(" ");

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getBasicAuthHeader() {
  return Buffer.from(
    `${getRequiredEnv("SPOTIFY_CLIENT_ID")}:${getRequiredEnv("SPOTIFY_CLIENT_SECRET")}`,
  ).toString("base64");
}

export function getSpotifyAuthUrl() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getRequiredEnv("SPOTIFY_CLIENT_ID"),
    scope: spotifyScopes,
    redirect_uri: getRequiredEnv("SPOTIFY_REDIRECT_URI"),
    state: crypto.randomUUID(),
    show_dialog: "true",
  });

  return {
    url: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
    state: params.get("state")!,
  };
}

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRequiredEnv("SPOTIFY_REDIRECT_URI"),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

export async function getSpotifyAccessTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get("spotify_access_token")?.value || null;
}

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit,
) {
  const response = await fetch(`${SPOTIFY_API_URL}${endpoint}`, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Spotify API failed:", {
      endpoint,
      status: response.status,
      text,
    });
    throw new Error(text);
  }

  if (response.status === 204) return null as T;

  return response.json() as Promise<T>;
}

export async function createSpotifyPlaylist({
  accessToken,
  name,
  description,
}: {
  accessToken: string;
  name: string;
  description: string;
}) {
  return spotifyFetch<SpotifyPlaylist>("/me/playlists", accessToken, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      public: false,
      collaborative: false,
    }),
  });
}

export async function searchSpotifyTrackUri({
  accessToken,
  query,
}: {
  accessToken: string;
  query: string;
}) {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
    market: "SG",
  });

  const result = await spotifyFetch<SpotifySearchResponse>(
    `/search?${params.toString()}`,
    accessToken,
  );

  return result.tracks.items[0]?.uri || null;
}

export async function addSingleTrackToPlaylist({
  accessToken,
  playlistId,
  uri,
}: {
  accessToken: string;
  playlistId: string;
  uri: string;
}) {
  return spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      uris: [uri],
      position: 0,
    }),
  });
}

export async function buildAndInsertTracks({
  accessToken,
  playlistId,
  prompt,
  selectedMood,
}: {
  accessToken: string;
  playlistId: string;
  prompt: string;
  selectedMood?: string;
}) {
  const seeds = buildPlaylistQueries(prompt, selectedMood);
  let added = 0;

  for (const seed of seeds) {
    try {
      const uri = await searchSpotifyTrackUri({
        accessToken,
        query: seed,
      });

      if (!uri) continue;

      await addSingleTrackToPlaylist({
        accessToken,
        playlistId,
        uri,
      });

      added += 1;
    } catch (error) {
      console.error(`Failed to add track for seed: ${seed}`, error);
    }
  }

  return added;
}

export function buildPlaylistQueries(prompt: string, selectedMood?: string) {
  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Nils Frahm Says",
      "Ólafur Arnalds Near Light",
      "Yiruma River Flows In You",
      "soft piano instrumental",
      "coffeehouse jazz instrumental",
      "lofi focus instrumental",
      "ambient study instrumental",
      "corporate lounge jazz",
      "bossa nova cafe instrumental",
      "peaceful piano",
      "deep focus instrumental",
      "minimal electronic focus",
      "calm background music",
      "jazz cafe instrumental",
      "soft acoustic instrumental",
      "modern classical piano",
      "study jazz instrumental",
      "chillhop instrumental",
      "ambient piano music",
    ];
  }

  if (lowerPrompt.includes("luxury") || lowerPrompt.includes("lounge")) {
    return [
      "luxury lounge jazz",
      "bossa nova cafe",
      "hotel lobby jazz",
      "smooth jazz instrumental",
      "chill lounge music",
      "elegant background music",
      "soft saxophone jazz",
      "modern jazz lounge",
      "cafe jazz instrumental",
      "dinner jazz instrumental",
    ];
  }

  return [
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "chill background music",
    "ambient study",
    "peaceful piano",
    "deep focus",
    "bossa nova cafe",
    "modern classical",
  ];
}