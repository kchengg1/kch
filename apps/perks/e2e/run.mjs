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
  `truncate "user", perks_push_subscription, perks_referral, perks_spend_target, perks_points, perks_redemption, perks_card, perks_benefit, perks_usage, perks_offer, perks_settings, session, account cascade;`,
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
check("empty dashboard offers the import", (await bodyText()).includes("Import cards"));

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

/* 6b. Catch up: bulk-mark earlier months, then import a statement CSV ----- */
await page.goto(`${BASE}/dashboard/catch-up`);
const month = Number(today.slice(5, 7));
if (month >= 3) {
  // Uber Cash on Amex PRG: every month before this one becomes used in one tap.
  const uberRow = page.locator("li", { hasText: "Uber Cash" }).first();
  await uberRow.locator('button:has-text("earlier periods used")').click();
  check(
    "one tap marks every earlier month used",
    await until(
      `select count(*) from perks_usage where benefit_id='${uberId}' and period_key < '${monthKey}'`,
      month - 1,
    ),
  );
}
const us2 = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const csv = [
  "Date,Description,Amount,Extended Details",
  `${us2(today)},"AMEX DINING CREDIT",-10.00,""`,
  `${us2(today)},"AMEX RESY CREDIT",-50.00,""`,
  `${us2(today)},"GRUBHUB",31.50,""`,
  `${us2(today)},"NORDSTROM RETURN",-40.00,""`,
  `12/15/${year - 1},"AMEX DINING CREDIT",-10.00,""`,
].join("\n");
await page.selectOption("#stmt-card", goldId);
await page.setInputFiles("#stmt-file", {
  name: "activity.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
});
await page.waitForSelector("text=credits found");
body = await bodyText();
check(
  "statement credits listed and matched",
  body.includes("4 credits found, 3 matched"),
  body.match(/\d+ credits found, \d+ matched/)?.[0],
);
await page.click('button:has-text("Save 3 matched credits")');
await page.waitForSelector("text=Skipped 1 from before this year");
const dining = sql(
  `select id from perks_benefit where card_id='${goldId}' and name='Dining credit'`,
);
const resy = sql(`select id from perks_benefit where card_id='${goldId}' and name='Resy credit'`);
check(
  "statement dining credit recorded for this month",
  sql(
    `select used_cents from perks_usage where benefit_id='${dining}' and period_key='${monthKey}'`,
  ) === "1000",
);
check(
  "statement Resy credit recorded for this half",
  sql(`select used_cents from perks_usage where benefit_id='${resy}'`) === "5000",
);
check("form clears after saving", !(await bodyText()).includes("credits found"));
await page.setInputFiles("#stmt-file", {
  name: "activity.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
});
check(
  "the old success message is gone once a new file is chosen",
  !(await bodyText()).includes("Skipped 1"),
);
await page.click('button:has-text("Save 3 matched credits")');
await page.waitForSelector("text=already recorded");
check(
  "re-uploading the same file changes nothing",
  sql(`select count(*) from perks_usage where benefit_id in ('${dining}','${resy}')`) === "2",
);

// Chase file with a Lyft ride refund: Lyft credit is applied in the app, so it is never offered.
const csrId = sql(`select id from perks_card where name='Chase Sapphire Reserve'`);
const chaseCsv = [
  "Transaction Date,Post Date,Description,Category,Type,Amount,Memo",
  `${us2(today)},${us2(today)},LYFT   *RIDE SUN 11AM,Travel,Sale,-18.40,`,
  `${us2(today)},${us2(today)},LYFT   *RIDE SUN 11AM,Travel,Return,18.40,`,
  `${us2(today)},${us2(today)},STARBUCKS,Food & Drink,Sale,-6.10,`,
].join("\n");
await page.selectOption("#stmt-card", csrId);
await page.setInputFiles("#stmt-file", {
  name: "chase.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(chaseCsv),
});
await page.waitForSelector("text=credits found");
const lyftSelect = page.locator('select[aria-label^="Benefit for LYFT"]');
check("a Lyft refund is not matched to a benefit", (await lyftSelect.inputValue()) === "");
check(
  "in-app credits are not offered for statement lines",
  !(await lyftSelect.locator("option").allInnerTexts()).some((o) => /Lyft|DoorDash/.test(o)),
);
check(
  "in-app credits are labelled on the page",
  (await page.locator("li", { hasText: "Lyft credit" }).first().innerText()).includes(
    "Applied in app",
  ),
);

