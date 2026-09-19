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
