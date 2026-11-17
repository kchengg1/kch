import { describe, expect, it, vi } from "vitest";
import { CATALOG, CATALOG_REVIEWED, RETIRED } from "./catalog";
import {
  buildCatalogSummary,
  evaluatePosts,
  evaluatePostsWithGemini,
  filterRecentPosts,
  formatEvaluationReport,
  generateUpdatedCatalogWithGemini,
  hasActionableFindings,
  isRelevantPost,
  parseRssFeed,
  stripHtml,
  stripMarkdownCodeFence,
} from "./catalog-monitor";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Doctor Of Credit</title>
    <item>
      <title><![CDATA[Amex Platinum Adds New $250 Dining Credit &amp; Raises Fee]]></title>
      <link>https://www.doctorofcredit.com/amex-platinum-dining-credit/?utm_source=rss</link>
      <pubDate>Tue, 17 Nov 2026 12:00:00 +0000</pubDate>
      <category><![CDATA[Credit Cards]]></category>
      <content:encoded><![CDATA[<p>American Express announced a <strong>$250 annual dining credit</strong> on the Amex Platinum.</p><script>bad()</script>]]></content:encoded>
    </item>
    <item>
      <title>Chase Checking $300 Bank Bonus</title>
      <link>https://www.doctorofcredit.com/chase-checking-300-bonus/</link>
      <pubDate>Tue, 17 Nov 2026 10:00:00 +0000</pubDate>
      <category><![CDATA[Bank Accounts]]></category>
      <description><![CDATA[<p>Open a new Chase Total Checking account and set up direct deposit for $300.</p>]]></description>
    </item>
    <item>
      <title>Old Capital One Venture X News</title>
      <link>https://www.doctorofcredit.com/old-venture-x-news/</link>
      <pubDate>Sun, 01 Nov 2026 10:00:00 +0000</pubDate>
      <category><![CDATA[Credit Cards]]></category>
      <description>Old news before review date.</description>
    </item>
  </channel>
