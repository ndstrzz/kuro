import Exa from "exa-js";

export type ExaSearchResult = {
  title: string;
  url: string;
  text: string;
};

export type TripFlightSearchResult = ExaSearchResult & {
  flightName: string;
  flightTime: string;
  price: string;
};

const exa = new Exa(process.env.EXA_API_KEY);

function ensureExaKey() {
  if (!process.env.EXA_API_KEY) {
    throw new Error("Missing EXA_API_KEY in .env.local");
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractPrice(text: string) {
  const pricePatterns = [
    /(?:S\$|SGD|US\$|USD|\$)\s?\d{2,5}(?:,\d{3})*(?:\.\d{2})?/i,
    /\d{2,5}(?:,\d{3})*(?:\.\d{2})?\s?(?:SGD|USD)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/\s+/g, " ").trim();
  }

  return "View price on Trip.com";
}

function extractFlightTime(text: string) {
  const timeRangePatterns = [
    /\b\d{1,2}:\d{2}\s?(?:AM|PM)?\s?[–—-]\s?\d{1,2}:\d{2}\s?(?:AM|PM)?\b/i,
    /\b\d{1,2}:\d{2}\s?(?:AM|PM)?\s?(?:to|→)\s?\d{1,2}:\d{2}\s?(?:AM|PM)?\b/i,
  ];

  for (const pattern of timeRangePatterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/\s+/g, " ").trim();
  }

  const singleTimeMatch = text.match(/\b\d{1,2}:\d{2}\s?(?:AM|PM)?\b/i);
  if (singleTimeMatch) return singleTimeMatch[0].replace(/\s+/g, " ").trim();

  return "View flight time on Trip.com";
}

function extractFlightName(title: string, text: string) {
  const combinedText = cleanText(`${title} ${text}`);

  const airlinePatterns = [
    /\b(?:Singapore Airlines|Scoot|Jetstar|AirAsia|Batik Air|Garuda Indonesia|Citilink|Malaysia Airlines|Thai Airways|Cathay Pacific|Cebu Pacific|VietJet Air|Vietnam Airlines|Qatar Airways|Emirates|Etihad Airways|Turkish Airlines|Korean Air|Asiana Airlines|Japan Airlines|All Nippon Airways|ANA)\b/i,
    /\b[A-Z]{2}\s?\d{2,4}\b/,
  ];

  for (const pattern of airlinePatterns) {
    const match = combinedText.match(pattern);
    if (match) return match[0].trim();
  }

  return cleanText(title)
    .replace(/\|.*$/g, "")
    .replace(/Trip\.com/gi, "")
    .replace(/Flights?/gi, "")
    .trim() || "Trip.com flight option";
}

function isTripDotComResult(result: ExaSearchResult) {
  try {
    const hostname = new URL(result.url).hostname.replace(/^www\./, "");
    return hostname === "trip.com" || hostname.endsWith(".trip.com");
  } catch {
    return false;
  }
}

export async function searchWithExa(query: string): Promise<ExaSearchResult[]> {
  ensureExaKey();

  const result = await exa.searchAndContents(query, {
    type: "auto",
    numResults: 5,
    text: true,
  });

  return result.results.map((item) => ({
    title: item.title ?? "Untitled result",
    url: item.url,
    text: item.text ?? "",
  }));
}

export async function searchTripFlightsWithExa(
  query: string
): Promise<TripFlightSearchResult[]> {
  ensureExaKey();

  const tripOnlyFlightQuery = `${query} flights Trip.com flight results price departure arrival time`;

  const result = await exa.searchAndContents(tripOnlyFlightQuery, {
    type: "auto",
    numResults: 10,
    text: true,
    includeDomains: ["trip.com", "www.trip.com"],
  });

  const tripResults: ExaSearchResult[] = result.results
    .map((item) => ({
      title: item.title ?? "Trip.com flight result",
      url: item.url,
      text: item.text ?? "",
    }))
    .filter(isTripDotComResult);

  const seenUrls = new Set<string>();

  return tripResults
    .filter((item) => {
      if (seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    })
    .slice(0, 3)
    .map((item) => {
      const combinedText = cleanText(`${item.title} ${item.text}`);

      return {
        ...item,
        flightName: extractFlightName(item.title, item.text),
        flightTime: extractFlightTime(combinedText),
        price: extractPrice(combinedText),
      };
    });
}
