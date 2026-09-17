import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "..");
const widgetUri = "ui://music-release-manager/release-plan-v1.html";
const widgetHtml = readFileSync(path.join(rootDir, "public", "widget.html"), "utf8");

const phaseNames = [
  "Foundation",
  "Distribution",
  "Profiles & editorial",
  "Listener path",
  "Content & promotion",
  "Press & radio",
  "Release day & follow-through",
] as const;

const phaseDetails = [
  "Confirm the final master, cover, metadata, credits, lyrics, ownership and release date.",
  "Prepare the distributor submission and distinguish draft, submitted, delivered and live states.",
  "Prepare truthful platform pitches, update artist profiles and check Canvas or equivalent assets.",
  "Create and test a pre-save or smart link using verified release-specific destinations.",
  "Build a varied social calendar and review ad goals, audience, creative, budget and dates separately.",
  "Prepare a concise press kit, identify current contacts, personalize outreach and track follow-ups.",
  "Verify live links, publish only missing assets, monitor responses and capture learnings.",
] as const;

const stageSchema = z.enum([
  "idea",
  "assets",
  "distribution",
  "promotion",
  "release-week",
  "released",
]);

const releaseTypeSchema = z.enum(["single", "ep", "album"]);

function startIndexForStage(stage: z.infer<typeof stageSchema>): number {
  return {
    idea: 0,
    assets: 0,
    distribution: 1,
    promotion: 2,
    "release-week": 5,
    released: 6,
  }[stage];
}

