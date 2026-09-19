import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeAudioFile } from "./audio-analysis.js";
import { fundingActivities, fundingDirectory, getFundingPrograms, matchFundingPrograms } from "./funding-catalog.js";

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
const releaseDashboardUri = "ui://music-release-manager/release-dashboard-v1.html";
const contentStudioUri = "ui://music-release-manager/content-studio-v1.html";
const campaignStudioUri = "ui://music-release-manager/campaign-studio-v1.html";
const releaseCardUri = "ui://music-release-manager/release-card-v2.html";
const metadataChecklistUri = "ui://music-release-manager/metadata-checklist-v2.html";
const concertCardUri = "ui://music-release-manager/concert-card-v2.html";
const pressPitchUri = "ui://music-release-manager/press-pitch-v2.html";
const contentSelectorUri = "ui://music-release-manager/content-selector-v2.html";
const operationsBoardUri = "ui://music-release-manager/operations-board-v2.html";
const audioAnalysisUri = "ui://music-release-manager/audio-analysis-v1.html";
const fundingWorkspaceUri = "ui://music-release-manager/funding-workspace-v1.html";
const releaseDashboardHtml = readFileSync(path.join(rootDir, "public", "widget.html"), "utf8");
const contentStudioHtml = readFileSync(path.join(rootDir, "public", "content-studio.html"), "utf8");
const campaignStudioHtml = readFileSync(path.join(rootDir, "public", "campaign-studio.html"), "utf8");
const artistOperationsHtml = readFileSync(path.join(rootDir, "public", "artist-operations.html"), "utf8");
const audioAnalysisHtml = readFileSync(path.join(rootDir, "public", "audio-analysis.html"), "utf8");
const fundingWorkspaceHtml = readFileSync(path.join(rootDir, "public", "funding-workspace.html"), "utf8");

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

const artistContentSchema = z.object({
  shortBio: z.string().max(2_000).optional(),
  longBio: z.string().max(6_000).optional(),
  releaseDescription: z.string().max(4_000).optional(),
  editorialPitch: z.string().max(3_000).optional(),
  pressRelease: z.string().max(8_000).optional(),
  pressEmailSubject: z.string().max(300).optional(),
  pressEmailBody: z.string().max(5_000).optional(),
  youtubeDescription: z.string().max(5_000).optional(),
});

const socialCaptionSchema = z.object({
  platform: z.string().max(80),
  content: z.string().max(2_000),
});

const shortVideoIdeaSchema = z.object({
  platform: z.string().max(80),
  concept: z.string().max(1_000),
  openingHook: z.string().max(500),
  shotList: z.array(z.string().max(500)).max(8),
  callToAction: z.string().max(500),
});

const imageConceptSchema = z.object({
  purpose: z.string().max(200),
  format: z.string().max(120),
  prompt: z.string().max(3_000),
  textOverlay: z.string().max(500).optional(),
  exclusions: z.array(z.string().max(300)).max(10),
});

const formFieldSchema = z.object({
  form: z.string().max(160),
  label: z.string().max(200),
  value: z.string().max(4_000),
});

const campaignPromotionTypeSchema = z.enum([
  "release",
  "concert",
  "tour",
  "music-video",
  "merchandise",
  "artist-awareness",
]);
const campaignObjectiveSchema = z.enum([
  "awareness",
  "pre-saves",
  "streams",
  "ticket-sales",
  "website-visits",
  "email-signups",
]);
const adCopySchema = z.object({
  label: z.string().max(120),
  headline: z.string().max(240),
  primaryText: z.string().max(2_000),
  callToAction: z.string().max(240),
});
const adCreativeBriefSchema = z.object({
  format: z.string().max(120),
  concept: z.string().max(1_000),
  prompt: z.string().max(3_000),
  textOverlay: z.string().max(500).optional(),
  exclusions: z.array(z.string().max(300)).max(10),
});
const campaignBudgetSchema = z.object({
  currency: z.string().min(3).max(12),
  total: z.number().nonnegative().max(100_000_000),
  period: z.string().max(160),
  allocationNote: z.string().max(1_000).optional(),
});
const campaignMeasurementSchema = z.object({
  primaryMetric: z.string().max(240),
  secondaryMetrics: z.array(z.string().max(240)).max(8),
  trackingNotes: z.string().max(2_000),
});

const releaseTrackSchema = z.object({
  title: z.string().min(1).max(160),
  artistCredit: z.string().max(180).optional(),
  duration: z.string().max(20).optional(),
  status: z.enum(["confirmed", "to-confirm"]).default("to-confirm"),
});

const releaseMetadataItemSchema = z.object({
  label: z.string().min(1).max(180),
  value: z.string().max(500).optional(),
  status: z.enum(["ready", "missing", "to-confirm"]),
});

const releaseTaskSchema = z.object({
  title: z.string().min(1).max(240),
  dueDate: z.string().max(40).optional(),
  owner: z.string().max(120).optional(),
  status: z.enum(["not-started", "in-progress", "done", "blocked"]),
});

const releaseMetricSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.number().nonnegative(),
  previousValue: z.number().nonnegative().optional(),
  source: z.string().max(160).optional(),
});

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
    { name: "music-release-manager", version: "1.8.0" },
    {
      instructions:
        "This server is exclusively for music—not software. It provides release planning, artist content, campaign briefs, audio-file analysis and a Norway funding catalog. For current funding discovery, use find_norway_funding_options with the artist's activity, applicant type and whether the activity is international. It returns possible opportunities from the catalog and the official Musikkontoret directory; eligibility, deadlines and terms remain unconfirmed until checked at the official funder page. Use create_funding_application_workspace after a possible opportunity is selected to organize an application checklist and editable draft fields. It does not submit an application. When an artist supplies audio and asks about metadata, mood or genre, use analyze_audio_file and present its creative suggestions as editable starting points. If the artist explicitly asks you to fill fields, use only the available in-app browser and the artist's current, intended page; fill only requested fields and do not submit. Sending, publishing, scheduling, submitting, activating ads, submitting applications, or spending money always requires separate explicit approval. Never ask for passwords or authentication codes.",
    }
  );

  const widgetMetadata = (description: string) => ({
    ui: {
      prefersBorder: true,
      domain: "https://release-manager-production-bb96.up.railway.app",
      csp: { connectDomains: [], resourceDomains: [] },
    },
    "openai/widgetDescription": description,
  });

  registerAppResource(server, "release-dashboard", releaseDashboardUri, {}, async () => ({
    contents: [
      {
        uri: releaseDashboardUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: releaseDashboardHtml,
        _meta: widgetMetadata("A release dashboard showing current phases, readiness gaps, next actions, or Norway-aware artist support."),
      },
    ],
  }));

  registerAppResource(server, "content-studio", contentStudioUri, {}, async () => ({
    contents: [
      {
        uri: contentStudioUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: contentStudioHtml,
        _meta: widgetMetadata("A copyable artist content workspace for release copy, social captions, video concepts, image briefs, and form-field drafts."),
      },
    ],
  }));

  registerAppResource(server, "campaign-studio", campaignStudioUri, {}, async () => ({
    contents: [
      {
        uri: campaignStudioUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: campaignStudioHtml,
        _meta: widgetMetadata("A campaign planning workspace with audience, budget, ad copy, creative briefs, measurement, and approval checks before any advertising action."),
      },
    ],
  }));

  const registerOperationsResource = (name: string, uri: string, description: string) =>
    registerAppResource(server, name, uri, {}, async () => ({
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: artistOperationsHtml,
          _meta: widgetMetadata(description),
        },
      ],
    }));

  registerOperationsResource(
    "release-card",
    releaseCardUri,
    "An artist and release summary card with confirmed details, release status, and clear information gaps."
  );
  registerOperationsResource(
    "metadata-checklist",
    metadataChecklistUri,
    "A tracklist and metadata checklist that keeps credits, rights, and delivery fields clearly separated."
  );
  registerOperationsResource(
    "concert-card",
    concertCardUri,
    "A concert planning card with supplied event details, promotion prompts, and confirmation gaps."
  );
  registerOperationsResource(
    "press-pitch",
    pressPitchUri,
    "A copyable press-pitch draft that is editable and never sends an email."
  );
  registerOperationsResource(
    "content-selector",
    contentSelectorUri,
    "A draft content-pack selector for choosing desired writing and creative outputs before generation."
  );
  registerOperationsResource(
    "operations-board",
    operationsBoardUri,
    "A release task and manually supplied performance snapshot workspace; it never creates tasks or retrieves analytics."
  );

  registerAppResource(server, "audio-analysis", audioAnalysisUri, {}, async () => ({
    contents: [
      {
        uri: audioAnalysisUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: audioAnalysisHtml,
        _meta: widgetMetadata("An audio-file analysis workspace for detected technical properties, embedded tags, loudness, an estimated tempo, and artist-confirmed creative metadata."),
      },
    ],
  }));

  registerAppResource(server, "funding-workspace", fundingWorkspaceUri, {}, async () => ({
    contents: [
      {
        uri: fundingWorkspaceUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: fundingWorkspaceHtml,
        _meta: widgetMetadata("A Norway funding matcher and application-preparation workspace that distinguishes curated matches from eligibility and deadline confirmation."),
      },
    ],
  }));

  const fundingActivitySchema = z.enum(fundingActivities);
  const fundingProgramSchema = z.object({
    id: z.string(), name: z.string(), funder: z.string(), officialUrl: z.string().url(), activities: z.array(fundingActivitySchema), applicantTypes: z.array(z.enum(["person", "organization", "either"])), scope: z.enum(["national", "international", "directory"]), summary: z.string(), eligibilityToVerify: z.array(z.string()), lastVerifiedAt: z.string(), lastSourceCheckAt: z.string().nullable(), sourceStatus: z.enum(["not-checked", "available", "needs-review"]), matchScore: z.number(), fitReasons: z.array(z.string()), status: z.literal("possible-eligibility-unconfirmed"),
  });
  const fundingDirectorySchema = z.object({ name: z.string(), url: z.string().url(), description: z.string(), lastVerifiedAt: z.string() });
  const fundingStepSchema = z.object({ title: z.string(), action: z.string(), evidence: z.string(), status: z.enum(["not-started", "to-confirm", "ready"]) });
  const fundingFormFieldSchema = z.object({ label: z.string(), value: z.string(), status: z.enum(["draft", "to-confirm"]) });

  const audioFileSchema = z.object({
    download_url: z.string().url().describe("Temporary secure download URL supplied by ChatGPT for the uploaded audio file."),
    file_id: z.string().min(1).max(500),
    mime_type: z.string().max(255).optional(),
    file_name: z.string().max(500).optional(),
  });
  const audioTagSchema = z.object({ label: z.string(), value: z.string() });
  const audioSuggestionSchema = z.object({ label: z.string(), value: z.string(), status: z.enum(["detected", "estimated", "to-confirm"]) });
  const audioAnalysisOutputSchema = z.object({
    kind: z.literal("audio-analysis"),
    artist: z.string().nullable(),
    trackTitle: z.string(),
    file: z.object({ name: z.string(), mimeType: z.string().nullable(), sizeBytes: z.number().nonnegative() }),
    technical: z.object({
      durationSeconds: z.number().nullable(), durationLabel: z.string().nullable(), container: z.string().nullable(), codec: z.string().nullable(), sampleRateHz: z.number().nullable(), bitDepth: z.number().nullable(), sampleFormat: z.string().nullable(), bitrateKbps: z.number().nullable(), channels: z.number().nullable(), channelLayout: z.string().nullable(), embeddedTags: z.array(audioTagSchema),
    }),
    analysis: z.object({
      tempoBpm: z.number().nullable(), tempoConfidence: z.enum(["not-available", "low", "medium", "high"]), energyLevel: z.enum(["not-available", "low", "moderate", "high"]), energyBasis: z.string(), integratedLufs: z.number().nullable(), loudnessRangeLu: z.number().nullable(), peakDbfs: z.number().nullable(), dynamics: z.enum(["not-available", "tight", "controlled", "dynamic"]), moodStatus: z.literal("artist-confirmation-needed"),
    }),
    creativeSuggestions: z.object({ genres: z.array(z.string()), genreConfidence: z.enum(["detected", "low"]), moods: z.array(z.string()), moodConfidence: z.literal("low"), basis: z.string() }),
    metadataSuggestions: z.array(audioSuggestionSchema), limitations: z.array(z.string()), confirmBeforeUse: z.array(z.string()), privacyNote: z.string(), safetyNote: z.string(),
  });

  registerAppTool(
    server,
    "analyze_audio_file",
    {
      title: "Analyze a music audio file",
      description:
        "Use when an artist uploads a music audio file and asks for technical metadata, mood, or genre help. It reads the supplied file for duration, codec, sample rate, channels, bitrate, embedded tags, loudness and dynamics; makes a clearly labelled tempo estimate; and proposes broad mood and genre starting points for an artist to confirm and use in metadata drafts. Credits, rights, identifiers and release details remain artist-confirmed fields. The audio is not edited, retained, submitted or published.",
      inputSchema: {
        audioFile: audioFileSchema.describe("The uploaded music audio file. Accept only a file supplied by ChatGPT."),
        artist: z.string().max(120).optional().describe("Artist name when supplied by the artist."),
        trackTitle: z.string().max(160).optional().describe("Track title when supplied by the artist. Otherwise, detected tags or file name are shown."),
      },
      outputSchema: audioAnalysisOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: {
        ui: { resourceUri: audioAnalysisUri },
        "openai/fileParams": ["audioFile"],
        "openai/toolInvocation/invoking": "Analyzing audio file",
        "openai/toolInvocation/invoked": "Audio analysis ready",
      },
    },
    async ({ audioFile, artist, trackTitle }) => {
      const structuredContent = await analyzeAudioFile(audioFile, artist, trackTitle);
      return {
        content: [{ type: "text" as const, text: `Analyzed ${structuredContent.file.name}. Review estimates and artist-confirmed fields before reuse.` }],
        structuredContent,
        _meta: { "openai/outputTemplate": audioAnalysisUri },
      };
    }
  );

  registerAppTool(
    server,
    "find_norway_funding_options",
    {
      title: "Find Norway funding options",
      description:
        "Use when an artist or music team in Norway wants possible funding options for recording, release marketing, live/tour activity, export, career development, equipment/studio or composition. It matches a curated catalog and returns official links, what must be verified, and the Musikkontoret directory. It does not claim that a deadline, eligibility or funding availability is current.",
      inputSchema: {
        artistName: z.string().min(1).max(120),
        activities: z.array(fundingActivitySchema).min(1).max(4),
        applicantType: z.enum(["person", "organization"]),
        internationalActivity: z.boolean(),
        region: z.string().max(120).optional(),
        projectTitle: z.string().max(160).optional(),
      },
      outputSchema: z.object({
        kind: z.literal("funding-match"), artistName: z.string(), projectTitle: z.string().nullable(), profileSummary: z.string(), opportunities: z.array(fundingProgramSchema), directory: fundingDirectorySchema, nextActions: z.array(z.string()), currentInfoNote: z.string(), safetyNote: z.string(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: fundingWorkspaceUri }, "openai/toolInvocation/invoking": "Matching funding options", "openai/toolInvocation/invoked": "Funding options ready" },
    },
    async ({ artistName, activities, applicantType, internationalActivity, region, projectTitle }) => {
      const opportunities = await matchFundingPrograms({ activities, applicantType, internationalActivity, region });
      const profileSummary = [applicantType === "organization" ? "Organization applicant" : "Individual applicant", activities.join(", "), internationalActivity ? "international activity" : "Norway-based activity"].join(" · ");
      const nextActions = opportunities.length
        ? ["Open the official page for the highest-ranked possible option and confirm the current deadline.", "Check applicant type, activity, eligible costs and required documents before writing the application.", "Create an application workspace only after choosing an opportunity to pursue."]
        : ["Use Musikkontoret's directory to widen the search by region and activity.", "Confirm whether the activity is international, local or regional, then run the match again.", "Gather a short project description, period and draft budget before evaluating eligibility."];
      const structuredContent = {
        kind: "funding-match" as const,
        artistName,
        projectTitle: projectTitle ?? null,
        profileSummary,
        opportunities,
        directory: fundingDirectory,
        nextActions,
        currentInfoNote: "These are curated possible matches, not confirmed eligibility. Current deadlines, rules, amounts and supported costs must be checked on the official funder page before an artist commits effort or money.",
        safetyNote: "This is discovery and preparation only. It does not submit an application, save artist data, promise funding or verify a current deadline.",
      };
      return { content: [{ type: "text" as const, text: opportunities.length ? `Found ${opportunities.length} possible funding options for ${artistName}. Verify the official source before treating any as eligible.` : `No curated option matched this profile yet. Use the official directory to widen the search.` }], structuredContent, _meta: { "openai/outputTemplate": fundingWorkspaceUri } };
    }
  );

  registerAppTool(
    server,
    "create_funding_application_workspace",
    {
      title: "Create funding application workspace",
      description:
        "Use after an artist selects a possible funding opportunity and wants a practical, editable application-preparation checklist. It organizes only the supplied project facts, identifies verification gaps and prepares draft field values. It does not save data, open a funder's site, submit an application or make an eligibility decision.",
      inputSchema: {
        opportunityId: z.string().min(1).max(160),
        artistName: z.string().min(1).max(120),
        projectTitle: z.string().min(1).max(160),
        projectSummary: z.string().min(1).max(3_000),
        activityPeriod: z.string().max(160).optional(),
        knownDocuments: z.array(z.string().max(240)).max(16).default([]),
      },
      outputSchema: z.object({
        kind: z.literal("funding-application-workspace"), artistName: z.string(), projectTitle: z.string(), projectSummary: z.string(), activityPeriod: z.string().nullable(), opportunity: z.object({ id: z.string(), name: z.string(), funder: z.string(), officialUrl: z.string().url(), summary: z.string(), lastVerifiedAt: z.string(), sourceStatus: z.enum(["not-checked", "available", "needs-review"]) }), applicationSteps: z.array(fundingStepSchema), formFields: z.array(fundingFormFieldSchema), requiredDocuments: z.array(z.string()), eligibilityToVerify: z.array(z.string()), knownDocuments: z.array(z.string()), currentInfoNote: z.string(), safetyNote: z.string(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: fundingWorkspaceUri }, "openai/toolInvocation/invoking": "Preparing funding workspace", "openai/toolInvocation/invoked": "Funding workspace ready" },
    },
    async ({ opportunityId, artistName, projectTitle, projectSummary, activityPeriod, knownDocuments }) => {
      const opportunity = (await getFundingPrograms()).find((program) => program.id === opportunityId);
      if (!opportunity) throw new Error("The selected funding opportunity was not found in the current catalog.");
      const applicationSteps = [
        { title: "Verify the current call", action: "Open the official source and confirm that the call, deadline and activity are current before preparing an application.", evidence: "Official page URL, checked date and saved eligibility notes.", status: "to-confirm" as const },
        { title: "Check eligibility", action: "Compare artist or organization status, project timing, geography and costs with the funder's current requirements.", evidence: "A written yes/no note for every listed eligibility condition.", status: "to-confirm" as const },
        { title: "Define the project", action: "Keep the project purpose, audience, activity plan and desired result consistent with the submitted budget and timeline.", evidence: "Artist-approved project description and dated activity plan.", status: "not-started" as const },
        { title: "Prepare budget and financing", action: "List costs, funding sources and any own contribution. Label estimates, offers and confirmed amounts separately.", evidence: "Line-item budget, financing plan and relevant quotes.", status: "not-started" as const },
        { title: "Review before submission", action: "Confirm claims, rights, attachments, bank/account requirements and reporting obligations with the artist and official source.", evidence: "Final review checklist completed by the applicant.", status: "not-started" as const },
      ];
      const formFields = [
        { label: "Project title", value: projectTitle, status: "draft" as const },
        { label: "Applicant / artist", value: artistName, status: "draft" as const },
        { label: "Project description", value: projectSummary, status: "draft" as const },
        { label: "Activity period", value: activityPeriod ?? "To confirm", status: activityPeriod ? "draft" as const : "to-confirm" as const },
      ];
      const requiredDocuments = ["Project description", "Dated activity plan", "Line-item budget and financing plan", "Current official eligibility notes", "Required quotes, invitations, agreements or confirmations listed by the funder"];
      const structuredContent = {
        kind: "funding-application-workspace" as const,
        artistName,
        projectTitle,
        projectSummary,
        activityPeriod: activityPeriod ?? null,
        opportunity: { id: opportunity.id, name: opportunity.name, funder: opportunity.funder, officialUrl: opportunity.officialUrl, summary: opportunity.summary, lastVerifiedAt: opportunity.lastVerifiedAt, sourceStatus: opportunity.sourceStatus },
        applicationSteps,
        formFields,
        requiredDocuments,
        eligibilityToVerify: opportunity.eligibilityToVerify,
        knownDocuments,
        currentInfoNote: "This workspace is a preparation draft. Confirm the current funder page, deadline, eligibility, required attachments and reporting terms before completing or submitting any form.",
        safetyNote: "Nothing has been saved, submitted, sent or promised. The artist or applicant must review every claim and approve submission separately.",
      };
      return { content: [{ type: "text" as const, text: `Prepared an application workspace for ${opportunity.name}. No application has been opened or submitted.` }], structuredContent, _meta: { "openai/outputTemplate": fundingWorkspaceUri } };
    }
  );

  registerAppTool(
    server,
    "create_release_card",
    {
      title: "Create artist release card",
      description:
        "Use when an artist wants a compact visual summary of a release. Show only supplied artist, release, artwork, status, and milestone details. List unknown details for confirmation. This tool does not access profiles, create artwork, save data, submit a release, or publish anything.",
      inputSchema: {
        artist: z.string().min(1).max(120),
        releaseTitle: z.string().min(1).max(160),
        releaseType: releaseTypeSchema,
        releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        genre: z.string().max(120).optional(),
        releaseStatus: z.enum(["planning", "in-production", "submitted", "scheduled", "released"]),
        milestones: z.array(releaseMetadataItemSchema).max(12).default([]),
        confirmBeforeUse: z.array(z.string().max(500)).max(12).default([]),
      },
      outputSchema: {
        kind: z.literal("release-card"), artist: z.string(), releaseTitle: z.string(), releaseType: z.string(), releaseDate: z.string().nullable(), genre: z.string().nullable(), releaseStatus: z.string(), milestones: z.array(releaseMetadataItemSchema), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: releaseCardUri }, "openai/toolInvocation/invoking": "Building release card", "openai/toolInvocation/invoked": "Release card ready" },
    },
    async ({ artist, releaseTitle, releaseType, releaseDate, genre, releaseStatus, milestones, confirmBeforeUse }) => {
      const structuredContent = { kind: "release-card" as const, artist, releaseTitle, releaseType, releaseDate: releaseDate ?? null, genre: genre ?? null, releaseStatus, milestones, confirmBeforeUse, safetyNote: "This is a supplied-details summary only. It does not verify status, access accounts, submit a release, or publish anything." };
      return { content: [{ type: "text" as const, text: `Prepared a release card for ${artist} - ${releaseTitle}.` }], structuredContent, _meta: { "openai/outputTemplate": releaseCardUri } };
    }
  );

  registerAppTool(
    server,
    "create_tracklist_metadata_checklist",
    {
      title: "Create tracklist and metadata checklist",
      description:
        "Use when an artist needs a clear release tracklist, credit, rights, and delivery checklist. Only organize supplied information; mark missing or unconfirmed information clearly. This tool does not register works, submit metadata, contact a distributor, or modify any external system.",
      inputSchema: {
        artist: z.string().min(1).max(120), releaseTitle: z.string().min(1).max(160), releaseType: releaseTypeSchema,
        tracks: z.array(releaseTrackSchema).min(1).max(40), metadata: z.array(releaseMetadataItemSchema).max(30).default([]), rights: z.array(releaseMetadataItemSchema).max(30).default([]), delivery: z.array(releaseMetadataItemSchema).max(30).default([]), confirmBeforeUse: z.array(z.string().max(500)).max(16).default([]),
      },
      outputSchema: {
        kind: z.literal("metadata-checklist"), artist: z.string(), releaseTitle: z.string(), releaseType: z.string(), tracks: z.array(releaseTrackSchema), metadata: z.array(releaseMetadataItemSchema), rights: z.array(releaseMetadataItemSchema), delivery: z.array(releaseMetadataItemSchema), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: metadataChecklistUri }, "openai/toolInvocation/invoking": "Organizing metadata checklist", "openai/toolInvocation/invoked": "Metadata checklist ready" },
    },
    async ({ artist, releaseTitle, releaseType, tracks, metadata, rights, delivery, confirmBeforeUse }) => {
      const structuredContent = { kind: "metadata-checklist" as const, artist, releaseTitle, releaseType, tracks, metadata, rights, delivery, confirmBeforeUse, safetyNote: "This checklist organizes supplied details only. Verify credits, rights, identifiers, contracts, and distributor requirements before registration or delivery." };
      return { content: [{ type: "text" as const, text: `Prepared a tracklist and metadata checklist for ${artist} - ${releaseTitle}.` }], structuredContent, _meta: { "openai/outputTemplate": metadataChecklistUri } };
    }
  );

  registerAppTool(
    server,
    "create_concert_card",
    {
      title: "Create concert promotion card",
      description:
        "Use when an artist wants a concise, visual concert or live-event plan. It organizes only supplied venue, date, ticket, lineup, and promotion details. It does not confirm bookings, issue tickets, message venues, publish event listings, or spend money.",
      inputSchema: {
        artist: z.string().min(1).max(120), eventTitle: z.string().min(1).max(160), venue: z.string().max(160).optional(), city: z.string().max(120).optional(), eventDate: z.string().max(80).optional(), doorsTime: z.string().max(40).optional(), ticketUrl: z.string().url().optional(), ticketStatus: z.enum(["available", "coming-soon", "to-confirm"]).default("to-confirm"), supportActs: z.array(z.string().max(120)).max(10).default([]), promotionActions: z.array(z.string().max(500)).max(12).default([]), confirmBeforeUse: z.array(z.string().max(500)).max(12).default([]),
      },
      outputSchema: {
        kind: z.literal("concert-card"), artist: z.string(), eventTitle: z.string(), venue: z.string().nullable(), city: z.string().nullable(), eventDate: z.string().nullable(), doorsTime: z.string().nullable(), ticketUrl: z.string().nullable(), ticketStatus: z.string(), supportActs: z.array(z.string()), promotionActions: z.array(z.string()), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: concertCardUri }, "openai/toolInvocation/invoking": "Building concert card", "openai/toolInvocation/invoked": "Concert card ready" },
    },
    async ({ artist, eventTitle, venue, city, eventDate, doorsTime, ticketUrl, ticketStatus, supportActs, promotionActions, confirmBeforeUse }) => {
      const structuredContent = { kind: "concert-card" as const, artist, eventTitle, venue: venue ?? null, city: city ?? null, eventDate: eventDate ?? null, doorsTime: doorsTime ?? null, ticketUrl: ticketUrl ?? null, ticketStatus, supportActs, promotionActions, confirmBeforeUse, safetyNote: "This is a planning card based on supplied details. Verify booking, venue, schedule, ticket, lineup, rights, and event-listing information before sharing or publishing." };
      return { content: [{ type: "text" as const, text: `Prepared a concert card for ${artist} - ${eventTitle}.` }], structuredContent, _meta: { "openai/outputTemplate": concertCardUri } };
    }
  );

  registerAppTool(
    server,
    "create_press_pitch_draft",
    {
      title: "Create press pitch draft",
      description:
        "Use when an artist asks for a press, radio, blog, or curator email draft. It creates editable copy from supplied facts only. This tool never looks up contacts, sends messages, saves an email, or submits a pitch.",
      inputSchema: {
        artist: z.string().min(1).max(120), releaseTitle: z.string().max(160).optional(), recipientType: z.enum(["press", "radio", "blog", "playlist-curator", "partner", "other"]), language: z.string().min(1).max(80), recipientName: z.string().max(160).optional(), subject: z.string().min(1).max(300), body: z.string().min(1).max(6_000), suggestedFollowUp: z.string().max(1_000).optional(), confirmBeforeUse: z.array(z.string().max(500)).max(12).default([]),
      },
      outputSchema: {
        kind: z.literal("press-pitch"), artist: z.string(), releaseTitle: z.string().nullable(), recipientType: z.string(), language: z.string(), recipientName: z.string().nullable(), subject: z.string(), body: z.string(), suggestedFollowUp: z.string().nullable(), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: pressPitchUri }, "openai/toolInvocation/invoking": "Drafting press pitch", "openai/toolInvocation/invoked": "Press pitch draft ready" },
    },
    async ({ artist, releaseTitle, recipientType, language, recipientName, subject, body, suggestedFollowUp, confirmBeforeUse }) => {
      const structuredContent = { kind: "press-pitch" as const, artist, releaseTitle: releaseTitle ?? null, recipientType, language, recipientName: recipientName ?? null, subject, body, suggestedFollowUp: suggestedFollowUp ?? null, confirmBeforeUse, safetyNote: "This is an editable draft only. Confirm the recipient, factual claims, rights, attachments, links, and permission before copying it into an email client. No email has been sent." };
      return { content: [{ type: "text" as const, text: `Prepared an editable ${recipientType} pitch draft for ${artist}. No email was sent.` }], structuredContent, _meta: { "openai/outputTemplate": pressPitchUri } };
    }
  );

  registerAppTool(
    server,
    "create_content_pack_selection",
    {
      title: "Create content pack selection",
      description:
        "Use when an artist wants to choose which release-content drafts to create next. It creates a draft selection list only; it does not generate files, charge money, place an order, or save the selection.",
      inputSchema: {
        artist: z.string().min(1).max(120), releaseTitle: z.string().max(160).optional(), language: z.string().min(1).max(80), selectedItems: z.array(z.enum(["short-bio", "long-bio", "release-description", "editorial-pitch", "press-release", "press-email", "social-captions", "short-video-ideas", "image-briefs", "youtube-description"])).min(1).max(10), notes: z.string().max(2_000).optional(), confirmBeforeUse: z.array(z.string().max(500)).max(12).default([]),
      },
      outputSchema: {
        kind: z.literal("content-selector"), artist: z.string(), releaseTitle: z.string().nullable(), language: z.string(), selectedItems: z.array(z.string()), notes: z.string().nullable(), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: contentSelectorUri }, "openai/toolInvocation/invoking": "Preparing content selection", "openai/toolInvocation/invoked": "Content selection ready" },
    },
    async ({ artist, releaseTitle, language, selectedItems, notes, confirmBeforeUse }) => {
      const structuredContent = { kind: "content-selector" as const, artist, releaseTitle: releaseTitle ?? null, language, selectedItems, notes: notes ?? null, confirmBeforeUse, safetyNote: "This is a draft selection only. It does not create assets, buy anything, save the selection, or publish content." };
      return { content: [{ type: "text" as const, text: `Prepared a content-pack selection for ${artist} with ${selectedItems.length} requested draft types.` }], structuredContent, _meta: { "openai/outputTemplate": contentSelectorUri } };
    }
  );

  registerAppTool(
    server,
    "create_release_operations_snapshot",
    {
      title: "Create release operations snapshot",
      description:
        "Use when an artist wants a visual task board and/or a simple performance snapshot from numbers they supply. It never creates or stores tasks, retrieves analytics, accesses artist accounts, or claims that supplied metrics are verified.",
      inputSchema: {
        artist: z.string().min(1).max(120), releaseTitle: z.string().max(160).optional(), tasks: z.array(releaseTaskSchema).max(40).default([]), metrics: z.array(releaseMetricSchema).max(12).default([]), reportingPeriod: z.string().max(160).optional(), confirmBeforeUse: z.array(z.string().max(500)).max(16).default([]),
      },
      outputSchema: {
        kind: z.literal("operations-snapshot"), artist: z.string(), releaseTitle: z.string().nullable(), tasks: z.array(releaseTaskSchema), metrics: z.array(releaseMetricSchema), reportingPeriod: z.string().nullable(), confirmBeforeUse: z.array(z.string()), safetyNote: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: operationsBoardUri }, "openai/toolInvocation/invoking": "Building operations snapshot", "openai/toolInvocation/invoked": "Operations snapshot ready" },
    },
    async ({ artist, releaseTitle, tasks, metrics, reportingPeriod, confirmBeforeUse }) => {
      const structuredContent = { kind: "operations-snapshot" as const, artist, releaseTitle: releaseTitle ?? null, tasks, metrics, reportingPeriod: reportingPeriod ?? null, confirmBeforeUse, safetyNote: "Tasks and metrics are a supplied-data snapshot only. Nothing was saved, assigned, retrieved from an account, or independently verified." };
      return { content: [{ type: "text" as const, text: `Prepared an operations snapshot for ${artist} with ${tasks.length} tasks and ${metrics.length} supplied metrics.` }], structuredContent, _meta: { "openai/outputTemplate": operationsBoardUri } };
    }
  );

  registerAppTool(
    server,
    "create_artist_content_pack",
    {
      title: "Create artist content pack",
      description:
        "Use after drafting music-related copy or promotional assets at the artist's request. Packages only the model-written drafts into clearly labeled, copyable deliverables, including release/profile copy, social captions, short-video concepts, image prompts, and website/form field values. Use confirmed facts only and put unknowns in confirmBeforeUse. This tool does not generate image files, browse, fill external forms, save data, or publish, send, submit, schedule, or spend.",
      inputSchema: {
        artist: z.string().min(1).max(120).describe("Artist or project name."),
        releaseTitle: z.string().min(1).max(160).optional().describe("Optional release or campaign title."),
        releaseDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Confirmed release date, if known."),
        language: z.string().min(1).max(80).describe("Language used for the requested deliverables."),
        content: artistContentSchema.describe("Only include the requested copy fields."),
        socialCaptions: z.array(socialCaptionSchema).max(12).default([]),
        shortVideoIdeas: z.array(shortVideoIdeaSchema).max(8).default([]),
        imageConcepts: z.array(imageConceptSchema).max(8).default([]),
        formFields: z.array(formFieldSchema).max(30).default([]),
        confirmBeforeUse: z
          .array(z.string().max(500))
          .max(20)
          .default([])
          .describe("Unverified facts, placeholders, permissions, or platform requirements the artist should check."),
      },
      outputSchema: {
        kind: z.literal("artist-content-pack"),
        artist: z.string(),
        releaseTitle: z.string().nullable(),
        releaseDate: z.string().nullable(),
        language: z.string(),
        content: artistContentSchema,
        socialCaptions: z.array(socialCaptionSchema),
        shortVideoIdeas: z.array(shortVideoIdeaSchema),
        imageConcepts: z.array(imageConceptSchema),
        formFields: z.array(formFieldSchema),
        confirmBeforeUse: z.array(z.string()),
        safetyNote: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: contentStudioUri },
        "openai/toolInvocation/invoking": "Preparing artist content pack",
        "openai/toolInvocation/invoked": "Artist content pack ready",
      },
    },
    async ({ artist, releaseTitle, releaseDate, language, content, socialCaptions, shortVideoIdeas, imageConcepts, formFields, confirmBeforeUse }) => {
      const structuredContent = {
        kind: "artist-content-pack" as const,
        artist,
        releaseTitle: releaseTitle ?? null,
        releaseDate: releaseDate ?? null,
        language,
        content,
        socialCaptions,
        shortVideoIdeas,
        imageConcepts,
        formFields,
        confirmBeforeUse,
        safetyNote: /norwegian|norsk|bokm[aå]l|nynorsk/i.test(language)
          ? "Utkastene bygger bare på opplysningene i samtalen. Kontroller fakta, rettigheter, krediteringer, lenker, plattformkrav og bilderettigheter før bruk. Ingen eksterne skjemaer er fylt ut eller sendt inn."
          : "Drafts are based only on the supplied conversation context. Review factual claims, rights, credits, links, platform limits, and image permissions before use. No external form has been filled or submitted.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Prepared a ${language} artist content pack for ${artist}${releaseTitle ? ` — ${releaseTitle}` : ""}. It contains ${socialCaptions.length} social captions, ${shortVideoIdeas.length} short-video ideas, ${imageConcepts.length} image concepts, and ${formFields.length} form-field drafts.`,
          },
        ],
        structuredContent,
        _meta: { "openai/outputTemplate": contentStudioUri },
      };
    }
  );

  registerAppTool(
    server,
    "create_music_ad_campaign_brief",
    {
      title: "Create music ad campaign brief",
      description:
        "Use after drafting a music campaign plan for a release, concert, tour, video, merchandise, or artist awareness. Packages only the model-written campaign brief into copyable audience, budget, ad-copy, creative, measurement, and approval fields. Use confirmed facts only and list unknowns in platformSettingsToVerify or approvalChecklist. This tool does not access Ads Manager or other ad accounts, browse, verify live ad rules or pricing, add payment details, buy ads, launch campaigns, or collect performance data.",
      inputSchema: {
        artist: z.string().min(1).max(120).describe("Artist or project name."),
        campaignName: z.string().min(1).max(160).optional().describe("Optional campaign name."),
        platform: z.literal("chatgpt-ads").describe("The intended advertising workspace."),
        promotionType: campaignPromotionTypeSchema.describe("What the campaign promotes."),
        objective: campaignObjectiveSchema.describe("The artist's intended campaign objective."),
        language: z.string().min(1).max(80).describe("Language used for the campaign brief."),
        markets: z.array(z.string().min(1).max(120)).max(20).default([]).describe("Countries, regions, or cities the artist wants to consider."),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Planned start date, if confirmed."),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Planned end date, if confirmed."),
        landingPage: z.string().max(2_000).optional().describe("Confirmed destination URL or page description, if available."),
        audience: z.string().max(2_000).optional().describe("Artist-approved audience summary; do not infer protected traits."),
        budget: campaignBudgetSchema.optional().describe("Planning budget only; it is not a purchase instruction."),
        adCopy: z.array(adCopySchema).max(8).default([]).describe("Only the model-written ad-copy variants requested by the artist."),
        creativeBriefs: z.array(adCreativeBriefSchema).max(8).default([]).describe("Creative briefs or prompts, not generated ad images or video files."),
        formFields: z.array(formFieldSchema).max(30).default([]).describe("Proposed field values for a later, artist-reviewed ad form."),
        measurement: campaignMeasurementSchema.optional().describe("Planning metrics and tracking notes; no live analytics are retrieved."),
        platformSettingsToVerify: z.array(z.string().max(500)).max(20).default([]).describe("Live availability, format, policy, pricing, audience, or measurement settings the artist must verify in Ads Manager."),
        approvalChecklist: z.array(z.string().max(500)).max(20).default([]).describe("Facts, rights, budget, payment, landing page, and launch approvals required before any external action."),
      },
      outputSchema: {
        kind: z.literal("ad-campaign-brief"),
        artist: z.string(),
        campaignName: z.string().nullable(),
        platform: z.literal("chatgpt-ads"),
        promotionType: campaignPromotionTypeSchema,
        objective: campaignObjectiveSchema,
        language: z.string(),
        markets: z.array(z.string()),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        landingPage: z.string().nullable(),
        audience: z.string().nullable(),
        budget: campaignBudgetSchema.nullable(),
        adCopy: z.array(adCopySchema),
        creativeBriefs: z.array(adCreativeBriefSchema),
        formFields: z.array(formFieldSchema),
        measurement: campaignMeasurementSchema.nullable(),
        platformSettingsToVerify: z.array(z.string()),
        approvalChecklist: z.array(z.string()),
        safetyNote: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: campaignStudioUri },
        "openai/toolInvocation/invoking": "Preparing music ad campaign brief",
        "openai/toolInvocation/invoked": "Music ad campaign brief ready",
      },
    },
    async ({ artist, campaignName, platform, promotionType, objective, language, markets, startDate, endDate, landingPage, audience, budget, adCopy, creativeBriefs, formFields, measurement, platformSettingsToVerify, approvalChecklist }) => {
      const norwegian = /norwegian|norsk|bokm[aå]l|nynorsk/i.test(language);
      const structuredContent = {
        kind: "ad-campaign-brief" as const,
        artist,
        campaignName: campaignName ?? null,
        platform,
        promotionType,
        objective,
        language,
        markets,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        landingPage: landingPage ?? null,
        audience: audience ?? null,
        budget: budget ?? null,
        adCopy,
        creativeBriefs,
        formFields,
        measurement: measurement ?? null,
        platformSettingsToVerify,
        approvalChecklist,
        safetyNote: norwegian
          ? "Dette er kun et kampanjeutkast. Kontroller tilgjengelighet, annonseformat, målretting, kostnad, betalingskrav, destinasjon, rettigheter og gjeldende Ads Manager-regler før du bruker det. Ingen annonsekonto er åpnet, ingen betaling er lagt til, og ingen kampanje er kjøpt eller aktivert."
          : "This is a planning brief only. Verify availability, ad format, targeting, cost, payment requirements, destination, rights, and current Ads Manager rules before use. No ad account was accessed, no payment was added, and no campaign was purchased or launched.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Prepared a ${language} ${platform} campaign brief for ${artist}${campaignName ? ` — ${campaignName}` : ""}. It contains ${adCopy.length} ad-copy variants, ${creativeBriefs.length} creative briefs, and ${approvalChecklist.length} approval checks. No ad account was accessed and no campaign was launched.`,
          },
        ],
        structuredContent,
        _meta: { "openai/outputTemplate": campaignStudioUri },
      };
    }
  );

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
        ui: { resourceUri: releaseDashboardUri },
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
        _meta: { "openai/outputTemplate": releaseDashboardUri },
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
        ui: { resourceUri: releaseDashboardUri },
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
        _meta: { "openai/outputTemplate": releaseDashboardUri },
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
        _meta: { "openai/outputTemplate": releaseDashboardUri },
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

  if (req.method === "GET" && url.pathname === "/next-widgets-preview") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "operations-preview.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/next-widgets-preview/artist-operations.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "artist-operations.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/audio-analysis-preview") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "audio-analysis-preview.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/audio-analysis-preview/audio-analysis.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "audio-analysis.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/funding-preview") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "funding-preview.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/funding-preview/funding-workspace.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(path.join(rootDir, "public", "funding-workspace.html"), "utf8"));
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/demo") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : readFileSync(path.join(rootDir, "public", "demo.html"), "utf8"));
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/demo/music-release-manager.mp4") {
    res.writeHead(200, { "content-type": "video/mp4", "cache-control": "public, max-age=86400" });
    res.end(req.method === "HEAD" ? undefined : readFileSync(path.join(rootDir, "public", "music-release-manager-demo.mp4")));
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/demo/music-release-manager-poster.jpg") {
    res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" });
    res.end(req.method === "HEAD" ? undefined : readFileSync(path.join(rootDir, "public", "music-release-manager-demo-poster.jpg")));
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
