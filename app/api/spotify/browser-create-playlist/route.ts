import { NextRequest, NextResponse } from "next/server";
import {
  createSpotifyPlaylist,
  getSpotifyAccessTokenFromCookies,
} from "@/lib/spotify/spotify";
import { createSpotifyPlaylistWithBrowserAgent } from "@/lib/browser/createSpotifyPlaylist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const playlist = await createSpotifyPlaylist({
      accessToken,
      name: playlistName,
      description: `Created by Kuro AI Browser Agent. Prompt: ${prompt}`,
    });

    const browserResult = await createSpotifyPlaylistWithBrowserAgent({
      playlistUrl: playlist.external_urls.spotify,
      playlistName: playlist.name,
      prompt,
      selectedMood,
    });

    return NextResponse.json({
      success: true,
      playlistName: playlist.name,
      playlistUrl: playlist.external_urls.spotify,
      tracksAdded: browserResult.tracksAdded,
      message: browserResult.message,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Spotify playlist with browser agent.",
      },
      { status: 500 },
    );
  }
}