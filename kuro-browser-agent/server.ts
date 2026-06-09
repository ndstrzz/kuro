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

  if (
    lowerPrompt.includes("kpop") ||
    lowerPrompt.includes("k-pop") ||
    lowerPrompt.includes("korean")
  ) {
    return [
      "aespa Supernova",
      "ILLIT Magnetic",
      "NewJeans Super Shy",
      "LE SSERAFIM EASY",
      "IVE I AM",
      "Jung Kook Standing Next to You",
      "SEVENTEEN MAESTRO",
      "Stray Kids LALALALA",
      "RIIZE Get A Guitar",
      "ENHYPEN Bite Me",
    ];
  }

  return [
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "ambient study",
    "peaceful piano",
    "deep focus",
    "bossa nova cafe",
  ];
}

async function isVisible(locator: Locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function findPlaylistSearchInput(page: Page) {
  const candidates = [
    page.getByPlaceholder(/search for songs or episodes/i).first(),
    page.getByPlaceholder(/find songs/i).first(),
    page.getByPlaceholder(/let'?s find something/i).first(),
    page.locator('input[placeholder*="Search"]').first(),
    page.locator('input[placeholder*="Find"]').first(),
    page.locator('input').last(),
    page.locator('input').first(),
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

  if (!searchInput) {
    console.log("Search input not found while clearing.");
    return false;
  }

  await searchInput.scrollIntoViewIfNeeded().catch(() => null);
  await searchInput.click({ timeout: 5000 }).catch(() => null);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(700);

  const valueAfterClear = await searchInput.inputValue().catch(() => "");

  if (valueAfterClear) {
    await searchInput.fill("").catch(() => null);
    await page.waitForTimeout(400);
  }

  return true;
}

async function searchTrackTitle(page: Page, seed: string) {
  const searchInput = await findPlaylistSearchInput(page);

  if (!searchInput) {
    console.log("Search input not found.");
    return false;
  }

  await searchInput.scrollIntoViewIfNeeded().catch(() => null);
  await searchInput.click({ timeout: 5000 }).catch(() => null);

  await clearPlaylistSearchInput(page);

  console.log(`Typing exact Exa song title: ${seed}`);
  await searchInput.fill(seed, { timeout: 5000 });

  await page.waitForTimeout(2600);
  return true;
}

async function clickFirstAddButton(page: Page, seed: string) {
  const addButtonSelectors = [
    '[data-testid="tracklist-row"] button[aria-label*="Add"]',
    '[data-testid="tracklist-row"] button:has-text("Add")',
    '[role="row"] button[aria-label*="Add"]',
    '[role="row"] button:has-text("Add")',
    'button[aria-label*="Add"]',
    'button:has-text("Add")',
  ];

  for (const selector of addButtonSelectors) {
    const buttons = page.locator(selector);
    const count = await buttons.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 10); index += 1) {
      const button = buttons.nth(index);

      if (!(await isVisible(button, 1200))) {
        continue;
      }

      const ariaLabel = await button.getAttribute("aria-label").catch(() => "");
      const text = await button.innerText().catch(() => "");
      const label = `${ariaLabel || ""} ${text || ""}`.toLowerCase();

      if (
        label.includes("added") ||
        label.includes("remove") ||
        label.includes("more") ||
        label.includes("close")
      ) {
        continue;
      }

      console.log(`Pressing Add for: ${seed}`);

      await button.scrollIntoViewIfNeeded().catch(() => null);
      await button.click({ timeout: 5000 });
      await page.waitForTimeout(1800);

      return true;
    }
  }

  console.log(`No Add button found for: ${seed}`);
  return false;
}

async function addTrackThenClearSearch(page: Page, seed: string) {
  console.log("--------------------------------------------");
  console.log(`Starting new track search: ${seed}`);

  await clearPlaylistSearchInput(page);

  const searched = await searchTrackTitle(page, seed);

  if (!searched) {
    return false;
  }

  const added = await clickFirstAddButton(page, seed);

  console.log(`Clearing playlist search input after: ${seed}`);
  await clearPlaylistSearchInput(page);

  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(1000);

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

  if (!needsLogin) {
    console.log("Spotify already logged in.");
    return;
  }

  console.log("Spotify login button detected.");
  console.log("Kuro will give you 40 seconds to log in manually.");

  if (loginVisible) {
    await loginButton.click({ timeout: 5000 }).catch(() => null);
  }

  await page.waitForTimeout(40000);

  console.log("40 seconds finished. Kuro will continue now.");
}

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

    console.log("========== KURO SPOTIFY JOB START ==========");
    console.log({
      playlistUrl,
      playlistName,
      selectedMood,
      prompt,
      trackSeeds,
      maxTracks,
    });

    const seeds = getSeeds(prompt || "", selectedMood, trackSeeds);
    const targetTrackCount =
      typeof maxTracks === "number"
        ? Math.min(maxTracks, seeds.length, 12)
        : Math.min(seeds.length, 12);

    const userDataDir = path.join(process.cwd(), ".kuro-google-chrome-profile");

    console.log("Launching installed Google Chrome...");
    console.log(`Profile directory: ${userDataDir}`);

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

    const currentUrl = page.url();
    const title = await page.title().catch(() => "");

    console.log("Spotify page loaded:", {
      currentUrl,
      title,
    });

    let tracksAdded = 0;
    const addedSeeds: string[] = [];
    const failedSeeds: string[] = [];

    for (let index = 0; index < targetTrackCount; index += 1) {
      const seed = seeds[index];

      console.log(`Searching Exa song ${index + 1}/${targetTrackCount}: ${seed}`);

      const added = await addTrackThenClearSearch(page, seed);

      if (added) {
        tracksAdded += 1;
        addedSeeds.push(seed);
        console.log(`Added successfully: ${seed}`);
      } else {
        failedSeeds.push(seed);
        console.log(`Failed or skipped: ${seed}`);
      }

      await page.waitForTimeout(1400);
    }

    console.log("========== KURO SPOTIFY JOB COMPLETE ==========");
    console.log({
      playlistName,
      tracksAdded,
      addedSeeds,
      failedSeeds,
    });

    await page.waitForTimeout(10000);

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
    console.error("========== KURO BROWSER AGENT ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Browser agent failed.",
    });
  } finally {
    if (context) {
      console.log("Keeping Google Chrome open for 30 seconds before closing...");
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