import { NextRequest, NextResponse } from "next/server";
import {
  addTracksToSpotifyPlaylist,
  buildPlaylistQueries,
  createSpotifyPlaylist,
  getSpotifyAccessTokenFromCookies,
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

    const playlist = await createSpotifyPlaylist({
      accessToken,
      name: playlistName,
      description: `Created by Kuro AI. Prompt: ${prompt}`,
    });

    let tracksAdded = 0;
    let trackWarning = "";

    try {
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

      tracksAdded = uris.length;
    } catch (trackError) {
      console.error("Playlist created but failed to add tracks:", trackError);
      trackWarning = "Playlist was created, but Spotify blocked automatic track adding.";
    }

    return NextResponse.json({
      success: true,
      playlistName: playlist.name,
      playlistUrl: playlist.external_urls.spotify,
      tracksAdded,
      warning: trackWarning,
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