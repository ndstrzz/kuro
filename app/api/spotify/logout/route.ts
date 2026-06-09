import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const response = NextResponse.redirect("https://kuro-three.vercel.app");

  response.cookies.set("spotify_access_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 0,
    path: "/",
  });

  response.cookies.set("spotify_refresh_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 0,
    path: "/",
  });

  response.cookies.set("spotify_auth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}