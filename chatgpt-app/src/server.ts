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

const artistRoleSchema = z.enum([
  "performer",
  "songwriter",
  "producer",
  "independent-artist",
  "label-team",
  "multi-role",
]);
const projectFocusSchema = z.enum(["recording", "release", "live", "export", "career"]);
const obstacleSchema = z.enum([
  "rights-metadata",
  "funding",
  "time-capacity",
  "promotion-audience",
  "financing",
  "administration",
  "other",
]);

type SupportAction = {
  title: string;
  action: string;
  why: string;
  verifyWith: string;
};

function actionForObstacle(obstacle: z.infer<typeof obstacleSchema>): SupportAction {
  const actions: Record<z.infer<typeof obstacleSchema>, SupportAction> = {
    "rights-metadata": {
      title: "Lag en oversikt over verk, innspilling og eierskap",
      action: "Skill mellom komposisjon, innspilling og master. Samle bidragsytere, avtaler, avtalte andeler og åpne spørsmål før registrering eller levering.",
      why: "Uklare roller, krediteringer og rettigheter kan føre til feilregistrering eller forsinket levering.",
      verifyWith: "Skriftlig bekreftelse fra bidragsyterne, relevante avtaler og gjeldende veiledning fra TONO, Gramo og distributøren.",
    },
    funding: {
      title: "Sjekk støtteordninger mot prosjektet før du skriver søknad",
      action: "Lag en kort prosjektbeskrivelse og kostnadsoversikt. Finn mulige ordninger, og kontroller krav, søker, kostnader og frist hos hver aktuell støttegiver.",
      why: "Ordninger varierer med geografi, søkerform, aktivitet og kostnadstype, og regler og frister endres.",
      verifyWith: "Støttegiverens gjeldende offisielle utlysning. Dette verktøyet har ikke sjekket frister eller kvalifikasjon live.",
    },
    "time-capacity": {
      title: "Gjør neste uke gjennomførbar",
      action: "Velg én nødvendig oppgave, sett av en kort arbeidsøkt og flytt resten til en senere liste. Vurder konkret hva en samarbeidspartner kan eie.",
      why: "En mindre, tydelig arbeidsmengde er enklere å gjennomføre når artisten også håndterer administrasjon.",
      verifyWith: "En oppgaveliste med ansvarlig, neste dato og dokumentasjon på fullføring.",
    },
    "promotion-audience": {
      title: "Velg ett publikumsmål og én lyttervei",
      action: "Bestem om innsatsen skal skape kjennskap, forhåndslagringer eller lytting. Velg få innholdsbiter artisten faktisk kan lage, og test lenken til utgivelsen.",
      why: "En avgrenset plan gjør det mulig å lære av responsen uten å spre tid og budsjett på for mange kanaler.",
      verifyWith: "Testet utgivelseslenke og en enkel logg over publisert innhold og respons. Ingen rekkevidde eller strømmer kan loves.",
    },
    financing: {
      title: "Sett et tydelig kostnadstak",
      action: "List kjente kostnader for produksjon, visuelt materiell, markedsføring og aktivitet. Skill tilbud fra estimater, sett et maksimalt beløp og prioriter tiltak som passer kapasiteten.",
      why: "Det synliggjør økonomisk risiko før penger bindes eller annonser aktiveres.",
      verifyWith: "Oppdaterte tilbud, prosjektbudsjett og skriftlig godkjenning fra den som bærer kostnaden.",
    },
    administration: {
      title: "Samle prosjektstatus på ett sted",
      action: "Opprett en oversikt med oppgave, ansvarlig, frist, status, kilde og bevis for ferdigstillelse.",
      why: "En felles oversikt reduserer dobbeltarbeid og gjør det lettere å se hva som mangler.",
      verifyWith: "Den løpende prosjektoversikten og opprinnelig kilde for hver frist eller status.",
    },
    other: {
      title: "Bryt hindringen ned til ett kontrollerbart steg",
      action: "Beskriv hva som stopper prosjektet, hva som haster, hvem som kan avklare det, og den minste handlingen som kan tas nå.",
      why: "Det viser om hindringen handler om informasjon, kapasitet, økonomi, rettigheter eller en beslutning.",
      verifyWith: "Svar eller dokumentasjon fra personen, plattformen eller organisasjonen som eier avklaringen.",
    },
  };

  return actions[obstacle];
}

