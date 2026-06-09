import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: [
      "https://kuro-three.vercel.app",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

app.use(express.json());

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

app.post("/spotify/browser-create-playlist", async (req, res) => {
  const { playlistUrl, playlistName, prompt, selectedMood } = req.body;

  if (!playlistUrl) {
    return res.status(400).json({
      success: false,
      error: "playlistUrl is required.",
    });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 950,
    },
  });

  try {
    await page.goto(playlistUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.bringToFront();
    await page.waitForTimeout(5000);

    const seeds = getSeeds(prompt, selectedMood);
    let tracksAdded = 0;

    for (const seed of seeds) {
      try {
        const searchInput =
          page.getByPlaceholder(/search for songs or episodes/i).first();

        if (!(await searchInput.isVisible().catch(() => false))) {
          console.log("Search input not found.");
          break;
        }

        await searchInput.fill("");
        await searchInput.fill(seed);
        await page.waitForTimeout(2000);

        const addButton = page.getByRole("button", { name: /^add$/i }).first();

        if (await addButton.isVisible().catch(() => false)) {
          await addButton.click();
          tracksAdded += 1;
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.error(`Failed to add ${seed}`, error);
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

app.listen(PORT, () => {
  console.log(`Kuro browser agent running on port ${PORT}`);
});