await page.goto(`${BASE}/dashboard`);
check(
  "Overview keeps a Catch up link after credits are logged",
  (await page.locator('a[href="/dashboard/catch-up"]').count()) === 1,
);

/* 6c. Navigation shows where you are ------------------------------------- */
const activeTab = async (path) => {
  await page.goto(`${BASE}${path}`);
  return page.locator('header a[aria-current="page"]').allInnerTexts();
};
check(
  "Overview tab active on the dashboard",
  (await activeTab("/dashboard")).join() === "Overview",
);
check(
  "Cards tab active on a card page",
  (await activeTab(`/dashboard/cards/${goldId}`)).join() === "Cards",
);
check("Cards tab active on Catch up", (await activeTab("/dashboard/catch-up")).join() === "Cards");
check("Offers tab active on Offers", (await activeTab("/dashboard/offers")).join() === "Offers");

/* 6d. Sign-up bonus, card worth, points and application rules ----------- */
const bonusCard = sql(`select id from perks_card where name='Chase Sapphire Reserve'`);
await page.goto(`${BASE}/dashboard/cards/${bonusCard}`);
await page.locator("summary", { hasText: "Sign-up bonus" }).click();
await page.fill("#bonus-text", "100,000 points");
await page.fill("#bonus-msr", "6000");
await page.fill("#bonus-deadline", new Date(Date.UTC(year + 1, 0, 31)).toISOString().slice(0, 10));
await page.fill("#bonus-spent", "1500");
await page
  .locator("form", { has: page.locator("#bonus-msr") })
  .locator('button[type="submit"]')
  .click();
check(
  "sign-up bonus saved",
  await until(
    `select msr_cents || '/' || msr_spent_cents from perks_card where id='${bonusCard}'`,
    "600000/150000",
  ),
);
await page.goto(`${BASE}/dashboard`);
const bonusRow = page.locator("li", { hasText: "100,000 points" });
check(
  "Overview shows the bonus in progress",
  (await bonusRow.innerText()).includes("$4,500 to go"),
);
await bonusRow.locator('input[name="spent"]').fill("6000");
await bonusRow.locator('button:has-text("Update")').click();
await page.waitForSelector("text=requirement met");
check("updating spend to the target marks it met", true);
await page
  .locator("li", { hasText: "100,000 points" })
  .locator('button:has-text("Bonus posted")')
  .click();
check(
  "Bonus posted records the date",
  await until(
    `select (bonus_received_on is not null)::text from perks_card where id='${bonusCard}'`,
    "true",
  ),
);

// Is it worth it: value Uber Cash at $0 on the gold card.
await page.goto(`${BASE}/dashboard/cards/${goldId}`);
await page.locator("summary", { hasText: "Is it worth the" }).click();
await page.getByLabel("Worth to me per year: Uber Cash").fill("0");
await page.locator('button:has-text("Save values")').click();
check(
  "a benefit's worth-to-me value is saved",
  await until(
    `select my_value_cents from perks_benefit where card_id='${goldId}' and name='Uber Cash'`,
    0,
  ),
);
await page.reload();
check(
  "the card shows advertised value against worth to you",
  /Advertised \$[\d,]+ a year, worth \$[\d,]+ to you/.test(
    await page.locator("summary", { hasText: "Is it worth the" }).innerText(),
  ),
);

