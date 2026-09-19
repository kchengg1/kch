/**
 * End-to-end checks for Scanlink, run against a real browser and a real
 * Postgres database. See docs/TESTING.md for how to run it.
 *
 * WARNING: this truncates every table in DATABASE_URL. Point it at a scratch
 * database, never at production.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
// Next.js injects an empty role="alert" route announcer, so exclude it.
const ALERT = '[role="alert"]:not(#__next-route-announcer__)';
const DB = process.env.DATABASE_URL;
const sql = (q) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();
const log = (...a) => console.log(...a);
let failures = 0;
const check = (name, cond, extra = "") => {
  log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " :: " + extra : ""}`);
  if (!cond) failures++;
};

// Clean slate so the run is reproducible.
sql(`truncate "user", qr_code, qr_scan, subscription, purchase, session, account cascade;`);

if (!DB) {
  console.error("DATABASE_URL must be set. See docs/TESTING.md.");
  process.exit(2);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => log("PAGEERROR:", e.message));

const signup = async (p, name, email) => {
  await p.goto(`${BASE}/signup`);
  await p.fill("#name", name);
  await p.fill("#email", email);
  await p.fill("#password", "supersecret123");
  await Promise.all([p.waitForURL("**/dashboard"), p.click('button[type="submit"]')]);
};
const createCode = async (p, name, url) => {
  await p.goto(`${BASE}/dashboard`);
  await p.fill("#name", name);
  await p.fill("#targetUrl", url);
  await p.click('form button[type="submit"]');
};

/* 1. Sign up ------------------------------------------------------------ */
await signup(page, "Sam Owner", "owner@example.com");
check("signup lands on dashboard", page.url().endsWith("/dashboard"), page.url());
check("free quota shown", (await page.textContent("body")).includes("0 of 3 free codes used"));

/* 2. Create a code through the server action ---------------------------- */
await createCode(page, "Lunch menu", "example.com/menu");
await page.waitForURL("**/dashboard/codes/**");
const codeUrl = page.url();
const codeId = codeUrl.split("/").pop();
check(
  "create redirects to the code page",
  /\/dashboard\/codes\/[0-9a-f-]{36}$/.test(codeUrl),
  codeUrl,
);
let body = await page.textContent("body");
check("code page shows the name", body.includes("Lunch menu"));
check(
  "analytics gated on free plan",
  body.includes("Daily trends, sources and countries are on Pro"),
);

/* 3. QR images ---------------------------------------------------------- */
const svgResp = await page.request.get(`${BASE}/api/codes/${codeId}/qr?format=svg`);
const svg = await svgResp.text();
check(
  "QR svg served",
  svgResp.status() === 200 &&
    svgResp.headers()["content-type"] === "image/svg+xml" &&
    svg.trimStart().startsWith("<svg") &&
    svg.includes("</svg>"),
  `${svgResp.status()} ${svg.length}b`,
);
const rendered = await page.evaluate(
  (src) =>
    new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i.naturalWidth);
      i.onerror = () => res(0);
      i.src = src;
    }),
  `/api/codes/${codeId}/qr?format=svg`,
);
check("QR svg decodes as an image", rendered > 0, `naturalWidth=${rendered}`);
const pngResp = await page.request.get(`${BASE}/api/codes/${codeId}/qr?format=png&download=1`);
const png = await pngResp.body();
check(
  "QR png served as a download",
  pngResp.status() === 200 &&
    png.subarray(1, 4).toString() === "PNG" &&
    (pngResp.headers()["content-disposition"] ?? "").includes("attachment"),
  `${png.length} bytes`,
);

const link = (await page.textContent(".font-mono")).trim();
check("short link shown", /^http:\/\/localhost:3100\/q\/[A-Za-z0-9]{7}$/.test(link), link);
const slug = link.split("/").pop();

/* 4. Validation --------------------------------------------------------- */
await createCode(page, "Bad one", "javascript:alert(1)");
await page.waitForSelector(ALERT);
check("dangerous URL rejected", (await page.textContent(ALERT)).includes("valid web address"));
check(
  "rejected code not stored",
  sql(`select count(*) from qr_code;`) === "1",
  sql(`select count(*) from qr_code;`),
);

/* 5. Scanning ----------------------------------------------------------- */
const phone = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const scan = await phone.request.get(`${BASE}/q/${slug}`, { maxRedirects: 0 });
check("scan redirects 302", scan.status() === 302, String(scan.status()));
check(
  "redirect points at the destination",
  scan.headers()["location"] === "https://example.com/menu",
  scan.headers()["location"],
);
check("redirect is not cached", (scan.headers()["cache-control"] ?? "").includes("no-store"));

