import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify/spotify";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { url, state } = getSpotifyAuthUrl();
    const cookieStore = await cookies();

    cookieStore.set("spotify_auth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    });

    return NextResponse.redirect(url);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to start Spotify login." },
      { status: 500 },
    );
  }
}