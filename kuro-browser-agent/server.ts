import express from "express";
import cors from "cors";
import path from "path";
import { chromium, Locator, Page } from "playwright";

const app = express();
const PORT = Number(process.env.PORT || 4000);

const allowedOrigins = [
  "https://kuro-three.vercel.app",
  "https://kuro-git-main-nds-projects-2437be5a.vercel.app",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      console.error(`CORS blocked origin: ${origin}`);
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

type FlightSearchRequest = {
  prompt: string;
  timezone?: string;
  userLocation?: {
    city?: string;
    country?: string;
  };
};

type ParsedRoute = {
  originCity: string;
  originAirport: string;
  originSlug: string;
  destinationCity: string;
  destinationAirport: string;
  destinationSlug: string;
  dateText: string;
  priority: "cheapest" | "direct" | "balanced";
};

type ScrapedFlight = {
  title: string;
  tag: string;
  description: string;
  price: string;
  route: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  departureTerminal: string;
  arrivalTerminal: string;
  duration: string;
  stops: string;
  tripUrl: string;
};

/* ----------------------------- shared helpers ----------------------------- */

async function isVisible(locator: Locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

function normalise(value: string) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normaliseLower(value: string) {
  return normalise(value).toLowerCase();
}

function numberFromPrice(price: string) {
  const match = price.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

/* ----------------------------- Spotify helpers ----------------------------- */

function getSeeds(prompt: string, selectedMood?: string, trackSeeds?: string[]) {
  if (Array.isArray(trackSeeds) && trackSeeds.length > 0) {
    return Array.from(
      new Set(
        trackSeeds
          .map((track) => String(track).trim())
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Yiruma River Flows In You",
      "Nils Frahm Says",
      "Ólafur Arnalds Near Light",
      "Max Richter On The Nature Of Daylight",
    ];
  }

  return [
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "ambient study",
  ];
}

async function findPlaylistSearchInput(page: Page) {
  const candidates = [
    page.getByPlaceholder(/search for songs or episodes/i).first(),
    page.getByPlaceholder(/find songs/i).first(),
    page.getByPlaceholder(/let'?s find something/i).first(),
    page.locator('input[placeholder*="Search"]').first(),
    page.locator('input[placeholder*="Find"]').first(),
    page.locator("input").last(),
    page.locator("input").first(),
  ];

  for (const candidate of candidates) {
    if (await isVisible(candidate, 2500)) {
      return candidate;
    }
  }

  return null;
}

async function clearPlaylistSearchInput(page: Page) {
  const searchInput = await findPlaylistSearchInput(page);

  if (!searchInput) return false;

  await searchInput.scrollIntoViewIfNeeded().catch(() => null);
  await searchInput.click({ timeout: 5000 }).catch(() => null);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(700);

  const valueAfterClear = await searchInput.inputValue().catch(() => "");

  if (valueAfterClear) {
    await searchInput.fill("").catch(() => null);
    await page.waitForTimeout(500);
  }

  return true;
}

async function searchTrackTitle(page: Page, seed: string) {
  const searchInput = await findPlaylistSearchInput(page);

  if (!searchInput) return false;

  await searchInput.scrollIntoViewIfNeeded().catch(() => null);
  await searchInput.click({ timeout: 5000 }).catch(() => null);
  await clearPlaylistSearchInput(page);

  await searchInput.fill(seed, { timeout: 5000 });
  await page.waitForTimeout(3000);

  return true;
}

function cleanButtonText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function clickSafeSearchResultAddButton(page: Page, seed: string) {
  const input = await findPlaylistSearchInput(page);
  const inputBox = await input?.boundingBox().catch(() => null);

  const candidates = page.locator(
    [
      'button:has-text("Add")',
      'button[aria-label^="Add"]',
      'button[aria-label*="Add "]',
      '[role="button"]:has-text("Add")',
    ].join(", ")
  );

  const count = await candidates.count().catch(() => 0);

  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const button = candidates.nth(index);

    if (!(await isVisible(button, 1200))) continue;

    const box = await button.boundingBox().catch(() => null);
    if (!box) continue;

    if (inputBox && box.y < inputBox.y + inputBox.height + 20) continue;

    const ariaLabel = await button.getAttribute("aria-label").catch(() => "");
    const text = await button.innerText().catch(() => "");
    const title = await button.getAttribute("title").catch(() => "");
    const label = `${ariaLabel || ""} ${text || ""} ${title || ""}`.toLowerCase();

    if (
      label.includes("more") ||
      label.includes("remove") ||
      label.includes("added") ||
      label.includes("options") ||
      label.includes("menu") ||
      label.includes("close")
    ) {
      continue;
    }

    const buttonText = cleanButtonText(text);

    if (buttonText && buttonText !== "add") continue;

    await button.scrollIntoViewIfNeeded().catch(() => null);
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    return true;
  }

  console.log(`No safe Add button found for: ${seed}`);
  return false;
}

async function addTrackThenClearSearch(page: Page, seed: string) {
  await clearPlaylistSearchInput(page);

  const searched = await searchTrackTitle(page, seed);

  if (!searched) return false;

  const added = await clickSafeSearchResultAddButton(page, seed);

  await clearPlaylistSearchInput(page);
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(1200);

  return added;
}

async function waitForSpotifyLogin(page: Page) {
  const loginButton = page.getByRole("button", { name: /log in/i }).first();

  const loginVisible = await loginButton
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  const currentUrl = page.url();

  const needsLogin =
    currentUrl.includes("login") ||
    currentUrl.includes("accounts.spotify.com") ||
    loginVisible;

  if (!needsLogin) return;

  if (loginVisible) {
    await loginButton.click({ timeout: 5000 }).catch(() => null);
  }

  await page.waitForTimeout(40000);
}

/* ----------------------------- Trip helpers ----------------------------- */

const cityMap: Record<
  string,
  {
    city: string;
    airport: string;
    slug: string;
  }
> = {
  singapore: { city: "Singapore", airport: "SIN", slug: "singapore" },
  jakarta: { city: "Jakarta", airport: "CGK", slug: "jakarta" },
  "new york": { city: "New York", airport: "NYC", slug: "new-york" },
  nyc: { city: "New York", airport: "NYC", slug: "new-york" },
  london: { city: "London", airport: "LON", slug: "london" },
  tokyo: { city: "Tokyo", airport: "TYO", slug: "tokyo" },
  bangkok: { city: "Bangkok", airport: "BKK", slug: "bangkok" },
  seoul: { city: "Seoul", airport: "SEL", slug: "seoul" },
  bali: { city: "Bali", airport: "DPS", slug: "bali" },
  taipei: { city: "Taipei", airport: "TPE", slug: "taipei" },
  shanghai: { city: "Shanghai", airport: "SHA", slug: "shanghai" },
  beijing: { city: "Beijing", airport: "BJS", slug: "beijing" },
  hongkong: { city: "Hong Kong", airport: "HKG", slug: "hong-kong" },
  "hong kong": { city: "Hong Kong", airport: "HKG", slug: "hong-kong" },
  paris: { city: "Paris", airport: "PAR", slug: "paris" },
  sydney: { city: "Sydney", airport: "SYD", slug: "sydney" },
};

function detectCityFromPrompt(prompt: string) {
  const text = normaliseLower(prompt);

  for (const [key, value] of Object.entries(cityMap)) {
    if (text.includes(key)) return value;
  }

  const toMatch = text.match(/\bto\s+([a-z\s]+?)(?:\s+tonight|\s+today|\s+tomorrow|\s+next|\s+cheapest|\s+direct|$)/i);
  const rawCity = toMatch?.[1]?.trim();

  if (rawCity) {
    return {
      city: rawCity
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      airport: rawCity.slice(0, 3).toUpperCase(),
      slug: rawCity.toLowerCase().replace(/\s+/g, "-"),
    };
  }

  return cityMap.jakarta;
}

function detectOriginFromPrompt(prompt: string, requestLocation?: FlightSearchRequest["userLocation"]) {
  const text = normaliseLower(prompt);
  const fromMatch = text.match(/\bfrom\s+([a-z\s]+?)\s+to\b/i);
  const rawOrigin = fromMatch?.[1]?.trim();

  if (rawOrigin) {
    for (const [key, value] of Object.entries(cityMap)) {
      if (rawOrigin.includes(key)) return value;
    }
  }

  const country = requestLocation?.country?.toUpperCase();
  const city = requestLocation?.city?.toLowerCase();

  if (country === "SG" || city?.includes("singapore")) {
    return cityMap.singapore;
  }

  return cityMap.singapore;
}

function parseFlightPrompt(body: FlightSearchRequest): ParsedRoute {
  const prompt = body.prompt || "";
  const text = normaliseLower(prompt);
  const origin = detectOriginFromPrompt(prompt, body.userLocation);
  const destination = detectCityFromPrompt(prompt);

  return {
    originCity: origin.city,
    originAirport: origin.airport,
    originSlug: origin.slug,
    destinationCity: destination.city,
    destinationAirport: destination.airport,
    destinationSlug: destination.slug,
    dateText: text.includes("tonight")
      ? "tonight"
      : text.includes("today")
        ? "today"
        : text.includes("tomorrow")
          ? "tomorrow"
          : "next available",
    priority: text.includes("direct")
      ? "direct"
      : text.includes("cheapest") || text.includes("cheap")
        ? "cheapest"
        : "balanced",
  };
}

function buildTripUrl(route: ParsedRoute) {
  return `https://www.trip.com/flights/${route.originSlug}-to-${route.destinationSlug}/airfares-${route.originAirport.toLowerCase()}-${route.destinationAirport.toLowerCase()}/`;
}

function attachFlightDetails(baseUrl: string, flight: Omit<ScrapedFlight, "tripUrl">) {
  const url = new URL(baseUrl);

  url.searchParams.set("kuroAirline", flight.airline);
  url.searchParams.set("kuroDepartureTime", flight.departureTime);
  url.searchParams.set("kuroArrivalTime", flight.arrivalTime);
  url.searchParams.set("kuroPrice", flight.price);
  url.searchParams.set("kuroRoute", flight.route);
  url.searchParams.set("kuroStops", flight.stops);

  return url.toString();
}

function removeKuroParams(rawUrl: string) {
  const url = new URL(rawUrl);

  [
    "kuroAirline",
    "kuroDepartureTime",
    "kuroArrivalTime",
    "kuroPrice",
    "kuroRoute",
    "kuroStops",
    "kuroOrigin",
    "kuroDestination",
    "kuroDate",
    "kuroTripType",
  ].forEach((key) => url.searchParams.delete(key));

  return url.toString();
}

async function closeTripPopups(page: Page) {
  const buttons = [
    page.getByRole("button", { name: /close/i }).first(),
    page.locator('[aria-label="Close"]').first(),
    page.locator("button").filter({ hasText: /^×$/ }).first(),
  ];

  for (const button of buttons) {
    if (await isVisible(button, 1000)) {
      await button.click({ timeout: 2000 }).catch(() => null);
      await page.waitForTimeout(800);
    }
  }
}

function parseFlightRow(text: string, route: ParsedRoute, tripUrl: string, index: number): ScrapedFlight | null {
  const cleaned = normalise(text);

  if (!cleaned.match(/select|view details/i)) return null;

  const price = cleaned.match(/(?:SGD|USD|S\$|US\$)\s?[\d,]+/i)?.[0];
  const times = cleaned.match(/\d{1,2}:\d{2}\s?(?:AM|PM)/gi) || [];
  const duration = cleaned.match(/\d+h\s*\d*m|\d+h|\d+\s*h\s+\d+\s*m/i)?.[0];
  const stops = cleaned.match(/nonstop|direct|\d+\s*stop[s]?/i)?.[0];

  if (!price || times.length < 2) return null;

  const lines = text
    .split("\n")
    .map((line) => normalise(line))
    .filter(Boolean);

  const badLine = /select|view details|round-trip|one-way|exclusive fare|cheapest|sgd|usd|nonstop|direct|\d+h|\d{1,2}:\d{2}|t\d/i;

  const airline =
    lines.find((line) => !badLine.test(line) && line.length <= 35) ||
    "Trip.com result";

  const terminals = lines.filter((line) =>
    new RegExp(`${route.originAirport}|${route.destinationAirport}|T\\d`, "i").test(line)
  );

  const departureTerminal =
    terminals.find((line) => line.toUpperCase().includes(route.originAirport)) ||
    route.originAirport;

  const arrivalTerminal =
    terminals.find((line) => line.toUpperCase().includes(route.destinationAirport)) ||
    route.destinationAirport;

  const baseFlight = {
    title:
      index === 0
        ? `${route.destinationCity} Cheapest Flight`
        : `${route.destinationCity} Option ${index + 1}`,
    tag: index === 0 ? "CHEAPEST" : index === 1 ? "BALANCED" : "CONVENIENT",
    description:
      "Kuro scraped this live Trip.com result and will select the exact matching row when approved.",
    price,
    route: `${route.originAirport} → ${route.destinationAirport}`,
    airline,
    departureTime: times[0] || "Check live timing",
arrivalTime: times[1] || "Check live timing",
    departureTerminal,
    arrivalTerminal,
    duration: duration || "Check duration",
    stops: stops || "Check stops",
  };

  return {
    ...baseFlight,
    tripUrl: attachFlightDetails(tripUrl, baseFlight),
  };
}

async function scrapeVisibleTripFlights(page: Page, route: ParsedRoute, tripUrl: string) {
  await closeTripPopups(page);
  await page.waitForTimeout(5000);

  const rowCandidates = page.locator("div").filter({
    hasText: /select|view details/i,
  });

  const count = await rowCandidates.count().catch(() => 0);
  const flights: ScrapedFlight[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < Math.min(count, 180); index += 1) {
    const row = rowCandidates.nth(index);

    if (!(await isVisible(row, 500))) continue;

    const text = await row.innerText({ timeout: 1000 }).catch(() => "");
    const flight = parseFlightRow(text, route, tripUrl, flights.length);

    if (!flight) continue;

    const key = `${flight.airline}-${flight.departureTime}-${flight.arrivalTime}-${flight.price}`;

    if (seen.has(key)) continue;

    seen.add(key);
    flights.push(flight);

    if (flights.length >= 6) break;
  }

  return flights
    .sort((a, b) => numberFromPrice(a.price) - numberFromPrice(b.price))
    .slice(0, 3)
    .map((flight, index) => ({
      ...flight,
      title:
        index === 0
          ? `${route.destinationCity} Cheapest Flight`
          : index === 1
            ? `${route.destinationCity} Balanced Flight`
            : `${route.destinationCity} Convenient Flight`,
      tag: index === 0 ? "CHEAPEST" : index === 1 ? "BALANCED" : "CONVENIENT",
    }));
}

function scoreTripRow(rowText: string, selected: any) {
  const text = normaliseLower(rowText);
  let score = 0;

  if (selected.airline && text.includes(normaliseLower(selected.airline))) score += 5;
  if (selected.departureTime && text.includes(normaliseLower(selected.departureTime))) score += 4;
  if (selected.arrivalTime && text.includes(normaliseLower(selected.arrivalTime))) score += 4;

  if (selected.price) {
    const cleanPrice = normaliseLower(selected.price);
    const priceWithoutCurrency = cleanPrice.replace("sgd ", "").replace("sgd", "");
    if (text.includes(cleanPrice)) score += 4;
    if (priceWithoutCurrency && text.includes(priceWithoutCurrency)) score += 4;
  }

  if (selected.stops && text.includes(normaliseLower(selected.stops))) score += 2;

  if (selected.route) {
    const parts = String(selected.route)
      .split("→")
      .map((part) => normaliseLower(part))
      .filter(Boolean);

    for (const part of parts) {
      if (text.includes(part)) score += 2;
    }
  }

  return score;
}

async function clickTripSelectButton(row: Locator) {
  const buttonCandidates = [
    row.getByRole("button", { name: /select|view details|continue|book/i }).first(),
    row.locator('button:has-text("Select")').first(),
    row.locator('button:has-text("View Details")').first(),
    row.locator('[role="button"]:has-text("Select")').first(),
    row.locator('[role="button"]:has-text("View Details")').first(),
  ];

  for (const button of buttonCandidates) {
    if (await isVisible(button, 3000)) {
      await button.scrollIntoViewIfNeeded().catch(() => null);
      await button.click({ timeout: 5000 });
      await row.page().waitForTimeout(3000);
      return true;
    }
  }

  return false;
}

async function selectMatchingTripFlight(page: Page, selected: any) {
  await closeTripPopups(page);

  const rowBaseText = selected.airline || selected.price || selected.departureTime || "Select";

  const rowCandidates = [
    page.locator("div").filter({ hasText: rowBaseText }),
    page.locator('[class*="flight"], [class*="Flight"], [class*="card"], [class*="Card"]'),
    page.locator("body div"),
  ];

  let bestRow: Locator | null = null;
  let bestScore = 0;
  let bestText = "";

  for (const rows of rowCandidates) {
    const count = await rows.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 160); index += 1) {
      const row = rows.nth(index);

      if (!(await isVisible(row, 500))) continue;

      const text = await row.innerText({ timeout: 800 }).catch(() => "");
      if (!text || text.length < 20) continue;

      const score = scoreTripRow(text, selected);

      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
        bestText = text;
      }
    }

    if (bestRow && bestScore >= 8) break;
  }

  console.log("Best Trip.com row score:", bestScore);
  console.log("Best Trip.com row text:", bestText.slice(0, 500));

  if (bestRow && bestScore >= 4) {
    const clicked = await clickTripSelectButton(bestRow);

    if (clicked) {
      return {
        selected: true,
        reason: `Matched row and clicked Select / View Details. Score: ${bestScore}`,
      };
    }
  }

  const firstSelect = page
    .getByRole("button", { name: /select|view details|continue|book/i })
    .first();

  if (await isVisible(firstSelect, 4000)) {
    await firstSelect.click({ timeout: 5000 });
    await page.waitForTimeout(3000);

    return {
      selected: true,
      reason: "Clicked first visible Select / View Details button.",
    };
  }

  return {
    selected: false,
    reason: "No matching flight row found.",
  };
}

/* -------------------------------- endpoints -------------------------------- */

app.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "Kuro Browser Agent",
    status: "running",
  });
});