function actionForArtistRole(role: z.infer<typeof artistRoleSchema>): SupportAction {
  const actions: Record<z.infer<typeof artistRoleSchema>, SupportAction> = {
    performer: {
      title: "Kontroller utøverrollen på innspillingen",
      action: "Bekreft hvilke spor du medvirker på og hvilken rolle du hadde. Se gjeldende Gramo-veiledning og avklar mangler med produsent eller label.",
      why: "Rettigheter knyttet til en innspilt fremføring er noe annet enn rettighetene til komposisjonen.",
      verifyWith: "Innspillingskreditering, avtale og gjeldende informasjon fra Gramo.",
    },
    songwriter: {
      title: "Avklar verk og andeler med medlåtskrivere",
      action: "Samle korrekt verkstittel, alle låtskrivere og skriftlig avtalte andeler. Bruk TONOs gjeldende veiledning for verkregistrering.",
      why: "Komposisjonsrettigheter må holdes adskilt fra eierskap til lydopptaket.",
      verifyWith: "Skriftlig enighet mellom låtskriverne og gjeldende TONO-veiledning.",
    },
    producer: {
      title: "Avklar produsentkreditering og rettighetsrolle",
      action: "Sjekk produsentkreditering, medvirkende utøvere og hva kontrakten sier om master og betaling. Skill dette fra eventuelle Gramo-krav.",
      why: "Kreditering, mastereierskap og vederlag følger ikke automatisk samme avtale eller regel.",
      verifyWith: "Signert produsent-/labelavtale og gjeldende veiledning fra relevant rettighetsorganisasjon.",
    },
    "independent-artist": {
      title: "Sjekk distribusjonsdata og rettigheter før levering",
      action: "Sammenlign artistnavn, tittel, dato, medvirkende, eksplisitt-merking og eierskapslinjer. Bekreft master, samples og nødvendige tillatelser.",
      why: "Selvutgivere må ofte koordinere metadata og rettighetsavklaringer på tvers av flere tjenester.",
      verifyWith: "Distributørens aktuelle krav, godkjente metadata og skriftlige rettighetsavklaringer.",
    },
    "label-team": {
      title: "Samle godkjente metadata fra bidragsyterne",
      action: "Bruk én versjon av utgivelsesdata og bekreft artistnavn, roller, avtaler, datoer og leveringskrav med artist og distributør.",
      why: "Et felles datagrunnlag reduserer avvik mellom distribusjon, presse og plattformer.",
      verifyWith: "Artistens skriftlige godkjenning, relevante avtaler og distributørens produktdata.",
    },
    "multi-role": {
      title: "Hold verk, fremføring og master i separate spor",
      action: "Skriv opp hvilke bidrag som gjelder komposisjon, innspilt fremføring og master. Avklar roller og andeler hver for seg før registrering eller levering.",
      why: "Én person kan ha flere roller, men de gir ikke nødvendigvis samme rettigheter eller registrering.",
      verifyWith: "Avtaler og bekreftelser fra bidragsyterne, samt gjeldende veiledning fra TONO, Gramo og distributøren.",
    },
  };

  return actions[role];
}

function actionForProjectFocus(focus: z.infer<typeof projectFocusSchema>): SupportAction {
  const actions: Record<z.infer<typeof projectFocusSchema>, SupportAction> = {
    recording: {
      title: "Avklar leveranser og ansvar før innspilling",
      action: "Skriv ned hvem som leverer opptak, produksjon, miks, master og visuelt materiell, hva det koster og hvilke rettigheter som avtales.",
      why: "Tidlige avklaringer gjør det enklere å ferdigstille innspillingen og planlegge kostnader.",
      verifyWith: "Avtaler, godkjent budsjett og leveranseplan.",
    },
    release: {
      title: "Kontroller metadata og dato på tvers av utgivelsen",
      action: "Sammenlign distributørskjema, cover, credits og kampanjemateriell. Skill mellom godkjent, levert og faktisk live.",
      why: "Distribusjonsstatus og offentlig tilgjengelighet er ulike steg.",
      verifyWith: "Distributørens status og fungerende offentlige lenker til riktig utgivelse.",
    },
    live: {
      title: "Lag en realistisk plan for konsertaktivitet",
      action: "Avgrens målområde, passende scener, datoer, honorar-/reisebudsjett og hvem som følger opp booking.",
      why: "En lokal eller regional plan kan konkretiseres før større turnékostnader vurderes.",
      verifyWith: "Bekreftede spillestedsvilkår, kostnader og gjeldende støttekrav dersom støtte vurderes.",
    },
    export: {
      title: "Velg ett målmarked og kontroller forutsetningene",
      action: "Beskriv hvorfor markedet passer, hvem som kan åpne dører der, kostnadene og hva som må være klart før reisen.",
      why: "Eksportarbeid krever relasjoner og ressurser; et avgrenset forsøk tydeliggjør risiko og læring.",
      verifyWith: "Bekreftede lokale samarbeid, oppdaterte reisekostnader og Music Norways gjeldende vilkår dersom støtte vurderes.",
    },
    career: {
      title: "Velg et målbart karrieresteg for de neste månedene",
      action: "Velg én utviklingsprioritet, for eksempel repertoar, live-erfaring, samarbeid eller artistmateriell, og knytt den til en dato og ansvarlig.",
      why: "En konkret milepæl gjør det enklere å følge framgang uten å forutsette rask vekst eller inntekt.",
      verifyWith: "En datert milepæl og dokumentasjon på gjennomført aktivitet.",
    },
  };

  return actions[focus];
}

