import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
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

app.use(express.json({ limit: "2mb" }));

type EmailUrgency = "urgent" | "important" | "normal";

type EmailItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt?: string;
  unread?: boolean;
};

type EmailSummary = {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  unread: boolean;
  label: string;
  urgency: EmailUrgency;
  summary: string;
  suggestedAction: string;
};

type GmailBriefRequest = {
  prompt?: string;
  emails?: EmailItem[];
};

type DraftReplyRequest = {
  email?: EmailItem;
  tone?: "professional" | "warm" | "short" | "formal";
  instruction?: string;
};

type DesktopPlanStep = {
  id: string;
  title: string;
  description: string;
  action:
    | "open_url"
    | "open_gmail"
    | "open_calendar"
    | "search_web"
    | "extract_text"
    | "wait_for_user";
  value?: string;
  requiresApproval?: boolean;
  safetyLevel: "safe" | "approval_required" | "blocked";
};

type DesktopPlanRequest = {
  prompt: string;
};

type DesktopExecuteRequest = {
  prompt?: string;
  url?: string;
  query?: string;
  plan?: DesktopPlanStep[];
};

let desktopContext: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
  null;

async function isVisible(locator: Locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

function normalise(value: string) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normaliseLower(value: string) {
  return normalise(value).toLowerCase();
}

function getOperaExecutablePath() {
  const platform = os.platform();

  const possiblePaths =
    platform === "darwin"
      ? [
          "/Applications/Opera.app/Contents/MacOS/Opera",
          "/Applications/Opera GX.app/Contents/MacOS/Opera GX",
        ]
      : platform === "win32"
        ? [
            path.join(
              process.env.LOCALAPPDATA || "",
              "Programs",
              "Opera",
              "opera.exe"
            ),
            path.join(
              process.env.LOCALAPPDATA || "",
              "Programs",
              "Opera GX",
              "opera.exe"
            ),
            "C:\\Program Files\\Opera\\opera.exe",
            "C:\\Program Files\\Opera GX\\opera.exe",
          ]
        : [
            "/usr/bin/opera",
            "/usr/bin/opera-stable",
            "/snap/bin/opera",
          ];

  return possiblePaths.find((item) => item && fs.existsSync(item));
}

function getBrowserLaunchOptions() {
  const operaPath = getOperaExecutablePath();

  const baseOptions = {
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
  };

  if (operaPath) {
    return {
      ...baseOptions,
      executablePath: operaPath,
    };
  }

  console.warn("Opera was not found. Falling back to Chrome channel.");
  return {
    ...baseOptions,
    channel: "chrome" as const,
  };
}

/* ----------------------------- Desktop Agent ----------------------------- */

function isDangerousPrompt(prompt: string) {
  const text = normaliseLower(prompt);

  return [
    "send email",
    "send this email",
    "delete",
    "trash",
    "pay",
    "payment",
    "buy",
    "purchase",
    "submit",
    "confirm order",
    "transfer money",
    "install",
    "remove file",
  ].some((word) => text.includes(word));
}

function inferUrlFromPrompt(prompt: string) {
  const text = normaliseLower(prompt);

  if (text.includes("gmail") || text.includes("email")) return "https://mail.google.com";
  if (text.includes("calendar")) return "https://calendar.google.com";
  if (text.includes("spotify")) return "https://open.spotify.com";
  if (text.includes("chatgpt")) return "https://chatgpt.com";
  if (text.includes("google")) return "https://www.google.com";

  return "https://www.google.com";
}

function buildDesktopPlan(prompt: string): DesktopPlanStep[] {
  const text = normaliseLower(prompt);
  const dangerous = isDangerousPrompt(prompt);
  const steps: DesktopPlanStep[] = [];

  steps.push({
    id: "step_001",
    title: "Understand request",
    description: "Kuro will analyse the request and decide which app or website to open.",
    action: "wait_for_user",
    safetyLevel: "safe",
  });

  if (text.includes("gmail") || text.includes("email") || text.includes("inbox")) {
    steps.push({
      id: "step_002",
      title: "Open Gmail in Kuro Workspace",
      description: "Kuro will open Gmail inside the dedicated Opera workspace.",
      action: "open_gmail",
      value: "https://mail.google.com",
      safetyLevel: "safe",
    });

    steps.push({
      id: "step_003",
      title: "Read visible inbox content",
      description: "Kuro will only read visible page text and prepare a summary.",
      action: "extract_text",
      safetyLevel: "safe",
    });
  } else if (text.includes("calendar") || text.includes("schedule")) {
    steps.push({
      id: "step_002",
      title: "Open Google Calendar in Kuro Workspace",
      description: "Kuro will open Google Calendar in Opera.",
      action: "open_calendar",
      value: "https://calendar.google.com",
      safetyLevel: "safe",
    });
  } else if (text.includes("search") || text.includes("research") || text.includes("find")) {
    const query = prompt
      .replace(/open/gi, "")
      .replace(/search/gi, "")
      .replace(/research/gi, "")
      .replace(/find/gi, "")
      .trim();

    steps.push({
      id: "step_002",
      title: "Search the web in Kuro Workspace",
      description: "Kuro will open Opera and search the requested topic.",
      action: "search_web",
      value: query || prompt,
      safetyLevel: "safe",
    });
  } else {
    steps.push({
      id: "step_002",
      title: "Open relevant workspace",
      description: "Kuro will open the most relevant website in Opera.",
      action: "open_url",
      value: inferUrlFromPrompt(prompt),
      safetyLevel: "safe",
    });
  }

  steps.push({
    id: "step_999",
    title: dangerous ? "Final approval required" : "Stop before sensitive actions",
    description: dangerous
      ? "This request contains sending, deleting, purchasing, submitting, or payment behaviour. Kuro will stop before that action."
      : "Kuro will not send, delete, purchase, submit, or pay without another approval.",
    action: "wait_for_user",
    requiresApproval: true,
    safetyLevel: dangerous ? "approval_required" : "safe",
  });

  return steps;
}

async function getDesktopPage() {
  const userDataDir = path.join(process.cwd(), ".kuro-opera-workspace-profile");

  if (!desktopContext) {
    desktopContext = await chromium.launchPersistentContext(
      userDataDir,
      getBrowserLaunchOptions()
    );
  }

  return desktopContext.pages()[0] || (await desktopContext.newPage());
}

async function executeDesktopStep(page: Page, step: DesktopPlanStep) {
  if (step.safetyLevel === "blocked") {
    return {
      step,
      success: false,
      blocked: true,
      message: "This action is blocked for safety.",
    };
  }

  if (
    step.action === "wait_for_user" ||
    step.requiresApproval ||
    step.safetyLevel === "approval_required"
  ) {
    return {
      step,
      success: true,
      waitingForUser: true,
      message: "Kuro stopped and is waiting for user approval.",
    };
  }

  if (
    step.action === "open_url" ||
    step.action === "open_gmail" ||
    step.action === "open_calendar"
  ) {
    const url = step.value || "https://www.google.com";

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    return {
      step,
      success: true,
      url: page.url(),
      message: `Kuro opened ${url} in Opera Workspace.`,
    };
  }

  if (step.action === "search_web") {
    const query = step.value || "Kuro AI executive assistant";

    await page.goto("https://www.google.com/search?q=" + encodeURIComponent(query), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    return {
      step,
      success: true,
      url: page.url(),
      message: `Kuro searched Google for "${query}" in Opera Workspace.`,
    };
  }

  if (step.action === "extract_text") {
    await page.waitForTimeout(2000);

    const pageText = await page
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "");

    return {
      step,
      success: true,
      extractedText: pageText.slice(0, 4000),
      message: "Kuro extracted visible page text from Opera Workspace.",
    };
  }

  return {
    step,
    success: false,
    message: "Unsupported desktop action.",
  };
}

/* ----------------------------- Spotify helpers ----------------------------- */

function getSeeds(prompt: string, selectedMood?: string, trackSeeds?: string[]) {
  if (Array.isArray(trackSeeds) && trackSeeds.length > 0) {
    return Array.from(
      new Set(trackSeeds.map((track) => String(track).trim()).filter(Boolean))
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
    if (await isVisible(candidate, 2500)) return candidate;
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

/* ----------------------------- Gmail helpers ----------------------------- */

const demoInbox: EmailItem[] = [
  {
    id: "mail_001",
    from: "OCBC Hackathon Team <events@ocbc.com>",
    subject: "Final hackathon briefing and demo schedule",
    snippet:
      "Please prepare your demo flow and arrive before the morning registration. Final judging will begin after lunch.",
    receivedAt: "Today, 8:20 AM",
    unread: true,
  },
  {
    id: "mail_002",
    from: "Client Success <client@example.com>",
    subject: "Re: Proposal confirmation",
    snippet:
      "Thanks for sending this over. Could you confirm the final delivery timeline and next steps by today?",
    receivedAt: "Today, 9:05 AM",
    unread: true,
  },
  {
    id: "mail_003",
    from: "Stripe <support@stripe.com>",
    subject: "Payment integration checklist",
    snippet:
      "Your Stripe account is almost ready. Complete the remaining checklist items before going live.",
    receivedAt: "Yesterday, 6:12 PM",
    unread: false,
  },
  {
    id: "mail_004",
    from: "Notion <team@notion.so>",
    subject: "Your weekly workspace summary",
    snippet:
      "Here is what changed in your workspace this week.",
    receivedAt: "Yesterday, 11:40 AM",
    unread: false,
  },
];

function getEmails(input?: EmailItem[]) {
  if (Array.isArray(input) && input.length > 0) return input;
  return demoInbox;
}

function classifyEmail(email: EmailItem) {
  const text = `${email.from} ${email.subject} ${email.snippet}`.toLowerCase();

  if (
    text.includes("urgent") ||
    text.includes("deadline") ||
    text.includes("today") ||
    text.includes("confirm") ||
    text.includes("action required") ||
    text.includes("demo") ||
    text.includes("briefing")
  ) {
    return "High Priority";
  }

  if (
    text.includes("invoice") ||
    text.includes("payment") ||
    text.includes("stripe") ||
    text.includes("receipt")
  ) {
    return "Finance";
  }

  if (
    text.includes("proposal") ||
    text.includes("client") ||
    text.includes("meeting") ||
    text.includes("timeline")
  ) {
    return "Client";
  }

  if (
    text.includes("newsletter") ||
    text.includes("weekly") ||
    text.includes("summary") ||
    text.includes("workspace")
  ) {
    return "Low Priority";
  }

  return "General";
}

function urgencyScore(email: EmailItem) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  let score = 0;

  if (email.unread) score += 2;
  if (text.includes("today")) score += 4;
  if (text.includes("urgent")) score += 5;
  if (text.includes("deadline")) score += 4;
  if (text.includes("confirm")) score += 3;
  if (text.includes("action required")) score += 4;
  if (text.includes("demo")) score += 3;
  if (text.includes("payment")) score += 2;
  if (text.includes("weekly")) score -= 2;
  if (text.includes("newsletter")) score -= 3;

  return score;
}

function getUrgency(email: EmailItem): EmailUrgency {
  const score = urgencyScore(email);

  if (score >= 6) return "urgent";
  if (score >= 3) return "important";
  return "normal";
}

function buildEmailSummary(email: EmailItem): EmailSummary {
  const label = classifyEmail(email);

  return {
    id: email.id,
    from: email.from,
    subject: email.subject,
    receivedAt: email.receivedAt || "Recently",
    unread: Boolean(email.unread),
    label,
    urgency: getUrgency(email),
    summary: normalise(email.snippet),
    suggestedAction:
      label === "High Priority"
        ? "Review and reply today."
        : label === "Finance"
          ? "Check payment/account status."
          : label === "Client"
            ? "Draft a polite confirmation reply."
            : label === "Low Priority"
              ? "Archive or read later."
              : "Review when free.",
  };
}

function buildReplyDraft(
  email: EmailItem,
  tone: DraftReplyRequest["tone"] = "professional"
) {
  const senderName = email.from.split("<")[0].trim() || "there";
  const subject = email.subject.toLowerCase().startsWith("re:")
    ? email.subject
    : `Re: ${email.subject}`;

  const signoff =
    tone === "formal"
      ? "Best regards,"
      : tone === "warm"
        ? "Warm regards,"
        : "Best regards,";

  const body =
    tone === "short"
      ? `Hi ${senderName},\n\nThanks for your email. I have received this and will review it shortly.\n\n${signoff}\nAndy`
      : `Hi ${senderName},\n\nThank you for your email.\n\nI have received the details and will review them carefully. I will get back to you with the next steps shortly.\n\n${signoff}\nAndy`;

  return {
    to: email.from,
    subject,
    body,
    status: "draft_ready",
    safetyNote: "Kuro prepared this as a draft only. The user should approve before sending.",
  };
}

function buildGoodMorningBrief(emails: EmailItem[]) {
  const summaries = emails.map(buildEmailSummary);
  const unreadCount = emails.filter((email) => email.unread).length;

  const urgencyOrder: Record<EmailUrgency, number> = {
    urgent: 3,
    important: 2,
    normal: 1,
  };

  const highPriority = summaries
    .filter((email) => email.label === "High Priority" || email.urgency === "urgent")
    .sort((a, b) => urgencyOrder[b.urgency] - urgencyOrder[a.urgency]);

  const normal = summaries.filter(
    (email) => !highPriority.some((item) => item.id === email.id)
  );

  return {
    title: "Good Morning, Andy",
    subtitle: "Kuro scanned your inbox and prepared your executive brief.",
    inboxStats: {
      totalEmailsScanned: emails.length,
      unreadCount,
      highPriorityCount: highPriority.length,
    },
    highPriority,
    normal,
    recommendedFocus:
      highPriority.length > 0
        ? `Start with "${highPriority[0].subject}" from ${highPriority[0].from}.`
        : "No urgent emails detected. You can start with planned work.",
    suggestedActions: [
      "Reply to high-priority emails first.",
      "Archive low-priority newsletters.",
      "Draft replies before sending anything.",
      "Review finance/payment emails separately.",
    ],
  };
}

/* -------------------------------- endpoints -------------------------------- */

app.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "Kuro Executive OS Agent",
    status: "running",
    browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
    modules: ["desktop", "gmail", "spotify"],
    safety:
      "Kuro can open and read apps/sites, but will stop before sending, deleting, purchasing, paying, or submitting.",
  });
});

