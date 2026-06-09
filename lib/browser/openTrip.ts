import { chromium } from "playwright";

function validateTripUrl(url: string) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  if (hostname !== "trip.com" && !hostname.endsWith(".trip.com")) {
    throw new Error("Only Trip.com URLs are allowed.");
  }

  return parsedUrl.toString();
}

export async function openTripFlightPage(url: string) {
  const exactSelectedUrl = validateTripUrl(url);

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

  await page.goto(exactSelectedUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.bringToFront();
  await page.waitForTimeout(3000);

  return {
    success: true,
    openedUrl: exactSelectedUrl,
    message: "Kuro opened the exact Trip.com option you selected.",
  };
}
