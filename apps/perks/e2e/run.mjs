/**
 * End-to-end checks for Perks, run against a real browser and a real Postgres
 * database. See docs/TESTING.md for how to run it.
 *
 * WARNING: this truncates every table in DATABASE_URL. Point it at a scratch
 * database, never at production.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const DB = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret";
if (!DB) {
  console.error("DATABASE_URL must be set. See docs/TESTING.md.");
  process.exit(2);
}
const sql = (q) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();
const log = (...a) => console.log(...a);
let failures = 0;
const check = (name, cond, extra = "") => {
  log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " :: " + extra : ""}`);
  if (!cond) failures++;
};

// Clean slate so the run is reproducible.
sql(
  `truncate "user", perks_card, perks_benefit, perks_usage, perks_offer, perks_settings, session, account cascade;`,
);

// The app decides "today" in PERKS_TIMEZONE; use the same day here.
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.PERKS_TIMEZONE || "America/New_York",
}).format(new Date());
const monthKey = today.slice(0, 7);
const year = Number(today.slice(0, 4));
const us = (y, m, d) => `${m}/${d}/${y}`;

const SHEET = [
  "Card Name\tApproval Date\tBonus Post Date\tClosed/PC Date\tAnnual Fee\tBank\tCard Type\tClosed",
  `Chase Sapphire Reserve\t${us(year - 1, 3, 1)}\t\t\t$550.00\tChase\tPersonal\tNo`,
  `Amex PRG\t${us(year - 8, 2, 18)}\t\t\t$325.00\tAmerican Express\tPersonal\tNo`,
  `Discover IT\t${us(year - 12, 3, 1)}\t\t\t$0.00\tDiscover\tPersonal\tNo`,
  `Marriott Bonvoy Brilliant\t${us(year - 10, 3, 1)}\t\t${us(year - 6, 4, 16)}\t$450.00\tAmerican Express\tPersonal\tYes`,
].join("\n");

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => log("PAGEERROR:", e.message));
// innerText, not textContent: the latter includes Next's inline data scripts.
const bodyText = () => page.innerText("body");

const signup = async (p, name, email) => {
  await p.goto(`${BASE}/signup`);
  await p.fill("#name", name);
  await p.fill("#email", email);
  await p.fill("#password", "supersecret123");
  await Promise.all([p.waitForURL("**/dashboard"), p.click('button[type="submit"]')]);
};
/** Wait until a SQL query returns the expected value (server actions are async). */
const until = async (query, expected) => {
  for (let i = 0; i < 40; i++) {
    if (sql(query) === String(expected)) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

/* 1. Sign up ------------------------------------------------------------ */
await signup(page, "Sam Owner", "owner@example.com");
check("signup lands on dashboard", page.url().endsWith("/dashboard"), page.url());
check("empty dashboard offers the import", (await bodyText()).includes("Import from spreadsheet"));

/* 2. Import the spreadsheet --------------------------------------------- */
await page.goto(`${BASE}/dashboard/cards/import`);
await page.fill('textarea[name="sheet"]', SHEET);
let body = await bodyText();
check("preview counts open and closed cards", body.includes("3 open cards, plus 1 closed"));
check("preview maps the nickname to a template", body.includes("Amex Gold ·"));
await Promise.all([
  page.waitForURL("**/dashboard/cards"),
  page.click('button:has-text("Import 4 cards")'),
]);
check("four cards stored", sql(`select count(*) from perks_card`) === "4");
check(
  "catalog fee replaces the stale sheet fee",
  sql(`select annual_fee_cents from perks_card where name='Chase Sapphire Reserve'`) === "79500",
);
check(
  "open template cards get benefits",
  Number(
    sql(
      `select count(*) from perks_benefit b join perks_card c on c.id=b.card_id where c.name='Amex PRG'`,
    ),
  ) >= 4,
);
check(
  "closed cards get none",
  sql(`select count(*) from perks_benefit b join perks_card c on c.id=b.card_id where c.closed`) ===
    "0",
);

// Importing the same sheet again must not duplicate anything.
await page.goto(`${BASE}/dashboard/cards/import`);
await page.fill('textarea[name="sheet"]', SHEET);
await page.click('button:has-text("Import 4 cards")');
await page.waitForSelector("text=already here");
check("re-import adds nothing", sql(`select count(*) from perks_card`) === "4");

/* 3. Mark a credit used ------------------------------------------------- */
await page.goto(`${BASE}/dashboard`);
const lyftId = sql(`select id from perks_benefit where name='Lyft credit'`);
const lyftRow = page.locator("li", { hasText: "Lyft credit" });
check("dashboard lists the unused Lyft credit", (await lyftRow.count()) === 1);
await lyftRow.locator('button:has-text("Mark used")').click();
check(
  "marking used stores the full amount for this month",
  await until(
    `select used_cents from perks_usage where benefit_id='${lyftId}' and period_key='${monthKey}'`,
    1000,
  ),
);
await lyftRow.waitFor({ state: "detached" });
check("used credit leaves the list", !(await bodyText()).includes("Lyft credit"));

/* 4. Log a partial amount ----------------------------------------------- */
const doorId = sql(`select id from perks_benefit where name='DoorDash credit'`);
const doorRow = page.locator("li", { hasText: "DoorDash credit" });
await doorRow.locator("summary").click();
await doorRow.locator('input[name="amount"]').fill("6");
await doorRow.locator('button:has-text("Save")').click();
check(
  "partial amount stored",
  await until(
    `select used_cents from perks_usage where benefit_id='${doorId}' and period_key='${monthKey}'`,
    600,
  ),
);
await page.waitForSelector("text=$6 used");
check("row shows what is left", (await doorRow.textContent()).includes("$9"));

/* 5. Backfill an earlier month on the card page -------------------------- */
const goldId = sql(`select id from perks_card where name='Amex PRG'`);
const uberId = sql(`select id from perks_benefit where name='Uber Cash' and card_id='${goldId}'`);
await page.goto(`${BASE}/dashboard/cards/${goldId}`);
const uberCard = page
  .locator("div.rounded-\\[calc\\(var\\(--radius\\)\\+4px\\)\\]", { hasText: "Uber Cash" })
  .first();
await uberCard.locator('button:has-text("Jan")').click();
check(
  "tapping January records it",
  await until(
    `select used_cents from perks_usage where benefit_id='${uberId}' and period_key='${year}-01'`,
    1000,
  ),
);
await page.waitForSelector('button[aria-pressed="true"]:has-text("Jan")');
await uberCard.locator('button:has-text("Jan")').click();
check(
  "tapping again undoes it",
  await until(
    `select count(*) from perks_usage where benefit_id='${uberId}' and period_key='${year}-01'`,
    0,
  ),
);

/* 6. Stop tracking a credit --------------------------------------------- */
const dunkin = page
  .locator("div.rounded-\\[calc\\(var\\(--radius\\)\\+4px\\)\\]", { hasText: "Dunkin' credit" })
  .first();
await dunkin.locator('button:has-text("Stop tracking")').click();
check(
  "untracked flag stored",
  await until(`select tracked from perks_benefit where name='Dunkin'' credit'`, "f"),
);
await page.goto(`${BASE}/dashboard`);
check("untracked credit is off the dashboard", !(await bodyText()).includes("Dunkin' credit"));

/* 7. Paste offers -------------------------------------------------------- */
await page.goto(`${BASE}/dashboard/offers`);
await page.selectOption("#cardId", goldId);
await page.fill(
  "#paste",
  `lululemon\nSpend $150 or more, get $30 back\nExpires in 5 days\nAdd to Card\nHilton\nSpend $250 or more, get $50 back\nExpires 12/31/${year + 1}\nAdded to Card`,
);
await page.click('button:has-text("Save 2 offers")');
await page.waitForSelector("text=Saved 2 offers");
check("two offers stored", sql(`select count(*) from perks_offer`) === "2");
check(
  "added status and value parsed",
  sql(`select status || ':' || value_cents from perks_offer where merchant='Hilton'`) ===
    "added:5000",
);
await page.fill("#paste", `lululemon\nSpend $150 or more, get $30 back\nExpires in 5 days`);
await page.click('button:has-text("Save 1 offer")');
await page.waitForSelector("text=skipped 1 already saved");
check("pasting again skips duplicates", sql(`select count(*) from perks_offer`) === "2");
await page.goto(`${BASE}/dashboard`);
check(
  "expiring offer appears on the dashboard",
  (await bodyText()).includes("Offers expiring soon"),
);
await page.goto(`${BASE}/dashboard/offers`);
await page.locator("li", { hasText: "lululemon" }).locator('button:has-text("Used")').click();
check(
  "offer marked used",
  await until(`select status from perks_offer where merchant='lululemon'`, "used"),
);

/* 8. Sign-up bonus eligibility ------------------------------------------ */
await page.goto(`${BASE}/dashboard/bonuses`);
body = await bodyText();
check("5/24 count shown", body.includes("1/24"), body.match(/\d+\/24/)?.[0]);
const bonus = (name) =>
  page.locator("div.rounded-\\[calc\\(var\\(--radius\\)\\+4px\\)\\]", { hasText: name }).first();
check(
  "held card is not eligible",
  (await bonus("100,000 points").textContent()).includes(
    "You currently hold Chase Sapphire Reserve",
  ),
);
check(
  "closed Amex card with an NLL offer is a caution",
  (await bonus("Bonvoy Brilliant").textContent()).includes("Check terms"),
);

/* 9. Digest -------------------------------------------------------------- */
const anon = await page.request.get(`${BASE}/api/cron/digest?force=1`);
check("digest endpoint rejects callers without the secret", anon.status() === 401);
const cron = await page.request.get(`${BASE}/api/cron/digest?force=1`, {
  headers: { authorization: `Bearer ${CRON_SECRET}` },
});
const cronBody = await cron.json().catch(() => ({}));
check(
  "digest sends to the one user with cards",
  cron.status() === 200 && cronBody.sent === 1,
  JSON.stringify(cronBody),
);
check("digest date recorded", sql(`select last_digest_on from perks_settings`) === today);
await page.goto(`${BASE}/dashboard/settings`);
await page.click('button:has-text("Turn off")');
check("digest switched off", await until(`select digest_enabled from perks_settings`, "f"));
const cron2 = await page.request.get(`${BASE}/api/cron/digest?force=1`, {
  headers: { authorization: `Bearer ${CRON_SECRET}` },
});
check("no digest once switched off", (await cron2.json()).sent === 0);

/* 10. Other users cannot see the card ------------------------------------ */
const other = await (await browser.newContext()).newPage();
await signup(other, "Eve Other", "eve@example.com");
const resp = await other.goto(`${BASE}/dashboard/cards/${goldId}`);
check("another account gets a 404 for the card", resp.status() === 404, String(resp.status()));
check(
  "another account starts empty",
  (await (await other.goto(`${BASE}/dashboard`), other.innerText("body"))).includes(
    "Add your cards to get started",
  ),
);

await browser.close();
log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
