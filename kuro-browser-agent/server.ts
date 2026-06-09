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

      console.error(`CORS blocked origin: ${origin}`);
      callback(null, false);
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
    page.locator("input").first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
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
  await page.waitForTimeout(300);
  await searchInput.fill(seed);
  await page.waitForTimeout(2500);

  const addButton = page
    .locator('button[aria-label*="Add"], button:has-text("Add")')
    .first();

  if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addButton.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    return true;
  }

  console.log(`No Add button found within timeout for seed: ${seed}`);
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
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
    null;

  try {
    const { playlistUrl, playlistName, prompt, selectedMood } = req.body;

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
    });

    const seeds = getSeeds(prompt || "", selectedMood);
    const userDataDir = path.join(process.cwd(), ".kuro-spotify-browser-profile");

    context = await chromium.launchPersistentContext(userDataDir, {
  channel: "chrome",
  headless: false,
      slowMo: 100,
      viewport: {
        width: 1440,
        height: 950,
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ],
    });

    const page = context.pages()[0] || (await context.newPage());

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

    const loginVisible = await page
      .getByRole("button", { name: /log in/i })
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (
      currentUrl.includes("login") ||
      currentUrl.includes("accounts.spotify.com") ||
      loginVisible
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Spotify login is required inside the Render browser agent. Render cannot use your local browser login automatically.",
        actionRequired:
          "For a deployed browser-agent demo, you need a persistent logged-in Spotify session on the Render browser profile, or run the browser agent locally.",
      });
    }

    let tracksAdded = 0;

    for (const seed of seeds) {
      console.log(`Searching seed: ${seed}`);

      const added = await addTrack(page, seed);

      if (added) {
        tracksAdded += 1;
        console.log(`Added ${tracksAdded}: ${seed}`);
      }

      if (tracksAdded >= 5) {
        break;
      }
    }

    return res.json({
      success: true,
      playlistName,
      playlistUrl,
      tracksAdded,
      message: `Kuro added ${tracksAdded} tracks.`,
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
      await context.close().catch(() => null);
    }
  }
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
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
  },
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro browser agent running on port ${PORT}`);
});