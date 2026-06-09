import { NextRequest, NextResponse } from "next/server";
import {
  addTracksToSpotifyPlaylist,
  buildPlaylistQueries,
  createSpotifyPlaylist,
  getSpotifyAccessTokenFromCookies,
  getSpotifyProfile,
  searchSpotifyTrackUris,
} from "@/lib/spotify/spotify";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const prompt =
      typeof body?.prompt === "string" && body.prompt.trim().length > 0
        ? body.prompt.trim()
        : "Create a calm Spotify playlist for my seminar";

    const playlistName =
      typeof body?.playlistName === "string" && body.playlistName.trim().length > 0
        ? body.playlistName.trim()
        : "Kuro AI Playlist";

    const selectedMood =
      typeof body?.selectedMood === "string" ? body.selectedMood : "";

    const accessToken = await getSpotifyAccessTokenFromCookies();

    if (!accessToken) {
      return NextResponse.json(
        {
          needsAuth: true,
          authUrl: "/api/spotify/login",
        },
        { status: 401 },
      );
    }

    const profile = await getSpotifyProfile(accessToken);

    const playlist = await createSpotifyPlaylist({
      accessToken,
      userId: profile.id,
      name: playlistName,
      description: `Created by Kuro AI. Prompt: ${prompt}`,
    });

    const queries = buildPlaylistQueries(prompt, selectedMood);

    const uris = await searchSpotifyTrackUris({
      accessToken,
      queries,
      limitPerQuery: 5,
    });

    await addTracksToSpotifyPlaylist({
      accessToken,
      playlistId: playlist.id,
      uris,
    });

    return NextResponse.json({
      success: true,
      playlistName: playlist.name,
      playlistUrl: playlist.external_urls.spotify,
      tracksAdded: uris.length,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Spotify playlist.",
      },
      { status: 500 },
    );
  }
}