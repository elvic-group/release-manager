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
const widgetUri = "ui://music-release-manager/release-plan-v2.html";
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
    { name: "music-release-manager", version: "1.3.0" },
    {
      instructions:
        "This server is exclusively for music—not software. It provides music-release planning, readiness checks, Norway-aware artist support, an Artist Content Studio, and ChatGPT Ads campaign briefs. When an artist asks for release copy, promotional assets, or an ad plan, use the conversation and user-provided files as source material, do not invent biographical, release, performance, rights, pricing, or platform facts, and write requested drafts in the artist's language. Use create_artist_content_pack for copyable release assets and create_music_ad_campaign_brief for copyable campaign planning. Put unknowns in the relevant confirmation list. The ad brief does not access Ads Manager, verify availability or policy, buy advertising, add payment, launch a campaign, or collect performance data. If the artist explicitly asks you to fill fields, use only the available in-app browser and the artist's current, intended page; fill only requested fields and do not submit. Sending, publishing, scheduling, submitting, activating ads, or spending money always requires separate explicit approval. Never ask for passwords or authentication codes. Verify current funding deadlines, eligibility, ad availability, costs, formats, targeting, and platform rules with the official source before acting.",
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
            "A compact music workspace showing release phases, readiness gaps, Norway-aware artist support, copyable release content, or a copyable campaign brief that requires approval before ad spend or launch.",
        },
      },
    ],
  }));

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
        ui: { resourceUri: widgetUri },
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
        _meta: { "openai/outputTemplate": widgetUri },
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
        ui: { resourceUri: widgetUri },
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
        _meta: { "openai/outputTemplate": widgetUri },
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
