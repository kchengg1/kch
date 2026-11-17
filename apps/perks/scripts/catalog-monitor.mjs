#!/usr/bin/env node
/**
 * Scrapes Doctor of Credit's RSS feeds, evaluates recent posts against
 * apps/perks/lib/catalog.ts using Google Gemini, and optionally updates
 * catalog.ts when actionable changes are found.
 *
 * Usage:
 *   GEMINI_API_KEY=... node --experimental-strip-types apps/perks/scripts/catalog-monitor.mjs [--since YYYY-MM-DD] [--dry-run] [--output-report path]
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOG, CATALOG_REVIEWED, RETIRED } from "../lib/catalog.ts";
import {
  DEFAULT_GEMINI_MODEL,
  evaluatePostsWithGemini,
  fetchDoctorOfCreditPosts,
  filterRecentPosts,
  formatEvaluationReport,
  generateUpdatedCatalogWithGemini,
  hasActionableFindings,
  isRelevantPost,
} from "../lib/catalog-monitor.ts";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function setGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${key}=${value}\n`, "utf8");
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";
  const sinceDate = getArg("--since")?.trim() || process.env.SINCE_DATE?.trim() || CATALOG_REVIEWED;
  const reportPath = getArg("--output-report")?.trim();
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  console.log(`Fetching Doctor of Credit feeds (since ${sinceDate}, dryRun=${dryRun})...`);
  const allPosts = await fetchDoctorOfCreditPosts();
  const recentPosts = filterRecentPosts(allPosts, sinceDate);
  const relevantPosts = recentPosts.filter((post) => isRelevantPost(post, CATALOG));

  console.log(
    `Scanned ${allPosts.length} feed items -> ${recentPosts.length} recent -> ${relevantPosts.length} relevant.`,
  );

  const evaluation = await evaluatePostsWithGemini({
    apiKey,
    model,
    posts: relevantPosts,
    catalog: CATALOG,
    retired: RETIRED,
    reviewedOn: CATALOG_REVIEWED,
  });

  const report = formatEvaluationReport(evaluation, {
    totalFetched: recentPosts.length,
    relevantCount: relevantPosts.length,
    sinceDate,
  });

  console.log("\n" + report + "\n");

  if (reportPath) {
    writeFileSync(reportPath, report + "\n", "utf8");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n", "utf8");
  }

  const actionable = hasActionableFindings(evaluation);
  if (!actionable || dryRun) {
    setGithubOutput("updated", "false");
    console.log(
      dryRun
        ? "Dry run enabled; skipping catalog.ts modification."
        : "No actionable catalog updates required.",
    );
    return;
  }

  const catalogPath = resolve(import.meta.dirname, "../lib/catalog.ts");
  const currentCatalogSource = readFileSync(catalogPath, "utf8");

  console.log("Generating updated apps/perks/lib/catalog.ts...");
  const updatedSource = await generateUpdatedCatalogWithGemini({
    apiKey,
    model,
    currentCatalogSource,
    todayIsoDate,
    evaluation,
    posts: relevantPosts,
  });

  writeFileSync(catalogPath, updatedSource, "utf8");
  setGithubOutput("updated", "true");
  console.log("Updated apps/perks/lib/catalog.ts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