function createMusicReleaseServer(): McpServer {
  const server = new McpServer(
    { name: "music-release-manager", version: "1.0.0" },
    {
      instructions:
        "This server is exclusively for releasing music—not software. Help artists and record labels plan songs, singles, EPs and albums. It never publishes, sends outreach, activates ads or spends money.",
    }
  );

  registerAppResource(server, "release-plan-widget", widgetUri, {}, async () => ({
    contents: [
      {
        uri: widgetUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: "https://release-manager-production-bb96.up.railway.app",
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/widgetDescription":
            "A compact black-and-gold music release plan showing the current phase, next actions and readiness gaps.",
        },
      },
    ],
  }));

  registerAppTool(
    server,
    "create_music_release_plan",
    {
      title: "Create music release plan",
      description:
        "Use this when an artist or record label wants a practical plan for releasing a song, single, EP, or album. This is only for music releases, never software releases. It calculates a plan but does not save, publish, submit, send, or spend.",
      inputSchema: {
        artist: z.string().min(1).max(120).describe("Artist or project name."),
        title: z.string().min(1).max(160).describe("Release title."),
        releaseType: releaseTypeSchema.describe("Whether this is a single, EP, or album."),
        releaseDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Planned release date in YYYY-MM-DD format."),
        currentStage: stageSchema.describe("The current stage of the music release."),
      },
      outputSchema: {
        kind: z.literal("plan"),
        artist: z.string(),
        title: z.string(),
        releaseType: z.string(),
        releaseDate: z.string(),
        currentStage: z.string(),
        nextActions: z.array(z.string()),
        phases: z.array(
          z.object({
            number: z.number(),
            name: z.string(),
            detail: z.string(),
            status: z.enum(["unverified", "current", "upcoming"]),
          })
        ),
        safetyNote: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/toolInvocation/invoking": "Building the music release plan",
        "openai/toolInvocation/invoked": "Music release plan ready",
      },
    },
    async ({ artist, title, releaseType, releaseDate, currentStage }) => {
      const currentIndex = startIndexForStage(currentStage);
      const phases = phaseNames.map((name, index) => ({
        number: index + 1,
        name,
        detail: phaseDetails[index],
        status: index < currentIndex ? ("unverified" as const) : index === currentIndex ? ("current" as const) : ("upcoming" as const),
      }));
      const nextActions = phases.slice(currentIndex, currentIndex + 3).map((phase) => phase.detail);
      const structuredContent = {
        kind: "plan" as const,
        artist,
        title,
        releaseType,
        releaseDate,
        currentStage,
        nextActions,
        phases,
        safetyNote: "This plan does not publish, submit, send messages, activate advertising, or spend money.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Created a music release plan for ${artist} — ${title}. The next priorities are ${nextActions.join(" ")}`,
          },
        ],
        structuredContent,
        _meta: { "openai/outputTemplate": widgetUri },
      };
    }
  );

  registerAppTool(
    server,
    "check_music_release_readiness",
    {
      title: "Check music release readiness",
      description:
        "Use this when an artist or record label wants to see what is ready or missing before releasing music. It checks supplied facts only and does not access accounts, upload files, publish, send, or spend.",
      inputSchema: {
        artist: z.string().min(1).max(120),
        title: z.string().min(1).max(160),
        releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        finalMaster: z.boolean().describe("A final approved audio master exists."),
        finalArtwork: z.boolean().describe("Final rights-cleared cover artwork exists."),
        metadataAndCredits: z.boolean().describe("Metadata and contributor credits are confirmed."),
        distributorSubmitted: z.boolean().describe("The release has been submitted to a distributor."),
        smartLinkReady: z.boolean().describe("A tested pre-save or smart link is ready."),
        promotionPlanReady: z.boolean().describe("A social or promotional plan is ready."),
      },
      outputSchema: {
        kind: z.literal("readiness"),
        artist: z.string(),
        title: z.string(),
        releaseDate: z.string(),
        score: z.number(),
        ready: z.array(z.string()),
        missing: z.array(z.string()),
        nextActions: z.array(z.string()),
        safetyNote: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/toolInvocation/invoking": "Checking music release readiness",
        "openai/toolInvocation/invoked": "Readiness check complete",
      },
    },
    async ({
      artist,
      title,
      releaseDate,
      finalMaster,
      finalArtwork,
      metadataAndCredits,
      distributorSubmitted,
      smartLinkReady,
      promotionPlanReady,
    }) => {
      const checks = [
        ["Final approved master", finalMaster],
        ["Final rights-cleared artwork", finalArtwork],
        ["Confirmed metadata and credits", metadataAndCredits],
        ["Distributor submission", distributorSubmitted],
        ["Tested pre-save or smart link", smartLinkReady],
        ["Promotion plan", promotionPlanReady],
      ] as const;
      const ready = checks.filter(([, done]) => done).map(([label]) => label);
      const missing = checks.filter(([, done]) => !done).map(([label]) => label);
      const nextActions = missing.slice(0, 3).map((item) => `Complete: ${item}.`);
      const structuredContent = {
        kind: "readiness" as const,
        artist,
        title,
        releaseDate,
        score: Math.round((ready.length / checks.length) * 100),
        ready,
        missing,
        nextActions,
        safetyNote: "This check uses only the details supplied in the request and does not access or change external accounts.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `${artist} — ${title} is ${structuredContent.score}% ready based on the supplied checklist. ${missing.length ? `Missing: ${missing.join(", ")}.` : "No checklist items are missing."}`,
          },
        ],
        structuredContent,
        _meta: { "openai/outputTemplate": widgetUri },
      };
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? "8787");
const mcpPath = "/mcp";

createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const isMcpRoute = url.pathname === mcpPath || url.pathname.startsWith(`${mcpPath}/`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Music Release Manager MCP server");
    return;
  }

  if (req.method === "GET" && url.pathname === "/privacy") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "privacy.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/terms") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "terms.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/support") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "support.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/openai-apps-challenge") {
    const challenge = process.env.OPENAI_APPS_CHALLENGE;
    if (!challenge) {
      res.writeHead(404).end("Challenge not configured");
      return;
    }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(challenge);
    return;
  }

  if (req.method === "OPTIONS" && isMcpRoute) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (isMcpRoute && req.method && new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createMusicReleaseServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Failed to handle MCP request:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
}).listen(port, () => {
  console.log(`Music Release Manager listening on http://localhost:${port}${mcpPath}`);
});