// Points: paste balances from the sheet, check an award, log it.
await page.goto(`${BASE}/dashboard/points`);
await page.fill(
  'textarea[name="balances"]',
  "American Express Membership Rewards\t270520\nMarriott Rewards\t1000",
);
await page.click('button:has-text("Update balances")');
await page.waitForSelector("text=Updated 2 balances");
check(
  "pasted balances get the sheet's values",
  sql(
    `select string_agg(program || '=' || cents_per_point_x100, ',' order by program) from perks_points`,
  ) === "American Express Membership Rewards=200,Marriott Bonvoy=85",
);
await page.reload();
check("total portfolio value shown", (await bodyText()).includes("worth about $5,419"));
await page.selectOption("#calc-program", "Marriott Bonvoy");
await page.fill("#calc-cash", "2300");
await page.fill("#calc-points", "318000");
await page.waitForSelector("text=Pay cash");
check("the sheet's Marriott example says pay cash", (await bodyText()).includes("0.72¢ per point"));
await page.click('button:has-text("Log as a redemption I made")');
await page.waitForSelector("text=Logged.");
check("redemption logged", sql(`select points from perks_redemption`) === "318000");

// Application rules from card history.
await page.goto(`${BASE}/dashboard/bonuses`);
check("application rules listed", (await bodyText()).includes("Bank of America 2/3/4"));

/* 6e. Card picker, spending goals, notifications, referrals -------------- */
await page.goto(`${BASE}/dashboard`);
check(
  "the card picker is not on the Overview",
  !(await page.locator('form[action="/dashboard/pick"]').count()),
);
await page.goto(`${BASE}/dashboard/cards`);
await page.fill('input[name="q"]', "Whole Foods");
await Promise.all([
  page.waitForURL("**/dashboard/pick?q=*"),
  page.click('form[action="/dashboard/pick"] button'),
]);
let picked = await page.locator("main ol > li").allInnerTexts();
check(
  "the picker counts Whole Foods as groceries",
  (await bodyText()).includes("counts as groceries"),
);
check(
  "Amex Gold wins at the supermarket",
  picked[0]?.includes("Amex PRG") && picked[0]?.includes("8%"),
  picked[0],
);
await page.goto(`${BASE}/dashboard/pick?q=Hyatt%20Regency`);
picked = await page.locator("main ol > li").allInnerTexts();
check(
  "the picker ranks a hotel booking",
  picked.length >= 2 && picked[0].includes("Best"),
  picked[0],
);

await page.goto(`${BASE}/dashboard`);
const goal = page.locator("li", { hasText: "$75,000 spend perks" });
check("Sapphire Reserve gets its $75,000 spending goal", (await goal.count()) === 1);
await goal.locator('input[name="spent"]').fill("12500");
await goal.locator('button:has-text("Update")').click();
check(
  "spending toward the goal is saved for this year",
  await until(
    `select spent_cents || '/' || period_key from perks_spend_target where name='$75,000 spend perks'`,
    `1250000/${year}`,
  ),
);

await page.goto(`${BASE}/dashboard/cards`);
check(
  "card rows say what's inside and that they open",
  (await page.locator('a[aria-label^="Chase Sapphire Reserve: see credits"]').innerText()).includes(
    "credits",
  ),
);

/* Year-end checklist ---------------------------------------------------- */
// Make the Gold card look like it was set up from an older catalog.
sql(
  `update perks_benefit set cadence='annual', amount_cents=10000 where name='Resy credit'; delete from perks_benefit where name='4x restaurants and U.S. supermarkets';`,
);
if (Number(today.slice(5, 7)) >= 11) {
  await page.goto(`${BASE}/dashboard`);
  check(
    "overview links the year-end checklist in November and December",
    (await page.locator('a[href="/dashboard/year-end"]').count()) === 1,
  );
}
await page.goto(`${BASE}/dashboard/year-end`);
body = await bodyText();
check("year-end page lists credits to use", body.includes("Use before December 31"));
check("calendar credits are on it", body.includes("The Edit hotel credit"));
check("cardmember-year credits are kept apart", body.includes("No rush"));
check("spend caps per card", body.includes("4x at U.S. supermarkets on up to $25,000"));
check("referral limits reset", body.includes("Referral limits reset January 1"));
check(
  "suggests a December double dip on a card not held",
  body.includes("Amex Business Platinum") && body.includes("Good in December"),
);
check("offers the catalog changes", body.includes("Changed: Resy credit"));
await page
  .locator("li", { hasText: "Changed: Resy credit" })
  .locator('button:has-text("Apply")')
  .click();
