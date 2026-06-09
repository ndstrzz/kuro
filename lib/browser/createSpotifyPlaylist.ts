import path from "path";
import { chromium, Page } from "playwright";

type SpotifyBrowserAgentInput = {
  playlistUrl: string;
  playlistName: string;
  prompt: string;
  selectedMood?: string;
};

type SpotifyBrowserAgentResult = {
  success: boolean;
  playlistUrl: string;
  playlistName: string;
  tracksAttempted: number;
  tracksAdded: number;
  message: string;
};

function getSeeds(prompt: string, selectedMood?: string) {
  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Yiruma River Flows In You",
      "Nils Frahm Says",
      "Ólafur Arnalds Near Light",
      "soft piano instrumental",
      "coffeehouse jazz instrumental",
      "lofi focus instrumental",
      "ambient study instrumental",
      "corporate lounge jazz",
      "bossa nova cafe instrumental",
      "peaceful piano",
      "deep focus instrumental",
      "minimal electronic focus",
      "calm background music",
      "jazz cafe instrumental",
    ];
  }

  if (lowerPrompt.includes("luxury") || lowerPrompt.includes("lounge")) {
    return [
      "luxury lounge jazz",
      "bossa nova cafe",
      "hotel lobby jazz",
      "smooth jazz instrumental",
      "chill lounge music",
      "elegant background music",
      "soft saxophone jazz",
      "modern jazz lounge",
      "cafe jazz instrumental",
      "dinner jazz instrumental",
    ];
  }

  return [
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "chill background music",
    "ambient study",
    "peaceful piano",
    "deep focus",
    "bossa nova cafe",
    "modern classical",
  ];
}

async function waitForManualSpotifyLogin(page: Page) {
  const loginButton = page.getByRole("button", { name: /log in/i }).first();

  if (await loginButton.isVisible().catch(() => false)) {
    console.log("Spotify login required. Please log in manually in the opened browser.");

    await loginButton.click().catch(() => null);

    await page.waitForTimeout(3000);

    await page.waitForFunction(
      () => window.location.href.includes("open.spotify.com"),
      undefined,
      { timeout: 180000 },
    );
  }
}

async function findPlaylistSearchBox(page: Page) {
  const candidates = [
    page.getByPlaceholder(/search for songs or episodes/i).first(),
    page.getByPlaceholder(/search/i).first(),
    page.locator('input[placeholder*="Search"]').first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

async function addOneTrack(page: Page, seed: string) {
  const searchBox = await findPlaylistSearchBox(page);

  if (!searchBox) {
    console.log("Could not find playlist search box.");
    return false;
  }

  await searchBox.fill("");
  await searchBox.fill(seed);
  await page.waitForTimeout(1800);

  const addButtons = page.getByRole("button", { name: /^add$/i });
  const addCount = await addButtons.count().catch(() => 0);

  if (addCount > 0) {
    await addButtons.first().click();
    await page.waitForTimeout(1000);
    return true;
  }

  const fallbackAddButtons = page.locator("button").filter({ hasText: /^Add$/i });
  const fallbackCount = await fallbackAddButtons.count().catch(() => 0);

  if (fallbackCount > 0) {
    await fallbackAddButtons.first().click();
    await page.waitForTimeout(1000);
    return true;
  }

  console.log(`No Add button found for: ${seed}`);
  return false;
}

export async function createSpotifyPlaylistWithBrowserAgent({
  playlistUrl,
  playlistName,
  prompt,
  selectedMood,
}: SpotifyBrowserAgentInput): Promise<SpotifyBrowserAgentResult> {
  const seeds = getSeeds(prompt, selectedMood);

  const userDataDir = path.join(process.cwd(), ".kuro-spotify-browser-profile");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 180,
    viewport: {
      width: 1440,
      height: 950,
    },
  });

  const page = context.pages()[0] || (await context.newPage());

  await page.goto(playlistUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.bringToFront();

  await waitForManualSpotifyLogin(page);

  await page.goto(playlistUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForTimeout(4000);

  let tracksAdded = 0;

  for (const seed of seeds) {
    try {
      const added = await addOneTrack(page, seed);

      if (added) {
        tracksAdded += 1;
        console.log(`Added track ${tracksAdded}: ${seed}`);
      }

      if (tracksAdded >= 12) {
        break;
      }
    } catch (error) {
      console.error(`Failed to add seed: ${seed}`, error);
    }
  }

  return {
    success: true,
    playlistUrl,
    playlistName,
    tracksAttempted: seeds.length,
    tracksAdded,
    message:
      tracksAdded > 0
        ? `Kuro created the playlist and added ${tracksAdded} tracks.`
        : "Kuro created the playlist, but could not find Spotify Add buttons.",
  };
}