/* ----------------------------- Desktop endpoints ----------------------------- */

app.post("/desktop/plan", async (req, res) => {
  try {
    const body = req.body as DesktopPlanRequest;

    if (!body.prompt || typeof body.prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "prompt is required.",
      });
    }

    const plan = buildDesktopPlan(body.prompt);

    return res.json({
      success: true,
      prompt: body.prompt,
      plan,
      approvalRequired: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      message: "Kuro prepared a permission-first desktop action plan.",
    });
  } catch (error) {
    console.error("========== KURO DESKTOP PLAN ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Kuro could not prepare the desktop plan.",
    });
  }
});

app.post("/desktop/execute", async (req, res) => {
  try {
    const body = req.body as DesktopExecuteRequest;
    const page = await getDesktopPage();

    const plan =
      Array.isArray(body.plan) && body.plan.length > 0
        ? body.plan
        : buildDesktopPlan(body.prompt || "Open Google");

    const results = [];

    for (const step of plan) {
      const result = await executeDesktopStep(page, step);
      results.push(result);

      if (result.waitingForUser || result.blocked) break;
    }

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      results,
      currentUrl: page.url(),
      message: "Kuro executed the approved safe desktop steps in Opera Workspace.",
    });
  } catch (error) {
    console.error("========== KURO DESKTOP EXECUTE ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Kuro could not execute desktop steps.",
    });
  }
});