check(
  "applying catalog changes fixes the credit",
  await until(
    `select cadence || '/' || amount_cents from perks_benefit where name='Resy credit'`,
    "semiannual/5000",
  ),
);
check(
  "and restores the missing one",
  await until(
    `select count(*) from perks_benefit where name='4x restaurants and U.S. supermarkets'`,
    "1",
  ),
);

await page.goto(`${BASE}/dashboard/settings`);
check("Settings offers phone notifications", (await bodyText()).includes("Phone notifications"));
check(
  "push signing keys are created on first use",
  sql(`select count(*) from perks_vapid`) === "1",
);

await page.goto(`${BASE}/dashboard/bonuses`);
await page.selectOption("#ref-card", "chase-sapphire-reserve");
await page.fill("#ref-url", "https://www.referyourchasecard.com/19/EXAMPLE");
await page.fill("#ref-reward", "10,000 points");
await page.click('button:has-text("Share link")');
await page.waitForSelector("text=Shared your Chase Sapphire Reserve link.");
check(
  "a referral link is saved",
  sql(`select card_name from perks_referral`) === "Chase Sapphire Reserve",
);

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
check(
  "the paste is recorded on the card even when nothing new was found",
  sql(
    `select (offers_checked_at > now() - interval '5 minutes')::text from perks_card where id='${goldId}'`,
  ) === "true",
);
await page.goto(`${BASE}/dashboard/offers`);
check(
  "Offers shows when each card was last pasted",
  (await page.locator("li", { hasText: "Amex PRG" }).first().innerText()).includes("updated today"),
);
check(
  "a card never pasted is flagged",
  (await page.locator("li", { hasText: "Chase Sapphire Reserve" }).first().innerText()).includes(
    "never pasted",
  ),
);
await page.goto(`${BASE}/dashboard`);
check(
  "expiring offer appears on the dashboard",
  (await bodyText()).includes("Offers expiring soon"),
);
await page.goto(`${BASE}/dashboard/offers`);
// The same offer on a second card is shown once, with a chip per card.
const csrCard = sql(`select id from perks_card where name='Chase Sapphire Reserve'`);
await page.selectOption("#cardId", csrCard);
await page.fill("#paste", `lululemon\nSpend $150 or more, get $30 back\nExpires in 5 days`);
await page.click('button:has-text("Save 1 offer")');
await page.waitForSelector("text=Saved 1 offer");
check(
  "same offer saved for the second card",
  sql(`select count(*) from perks_offer where merchant='lululemon'`) === "2",
);
const lulu = page
  .locator("li", { hasText: "lululemon" })
  .filter({ has: page.locator('button:has-text("Used")') });
check("an offer on two cards is listed once", (await lulu.count()) === 1);
check("it shows a chip for each card", (await lulu.locator("button[aria-pressed]").count()) === 2);
await lulu.locator('button[aria-pressed]:has-text("Chase Sapphire Reserve")').click();
check(
  "tapping a card chip marks the offer added on that card only",
  await until(
    `select status from perks_offer where merchant='lululemon' and card_id='${csrCard}'`,
    "added",
  ),
);
check(
  "the other card is unchanged",
  sql(`select status from perks_offer where merchant='lululemon' and card_id='${goldId}'`) ===
    "available",
);
await page.locator("li", { hasText: "lululemon" }).locator('button:has-text("Used")').click();
check(
  "Used applies to the offer on every card",
  await until(
    `select string_agg(distinct status, ',') from perks_offer where merchant='lululemon'`,
    "used",
  ),
);

