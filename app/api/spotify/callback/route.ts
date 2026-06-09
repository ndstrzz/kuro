import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify/spotify";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const savedState = request.cookies.get("spotify_auth_state")?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kuro-three.vercel.app";

  if (error) {
    return NextResponse.redirect(`${appUrl}/?spotify=denied`);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/?spotify=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const response = NextResponse.redirect(`${appUrl}/?spotify=connected`);

    response.cookies.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: tokens.expires_in,
      path: "/",
    });

    if (tokens.refresh_token) {
      response.cookies.set("spotify_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    response.cookies.set("spotify_auth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${appUrl}/?spotify=error`);
  }
}