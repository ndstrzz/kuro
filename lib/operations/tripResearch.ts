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

type UserLocation = {
  city?: string;
  country?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
};

type ParsedFlightRequest = {
  originCity: string;
  originCountry: string;
  originAirportCode: string;
  destinationCity: string;
  destinationCountry: string;
  destinationAirportCode: string;
  dateText: string;
  tripType: "one-way" | "round-trip";
  priority: "cheapest" | "fastest" | "direct" | "balanced";
};

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fallbackOriginFromLocation(userLocation: UserLocation) {
  const city = userLocation.city || "";
  const country = userLocation.country || "";

  if (country === "SG" || city.toLowerCase().includes("singapore")) {
    return {
      originCity: "Singapore",
      originCountry: "Singapore",
      originAirportCode: "SIN",
    };
  }

  return {
    originCity: city || "Singapore",
    originCountry: country || "Singapore",
    originAirportCode: country === "SG" ? "SIN" : "",
  };
}

async function parseFlightRequestWithOpenAI(
  prompt: string,
  userLocation: UserLocation
): Promise<ParsedFlightRequest> {
  const fallbackOrigin = fallbackOriginFromLocation(userLocation);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackParseFlightRequest(prompt, fallbackOrigin);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You extract flight search details. Return only valid JSON. Do not add markdown.",
        },
        {
          role: "user",
          content: `
User request:
${prompt}

Approx user location from hosting headers:
${JSON.stringify(userLocation)}

If origin is not mentioned, infer origin from current country/location.
Use the nearest major international airport code.
If user says tonight/today/tomorrow, preserve that as dateText.

Return JSON:
{
  "originCity": "...",
  "originCountry": "...",
  "originAirportCode": "SIN",
  "destinationCity": "...",
  "destinationCountry": "...",
  "destinationAirportCode": "JFK",
  "dateText": "tonight",
  "tripType": "one-way",
  "priority": "cheapest"
}
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallbackParseFlightRequest(prompt, fallbackOrigin);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return fallbackParseFlightRequest(prompt, fallbackOrigin);
  }

  try {
    const parsed = JSON.parse(content);

    return {
      originCity: clean(String(parsed.originCity || fallbackOrigin.originCity)),
      originCountry: clean(String(parsed.originCountry || fallbackOrigin.originCountry)),
      originAirportCode: clean(String(parsed.originAirportCode || fallbackOrigin.originAirportCode)).toUpperCase(),
      destinationCity: clean(String(parsed.destinationCity || "Destination")),
      destinationCountry: clean(String(parsed.destinationCountry || "")),
      destinationAirportCode: clean(String(parsed.destinationAirportCode || "")).toUpperCase(),
      dateText: clean(String(parsed.dateText || "next available")),
      tripType:
        parsed.tripType === "round-trip" || parsed.tripType === "one-way"
          ? parsed.tripType
          : "one-way",
      priority:
        parsed.priority === "fastest" ||
        parsed.priority === "direct" ||
        parsed.priority === "balanced"
          ? parsed.priority
          : "cheapest",
    };
  } catch {
    return fallbackParseFlightRequest(prompt, fallbackOrigin);
  }
}

function fallbackParseFlightRequest(
  prompt: string,
  fallbackOrigin: {
    originCity: string;
    originCountry: string;
    originAirportCode: string;
  }
): ParsedFlightRequest {
  const text = prompt.toLowerCase();

  let destinationCity = "New York";
  let destinationCountry = "United States";
  let destinationAirportCode = "JFK";

  if (text.includes("jakarta")) {
    destinationCity = "Jakarta";
    destinationCountry = "Indonesia";
    destinationAirportCode = "CGK";
  } else if (text.includes("bangkok")) {
    destinationCity = "Bangkok";
    destinationCountry = "Thailand";
    destinationAirportCode = "BKK";
  } else if (text.includes("tokyo")) {
    destinationCity = "Tokyo";
    destinationCountry = "Japan";
    destinationAirportCode = "TYO";
  } else if (text.includes("seoul")) {
    destinationCity = "Seoul";
    destinationCountry = "South Korea";
    destinationAirportCode = "SEL";
  } else if (text.includes("london")) {
    destinationCity = "London";
    destinationCountry = "United Kingdom";
    destinationAirportCode = "LON";
  }

  const dateText = text.includes("tonight")
    ? "tonight"
    : text.includes("tomorrow")
      ? "tomorrow"
      : "next available";

  return {
    ...fallbackOrigin,
    destinationCity,
    destinationCountry,
    destinationAirportCode,
    dateText,
    tripType: text.includes("round trip") || text.includes("return") ? "round-trip" : "one-way",
    priority: text.includes("direct") ? "direct" : "cheapest",
  };
}

async function searchExaFlights(parsed: ParsedFlightRequest) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("EXA_API_KEY is missing.");
  }

  const query = `
Find current flight options and cheap airfare information for:
${parsed.originCity} (${parsed.originAirportCode}) to ${parsed.destinationCity} (${parsed.destinationAirportCode})
Date: ${parsed.dateText}
Trip type: ${parsed.tripType}
Priority: ${parsed.priority}

Search broadly across Trip.com flight pages and flight result sources.
Prioritise real visible flight details: airline, departure time, arrival time, price, duration, stops, airport terminals.
`;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 8,
      contents: {
        text: true,
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa flight search failed with status ${response.status}.`);
  }

  return response.json();
}

