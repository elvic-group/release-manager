import { closeFundingDatabase, migrateFundingCatalog } from "./funding-catalog.js";

try {
  const result = await migrateFundingCatalog();
  console.log(result.databaseEnabled ? `Funding catalog migrated with ${result.seededPrograms} curated programs.` : `DATABASE_URL is not set; using ${result.seededPrograms} packaged funding records.`);
} finally {
  await closeFundingDatabase();
}
