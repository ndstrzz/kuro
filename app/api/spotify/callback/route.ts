import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/spotify/spotify";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("spotify_auth_state")?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/?spotify=denied`);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/?spotify=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    cookieStore.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: tokens.expires_in,
      path: "/",
    });

    if (tokens.refresh_token) {
      cookieStore.set("spotify_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    cookieStore.delete("spotify_auth_state");

    return NextResponse.redirect(`${appUrl}/?spotify=connected`);
  } catch (error) {
    console.error(error);

    return NextResponse.redirect(`${appUrl}/?spotify=error`);
  }
}