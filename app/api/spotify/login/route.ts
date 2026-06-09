import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify/spotify";

export const runtime = "nodejs";

export async function GET() {
  const { url, state } = getSpotifyAuthUrl();

  const response = NextResponse.redirect(url);

  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}