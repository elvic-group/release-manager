import postgres, { type Sql } from "postgres";

export const fundingActivities = [
  "recording",
  "release-marketing",
  "live-tour",
  "export",
  "career-development",
  "equipment-studio",
  "composition",
] as const;

export type FundingActivity = (typeof fundingActivities)[number];
export type ApplicantType = "person" | "organization" | "either";

export type FundingProgram = {
  id: string;
  name: string;
  funder: string;
  officialUrl: string;
  activities: FundingActivity[];
  applicantTypes: ApplicantType[];
  scope: "national" | "international" | "directory";
  summary: string;
  eligibilityToVerify: string[];
  lastVerifiedAt: string;
  lastSourceCheckAt: string | null;
  sourceStatus: "not-checked" | "available" | "needs-review";
};

export type FundingMatchInput = {
  activities: FundingActivity[];
  applicantType: "person" | "organization";
  internationalActivity: boolean;
  region?: string;
};

export type FundingMatch = FundingProgram & {
  matchScore: number;
  fitReasons: string[];
  status: "possible-eligibility-unconfirmed" | "not-currently-matched";
};

const today = "2026-09-19";

const seedCatalog: FundingProgram[] = [
  {
    id: "music-norway-travel-support",
    name: "Reisetilskudd",
    funder: "Music Norway",
    officialUrl: "https://musicnorway.no/tilskudd/reisetilskudd",
    activities: ["live-tour", "export", "composition"],
    applicantTypes: ["person", "organization"],
    scope: "international",
    summary: "For eligible international travel connected to concerts, touring, songwriting or composition.",
    eligibilityToVerify: ["Professional status and connection to the international activity.", "Travel purpose, location, timing, costs and current deadline."],
    lastVerifiedAt: today,
    lastSourceCheckAt: null,
    sourceStatus: "not-checked",
  },
  {
    id: "music-norway-marketing-support",
    name: "Markedsføringstilskudd",
    funder: "Music Norway",
    officialUrl: "https://musicnorway.no/tilskudd/markedsf%C3%B8ringstilskudd-2",
    activities: ["release-marketing", "export"],
    applicantTypes: ["person", "organization"],
    scope: "international",
    summary: "For eligible international marketing activity for Norwegian music.",
    eligibilityToVerify: ["Professional status and international market plan.", "Eligible marketing costs, timing, co-financing and current deadline."],
    lastVerifiedAt: today,
    lastSourceCheckAt: null,
    sourceStatus: "not-checked",
  },
  {
    id: "music-norway-organizer-support",
    name: "Arrangørtilskudd",
    funder: "Music Norway",
    officialUrl: "https://musicnorway.no/tilskudd/arrang%C3%B8rtilskudd",
    activities: ["export", "career-development"],
    applicantTypes: ["organization"],
    scope: "international",
    summary: "For eligible international participation at relevant music-industry events in Norway.",
    eligibilityToVerify: ["Applicant organization and the event's international relevance.", "Current requirements, costs and application window."],
    lastVerifiedAt: today,
    lastSourceCheckAt: null,
    sourceStatus: "not-checked",
  },
  {
    id: "music-norway-meeting-support",
    name: "Møtevirksomhet",
    funder: "Music Norway",
    officialUrl: "https://musicnorway.no/tilskudd/motevirksomhet",
    activities: ["export", "career-development"],
    applicantTypes: ["person", "organization"],
    scope: "international",
    summary: "For eligible international meetings and industry activity that can lead to new work, agreements or long-term growth.",
    eligibilityToVerify: ["Professional status, concrete meeting plan and international relevance.", "Current eligible costs, documentation and deadline."],
    lastVerifiedAt: today,
    lastSourceCheckAt: null,
    sourceStatus: "not-checked",
  },
];

export const fundingDirectory = {
  name: "Musikkontoret tilskuddsoversikt",
  url: "https://www.musikkontoret.no/tilskuddsordninger",
  description: "Use this official-sector directory to discover national, regional and municipal opportunities, then verify the selected fund directly with the funder.",
  lastVerifiedAt: today,
};

let sql: Sql | null = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 2, idle_timeout: 20, connect_timeout: 10 }) : null;

function normalizeProgram(row: Record<string, unknown>): FundingProgram {
  return {
    id: String(row.id), name: String(row.name), funder: String(row.funder), officialUrl: String(row.official_url),
    activities: Array.isArray(row.activities) ? row.activities as FundingActivity[] : [],
    applicantTypes: Array.isArray(row.applicant_types) ? row.applicant_types as ApplicantType[] : [],
    scope: row.scope === "international" || row.scope === "directory" ? row.scope : "national",
    summary: String(row.summary), eligibilityToVerify: Array.isArray(row.eligibility_to_verify) ? row.eligibility_to_verify as string[] : [],
    lastVerifiedAt: new Date(String(row.last_verified_at)).toISOString().slice(0, 10),
    lastSourceCheckAt: row.last_source_check_at ? new Date(String(row.last_source_check_at)).toISOString() : null,
    sourceStatus: row.source_status === "available" || row.source_status === "needs-review" ? row.source_status : "not-checked",
  };
}

