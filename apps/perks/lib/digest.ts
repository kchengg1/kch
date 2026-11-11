import "server-only";
import { sendEmail, type EmailContent } from "@kch/email";
import { appConfig } from "@/app.config";
import { formatCents } from "./money";
import { listOffers, loadPortfolio } from "./perks";
import { daysBetween, formatDate } from "./periods";
import { actionable, buildStatuses, type BenefitStatus } from "./summary";

/** Credits ending within this many days make it into the email. */
export const DIGEST_WINDOW_DAYS = 21;
export const OFFER_WINDOW_DAYS = 10;

export type DigestOffer = {
  merchant: string;
  details: string;
  expiresOn: string;
  cardName: string | null;
};

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const due = (days: number) => (days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

/** Pure: builds the email from what is expiring. Null when there is nothing to say. */
export function buildDigest(
  credits: BenefitStatus[],
  offers: DigestOffer[],
  today: string,
): EmailContent | null {
  if (credits.length === 0 && offers.length === 0) return null;
  const total = credits.reduce((sum, c) => sum + c.remainingCents, 0);
  const creditLine = (c: BenefitStatus) =>
    `${c.remainingCents > 0 ? `${formatCents(c.remainingCents)} ` : ""}${c.benefit.name} (${c.card.name}), ends ${formatDate(c.deadline!, today)}, ${due(c.daysLeft!)}`;
  const offerLine = (o: DigestOffer) =>
    `${o.merchant}: ${o.details}${o.cardName ? ` (${o.cardName})` : ""}, expires ${formatDate(o.expiresOn, today)}, ${due(daysBetween(today, o.expiresOn))}`;

  const subject =
    credits.length > 0
      ? `${formatCents(total)} in card credits to use soon`
      : `${offers.length} card offer${offers.length === 1 ? "" : "s"} expiring soon`;
  const url = `${appConfig.url}/dashboard`;

  const text = [
    credits.length ? `Credits to use:\n${credits.map((c) => `- ${creditLine(c)}`).join("\n")}` : "",
    offers.length ? `Offers expiring:\n${offers.map((o) => `- ${offerLine(o)}`).join("\n")}` : "",
    `Mark them off: ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const list = (title: string, items: string[]) =>
    items.length
      ? `<h3 style="margin:24px 0 8px;font-size:15px">${title}</h3><ul style="margin:0;padding-left:20px;line-height:1.6">${items
          .map((i) => `<li>${escape(i)}</li>`)
          .join("")}</ul>`
      : "";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1c2030;max-width:560px">
<h2 style="font-size:18px;margin:0">${escape(subject)}</h2>
${list("Credits to use", credits.map(creditLine))}
${list("Offers expiring", offers.map(offerLine))}
<p style="margin-top:24px"><a href="${url}">Open ${escape(appConfig.name)}</a> to mark them off.</p>
</div>`;

  return { subject, html, text };
}

/** Gather what is expiring for one user and email it. Returns false when there was nothing to send. */
export async function sendDigest(
  user: { id: string; email: string; name: string },
  today: string,
): Promise<boolean> {
  const [{ cards, benefits, usage }, offers] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
  ]);
  const credits = actionable(buildStatuses(cards, benefits, usage, today)).filter(
    (s) => s.daysLeft !== null && s.daysLeft <= DIGEST_WINDOW_DAYS,
  );
  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  const expiring = offers
    .filter(
      (o) =>
        (o.status === "available" || o.status === "added") &&
        o.expiresOn !== null &&
        o.expiresOn >= today &&
        daysBetween(today, o.expiresOn) <= OFFER_WINDOW_DAYS,
    )
    .map((o) => ({
      merchant: o.merchant,
      details: o.details,
      expiresOn: o.expiresOn!,
      cardName: o.cardId ? (cardName.get(o.cardId) ?? null) : null,
    }));
  const content = buildDigest(credits, expiring, today);
  if (!content) return false;
  await sendEmail({ to: user.email, ...content });
  return true;
}

/** Digests go out every Monday, plus the 25th as a last call for monthly credits. */
export function isDigestDay(today: string): boolean {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1 || d === 25;
}