const bot = await browser.newContext({ userAgent: "facebookexternalhit/1.1" });
await bot.request.get(`${BASE}/q/${slug}`, { maxRedirects: 0 });
for (let i = 0; i < 2; i++) await phone.request.get(`${BASE}/q/${slug}`, { maxRedirects: 0 });
await new Promise((r) => setTimeout(r, 1500)); // scans are written after the response

check(
  "only human scans counted",
  sql(`select count(*) from qr_scan;`) === "3",
  sql(`select count(*) from qr_scan;`),
);
check(
  "counter matches scan rows",
  sql(`select scan_count from qr_code;`) === "3",
  sql(`select scan_count from qr_code;`),
);
check(
  "unknown slug 404s",
  (await phone.request.get(`${BASE}/q/nosuchcode`, { maxRedirects: 0 })).status() === 404,
);

/* 6. Editing the destination -------------------------------------------- */
await page.goto(codeUrl);
await page.fill("#targetUrl", "https://example.com/new-menu");
await page.click('form:has(#targetUrl) button[type="submit"]');
await page.waitForSelector("text=points to the new destination");
const afterEdit = await phone.request.get(`${BASE}/q/${slug}`, { maxRedirects: 0 });
check(
  "edited destination takes effect on the same printed code",
  afterEdit.headers()["location"] === "https://example.com/new-menu",
  afterEdit.headers()["location"],
);

/* 7. Free plan limit ---------------------------------------------------- */
await createCode(page, "Second", "example.com/2");
await page.waitForURL("**/dashboard/codes/**");
await createCode(page, "Third", "example.com/3");
await page.waitForURL("**/dashboard/codes/**");
await createCode(page, "Fourth", "example.com/4");
await page.waitForSelector(ALERT);
const limitMsg = await page.textContent(ALERT);
check(
  "fourth code blocked on free plan",
  limitMsg.includes("free plan includes 3 codes"),
  limitMsg.slice(0, 60),
);
check("upgrade link offered", (await page.locator(`${ALERT} a[href="/pricing"]`).count()) === 1);
check("still only 3 codes stored", sql(`select count(*) from qr_code;`) === "3");

/* 8. Paid plan unlocks analytics ---------------------------------------- */
const userId = sql(`select id from "user" where email = 'owner@example.com';`);
sql(
  `insert into subscription (id, user_id, stripe_customer_id, price_id, status, current_period_end, cancel_at_period_end)
   values ('sub_test', '${userId}', 'cus_test', 'price_pro_test', 'active', now() + interval '30 days', false);`,
);
await page.goto(codeUrl);
body = await page.textContent("body");
check(
  "analytics visible once paid",
  !body.includes("Daily trends, sources and countries are on Pro"),
);
check(
  "last 7 days total correct",
  /Last 7 days\s*4/.test(body.replace(/\s+/g, " ")),
  body.replace(/\s+/g, " ").match(/Last 7 days.{0,12}/)?.[0],
);
check("top sources listed", body.includes("Direct scan"));
await page.goto(`${BASE}/dashboard`);
check(
  "dashboard reflects paid plan",
  (await page.textContent("body")).includes("Unlimited codes with scan analytics"),
);
await createCode(page, "Fourth", "example.com/4");
await page.waitForURL("**/dashboard/codes/**");
check("paid plan allows a 4th code", sql(`select count(*) from qr_code;`) === "4");

/* 9. Ownership and auth -------------------------------------------------- */
const intruderCtx = await browser.newContext();
const intruder = await intruderCtx.newPage();
await signup(intruder, "Nosy Person", "nosy@example.com");
check(
  "other user blocked from the QR image",
  (await intruder.request.get(`${BASE}/api/codes/${codeId}/qr?format=svg`)).status() === 404,
);
await intruder.goto(codeUrl);
check(
  "other user blocked from the code page",
  (await intruder.textContent("body")).includes("Page not found"),
);
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/dashboard`);
check("signed-out visitor sent to login", anon.url().includes("/login"), anon.url());
const anonQr = await anon.request.get(`${BASE}/api/codes/${codeId}/qr?format=svg`);
check(
  "signed-out visitor blocked from the QR image",
  anonQr.status() === 401,
  String(anonQr.status()),
);

/* 10. Deleting ----------------------------------------------------------- */
page.on("dialog", (d) => d.accept());
await page.goto(codeUrl);
await Promise.all([page.waitForURL("**/dashboard"), page.click('button:has-text("Delete code")')]);
check("code deleted", sql(`select count(*) from qr_code where id = '${codeId}';`) === "0");
check(
  "its scans deleted with it",
  sql(`select count(*) from qr_scan where code_id = '${codeId}';`) === "0",
);
const gone = await phone.request.get(`${BASE}/q/${slug}`, { maxRedirects: 0 });
check("deleted code stops resolving", gone.status() === 404, String(gone.status()));

await browser.close();
log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