// Offers are scored by return, weak ones collapse, and merchants can be hidden.
await page.goto(`${BASE}/dashboard/offers`);
await page.selectOption("#cardId", goldId);
await page.fill(
  "#paste",
  [
    "Misfits Market",
    "Spend $5 or more, earn $5 back",
    "Expires 12/31/26",
    "St. Regis",
    "Spend $1,000 or more, earn $200 back",
    "Expires 12/31/26",
    "dyson.com",
    "Earn 2% back on purchases, up to a total of $250",
    "Expires 12/31/26",
  ].join("\n"),
);
await page.waitForSelector("text=100% back");
await page.click('button:has-text("Save 3 offers")');
await page.waitForSelector("text=Saved 3 offers");
await page.goto(`${BASE}/dashboard/offers`);
const order = await page.locator("section ul > li p.font-medium").allInnerTexts();
check(
  "best return first: $5 on $5 beats $200 on $1,000",
  order.findIndex((t) => t.includes("Misfits")) < order.findIndex((t) => t.includes("St. Regis")),
  order.join(" | "),
);
check(
  "an offer under 10% back is tucked away",
  (await page.locator("details", { hasText: "weaker offer" }).innerText()).includes(
    "1 weaker offer",
  ),
);
await page.goto(`${BASE}/dashboard/offers?sort=value`);
const byValue = await page.locator("section ul > li p.font-medium").allInnerTexts();
check(
  "sorting by biggest reward puts St. Regis first",
  byValue[0]?.includes("St. Regis"),
  byValue[0],
);
await page
  .locator("li", { hasText: "St. Regis" })
  .locator('button:has-text("Not interested")')
  .click();
