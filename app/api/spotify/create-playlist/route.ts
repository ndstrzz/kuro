import { NextRequest, NextResponse } from "next/server";
import {
  createSpotifyPlaylist,
  getSpotifyAccessTokenFromCookies,
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
      description: `Created by Kuro AI. Prompt: ${prompt}`,
    });

    return NextResponse.json({
      success: true,
      playlistName: playlist.name,
      playlistUrl: playlist.external_urls.spotify,
      tracksAdded: 0,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Spotify playlist.",
      },
      { status: 500 },
    );
  }
}