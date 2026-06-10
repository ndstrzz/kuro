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

  return [
    "lofi focus",
    "soft piano",
    "coffeehouse jazz",
    "calm instrumental",
    "ambient study",
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
    await page.waitForTimeout(500);
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

  await page.waitForTimeout(3000);
  return true;
}

async function getSearchResultsContainer(page: Page) {
  const searchInput = await findPlaylistSearchInput(page);

  if (!searchInput) {
    return page.locator("body");
  }

  const inputBox = await searchInput.boundingBox().catch(() => null);

  if (!inputBox) {
    return page.locator("body");
  }

  return page.locator("body");
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

  console.log(`Found ${count} possible Add buttons for: ${seed}`);

  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const button = candidates.nth(index);

    if (!(await isVisible(button, 1200))) {
      continue;
    }

    const box = await button.boundingBox().catch(() => null);

    if (!box) {
      continue;
    }

    if (inputBox && box.y < inputBox.y + inputBox.height + 20) {
      console.log("Skipping button above search input.");
      continue;
    }

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
      console.log(`Skipping unsafe button label: ${label}`);
      continue;
    }

    const buttonText = cleanButtonText(text);

    if (buttonText && buttonText !== "add") {
      console.log(`Skipping non-Add button text: ${buttonText}`);
      continue;
    }

    console.log(`Pressing safe search-result Add button for: ${seed}`);

    await button.scrollIntoViewIfNeeded().catch(() => null);
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    return true;
  }

  console.log(`No safe Add button found for: ${seed}`);
  return false;
}

function cleanButtonText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function addTrackThenClearSearch(page: Page, seed: string) {
  console.log("--------------------------------------------");
  console.log(`Starting new track search: ${seed}`);

  await clearPlaylistSearchInput(page);

  const searched = await searchTrackTitle(page, seed);

  if (!searched) {
    return false;
  }

  const added = await clickSafeSearchResultAddButton(page, seed);

  console.log(`Clearing playlist search input after: ${seed}`);
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

    console.log("Spotify page loaded:", {
      currentUrl: page.url(),
      title: await page.title().catch(() => ""),
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro browser agent running on port ${PORT}`);
});