app.post("/desktop/open-url", async (req, res) => {
  try {
    const body = req.body as DesktopExecuteRequest;

    if (!body.url || typeof body.url !== "string") {
      return res.status(400).json({
        success: false,
        error: "url is required.",
      });
    }

    const page = await getDesktopPage();

    await page.goto(body.url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2500);

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      openedUrl: page.url(),
      message: `Kuro opened ${body.url} in Opera Workspace.`,
    });
  } catch (error) {
    console.error("========== KURO OPEN URL ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not open the URL.",
    });
  }
});

app.post("/desktop/search-web", async (req, res) => {
  try {
    const body = req.body as DesktopExecuteRequest;

    if (!body.query || typeof body.query !== "string") {
      return res.status(400).json({
        success: false,
        error: "query is required.",
      });
    }

    const page = await getDesktopPage();
    const url = "https://www.google.com/search?q=" + encodeURIComponent(body.query);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2500);

    const text = await page
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "");

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      query: body.query,
      openedUrl: page.url(),
      visibleText: text.slice(0, 4000),
      message: `Kuro searched the web for "${body.query}" in Opera Workspace.`,
    });
  } catch (error) {
    console.error("========== KURO SEARCH WEB ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not search the web.",
    });
  }
});

app.post("/desktop/open-gmail", async (_req, res) => {
  try {
    const page = await getDesktopPage();

    await page.goto("https://mail.google.com", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      openedUrl: page.url(),
      message:
        "Kuro opened Gmail in Opera Workspace. If login is required, please log in manually. Kuro will not send emails without approval.",
    });
  } catch (error) {
    console.error("========== KURO OPEN GMAIL ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not open Gmail.",
    });
  }
});

