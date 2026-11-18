#!/usr/bin/env node
/**
 * Scrapes Doctor of Credit's RSS feeds and checks whether apps/perks/lib/catalog.ts
 * may need updates.
 *
 * - If GEMINI_API_KEY is set: evaluates posts with Google Gemini and updates
 *   catalog.ts when actionable changes are found (output: updated=true).
 * - Otherwise (zero-key mode): outputs a digest of relevant Doctor of Credit
 *   posts so the workflow can open/update a GitHub Issue (output: issue_needed=true).
 *
 * Usage:
 *   node --experimental-strip-types apps/perks/scripts/catalog-monitor.mjs [--since YYYY-MM-DD] [--dry-run] [--output-report path]
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOG, CATALOG_REVIEWED, RETIRED } from "../lib/catalog.ts";
import {
  DEFAULT_GEMINI_MODEL,
  evaluatePosts,
  fetchDoctorOfCreditPosts,
  filterRecentPosts,
  formatDigestIssueBody,
  formatEvaluationReport,
  generateUpdatedCatalog,
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

function writeReport(report, reportPath) {
  if (reportPath) {
    writeFileSync(reportPath, report + "\n", "utf8");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n", "utf8");
  }
}

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";
  const sinceDate = getArg("--since")?.trim() || process.env.SINCE_DATE?.trim() || CATALOG_REVIEWED;
  const reportPath = getArg("--output-report")?.trim();
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  const mode = geminiKey ? "gemini" : "digest";
  console.log(
    `Fetching Doctor of Credit feeds (since ${sinceDate}, mode=${mode}${geminiKey ? `, model=${model}` : ""}, dryRun=${dryRun})...`,
  );

  const allPosts = await fetchDoctorOfCreditPosts();
  const recentPosts = filterRecentPosts(allPosts, sinceDate);
  const relevantPosts = recentPosts.filter((post) => isRelevantPost(post, CATALOG));

  console.log(
    `Scanned ${allPosts.length} feed items -> ${recentPosts.length} recent -> ${relevantPosts.length} relevant.`,
  );

  if (!geminiKey) {
    const report = formatDigestIssueBody(relevantPosts, {
      totalFetched: recentPosts.length,
      sinceDate,
    });
    console.log("\n" + report + "\n");
    writeReport(report, reportPath);
    setGithubOutput("updated", "false");
    setGithubOutput("issue_needed", relevantPosts.length > 0 && !dryRun ? "true" : "false");
    return;
  }

  const llm = { provider: "gemini", apiKey: geminiKey, model };
  const evaluation = await evaluatePosts({
    llm,
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
  writeReport(report, reportPath);
  setGithubOutput("issue_needed", "false");

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
  const updatedSource = await generateUpdatedCatalog({
    llm,
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
