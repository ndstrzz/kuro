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

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getBasicAuthHeader() {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");

  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function getSpotifyAuthUrl() {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: spotifyScopes,
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });

  return {
    url: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
    state,
  };
}

export async function exchangeCodeForTokens(code: string) {
  const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

export async function refreshSpotifyAccessToken(refreshToken: string) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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

  const accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (accessToken) return accessToken;
  if (!refreshToken) return null;

  const refreshed = await refreshSpotifyAccessToken(refreshToken);

  cookieStore.set("spotify_access_token", refreshed.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: refreshed.expires_in,
    path: "/",
  });

  return refreshed.access_token;
}

export async function spotifyFetch<T>(
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

    console.error("Spotify API failed", {
      endpoint,
      status: response.status,
      text,
    });

    throw new Error(text);
  }

  if (response.status === 204) {
    return null as T;
  }

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
      public: true,
      collaborative: false,
    }),
  });
}

export function buildPlaylistSeeds(prompt: string, selectedMood?: string) {
  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Nils Frahm Says",
      "Olafur Arnalds Near Light",
      "soft piano instrumental",
      "coffeehouse jazz instrumental",
      "lofi focus instrumental",
      "ambient study music",
      "corporate lounge jazz",
      "bossa nova cafe instrumental",
      "peaceful piano",
    ];
  }

  if (lowerPrompt.includes("luxury") || lowerPrompt.includes("lounge")) {
    return [
      "luxury lounge jazz",
      "smooth jazz instrumental",
      "bossa nova cafe",
      "hotel lobby jazz",
      "soft saxophone jazz",
      "modern jazz lounge",
      "elegant background music",
      "chill lounge music",
    ];
  }

  if (lowerPrompt.includes("energetic") || lowerPrompt.includes("networking")) {
    return [
      "upbeat lounge music",
      "warm indie pop",
      "feel good pop",
      "light electronic upbeat",
      "networking event background",
      "happy acoustic pop",
      "chill upbeat songs",
    ];
  }

  return [
    prompt,
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "chill background music",
  ];
}

export async function searchSpotifyTrackUris({
  accessToken,
  seeds,
}: {
  accessToken: string;
  seeds: string[];
}) {
  const uris: string[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const params = new URLSearchParams({
      q: seed,
      type: "track",
      limit: "3",
      market: "SG",
    });

    try {
      const result = await spotifyFetch<SpotifySearchResponse>(
        `/search?${params.toString()}`,
        accessToken,
      );

      for (const track of result.tracks.items) {
        if (track.uri && track.uri.startsWith("spotify:track:") && !seen.has(track.uri)) {
          seen.add(track.uri);
          uris.push(track.uri);
        }
      }
    } catch (error) {
      console.error("Track search failed:", seed, error);
    }
  }

  return uris.slice(0, 30);
}

export async function addTracksToSpotifyPlaylist({
  accessToken,
  playlistId,
  uris,
}: {
  accessToken: string;
  playlistId: string;
  uris: string[];
}) {
  let added = 0;

  for (const uri of uris) {
    try {
      await spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          uris: [uri],
          position: added,
        }),
      });

      added += 1;
    } catch (error) {
      console.error("Failed to add track:", uri, error);
    }
  }

  return added;
}