check(
  "Not interested stores the merchant",
  await until(`select label from perks_hidden_merchant`, "St. Regis"),
);
await page.waitForFunction(
  () => !document.querySelector("section")?.innerText.includes("Spend $1,000"),
);
check(
  "its offers disappear",
  !(await page.locator("section").first().innerText()).includes("Spend $1,000"),
);
await page.fill("#paste", "St. Regis\nSpend $1,000 or more, earn $200 back\nExpires 1/31/27");
await page.waitForSelector("text=will be skipped");
await page.click('button:has-text("Save 1 offer")');
await page.waitForSelector("text=left out 1 from merchants you hid");
check(
  "future pastes of a hidden merchant are kept out of sight",
  sql(`select status from perks_offer where merchant='St. Regis' and expires_on='2027-01-31'`) ===
    "hidden",
);
await page.locator("summary", { hasText: "not interested" }).click();
await page.locator('button:has-text("Show again")').click();
check(
  "Show again brings the merchant back",
  await until(`select count(*) from perks_hidden_merchant`, 0),
);
check(
  "offers pasted while hidden come back",
  await until(
    `select status from perks_offer where merchant='St. Regis' and expires_on='2027-01-31'`,
    "available",
  ),
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

// A second person imports a plain typed list of cards, no spreadsheet.
await other.goto(`${BASE}/dashboard/cards/import`);
await other.fill(
  'textarea[name="sheet"]',
  "Chase Sapphire Pref\nAmex Gold Personal, 2/2024\nChase Freedom Flex\nCiti Double Cash",
);
await other.waitForSelector("text=4 open cards");
await Promise.all([
  other.waitForURL("**/dashboard/cards"),
  other.click('button:has-text("Import 4 cards")'),
]);
const eveId = sql(`select id from "user" where email='eve@example.com'`);
check(
  "a typed list imports for the second person",
  sql(`select count(*) from perks_card where user_id='${eveId}'`) === "4",
);
check(
  "listed cards get their credits",
  sql(
    `select count(*) from perks_benefit b join perks_card c on c.id=b.card_id where c.user_id='${eveId}' and c.name='Chase Sapphire Pref' and b.name='Chase Travel hotel credit'`,
  ) === "1",
);
check(
  "an opened month is kept",
  sql(`select opened_on from perks_card where user_id='${eveId}' and name='Amex Gold Personal'`) ===
    "2024-02-01",
);
check(
  "the first person's cards are untouched",
  sql(
    `select count(*) from perks_card c join "user" u on u.id=c.user_id where u.email='owner@example.com'`,
  ) === "4",
);

// The second person sees the first person's referral on the matching bonus.
await other.goto(`${BASE}/dashboard/bonuses`);
check(
  "others see the group's referral link on the bonus",
  (await other.locator('a:has-text("Apply with Sam’s referral")').count()) >= 1,
);

// Group rankings: both people hold an Amex Gold, so each card page compares them.
const eveGold = sql(
  `select c.id from perks_card c join "user" u on u.id = c.user_id where u.email='eve@example.com' and c.template_key='amex-gold'`,
);
await other.goto(`${BASE}/dashboard/cards/${eveGold}`);
let otherBody = await other.innerText("body");
check(
  "people with the same card see how they rank",
  otherBody.includes("How you compare on this card") &&
    otherBody.includes("Sam") &&
    /1st\s*Sam/.test(otherBody),
);
await page.goto(`${BASE}/dashboard/settings`);
await page.click('button:has-text("Stop sharing my totals")');
check(
  "opting out is saved",
  await until(
    `select share_rankings from perks_settings s join "user" u on u.id=s.user_id where u.email='owner@example.com'`,
    "f",
  ),
);
await other.reload();
check(
  "an opted-out person disappears from rankings",
  !(await other.innerText("body")).includes("How you compare"),
);

/* 11. Phone layout ------------------------------------------------------- */
const phone = await (
  await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
).newPage();
await signup(phone, "Pat Phone", "phone@example.com");
const tabBar = phone.getByRole("navigation", { name: "Sections" });
check("phone shows the bottom tab bar", await tabBar.isVisible());
for (const label of ["Overview", "Cards", "Offers", "Points", "Bonuses", "Settings"]) {
  check(
    `${label} is reachable on a phone`,
    await tabBar.getByRole("link", { name: label }).isVisible(),
  );
}
check(
  "nothing scrolls sideways on a phone",
  (await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390,
);
// Swiping offers on a phone: left skips, right marks used, Undo restores.
await phone.goto(`${BASE}/dashboard/cards/import`);
await phone.fill('textarea[name="sheet"]', "Amex Gold Personal");
await Promise.all([
  phone.waitForURL("**/dashboard/cards"),
  phone.click('button:has-text("Import 1 card")'),
]);
await phone.goto(`${BASE}/dashboard/offers`);
await phone.fill(
  "#paste",
  "Walmart.com\nSpend $50 or more, earn $10 back\nExpires 12/31/26\nJetBlue\nSpend $200 or more, earn $40 back\nExpires 12/31/26",
);
await phone.click('button:has-text("Save 2 offers")');
await phone.waitForSelector("text=Saved 2 offers");
await phone.goto(`${BASE}/dashboard/offers`);
const swipe = async (merchant, distance) => {
  const rowEl = phone.locator("li[data-swipe-row]", { hasText: merchant });
  const box = await rowEl.boundingBox();
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  const ev = (type, clientX) =>
    rowEl.dispatchEvent(type, {
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      bubbles: true,
      clientX,
      clientY: y,
    });
  await ev("pointerdown", x);
  for (let step = 1; step <= 6; step++) await ev("pointermove", x + (distance * step) / 6);
  await ev("pointerup", x + distance);
};
const phoneUser = sql(`select id from "user" where email='phone@example.com'`);
const status = (m) =>
  sql(`select status from perks_offer where user_id='${phoneUser}' and merchant='${m}'`);
await swipe("Walmart.com", -300);
check(
  "swiping left skips the offer",
  await until(
    `select status from perks_offer where user_id='${phoneUser}' and merchant='Walmart.com'`,
    "dismissed",
  ),
);
await phone.getByRole("status").getByRole("button", { name: "Undo" }).click();
check(
  "Undo puts it back",
  await until(
    `select status from perks_offer where user_id='${phoneUser}' and merchant='Walmart.com'`,
    "available",
  ),
);
await phone.waitForSelector("li[data-swipe-row]:has-text('Walmart.com')");
await swipe("JetBlue", 300);
check(
  "swiping right marks it used",
  await until(
    `select status from perks_offer where user_id='${phoneUser}' and merchant='JetBlue'`,
    "used",
  ),
);
await swipe("Walmart.com", -40);
await phone.waitForTimeout(500);
check("a short swipe does nothing", status("Walmart.com") === "available");
const manifest = await phone.request.get(`${BASE}/manifest.webmanifest`);
check(
  "home-screen manifest is served",
  manifest.status() === 200 && (await manifest.json()).display === "standalone",
);

/* 12. Mobile JSON API (cookie-free Bearer auth) -------------------------- */
const unauthBoot = await fetch(`${BASE}/api/mobile/bootstrap`);
check("mobile bootstrap rejects unauthenticated callers", unauthBoot.status === 401);
const unauthAct = await fetch(`${BASE}/api/mobile/action`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "settings.setDigest", enabled: true }),
});
check("mobile action rejects unauthenticated callers", unauthAct.status === 401);

