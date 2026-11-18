import { z } from "zod";
import type { CardTemplate } from "./catalog";

export const DOC_FEEDS = [
  "https://www.doctorofcredit.com/feed/",
  "https://www.doctorofcredit.com/credit-cards/feed/",
] as const;

export const DEFAULT_GITHUB_MODEL = "openai/gpt-4.1-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";

export type LlmConfig =
  | { provider: "github-models"; token: string; model?: string }
  | { provider: "gemini"; apiKey: string; model?: string };

export type DocPost = {
  title: string;
  link: string;
  pubDate: string;
  publishedAt: number;
  categories: string[];
  content: string;
};

export const EvaluationFindingSchema = z.object({
  cardKey: z.string().nullable(),
  cardName: z.string(),
  changeType: z.enum([
    "fee",
    "benefit_added",
    "benefit_changed",
    "benefit_retired",
    "note",
    "new_card",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  description: z.string(),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
});

export const EvaluationResultSchema = z.object({
  needsUpdate: z.boolean(),
  summary: z.string(),
  findings: z.array(EvaluationFindingSchema),
});

export type EvaluationFinding = z.infer<typeof EvaluationFindingSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "--",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " ");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unwrapCdata(raw: string): string {
  return raw.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function extractTag(block: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
  );
  return match?.[1] ? unwrapCdata(match[1].trim()) : "";
}

function extractAllTags(block: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi");
  const values: string[] = [];
  for (const match of block.matchAll(regex)) {
    const raw = match[1];
    if (!raw) continue;
    const value = decodeHtmlEntities(unwrapCdata(raw.trim()));
    if (value) values.push(value);
  }
  return values;
}

export function parseRssFeed(xml: string, maxContentChars = 4000): DocPost[] {
  const posts: DocPost[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemRegex)) {
    const block = match[1] ?? "";
    const title = decodeHtmlEntities(extractTag(block, "title"));
    const link = decodeHtmlEntities(extractTag(block, "link")).trim();
    const pubDate = extractTag(block, "pubDate");
    const categories = extractAllTags(block, "category");
    const encoded = extractTag(block, "content:encoded");
    const description = extractTag(block, "description");
    const content = stripHtml(encoded || description).slice(0, maxContentChars);
    const parsedTime = Date.parse(pubDate);
    if (!title || !link) continue;
    posts.push({
      title,
      link,
      pubDate,
      publishedAt: Number.isFinite(parsedTime) ? parsedTime : 0,
      categories,
      content,
    });
  }
  return posts;
}