const norwayResources = [
  { name: "Musikkontoret – støtteordninger", url: "https://www.musikkontoret.no/tilskuddsordninger", use: "Finn mulige ordninger; kontroller alltid reglene hos støttegiver." },
  { name: "Music Norway", url: "https://musicnorway.no", use: "Startpunkt for norsk musikkeksport og internasjonal aktivitet." },
  { name: "Kulturdirektoratet", url: "https://www.kulturdirektoratet.no", use: "Offisiell informasjon om relevante kulturordninger." },
  { name: "TONO", url: "https://www.tono.no", use: "Veiledning om opphaver-/komposisjonssiden." },
  { name: "Gramo", url: "https://gramo.no/no", use: "Veiledning om relevante rettigheter for innspillinger og medvirkende." },
];

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
    { name: "music-release-manager", version: "1.1.0" },
    {
      instructions:
        "This server is exclusively for music—not software. It provides music-release planning, readiness checks, and general Norway-aware artist support. It never publishes, sends outreach, activates ads, or spends money. Verify current funding deadlines and eligibility with the official funder; the Norway support tool does not browse or confirm them.",
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

  registerAppTool(
    server,
    "create_norway_artist_support_plan",
    {
      title: "Create Norway artist support plan",
      description:
        "Use this when an artist in Norway asks how to overcome a release, rights, funding, capacity, audience, or career obstacle. It returns three profile-based practical priorities and official starting points. It does not verify live deadlines, eligibility, or current grant rules.",
      inputSchema: {
        artistName: z.string().min(1).max(120).optional().describe("Optional artist or project name."),
        artistRole: artistRoleSchema.describe("The artist's main role in this project."),
        area: z.string().max(120).optional().describe("Optional municipality or county."),
        projectFocus: projectFocusSchema.describe("The main project: recording, release, live work, export, or career development."),
        mainObstacle: obstacleSchema.describe("The most urgent obstacle to address."),
      },
      outputSchema: {
        kind: z.literal("norway-support-plan"),
        artistName: z.string(),
        artistRole: z.string(),
        area: z.string().nullable(),
        projectFocus: z.string(),
        mainObstacle: z.string(),
        nextActions: z.array(
          z.object({
            priority: z.number(),
            title: z.string(),
            action: z.string(),
            why: z.string(),
            verifyWith: z.string(),
          })
        ),
        resources: z.array(
          z.object({ name: z.string(), url: z.string(), use: z.string() })
        ),
        currentInfoNote: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Building a Norway artist support plan",
        "openai/toolInvocation/invoked": "Norway artist support plan ready",
      },
    },
    async ({ artistName, artistRole, area, projectFocus, mainObstacle }) => {
      const structuredContent = {
        kind: "norway-support-plan" as const,
        artistName: artistName ?? "Artist project",
        artistRole,
        area: area ?? null,
        projectFocus,
        mainObstacle,
        nextActions: [
          actionForObstacle(mainObstacle),
          actionForArtistRole(artistRole),
          actionForProjectFocus(projectFocus),
        ].map((action, index) => ({ priority: index + 1, ...action })),
        resources: norwayResources,
        currentInfoNote:
          "This plan uses stable general guidance only. It has not checked current funding calls, deadlines, eligibility, or costs. Verify those details on the official funder's page before acting.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Created a Norway artist support plan for ${structuredContent.artistName}. The plan prioritizes ${mainObstacle}, the artist's role, and the ${projectFocus} project. Current funding details still need official verification.`,
          },
        ],
        structuredContent,
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