const mobileSignIn = async (email) => {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "perks://app" },
    body: JSON.stringify({ email, password: "supersecret123" }),
  });
  const headerToken = res.headers.get("set-auth-token");
  const json = await res.json();
  return { status: res.status, token: headerToken || json.token };
};

const ownerLogin = await mobileSignIn("owner@example.com");
check(
  "mobile sign-in issues a bearer token",
  ownerLogin.status === 200 && Boolean(ownerLogin.token),
);

const mobileGet = (token) =>
  fetch(`${BASE}/api/mobile/bootstrap`, {
    headers: { authorization: `Bearer ${token}` },
  });
const mobilePost = (token, payload) =>
  fetch(`${BASE}/api/mobile/action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

const bootRes = await mobileGet(ownerLogin.token);
const boot = await bootRes.json();
check(
  "mobile bootstrap returns the caller's cards and points",
  bootRes.status === 200 &&
    boot.user.email === "owner@example.com" &&
    boot.cards.length === 4 &&
    boot.points.balances.length === 2,
);

const addVentureRes = await mobilePost(ownerLogin.token, {
  type: "card.add",
  template: "capital-one-venture-x",
  openedOn: `${year}-01-15`,
});
const addVenture = await addVentureRes.json();
check(
  "mobile action adds a template card and returns fresh bootstrap",
  addVentureRes.status === 200 &&
    Boolean(addVenture.cardId) &&
    addVenture.bootstrap.cards.length === 5,
);

const pasteMobRes = await mobilePost(ownerLogin.token, {
  type: "offers.paste",
  cardId: addVenture.cardId,
  text: `REI\nSpend $100 or more, get $20 back\nExpires 12/31/${year + 1}`,
});
const pasteMob = await pasteMobRes.json();
check(
  "mobile action parses and saves pasted offers",
  pasteMobRes.status === 200 && pasteMob.bootstrap.offers.strong.some((g) => g.merchant === "REI"),
);

// Another user's bearer token cannot see or delete the owner's card.
const eveLogin = await mobileSignIn("eve@example.com");
const eveBoot = await (await mobileGet(eveLogin.token)).json();
check(
  "another mobile user only sees their own cards",
  eveBoot.user.email === "eve@example.com" &&
    !eveBoot.cards.some((c) => c.id === addVenture.cardId),
);
await mobilePost(eveLogin.token, { type: "card.delete", id: addVenture.cardId });
check(
  "another mobile user cannot delete the owner's card",
  sql(`select count(*) from perks_card where id='${addVenture.cardId}'`) === "1",
);

const signOutRes = await fetch(`${BASE}/api/auth/sign-out`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "perks://app",
    authorization: `Bearer ${eveLogin.token}`,
  },
  body: "{}",
});
check("mobile bearer sign-out succeeds", signOutRes.status === 200);
check("signed-out bearer token is rejected", (await mobileGet(eveLogin.token)).status === 401);

await browser.close();
log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
