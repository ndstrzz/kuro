export type TripResearchResult = {
  title: string;
  tag: string;
  description: string;
  price: string;
  route: string;
  airline: string;
  departureTime: string;
  tripUrl: string;
};

export async function researchTripFlights(prompt: string): Promise<TripResearchResult[]> {
  const tripUrl = buildTripSearchUrl(prompt);

  return [
    {
      title: "Trip.com Flight Option",
      tag: "TRIP.COM FLIGHTS",
      description:
        "Kuro will only use Trip.com for flight search and flight booking workflows. It will stop before payment.",
      price: "Live Trip.com fare",
      route: "Based on your flight request",
      airline: "Trip.com flight result",
      departureTime: "Selected in Trip.com",
      tripUrl,
    },
    {
      title: "Cheapest Flight Search",
      tag: "LOWEST FARE",
      description:
        "Focused on finding a lower fare flight option from Trip.com flight results only.",
      price: "Check live fare",
      route: "Flight-only search",
      airline: "Trip.com comparison",
      departureTime: "Flexible",
      tripUrl,
    },
    {
      title: "Direct / Convenient Flight",
      tag: "CONVENIENT",
      description:
        "Focused on a cleaner flight option with fewer steps, better timing, or direct routing where available.",
      price: "Check live fare",
      route: "Flight-only search",
      airline: "Trip.com comparison",
      departureTime: "Convenient timing",
      tripUrl,
    },
  ];
}

function buildTripSearchUrl(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("jakarta")) {
    return "https://www.trip.com/flights/singapore-to-jakarta/airfares-sin-jkt/";
  }

  if (lowerPrompt.includes("bangkok")) {
    return "https://www.trip.com/flights/singapore-to-bangkok/airfares-sin-bkk/";
  }

  if (lowerPrompt.includes("kuala lumpur") || lowerPrompt.includes("kl")) {
    return "https://www.trip.com/flights/singapore-to-kuala-lumpur/airfares-sin-kul/";
  }

  if (lowerPrompt.includes("seoul") || lowerPrompt.includes("korea")) {
    return "https://www.trip.com/flights/singapore-to-seoul/airfares-sin-sel/";
  }

  if (lowerPrompt.includes("tokyo") || lowerPrompt.includes("japan")) {
    return "https://www.trip.com/flights/singapore-to-tokyo/airfares-sin-tyo/";
  }

  return "https://www.trip.com/flights/";
}