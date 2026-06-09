import { NextResponse } from "next/server";
import { createMockOperation } from "@/lib/agents/mockOperation";
import { searchTripFlightsWithExa, searchWithExa } from "@/lib/exa/search";

function inferRoute(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("jakarta")) return "Singapore → Jakarta";
  if (lowerPrompt.includes("bangkok")) return "Singapore → Bangkok";
  if (lowerPrompt.includes("seoul") || lowerPrompt.includes("korea")) {
    return "Singapore → Seoul";
  }
  if (lowerPrompt.includes("tokyo") || lowerPrompt.includes("japan")) {
    return "Singapore → Tokyo";
  }
  if (lowerPrompt.includes("bali") || lowerPrompt.includes("denpasar")) {
    return "Singapore → Bali";
  }

  return "Flight route from your request";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const operation = createMockOperation(prompt);

    if (operation.type === "flight") {
      const results = await searchTripFlightsWithExa(prompt);

      if (results.length === 0) {
        return NextResponse.json(
          {
            error:
              "Exa did not return any Trip.com flight results. Try adding a destination and travel date.",
          },
          { status: 404 }
        );
      }

      operation.recommendations = results.map((result, index) => ({
        id: `trip-flight-${index + 1}`,
        kind: "flight",
        title: result.flightName,
        subtitle: result.title,
        description:
          result.text.slice(0, 180) ||
          "Kuro found this live flight result directly from Trip.com.",
        metadata: "Trip.com flight",
        flightDetails: {
          route: inferRoute(prompt),
          airline: result.flightName,
          departureTime: result.flightTime,
          arrivalTime: "",
          duration: "View duration on Trip.com",
          stops: "View stops on Trip.com",
          price: result.price,
          baggage: "View baggage on Trip.com",
          cabinBag: "View cabin policy on Trip.com",
          bookingNote: "Kuro will open this selected Trip.com result.",
          tripUrl: result.url,
        },
      }));

      return NextResponse.json({ operation });
    }

    if (operation.type === "research") {
      const results = await searchWithExa(prompt);

      operation.recommendations = results.slice(0, 3).map((result, index) => ({
        id: `exa-${index + 1}`,
        kind: "standard",
        title: result.title,
        subtitle: result.url,
        description:
          result.text.slice(0, 180) ||
          "Kuro found this live result from the web.",
        metadata: "Live Exa result",
      }));
    }

    return NextResponse.json({ operation });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create operation plan." },
      { status: 500 }
    );
  }
}