</rss>`;

describe("stripHtml", () => {
  it("strips tags, scripts, and decodes entities", () => {
    const html = "<p>Hello &amp; <b>world</b>&#8217;s</p><script>alert(1)</script><p>Line 2</p>";
    expect(stripHtml(html)).toBe("Hello & world’s\nLine 2");
  });
});

describe("parseRssFeed", () => {
  it("parses items, CDATA, categories, and prefers content:encoded", () => {
    const posts = parseRssFeed(SAMPLE_RSS);
    expect(posts).toHaveLength(3);
    expect(posts[0]!.title).toBe("Amex Platinum Adds New $250 Dining Credit & Raises Fee");
    expect(posts[0]!.categories).toEqual(["Credit Cards"]);
    expect(posts[0]!.content).toBe(
      "American Express announced a $250 annual dining credit on the Amex Platinum.",
    );
    expect(posts[1]!.content).toContain("Chase Total Checking");
  });
});

describe("filterRecentPosts", () => {
  it("filters by sinceIsoDate (with 1-day buffer) and deduplicates canonical URLs", () => {
    const posts = parseRssFeed(SAMPLE_RSS);
    const duplicate = {
      ...posts[0]!,
      link: "https://www.doctorofcredit.com/amex-platinum-dining-credit",
      content: "shorter",
    };
    const filtered = filterRecentPosts([...posts, duplicate], "2026-11-16", 1);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.content.length).toBeGreaterThan(10);
    expect(filtered.map((p) => p.title)).not.toContain("Old Capital One Venture X News");
  });
});

describe("isRelevantPost", () => {
  it("keeps posts matching catalog cards or issuer benefit changes, excludes bank promos", () => {
    const posts = parseRssFeed(SAMPLE_RSS);
    expect(isRelevantPost(posts[0]!, CATALOG)).toBe(true);
    expect(isRelevantPost(posts[1]!, CATALOG)).toBe(false);
  });
});

describe("buildCatalogSummary", () => {
  it("includes reviewed date, retired benefits, and catalog cards", () => {
    const summary = JSON.parse(buildCatalogSummary(CATALOG, RETIRED, CATALOG_REVIEWED));
    expect(summary.catalogReviewed).toBe(CATALOG_REVIEWED);
    expect(summary.cards.length).toBe(CATALOG.length);
    expect(summary.retired["amex-platinum"]).toContain("Saks Fifth Avenue credit");
  });
});

describe("evaluatePostsWithGemini", () => {
  it("returns no-update result immediately when there are no posts", async () => {
    const fetchMock = vi.fn();
    const res = await evaluatePostsWithGemini({
      apiKey: "test-key",
      posts: [],
      catalog: CATALOG,
      retired: RETIRED,
      reviewedOn: CATALOG_REVIEWED,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.needsUpdate).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses and validates structured Gemini JSON response", async () => {
    const firstPost = parseRssFeed(SAMPLE_RSS)[0]!;
    const mockPayload = {
      needsUpdate: true,
      summary: "Amex Platinum added a $250 dining credit.",
      findings: [
        {
          cardKey: "amex-platinum",
          cardName: "Amex Platinum",
          changeType: "benefit_added",
          confidence: "high",
          description: "Added $250 annual dining credit.",
          sourceTitle: firstPost.title,
          sourceUrl: firstPost.link,
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPayload) }] } }],
      }),
    });

    const result = await evaluatePostsWithGemini({
      apiKey: "test-key",
      posts: [firstPost],
      catalog: CATALOG,
      retired: RETIRED,
      reviewedOn: CATALOG_REVIEWED,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result.needsUpdate).toBe(true);
    expect(hasActionableFindings(result)).toBe(true);
    expect(result.findings[0]!.cardKey).toBe("amex-platinum");
  });

  it("supports GitHub Models provider via GITHUB_TOKEN", async () => {
    const firstPost = parseRssFeed(SAMPLE_RSS)[0]!;
    const mockPayload = {
      needsUpdate: false,
      summary: "No catalog changes needed.",
      findings: [],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockPayload) } }],
      }),
    });

    const result = await evaluatePosts({
      llm: { provider: "github-models", token: "gh-token" },
      posts: [firstPost],
      catalog: CATALOG,
      retired: RETIRED,
      reviewedOn: CATALOG_REVIEWED,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result.needsUpdate).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("hasActionableFindings", () => {
  it("ignores low-confidence-only findings", () => {
    expect(
      hasActionableFindings({
        needsUpdate: true,
        summary: "Unconfirmed rumor",
        findings: [
          {
            cardKey: "amex-platinum",
            cardName: "Amex Platinum",
            changeType: "note",
            confidence: "low",
            description: "Rumor only",
            sourceTitle: "Rumor",
            sourceUrl: "https://www.doctorofcredit.com/rumor/",
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("generateUpdatedCatalogWithGemini", () => {
  it("strips markdown fences and validates required exports", async () => {
    const fakeCatalog = [
      'export const CATALOG_REVIEWED = "2026-11-17";',
      "export const CATALOG = [];",
      "export function matchTemplate() { return undefined; }",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "```ts\n" + fakeCatalog + "\n```" }] } }],
      }),
    });

    const updated = await generateUpdatedCatalogWithGemini({
      apiKey: "test-key",
      currentCatalogSource: fakeCatalog,
      todayIsoDate: "2026-11-17",
      evaluation: {
        needsUpdate: true,
        summary: "Updated",
        findings: [
          {
            cardKey: "amex-platinum",
            cardName: "Amex Platinum",
            changeType: "note",
            confidence: "high",
            description: "Updated note",
            sourceTitle: "Post",
            sourceUrl: "https://www.doctorofcredit.com/post/",
          },
        ],
      },
      posts: [],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(updated).toBe(fakeCatalog + "\n");
  });
});

describe("stripMarkdownCodeFence", () => {
  it("unwraps fenced code blocks", () => {
    expect(stripMarkdownCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("formatEvaluationReport", () => {
  it("formats a markdown report with findings", () => {
    const report = formatEvaluationReport(
      {
        needsUpdate: true,
        summary: "One change found.",
        findings: [
          {
            cardKey: "amex-platinum",
            cardName: "Amex Platinum",
            changeType: "fee",
            confidence: "high",
            description: "Annual fee changed.",
            sourceTitle: "DoC Post",
            sourceUrl: "https://www.doctorofcredit.com/post/",
          },
        ],
      },
      { totalFetched: 12, relevantCount: 3, sinceDate: "2026-11-16" },
    );

    expect(report).toContain("## Doctor of Credit Catalog Evaluation");
    expect(report).toContain("Amex Platinum");
    expect(report).toContain("[DoC Post](https://www.doctorofcredit.com/post/)");
  });
});