async function generateFlightOptionsWithOpenAI(
  parsed: ParsedFlightRequest,
  researchText: string,
  tripUrl: string
): Promise<TripResearchResult[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You create flight recommendation cards from flight research. Return only valid JSON.",
        },
        {
          role: "user",
          content: `
Create up to 3 flight recommendation cards from this Exa research.

Flight request:
${JSON.stringify(parsed)}

Exa research:
${researchText.slice(0, 10000)}

Rules:
- Prefer real-looking airline, time, route, price, duration, stops from research.
- If exact values are unavailable, say "Check live fare" or "Check live timing".
- Include price in every option.
- Do not invent impossible data.
- The browser agent will use airline, departureTime, arrivalTime, price, and stops to match a Trip.com row.

Return JSON:
{
  "flights": [
    {
      "title": "...",
      "tag": "LOWEST FARE",
      "description": "...",
      "price": "SGD 1234",
      "route": "SIN → JFK",
      "airline": "...",
      "departureTime": "...",
      "arrivalTime": "...",
      "duration": "...",
      "stops": "Nonstop"
    }
  ]
}
`,
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) return null;

  try {
    const parsedContent = JSON.parse(content);
    const flights = parsedContent.flights;

    if (!Array.isArray(flights)) return null;

    return flights.slice(0, 3).map((flight, index) => ({
      title: clean(String(flight.title || `Flight Option ${index + 1}`)),
      tag: clean(String(flight.tag || (index === 0 ? "LOWEST FARE" : "TRIP.COM"))),
      description: clean(
        String(
          flight.description ||
            "Kuro will open Trip.com and select the matching visible flight row."
        )
      ),
      price: clean(String(flight.price || "Check live fare")),
      route: clean(
        String(
          flight.route ||
            `${parsed.originAirportCode || parsed.originCity} → ${
              parsed.destinationAirportCode || parsed.destinationCity
            }`
        )
      ),
      airline: clean(String(flight.airline || "Trip.com result")),
      departureTime: clean(String(flight.departureTime || "Check live timing")),
      arrivalTime: clean(String(flight.arrivalTime || "Check live timing")),
      duration: clean(String(flight.duration || "Check live duration")),
      stops: clean(String(flight.stops || "Check live stops")),
      tripUrl: attachSelectedFlightDetails(tripUrl, {
        airline: clean(String(flight.airline || "Trip.com result")),
        departureTime: clean(String(flight.departureTime || "Check live timing")),
        arrivalTime: clean(String(flight.arrivalTime || "Check live timing")),
        price: clean(String(flight.price || "Check live fare")),
        route: clean(
          String(
            flight.route ||
              `${parsed.originAirportCode || parsed.originCity} → ${
                parsed.destinationAirportCode || parsed.destinationCity
              }`
          )
        ),
        stops: clean(String(flight.stops || "Check live stops")),
      }),
    }));
  } catch {
    return null;
  }
}

