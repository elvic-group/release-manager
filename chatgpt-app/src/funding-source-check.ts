import { checkFundingSources, closeFundingDatabase } from "./funding-catalog.js";

try {
  const result = await checkFundingSources();
  console.log(`Checked ${result.checked} funding sources: ${result.available} available, ${result.needsReview} need review.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Funding source check failed.");
  process.exitCode = 1;
} finally {
  await closeFundingDatabase();
}
