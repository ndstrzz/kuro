import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const browserAgentUrl = process.env.NEXT_PUBLIC_BROWSER_AGENT_URL;

    if (!browserAgentUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "NEXT_PUBLIC_BROWSER_AGENT_URL is missing.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    const response = await fetch(`${browserAgentUrl}/spotify/browser-add-tracks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to contact browser agent.",
      },
      { status: 500 },
    );
  }
}