app.post("/desktop/open-calendar", async (_req, res) => {
  try {
    const page = await getDesktopPage();

    await page.goto("https://calendar.google.com", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      openedUrl: page.url(),
      message:
        "Kuro opened Google Calendar in Opera Workspace. Kuro will not create or edit events without approval.",
    });
  } catch (error) {
    console.error("========== KURO OPEN CALENDAR ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not open Calendar.",
    });
  }
});

app.post("/desktop/extract-visible-text", async (_req, res) => {
  try {
    const page = await getDesktopPage();

    const text = await page
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "");

    return res.json({
      success: true,
      browser: getOperaExecutablePath() ? "Opera Workspace" : "Chrome fallback",
      currentUrl: page.url(),
      visibleText: text.slice(0, 8000),
      message: "Kuro extracted visible text from the active Opera Workspace page.",
    });
  } catch (error) {
    console.error("========== KURO EXTRACT TEXT ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not extract text.",
    });
  }
});

app.post("/desktop/close", async (_req, res) => {
  try {
    if (desktopContext) {
      await desktopContext.close().catch(() => null);
      desktopContext = null;
    }

    return res.json({
      success: true,
      message: "Kuro closed the Opera Workspace session.",
    });
  } catch (error) {
    console.error("========== KURO DESKTOP CLOSE ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Kuro could not close the desktop browser.",
    });
  }
});