app.post("/spotify/browser-add-tracks", async (req, res) => {
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
    null;

  try {
    const {
      playlistUrl,
      playlistName,
      prompt,
      selectedMood,
      trackSeeds,
      maxTracks,
    } = req.body;

    if (!playlistUrl) {
      return res.status(400).json({
        success: false,
        error: "playlistUrl is required.",
      });
    }

    const seeds = getSeeds(prompt || "", selectedMood, trackSeeds);
    const targetTrackCount =
      typeof maxTracks === "number"
        ? Math.min(maxTracks, seeds.length, 12)
        : Math.min(seeds.length, 12);

    const userDataDir = path.join(process.cwd(), ".kuro-google-chrome-profile");

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      slowMo: 120,
      viewport: {
        width: 1440,
        height: 950,
      },
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--start-maximized",
      ],
    });

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(playlistUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(5000);
    await waitForSpotifyLogin(page);

    await page.goto(playlistUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    let tracksAdded = 0;
    const addedSeeds: string[] = [];
    const failedSeeds: string[] = [];

    for (let index = 0; index < targetTrackCount; index += 1) {
      const seed = seeds[index];
      const added = await addTrackThenClearSearch(page, seed);

      if (added) {
        tracksAdded += 1;
        addedSeeds.push(seed);
      } else {
        failedSeeds.push(seed);
      }

      await page.waitForTimeout(1500);
    }

    return res.json({
      success: true,
      playlistName,
      playlistUrl,
      tracksAdded,
      addedSeeds,
      failedSeeds,
      message: `Kuro added ${tracksAdded} tracks to ${playlistName}.`,
    });
  } catch (error) {
    console.error("========== KURO SPOTIFY ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Spotify browser agent failed.",
    });
  } finally {
    if (context) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await context.close().catch(() => null);
    }
  }
});

