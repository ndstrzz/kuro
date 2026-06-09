import express from "express";
import cors from "cors";
import path from "path";
import { chromium, Page } from "playwright";

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

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

function getSeeds(prompt: string, selectedMood?: string) {
  const lowerPrompt = `${prompt} ${selectedMood || ""}`.toLowerCase();

  if (lowerPrompt.includes("seminar") || lowerPrompt.includes("professional")) {
    return [
      "Ludovico Einaudi Nuvole Bianche",
      "Yiruma River Flows In You",
      "Nils Frahm Says",
      "Ólafur Arnalds Near Light",
      "Max Richter On The Nature Of Daylight",
      "soft piano instrumental",
      "coffeehouse jazz instrumental",
      "lofi focus instrumental",
      "ambient study instrumental",
      "corporate lounge jazz",
      "bossa nova cafe instrumental",
      "peaceful piano",
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
    "ambient study",
    "peaceful piano",
    "deep focus",
    "bossa nova cafe",
  ];
}

async function findSearchInput(page: Page) {
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

async function addTrack(page: Page, seed: string) {
  const searchInput = await findSearchInput(page);

  if (!searchInput) {
    console.log("Search input not found.");
    return false;
  }

  await searchInput.fill("");
  await searchInput.fill(seed);
  await page.waitForTimeout(2500);

  const addButton = page.getByRole("button", { name: /^add$/i }).first();

  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
    await page.waitForTimeout(1200);
    return true;
  }

  const fallbackButton = page.locator("button").filter({ hasText: /^Add$/i }).first();

  if (await fallbackButton.isVisible().catch(() => false)) {
    await fallbackButton.click();
    await page.waitForTimeout(1200);
    return true;
  }

  console.log(`Add button not found for seed: ${seed}`);
  return false;
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "Kuro Browser Agent",
    status: "running",
  });
});

app.post("/spotify/browser-add-tracks", async (req, res) => {
  const { playlistUrl, playlistName, prompt, selectedMood } = req.body;

  if (!playlistUrl) {
    return res.status(400).json({
      success: false,
      error: "playlistUrl is required.",
    });
  }

  const seeds = getSeeds(prompt || "", selectedMood);
  const userDataDir = path.join(process.cwd(), ".kuro-spotify-browser-profile");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    slowMo: 100,
    viewport: {
      width: 1440,
      height: 950,
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(playlistUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    if (page.url().includes("login")) {
      await context.close();

      return res.status(401).json({
        success: false,
        error:
          "Spotify login is required on the Render browser agent. Run this locally first or set up a persistent logged-in browser profile.",
      });
    }

    let tracksAdded = 0;

    for (const seed of seeds) {
      const added = await addTrack(page, seed);

      if (added) {
        tracksAdded += 1;
        console.log(`Added ${tracksAdded}: ${seed}`);
      }

      if (tracksAdded >= 10) {
        break;
      }
    }

    await context.close();

    return res.json({
      success: true,
      playlistName,
      playlistUrl,
      tracksAdded,
      message: `Kuro added ${tracksAdded} tracks.`,
    });
  } catch (error) {
    await context.close();

    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Browser agent failed.",
    });
  }
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("========== KURO ERROR ==========");
    console.error(err);
    console.error(err.stack);

    res.status(500).json({
      success: false,
      error: err?.message || "Unknown server error",
      stack: err?.stack,
    });
  },
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro browser agent running on port ${PORT}`);
});