/* ----------------------------- Gmail endpoints ----------------------------- */

app.post("/gmail/good-morning", async (req, res) => {
  try {
    const body = req.body as GmailBriefRequest;
    const emails = getEmails(body.emails);
    const brief = buildGoodMorningBrief(emails);

    return res.json({
      success: true,
      mode: "good_morning",
      brief,
      message: "Kuro prepared your executive inbox brief.",
    });
  } catch (error) {
    console.error("========== KURO GMAIL GOOD MORNING ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Kuro could not prepare the inbox brief.",
    });
  }
});

app.post("/gmail/summarize-inbox", async (req, res) => {
  try {
    const body = req.body as GmailBriefRequest;
    const emails = getEmails(body.emails);
    const summaries = emails.map(buildEmailSummary);

    return res.json({
      success: true,
      summaries,
      message: `Kuro summarized ${summaries.length} emails.`,
    });
  } catch (error) {
    console.error("========== KURO GMAIL SUMMARY ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Kuro could not summarize the inbox.",
    });
  }
});

app.post("/gmail/draft-reply", async (req, res) => {
  try {
    const body = req.body as DraftReplyRequest;
    const email = body.email || demoInbox[1];
    const draft = buildReplyDraft(email, body.tone || "professional");

    return res.json({
      success: true,
      draft,
      originalEmail: email,
      message: "Kuro prepared a reply draft. User approval is required before sending.",
    });
  } catch (error) {
    console.error("========== KURO GMAIL DRAFT ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not draft the reply.",
    });
  }
});

app.post("/gmail/smart-labels", async (req, res) => {
  try {
    const body = req.body as GmailBriefRequest;
    const emails = getEmails(body.emails);

    const labelled = emails.map((email) => ({
      ...email,
      label: classifyEmail(email),
      urgencyScore: urgencyScore(email),
    }));

    return res.json({
      success: true,
      labelled,
      message: "Kuro sorted the inbox into smart labels.",
    });
  } catch (error) {
    console.error("========== KURO GMAIL LABEL ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not label the inbox.",
    });
  }
});

app.post("/gmail/search", async (req, res) => {
  try {
    const { query, emails } = req.body as GmailBriefRequest & { query?: string };
    const sourceEmails = getEmails(emails);
    const cleanQuery = String(query || "").toLowerCase();

    const results = sourceEmails
      .filter((email) => {
        const text = `${email.from} ${email.subject} ${email.snippet}`.toLowerCase();
        return !cleanQuery || text.includes(cleanQuery);
      })
      .map(buildEmailSummary);

    return res.json({
      success: true,
      query: cleanQuery,
      results,
      message:
        results.length > 0
          ? `Kuro found ${results.length} matching emails.`
          : "Kuro could not find matching emails.",
    });
  } catch (error) {
    console.error("========== KURO GMAIL SEARCH ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Kuro could not search the inbox.",
    });
  }
});

/* ----------------------------- Spotify endpoint - unchanged ----------------------------- */

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
        error instanceof Error ? error.message : "Spotify browser agent failed.",
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
      error: err instanceof Error ? err.message : "Unknown server error",
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro Executive OS Agent running on port ${PORT}`);
  console.log(
    getOperaExecutablePath()
      ? `Opera Workspace connected: ${getOperaExecutablePath()}`
      : "Opera not found. Falling back to Chrome."
  );
});