app.post("/trip/search-flights", async (req, res) => {
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
    null;

  try {
    const body = req.body as FlightSearchRequest;

    if (!body.prompt || typeof body.prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "prompt is required.",
      });
    }

    const route = parseFlightPrompt(body);
    const tripUrl = buildTripUrl(route);
    const userDataDir = path.join(process.cwd(), ".kuro-trip-chrome-profile");

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      slowMo: 120,
      viewport: {
        width: 1440,
        height: 950,
      },
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--start-maximized",
      ],
    });

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(tripUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(9000);

    const flights = await scrapeVisibleTripFlights(page, route, tripUrl);

    if (!flights.length) {
      return res.status(404).json({
        success: false,
        error:
          "Kuro opened Trip.com but could not scrape visible flight rows yet. Try a simpler route like Singapore to Jakarta.",
        tripUrl,
        route,
      });
    }

    return res.json({
      success: true,
      tripUrl,
      route,
      flights,
      message: `Kuro found ${flights.length} live Trip.com flight options.`,
    });
  } catch (error) {
    console.error("========== KURO TRIP.COM SEARCH ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Trip.com flight search failed.",
    });
  } finally {
    if (context) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await context.close().catch(() => null);
    }
  }
});

app.post("/trip/open-flight", async (req, res) => {
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
    null;

  try {
    const { tripUrl, selectedFlight, recommendationTitle } = req.body;

    if (!tripUrl || typeof tripUrl !== "string") {
      return res.status(400).json({
        success: false,
        error: "tripUrl is required.",
      });
    }

    const userDataDir = path.join(process.cwd(), ".kuro-trip-chrome-profile");

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      slowMo: 180,
      viewport: {
        width: 1440,
        height: 950,
      },
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--start-maximized",
      ],
    });

    const page = context.pages()[0] || (await context.newPage());
    const cleanUrl = removeKuroParams(tripUrl);

    await page.goto(cleanUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(7000);
    await closeTripPopups(page);

    const result = await selectMatchingTripFlight(page, selectedFlight || {});

    return res.json({
      success: true,
      recommendationTitle,
      openedUrl: cleanUrl,
      selectedFlight: result.selected,
      message: result.selected
        ? "Kuro opened Trip.com and selected the matching flight row."
        : result.reason,
    });
  } catch (error) {
    console.error("========== KURO TRIP.COM ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Trip.com browser agent failed.",
    });
  } finally {
    if (context) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await context.close().catch(() => null);
    }
  }
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("========== KURO EXPRESS ERROR ==========");
    console.error(err);

    res.status(500).json({
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unknown server error",
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro browser agent running on port ${PORT}`);
});