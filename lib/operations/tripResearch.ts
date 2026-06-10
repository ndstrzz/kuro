export type TripResearchResult = {
  title: string;
  tag: string;
  description: string;
  price: string;
  route: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  tripUrl: string;
};

export async function researchTripFlights(prompt: string): Promise<TripResearchResult[]> {
  const baseTripUrl = buildTripSearchUrl(prompt);

  const options: Omit<TripResearchResult, "tripUrl">[] = [
    {
      title: "TransNusa Morning Flight",
      tag: "LOWEST FARE",
      description:
        "Kuro will select this exact visible Trip.com flight row by matching airline, time, route, and price before clicking View Details.",
      price: "SGD 382",
      route: "CGK T3 → SIN T2",
      airline: "TransNusa",
      departureTime: "7:55 AM",
      arrivalTime: "10:45 AM",
      duration: "1h 50m",
      stops: "Nonstop",
      departureTerminal: "CGK T3",
      arrivalTerminal: "SIN T2",
    },
    {
      title: "Cheapest Flight Search",
      tag: "TRIP.COM FLIGHTS",
      description:
        "Kuro will look for the cheapest matching Trip.com flight option and stop before payment.",
      price: "Check live fare",
      route: "Flight-only search",
      airline: "Trip.com result",
      departureTime: "Flexible",
      arrivalTime: "Flexible",
      duration: "Varies",
      stops: "Any",
    },
    {
      title: "Convenient Direct Flight",
      tag: "CONVENIENT",
      description:
        "Kuro will prioritise a direct or convenient Trip.com flight option and stop before payment.",
      price: "Check live fare",
      route: "Flight-only search",
      airline: "Trip.com result",
      departureTime: "Convenient timing",
      arrivalTime: "Convenient timing",
      duration: "Varies",
      stops: "Prefer nonstop",
    },
  ];

  return options.map((option) => ({
    ...option,
    tripUrl: attachSelectedFlightDetails(baseTripUrl, option),
  }));
}

function attachSelectedFlightDetails(
  baseUrl: string,
  option: Omit<TripResearchResult, "tripUrl">
) {
  const url = new URL(baseUrl);

  url.searchParams.set("kuroAirline", option.airline);
  url.searchParams.set("kuroDepartureTime", option.departureTime);
  url.searchParams.set("kuroArrivalTime", option.arrivalTime);
  url.searchParams.set("kuroPrice", option.price);
  url.searchParams.set("kuroRoute", option.route);
  url.searchParams.set("kuroStops", option.stops);

  return url.toString();
}

function buildTripSearchUrl(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  if (
    lowerPrompt.includes("jakarta") ||
    lowerPrompt.includes("cgk") ||
    lowerPrompt.includes("jkt")
  ) {
    return "https://www.trip.com/flights/jakarta-to-singapore/airfares-jkt-sin/";
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