import type { Operation, OperationType, Recommendation } from "@/types/operation";

function detectOperationType(prompt: string): OperationType {
  const lowerPrompt = prompt.toLowerCase();

  if (
    lowerPrompt.includes("flight") ||
    lowerPrompt.includes("ticket") ||
    lowerPrompt.includes("trip") ||
    lowerPrompt.includes("jakarta") ||
    lowerPrompt.includes("bangkok") ||
    lowerPrompt.includes("korea") ||
    lowerPrompt.includes("seoul") ||
    lowerPrompt.includes("japan") ||
    lowerPrompt.includes("tokyo")
  ) {
    return "flight";
  }

  if (
    lowerPrompt.includes("spotify") ||
    lowerPrompt.includes("playlist") ||
    lowerPrompt.includes("music") ||
    lowerPrompt.includes("song")
  ) {
    return "spotify";
  }

  if (
    lowerPrompt.includes("schedule") ||
    lowerPrompt.includes("calendar") ||
    lowerPrompt.includes("meeting")
  ) {
    return "calendar";
  }

  if (
    lowerPrompt.includes("research") ||
    lowerPrompt.includes("find") ||
    lowerPrompt.includes("search")
  ) {
    return "research";
  }

  return "general";
}

function getRecommendations(type: OperationType): Recommendation[] {
  if (type === "flight") {
    return [
      {
        id: "flight-1",
        kind: "flight",
        title: "Cheapest Route",
        subtitle: "Best for lowest fare",
        description: "Recommended if your main priority is saving money.",
        metadata: "Budget option",
        flightDetails: {
          route: "Singapore → Jakarta",
          airline: "Scoot / AirAsia",
          departureTime: "08:35",
          arrivalTime: "09:25",
          duration: "1h 50m",
          stops: "Direct",
          price: "From S$95",
          baggage: "Checked baggage may cost extra",
          cabinBag: "7kg cabin baggage",
          bookingNote: "Best for users travelling light.",
          tripUrl: "",
        },
      },
      {
        id: "flight-2",
        kind: "flight",
        title: "Best Value",
        subtitle: "Balanced price and timing",
        description: "Recommended for most users because it balances cost and convenience.",
        metadata: "Recommended",
        flightDetails: {
          route: "Singapore → Jakarta",
          airline: "Singapore Airlines / Garuda",
          departureTime: "11:15",
          arrivalTime: "12:05",
          duration: "1h 50m",
          stops: "Direct",
          price: "From S$135",
          baggage: "Usually includes checked baggage",
          cabinBag: "7kg cabin baggage",
          bookingNote: "Best overall choice if the price difference is acceptable.",
          tripUrl: "",
        },
      },
      {
        id: "flight-3",
        kind: "flight",
        title: "Earliest Departure",
        subtitle: "Reach as soon as possible",
        description: "Recommended if your priority is arriving early instead of saving money.",
        metadata: "Fastest option",
        flightDetails: {
          route: "Singapore → Jakarta",
          airline: "Jetstar / Scoot",
          departureTime: "06:20",
          arrivalTime: "07:10",
          duration: "1h 50m",
          stops: "Direct",
          price: "From S$160",
          baggage: "Checked baggage may cost extra",
          cabinBag: "7kg cabin baggage",
          bookingNote: "Best if arrival time matters most.",
          tripUrl: "",
        },
      },
    ];
  }

  if (type === "spotify") {
    return [
      {
        id: "spotify-1",
        kind: "spotify",
        title: "Seminar Focus",
        subtitle: "Professional, calm, mostly instrumental",
        description:
          "Best for seminars, presentations, workshops, and client-facing sessions where the music should feel polished but not distracting.",
        metadata: "Recommended",
        spotifyDetails: {
          mood: "Professional · Calm · Instrumental",
          estimatedTracks: "40–50 tracks",
          estimatedDuration: "2h 30m – 3h",
          source: "Spotify",
          playlistName: "Seminar Focus by Kuro",
        },
      },
      {
        id: "spotify-2",
        kind: "spotify",
        title: "Luxury Lounge",
        subtitle: "Jazz, bossa nova, soft beats",
        description:
          "A more premium and elegant playlist for receptions, business lounges, networking areas, or client events.",
        metadata: "Elegant mood",
        spotifyDetails: {
          mood: "Elegant · Lounge · Smooth",
          estimatedTracks: "35–45 tracks",
          estimatedDuration: "2h – 2h 45m",
          source: "Spotify",
          playlistName: "Luxury Lounge by Kuro",
        },
      },
      {
        id: "spotify-3",
        kind: "spotify",
        title: "Energetic Networking",
        subtitle: "Warm, upbeat, welcoming",
        description:
          "Best for the start or end of an event when guests are entering, talking, and networking.",
        metadata: "Light energy",
        spotifyDetails: {
          mood: "Warm · Upbeat · Social",
          estimatedTracks: "35–50 tracks",
          estimatedDuration: "2h – 3h",
          source: "Spotify",
          playlistName: "Energetic Networking by Kuro",
        },
      },
    ];
  }

  return [
    {
      id: "general-1",
      kind: "standard",
      title: "Research First",
      subtitle: "Gather live information",
      description: "Kuro will search, compare, and summarize the best options first.",
      metadata: "Recommended",
    },
    {
      id: "general-2",
      kind: "standard",
      title: "Plan Workflow",
      subtitle: "Break task into steps",
      description: "Kuro will prepare an execution plan before taking action.",
      metadata: "Safe mode",
    },
    {
      id: "general-3",
      kind: "standard",
      title: "Ask For Approval",
      subtitle: "Human-in-the-loop",
      description: "Kuro will wait for your confirmation before executing anything.",
      metadata: "Always enabled",
    },
  ];
}

export function createMockOperation(prompt: string): Operation {
  const type = detectOperationType(prompt);

  return {
    type,
    userPrompt: prompt,
    recommendations: getRecommendations(type),
  };
}