export async function migrateFundingCatalog(): Promise<{ databaseEnabled: boolean; seededPrograms: number }> {
  if (!sql) return { databaseEnabled: false, seededPrograms: seedCatalog.length };
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS funding_programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      funder TEXT NOT NULL,
      official_url TEXT NOT NULL,
      activities TEXT[] NOT NULL,
      applicant_types TEXT[] NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('national', 'international', 'directory')),
      summary TEXT NOT NULL,
      eligibility_to_verify TEXT[] NOT NULL,
      last_verified_at TIMESTAMPTZ NOT NULL,
      last_source_check_at TIMESTAMPTZ,
      source_status TEXT NOT NULL DEFAULT 'not-checked' CHECK (source_status IN ('not-checked', 'available', 'needs-review')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS funding_source_checks (
      id BIGSERIAL PRIMARY KEY,
      funding_program_id TEXT NOT NULL REFERENCES funding_programs(id) ON DELETE CASCADE,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL CHECK (status IN ('available', 'needs-review')),
      http_status INTEGER,
      details TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_funding_programs_activities ON funding_programs USING GIN (activities);
    CREATE INDEX IF NOT EXISTS idx_funding_source_checks_program_checked ON funding_source_checks (funding_program_id, checked_at DESC);
  `);
  for (const program of seedCatalog) {
    await sql`
      INSERT INTO funding_programs (
        id, name, funder, official_url, activities, applicant_types, scope, summary, eligibility_to_verify, last_verified_at
      ) VALUES (
        ${program.id}, ${program.name}, ${program.funder}, ${program.officialUrl}, ${program.activities}, ${program.applicantTypes}, ${program.scope}, ${program.summary}, ${program.eligibilityToVerify}, ${program.lastVerifiedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        funder = EXCLUDED.funder,
        official_url = EXCLUDED.official_url,
        activities = EXCLUDED.activities,
        applicant_types = EXCLUDED.applicant_types,
        scope = EXCLUDED.scope,
        summary = EXCLUDED.summary,
        eligibility_to_verify = EXCLUDED.eligibility_to_verify,
        last_verified_at = EXCLUDED.last_verified_at,
        updated_at = NOW()
    `;
  }
  return { databaseEnabled: true, seededPrograms: seedCatalog.length };
}

export async function closeFundingDatabase() {
  if (sql) await sql.end({ timeout: 5 });
  sql = null;
}

export async function getFundingPrograms(): Promise<FundingProgram[]> {
  if (!sql) return seedCatalog.map((program) => ({ ...program, activities: [...program.activities], applicantTypes: [...program.applicantTypes], eligibilityToVerify: [...program.eligibilityToVerify] }));
  const records = await sql`SELECT id, name, funder, official_url, activities, applicant_types, scope, summary, eligibility_to_verify, last_verified_at, last_source_check_at, source_status FROM funding_programs ORDER BY funder, name`;
  return records.map((record) => normalizeProgram(record));
}

export async function matchFundingPrograms(input: FundingMatchInput): Promise<FundingMatch[]> {
  const programs = await getFundingPrograms();
  return programs
    .map((program) => {
      const matchedActivities = program.activities.filter((activity) => input.activities.includes(activity));
      const applicantCompatible = program.applicantTypes.includes("either") || program.applicantTypes.includes(input.applicantType);
      const scopeCompatible = program.scope !== "international" || input.internationalActivity;
      const fitReasons = [
        ...(matchedActivities.length ? [`Matches: ${matchedActivities.join(", ")}.`] : []),
        ...(program.scope === "international" ? ["International activity is required for this opportunity."] : []),
        ...(input.region ? [`Region supplied: ${input.region}; confirm regional criteria on the official source.`] : []),
      ];
      const matchScore = matchedActivities.length * 10 + (applicantCompatible ? 3 : -10) + (scopeCompatible ? 2 : -8);
      const isPossibleMatch = matchedActivities.length > 0 && applicantCompatible && scopeCompatible;
      return { ...program, matchScore, fitReasons, status: isPossibleMatch ? "possible-eligibility-unconfirmed" as const : "not-currently-matched" as const };
    })
    .filter((program) => program.status === "possible-eligibility-unconfirmed")
    .sort((left, right) => right.matchScore - left.matchScore || left.name.localeCompare(right.name));
}

export async function checkFundingSources(): Promise<{ checked: number; available: number; needsReview: number }> {
  if (!sql) throw new Error("DATABASE_URL is required to record source checks.");
  const programs = await getFundingPrograms();
  let available = 0;
  let needsReview = 0;
  for (const program of programs) {
    let status: "available" | "needs-review" = "needs-review";
    let httpStatus: number | null = null;
    let details = "Official source could not be reached; verify manually.";
    try {
      const response = await fetch(program.officialUrl, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "MusicReleaseManagerFundingCheck/1.0" } });
      httpStatus = response.status;
      if (response.ok) {
        status = "available";
        details = "Official source returned a successful response. Rules, deadline and eligibility still require content review.";
        available += 1;
      } else {
        needsReview += 1;
      }
    } catch {
      needsReview += 1;
    }
    await sql.begin(async (transaction) => {
      await transaction`UPDATE funding_programs SET last_source_check_at = NOW(), source_status = ${status}, updated_at = NOW() WHERE id = ${program.id}`;
      await transaction`INSERT INTO funding_source_checks ${transaction({ funding_program_id: program.id, status, http_status: httpStatus, details })}`;
    });
  }
  return { checked: programs.length, available, needsReview };
}
