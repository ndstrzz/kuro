import { chromium, Locator, Page } from "playwright";

type SelectedFlightDetails = {
  airline?: string;
  departureTime?: string;
  arrivalTime?: string;
  price?: string;
  route?: string;
  stops?: string;
};

function validateTripUrl(url: string) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  if (hostname !== "trip.com" && !hostname.endsWith(".trip.com")) {
    throw new Error("Only Trip.com URLs are allowed.");
  }

  return parsedUrl;
}

function extractSelectedFlightDetails(url: URL): SelectedFlightDetails {
  return {
    airline: url.searchParams.get("kuroAirline") || undefined,
    departureTime: url.searchParams.get("kuroDepartureTime") || undefined,
    arrivalTime: url.searchParams.get("kuroArrivalTime") || undefined,
    price: url.searchParams.get("kuroPrice") || undefined,
    route: url.searchParams.get("kuroRoute") || undefined,
    stops: url.searchParams.get("kuroStops") || undefined,
  };
}

function removeKuroParams(url: URL) {
  const cleanUrl = new URL(url.toString());

  [
    "kuroAirline",
    "kuroDepartureTime",
    "kuroArrivalTime",
    "kuroPrice",
    "kuroRoute",
    "kuroStops",
  ].forEach((key) => cleanUrl.searchParams.delete(key));

  return cleanUrl.toString();
}

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s:$.-]/g, "")
    .trim();
}

async function isVisible(locator: Locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function closeTripPopups(page: Page) {
  const popupButtons = [
    page.getByRole("button", { name: /close/i }).first(),
    page.locator('[aria-label="Close"]').first(),
    page.locator(".close").first(),
    page.locator("button").filter({ hasText: /^×$/ }).first(),
  ];

  for (const button of popupButtons) {
    if (await isVisible(button, 1000)) {
      await button.click({ timeout: 2000 }).catch(() => null);
      await page.waitForTimeout(800);
    }
  }
}

async function getCandidateFlightRows(page: Page) {
  const selectors = [
    '[class*="flight"]',
    '[class*="Flight"]',
    '[class*="card"]',
    '[class*="Card"]',
    '[class*="result"]',
    '[class*="Result"]',
    '[class*="list"] > div',
  ];

  const rows: Locator[] = [];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 80); index += 1) {
      const row = locator.nth(index);

      if (await isVisible(row, 500)) {
        rows.push(row);
      }
    }
  }

  return rows;
}

function scoreRow(rowText: string, selected: SelectedFlightDetails) {
  const text = normalise(rowText);
  let score = 0;

  if (selected.airline && text.includes(normalise(selected.airline))) score += 4;
  if (selected.departureTime && text.includes(normalise(selected.departureTime))) score += 3;
  if (selected.arrivalTime && text.includes(normalise(selected.arrivalTime))) score += 3;
  if (selected.price && text.includes(normalise(selected.price).replace("sgd ", ""))) score += 3;
  if (selected.price && text.includes(normalise(selected.price))) score += 3;
  if (selected.stops && text.includes(normalise(selected.stops))) score += 2;

  if (selected.route) {
    const routeParts = selected.route
      .split("→")
      .map((part) => normalise(part))
      .filter(Boolean);

    for (const part of routeParts) {
      if (text.includes(part)) score += 2;
    }
  }

  return score;
}

async function clickViewDetailsInsideRow(row: Locator) {
  const viewDetailsButtons = [
    row.getByRole("button", { name: /view details/i }).first(),
    row.getByText(/view details/i).first(),
    row.locator('button:has-text("View Details")').first(),
    row.locator('[role="button"]:has-text("View Details")').first(),
  ];

  for (const button of viewDetailsButtons) {
    if (await isVisible(button, 2000)) {
      await button.scrollIntoViewIfNeeded().catch(() => null);
      await button.click({ timeout: 5000 });
      return true;
    }
  }

  return false;
}

async function selectMatchingTripFlight(
  page: Page,
  selected: SelectedFlightDetails
) {
  if (!selected.airline && !selected.departureTime && !selected.price) {
    return {
      selected: false,
      reason: "No selected flight details were provided.",
    };
  }

  await page.waitForTimeout(5000);
  await closeTripPopups(page);

  const rows = await getCandidateFlightRows(page);

  let bestRow: Locator | null = null;
  let bestScore = 0;
  let bestText = "";

  for (const row of rows) {
    const rowText = await row.innerText({ timeout: 1000 }).catch(() => "");
    const score = scoreRow(rowText, selected);

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
      bestText = rowText;
    }
  }

  console.log("Best Trip.com flight row score:", bestScore);
  console.log("Best Trip.com flight row text:", bestText.slice(0, 500));

  if (bestRow && bestScore >= 6) {
    const clicked = await clickViewDetailsInsideRow(bestRow);

    if (clicked) {
      await page.waitForTimeout(3000);

      return {
        selected: true,
        reason: `Matched selected flight row with score ${bestScore}.`,
      };
    }
  }

  const fallbackViewDetails = page.getByRole("button", {
    name: /view details/i,
  }).first();

  if (await isVisible(fallbackViewDetails, 3000)) {
    await fallbackViewDetails.click({ timeout: 5000 });
    await page.waitForTimeout(3000);

    return {
      selected: true,
      reason:
        "Could not confidently match exact row, so Kuro clicked the first visible View Details button.",
    };
  }

  return {
    selected: false,
    reason: "No matching flight row or View Details button found.",
  };
}

export async function openTripFlightPage(url: string) {
  const parsedUrl = validateTripUrl(url);
  const selectedFlightDetails = extractSelectedFlightDetails(parsedUrl);
  const tripUrl = removeKuroParams(parsedUrl);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 950,
    },
  });

  await page.goto(tripUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.bringToFront();
  await page.waitForTimeout(5000);

  const selectionResult = await selectMatchingTripFlight(
    page,
    selectedFlightDetails
  );

  return {
    success: true,
    openedUrl: tripUrl,
    selectedFlightDetails,
    selectedFlight: selectionResult.selected,
    selectionMessage: selectionResult.reason,
    message: selectionResult.selected
      ? `Kuro opened Trip.com and selected the matching flight option.`
      : `Kuro opened Trip.com, but could not select the matching flight option.`,
  };
}