export function canonicalPostUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
        parsed.searchParams.delete(key);
      }
    }
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}${parsed.search}`;
  } catch {
    return url.trim().replace(/\/+$/, "");
  }
}

export function filterRecentPosts(
  posts: DocPost[],
  sinceIsoDate: string,
  bufferDays = 1,
): DocPost[] {
  const parsedSince = Date.parse(`${sinceIsoDate}T00:00:00Z`);
  const cutoff = Number.isFinite(parsedSince) ? parsedSince - bufferDays * 24 * 60 * 60 * 1000 : 0;

  const byUrl = new Map<string, DocPost>();
  for (const post of posts) {
    if (post.publishedAt > 0 && post.publishedAt < cutoff) continue;
    const key = canonicalPostUrl(post.link);
    const existing = byUrl.get(key);
    if (!existing || post.content.length > existing.content.length) {
      byUrl.set(key, post);
    }
  }

  return [...byUrl.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

const CHANGE_KEYWORDS = [
  "annual fee",
  "statement credit",
  "credit",
  "benefit",
  "perk",
  "devaluation",
  "nerf",
  "refresh",
  "revamp",
  "retire",
  "discontinue",
  "ending",
  "lounge",
  "transfer partner",
  "enroll",
  "credit card",
  "business card",
  "signup bonus",
  "sign-up bonus",
  "welcome offer",
];

const ISSUER_KEYWORDS = [
  "american express",
  "amex",
  "chase",
  "capital one",
  "citi",
  "discover",
  "bilt",
  "wells fargo",
  "bank of america",
  "barclays",
  "u.s. bank",
];

export function isRelevantPost(post: DocPost, catalog: CardTemplate[]): boolean {
  const haystack = `${post.title}\n${post.categories.join(" ")}\n${post.content}`.toLowerCase();

  const matchesCatalogCard = catalog.some(
    (card) => card.match.test(haystack) || haystack.includes(card.name.toLowerCase()),
  );
  if (matchesCatalogCard) return true;

  const hasIssuer = ISSUER_KEYWORDS.some((kw) => haystack.includes(kw));
  const hasChangeKeyword = CHANGE_KEYWORDS.some((kw) => haystack.includes(kw));
  const hasCreditCardCategory = post.categories.some((c) =>
    c.toLowerCase().includes("credit card"),
  );

  return (hasIssuer || hasCreditCardCategory) && hasChangeKeyword;
}

export function buildCatalogSummary(
  catalog: CardTemplate[],
  retired: Record<string, string[]>,
  reviewedOn: string,
): string {
  return JSON.stringify(
    {
      catalogReviewed: reviewedOn,
      retired,
      cards: catalog.map((card) => ({
        key: card.key,
        name: card.name,
        issuer: card.issuer,
        business: card.business,
        annualFee: card.annualFee,
        benefits: card.benefits.map((b) => ({
          name: b.name,
          cadence: b.cadence,
          ...(b.amount !== undefined ? { amount: b.amount } : {}),
          ...(b.enroll ? { enroll: b.enroll } : {}),
          ...(b.inApp ? { inApp: b.inApp } : {}),
          ...(b.endsOn ? { endsOn: b.endsOn } : {}),
          ...(b.notes ? { notes: b.notes } : {}),
        })),
      })),
    },
    null,
    2,
  );
}

export async function fetchDoctorOfCreditPosts(
  feeds: readonly string[] = DOC_FEEDS,
  fetchImpl: typeof fetch = fetch,
): Promise<DocPost[]> {
  const allPosts: DocPost[] = [];
  const errors: string[] = [];

  for (const feedUrl of feeds) {
    try {
      const res = await fetchImpl(feedUrl, {
        headers: {
          "User-Agent": "kch-perks-catalog-monitor/1.0 (+https://github.com/kchengg1/kch)",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        errors.push(`${feedUrl}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      allPosts.push(...parseRssFeed(xml));
    } catch (err) {
      errors.push(`${feedUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allPosts.length === 0 && errors.length > 0) {
    throw new Error(`Failed to fetch Doctor of Credit feeds: ${errors.join("; ")}`);
  }

  return allPosts;
}

async function callGitHubModels(params: {
  token: string;
  model: string;
  prompt: string;
  jsonMode?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const res = await fetchImpl(GITHUB_MODELS_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: "user", content: params.prompt }],
      temperature: 0.1,
      ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub Models API error (${res.status}): ${rawBody.slice(0, 500)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawBody) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new Error(
      `GitHub Models API returned non-JSON (${res.status} ${res.headers.get("content-type") ?? ""}): ${rawBody.slice(0, 200)}`,
    );
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("GitHub Models API returned no text content");
  }
  return text;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  jsonMode?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: {
        temperature: 0.1,
        ...(params.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API returned no text content");
  }
  return text;
}

async function callLlm(params: {
  llm: LlmConfig;
  prompt: string;
  jsonMode?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  if (params.llm.provider === "github-models") {
    return callGitHubModels({
      token: params.llm.token,
      model: params.llm.model ?? DEFAULT_GITHUB_MODEL,
      prompt: params.prompt,
      jsonMode: params.jsonMode,
      fetchImpl: params.fetchImpl,
    });
  }
  return callGemini({
    apiKey: params.llm.apiKey,
    model: params.llm.model ?? DEFAULT_GEMINI_MODEL,
    prompt: params.prompt,
    jsonMode: params.jsonMode,
    fetchImpl: params.fetchImpl,
  });
}

export function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```$/);
  return match?.[1] ? match[1].trim() : trimmed;
}

export async function evaluatePosts(params: {
  llm: LlmConfig;
  posts: DocPost[];
  catalog: CardTemplate[];
  retired: Record<string, string[]>;
  reviewedOn: string;
  fetchImpl?: typeof fetch;
}): Promise<EvaluationResult> {
  if (params.posts.length === 0) {
    return {
      needsUpdate: false,
      summary: "No new relevant Doctor of Credit posts found since the last catalog review.",
      findings: [],
    };
  }

  const catalogSummary = buildCatalogSummary(params.catalog, params.retired, params.reviewedOn);
  const postsPayload = params.posts.slice(0, 25).map((p) => ({
    title: p.title,
    link: p.link,
    pubDate: p.pubDate,
    categories: p.categories,
    content: p.content.slice(0, 2500),
  }));

  const prompt = `You are maintaining a credit card benefits catalog (apps/perks/lib/catalog.ts) for a personal credit card perks tracker.
Your job is to compare recent posts from Doctor of Credit against the current catalog and decide whether the catalog needs to be updated.

Only flag changes that affect recurring card benefits, statement credits, annual fees, enrollment requirements, benefit end dates, retired benefits, important card perks/rules, or notable new/revamped cards that belong in the catalog.
Ignore temporary sign-up bonus fluctuations, targeted Amex/Chase merchant offers, bank account bonuses, checking/savings promos, and rumors that have not been confirmed unless they are clearly announced changes.
Also ignore changes that are ALREADY reflected in the current catalog.

Return a JSON object matching this exact schema:
{
  "needsUpdate": boolean,
  "summary": string,
  "findings": [
    {
      "cardKey": string | null,
      "cardName": string,
      "changeType": "fee" | "benefit_added" | "benefit_changed" | "benefit_retired" | "note" | "new_card",
      "confidence": "high" | "medium" | "low",
      "description": string,
      "sourceTitle": string,
      "sourceUrl": string
    }
  ]
}

Current catalog (reviewed on ${params.reviewedOn}):
${catalogSummary}

Recent Doctor of Credit posts:
${JSON.stringify(postsPayload, null, 2)}`;

  const raw = await callLlm({
    llm: params.llm,
    prompt,
    jsonMode: true,
    fetchImpl: params.fetchImpl,
  });

  const parsed = JSON.parse(stripMarkdownCodeFence(raw));
  return EvaluationResultSchema.parse(parsed);
}