function createFallbackFlightOptions(
  parsed: ParsedFlightRequest,
  tripUrl: string
): TripResearchResult[] {
  const route = `${parsed.originAirportCode || parsed.originCity} → ${
    parsed.destinationAirportCode || parsed.destinationCity
  }`;

  const base = {
    route,
    airline: "Trip.com result",
    departureTime: "Check live timing",
    arrivalTime: "Check live timing",
    duration: "Check live duration",
    stops: parsed.priority === "direct" ? "Prefer nonstop" : "Any",
  };

  return [
    {
      title: `${parsed.destinationCity} Cheapest Flight`,
      tag: "LOWEST FARE",
      description:
        "Kuro will open Trip.com and select the best matching cheap flight row from live results.",
      price: "Check live fare",
      ...base,
      tripUrl: attachSelectedFlightDetails(tripUrl, {
        ...base,
        price: "Check live fare",
      }),
    },
    {
      title: `${parsed.destinationCity} Balanced Flight`,
      tag: "BALANCED",
      description:
        "Kuro will look for a practical balance of price, time, and stops from Trip.com results.",
      price: "Check live fare",
      ...base,
      tripUrl: attachSelectedFlightDetails(tripUrl, {
        ...base,
        price: "Check live fare",
      }),
    },
    {
      title: `${parsed.destinationCity} Convenient Flight`,
      tag: "CONVENIENT",
      description:
        "Kuro will prioritise cleaner timing and fewer stops where Trip.com provides matching rows.",
      price: "Check live fare",
      ...base,
      stops: "Prefer fewer stops",
      tripUrl: attachSelectedFlightDetails(tripUrl, {
        ...base,
        price: "Check live fare",
        stops: "Prefer fewer stops",
      }),
    },
  ];
}

function buildTripSearchUrl(parsed: ParsedFlightRequest) {
  const origin = parsed.originAirportCode || parsed.originCity;
  const destination = parsed.destinationAirportCode || parsed.destinationCity;

  const search = new URL("https://www.trip.com/flights/");

  search.searchParams.set("kuroOrigin", origin);
  search.searchParams.set("kuroDestination", destination);
  search.searchParams.set("kuroDate", parsed.dateText);
  search.searchParams.set("kuroTripType", parsed.tripType);

  return search.toString();
}

function attachSelectedFlightDetails(
  baseUrl: string,
  option: {
    airline: string;
    departureTime: string;
    arrivalTime: string;
    price: string;
    route: string;
    stops: string;
  }
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

export async function researchTripFlights(
  prompt: string,
  userLocation: UserLocation
): Promise<TripResearchResult[]> {
  const parsed = await parseFlightRequestWithOpenAI(prompt, userLocation);
  const tripUrl = buildTripSearchUrl(parsed);

  let researchText = "";

  try {
    const data = await searchExaFlights(parsed);
    const results: ExaResult[] = data.results || [];

    researchText = results
      .map((result) =>
        [
          result.title || "",
          result.url || "",
          result.text || "",
          Array.isArray(result.highlights) ? result.highlights.join(" ") : "",
        ].join(" ")
      )
      .join("\n\n");
  } catch (error) {
    console.error("Exa flight research failed:", error);
  }

  if (researchText) {
    const aiFlights = await generateFlightOptionsWithOpenAI(
      parsed,
      researchText,
      tripUrl
    );

    if (aiFlights?.length) {
      return aiFlights;
    }
  }

  return createFallbackFlightOptions(parsed, tripUrl);
}