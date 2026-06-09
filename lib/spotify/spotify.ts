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

export const spotifyScopes = [
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
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
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getRequiredEnv("SPOTIFY_CLIENT_ID"),
    scope: spotifyScopes,
    redirect_uri: getRequiredEnv("SPOTIFY_REDIRECT_URI"),
    state,
    show_dialog: "true",
  });

  return {
    url: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
    state,
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
    const text = await response.text();
    throw new Error(`Spotify token exchange failed: ${text}`);
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
    const text = await response.text();
    throw new Error(`Spotify refresh failed: ${text}`);
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

export async function getSpotifyAccessTokenFromCookies() {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (accessToken) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  const refreshed = await refreshSpotifyAccessToken(refreshToken);

  cookieStore.set("spotify_access_token", refreshed.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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

    console.error("Spotify API failed:", {
      endpoint,
      status: response.status,
      text,
    });

    throw new Error(`Spotify API error: ${text}`);
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
      public: false,
      collaborative: false,
    }),
  });
}

export function buildPlaylistSeeds(prompt: string, selectedMood?: string) {
  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Yiruma River Flows In You",
      "Nils Frahm Says",
      "Ólafur Arnalds Near Light",
      "Max Richter On The Nature Of Daylight",
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
      "smooth jazz instrumental",
      "calm piano music",
      "focus music instrumental",
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
      "jazz lounge instrumental",
      "cocktail jazz",
      "smooth bossa nova",
      "soft lounge music",
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
      "modern cafe pop",
      "soft upbeat background",
      "feel good indie",
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