export async function evaluatePostsWithGemini(params: {
  apiKey: string;
  model?: string;
  posts: DocPost[];
  catalog: CardTemplate[];
  retired: Record<string, string[]>;
  reviewedOn: string;
  fetchImpl?: typeof fetch;
}): Promise<EvaluationResult> {
  return evaluatePosts({
    llm: { provider: "gemini", apiKey: params.apiKey, model: params.model },
    posts: params.posts,
    catalog: params.catalog,
    retired: params.retired,
    reviewedOn: params.reviewedOn,
    fetchImpl: params.fetchImpl,
  });
}

export function hasActionableFindings(result: EvaluationResult): boolean {
  return result.needsUpdate && result.findings.some((f) => f.confidence !== "low");
}

export async function generateUpdatedCatalog(params: {
  llm: LlmConfig;
  currentCatalogSource: string;
  todayIsoDate: string;
  evaluation: EvaluationResult;
  posts: DocPost[];
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const actionableFindings = params.evaluation.findings.filter((f) => f.confidence !== "low");
  const referencedUrls = new Set(actionableFindings.map((f) => canonicalPostUrl(f.sourceUrl)));
  const relevantPosts = params.posts.filter((p) => referencedUrls.has(canonicalPostUrl(p.link)));

  const prompt = `Update the TypeScript file apps/perks/lib/catalog.ts based on the verified Doctor of Credit findings below.

Rules:
1. Update CATALOG_REVIEWED to "${params.todayIsoDate}".
2. Apply ONLY the changes described in the actionable findings below.
3. If an existing benefit is retired or renamed on a card, add the old exact benefit name to RETIRED[cardKey] so existing users are offered its removal (see how RETIRED is used).
4. Preserve all unrelated cards, helper functions (getTemplate, onStatement, matchTemplate), types, and existing comments.
5. Keep valid TypeScript matching the existing style and Cadence values ("monthly" | "quarterly" | "semiannual" | "annual" | "quadrennial" | "perk").
6. Return ONLY the complete updated TypeScript file content with no markdown fences or explanation.

Actionable findings:
${JSON.stringify(actionableFindings, null, 2)}

Source posts:
${JSON.stringify(relevantPosts, null, 2)}

Current apps/perks/lib/catalog.ts:
${params.currentCatalogSource}`;

  const raw = await callLlm({
    llm: params.llm,
    prompt,
    jsonMode: false,
    fetchImpl: params.fetchImpl,
  });

  const updated = stripMarkdownCodeFence(raw);
  if (
    !updated.includes("export const CATALOG_REVIEWED") ||
    !updated.includes("export const CATALOG") ||
    !updated.includes("export function matchTemplate")
  ) {
    throw new Error("LLM returned an invalid catalog.ts replacement");
  }

  return updated.endsWith("\n") ? updated : `${updated}\n`;
}

export async function generateUpdatedCatalogWithGemini(params: {
  apiKey: string;
  model?: string;
  currentCatalogSource: string;
  todayIsoDate: string;
  evaluation: EvaluationResult;
  posts: DocPost[];
  fetchImpl?: typeof fetch;
}): Promise<string> {
  return generateUpdatedCatalog({
    llm: { provider: "gemini", apiKey: params.apiKey, model: params.model },
    currentCatalogSource: params.currentCatalogSource,
    todayIsoDate: params.todayIsoDate,
    evaluation: params.evaluation,
    posts: params.posts,
    fetchImpl: params.fetchImpl,
  });
}

export function formatEvaluationReport(
  result: EvaluationResult,
  stats: { totalFetched: number; relevantCount: number; sinceDate: string },
): string {
  const lines: string[] = [
    "## Doctor of Credit Catalog Evaluation",
    "",
    result.summary,
    "",
    `- **Reviewed since:** \`${stats.sinceDate}\``,
    `- **Feed items scanned:** ${stats.totalFetched}`,
    `- **Relevant credit card posts:** ${stats.relevantCount}`,
    `- **Needs catalog update:** ${result.needsUpdate ? "Yes" : "No"}`,
  ];

  if (result.findings.length > 0) {
    lines.push("", "### Findings", "");
    for (const f of result.findings) {
      const keyBadge = f.cardKey ? ` (\`${f.cardKey}\`)` : "";
      lines.push(
        `- **${f.cardName}**${keyBadge} — \`${f.changeType}\` (${f.confidence} confidence): ${f.description} ([${f.sourceTitle}](${f.sourceUrl}))`,
      );
    }
  }

  lines.push(
    "",
    "> Automated check against Doctor of Credit. Please verify all benefit amounts, cadences, and fine print against the issuer's official terms before merging.",
  );
  return lines.join("\n");
}
