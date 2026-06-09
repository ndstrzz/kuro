import { NextResponse } from "next/server";
import { openTripFlightPage } from "@/lib/browser/openTrip";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tripUrl = body.tripUrl;
    const recommendationId = body.recommendationId;
    const recommendationTitle = body.recommendationTitle;

    if (!tripUrl || typeof tripUrl !== "string") {
      return NextResponse.json(
        { error: "Selected Trip.com URL is required." },
        { status: 400 }
      );
    }

    const result = await openTripFlightPage(tripUrl);

    return NextResponse.json({
      success: true,
      recommendationId,
      recommendationTitle,
      openedUrl: result.openedUrl,
      message: `Kuro opened the exact selected Trip.com option${
        recommendationId ? ` (${recommendationId})` : ""
      }.`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open selected Trip.com option.",
      },
      { status: 500 }
    );
  }
}
