import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  and,
  db,
  eq,
  inArray,
  perksBenefit,
  perksCard,
  perksHiddenMerchant,
  perksOffer,
  perksPoints,
  perksRedemption,
  perksReferral,
  perksSettings,
  perksSpendTarget,
  perksUsage,
} from "@kch/db";
import { getTemplate, onStatement } from "@/lib/catalog";
import { catalogUpdates, templateRow, updateCount } from "@/lib/catalog-sync";
import { sendDigest } from "@/lib/digest";
import { parseMobileAction, type MobileAction, type MobileActionResponse } from "@/lib/mobile-api";
import { getMobileUser, loadMobileBootstrap, type MobileUser } from "@/lib/mobile-server";
import { merchantKey } from "@/lib/offer-groups";
import { offerKey, parseOffers } from "@/lib/offer-parse";
import {
  addTemplateBenefits,
  getBenefit,
  getCard,
  listHiddenMerchants,
  listOffers,
  listPoints,
  loadPortfolio,
  otherUserIds,
  today,
} from "@/lib/perks";
import { currentPeriod, isCadence, periodsThisYear } from "@/lib/periods";
import { defaultCentsPerPoint, parseBalances } from "@/lib/points";
import { sendPush } from "@/lib/push";
import { parseCardSheet, parseSheetDate } from "@/lib/sheet-import";
import { parseStatementCsv, suggestBenefit } from "@/lib/statement-import";

async function setUsage(benefitId: string, userId: string, periodKey: string, usedCents: number) {
  await db
    .insert(perksUsage)
    .values({ id: crypto.randomUUID(), benefitId, userId, periodKey, usedCents })
    .onConflictDoUpdate({
      target: [perksUsage.benefitId, perksUsage.periodKey],
      set: { usedCents, updatedAt: new Date() },
    });
}

async function ownedPeriod(userId: string, benefitId: string, periodKey: string) {
  const benefit = await getBenefit(benefitId, userId);
  if (!benefit || !isCadence(benefit.cadence)) return null;
  const card = await getCard(benefit.cardId, userId);
  if (!card) return null;
  const now = today();
  const valid = [
    ...periodsThisYear(benefit.cadence, now, card.openedOn),
    currentPeriod(benefit.cadence, now, card.openedOn),
  ].some((p) => p?.key === periodKey);
  return valid ? benefit : null;
}

async function runAction(
  user: MobileUser,
  action: MobileAction,
): Promise<{ error: string; status?: number } | Omit<MobileActionResponse, "ok" | "bootstrap">> {
  switch (action.type) {
    case "usage.markUsed": {
      const benefit = await ownedPeriod(user.id, action.benefitId, action.periodKey);
      if (!benefit) return { error: "Benefit or period not found.", status: 404 };
      await setUsage(benefit.id, user.id, action.periodKey, benefit.amountCents);
      return {};
    }

    case "usage.clearUsed": {
      const benefit = await ownedPeriod(user.id, action.benefitId, action.periodKey);
      if (!benefit) return { error: "Benefit or period not found.", status: 404 };
      await db
        .delete(perksUsage)
        .where(
          and(
            eq(perksUsage.benefitId, benefit.id),
            eq(perksUsage.periodKey, action.periodKey),
            eq(perksUsage.userId, user.id),
          ),
        );
      return {};
    }

    case "usage.logAmount": {
      const benefit = await ownedPeriod(user.id, action.benefitId, action.periodKey);
      if (!benefit) return { error: "Benefit or period not found.", status: 404 };
      await setUsage(
        benefit.id,
        user.id,
        action.periodKey,
        Math.min(action.amountCents, benefit.amountCents),
      );
      return {};
    }

    case "usage.markPastUsed": {
      const benefit = await getBenefit(action.benefitId, user.id);
      if (!benefit || !isCadence(benefit.cadence) || benefit.amountCents === 0) {
        return { error: "Benefit not found.", status: 404 };
      }
      const card = await getCard(benefit.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      const now = today();
      const past = periodsThisYear(benefit.cadence, now, card.openedOn).filter((p) => p.end < now);
      if (past.length > 0) {
        await db
          .insert(perksUsage)
          .values(
            past.map((p) => ({
              id: crypto.randomUUID(),
              benefitId: benefit.id,
              userId: user.id,
              periodKey: p.key,
              usedCents: benefit.amountCents,
            })),
          )
          .onConflictDoNothing({ target: [perksUsage.benefitId, perksUsage.periodKey] });
      }
      return {};
    }

    case "statement.preview": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      const parsed = parseStatementCsv(action.csv);
      if (parsed.error) return { error: parsed.error };
      const now = today();
      const { benefits } = await loadPortfolio(user.id);
      const eligible = benefits
        .filter(
          (b) =>
            b.cardId === card.id &&
            b.tracked &&
            b.cadence !== "perk" &&
            b.amountCents > 0 &&
            !(b.endsOn && b.endsOn < now) &&
            onStatement(card.templateKey, b.name),
        )
        .map((b) => ({ id: b.id, name: b.name }));
      return {
        statementPreview: {
          charges: parsed.charges,
          benefits: eligible,
          rows: parsed.credits.map((c) => ({
            date: c.date,
            description: c.description,
            amountCents: c.amountCents,
            suggestedBenefitId: suggestBenefit(c.description, eligible)?.id ?? null,
          })),
        },
      };
    }

    case "usage.saveStatementCredits": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Pick the card this statement is for.", status: 404 };
      const { benefits, usage } = await loadPortfolio(user.id);
      const cardBenefits = new Map(
        benefits.filter((b) => b.cardId === card.id).map((b) => [b.id, b]),
      );
      const existing = new Map(usage.map((u) => [`${u.benefitId}|${u.periodKey}`, u.usedCents]));
      const now = today();
      const totals = new Map<
        string,
        { benefitId: string; periodKey: string; cents: number; cap: number }
      >();
      let outside = 0;

      for (const row of action.credits) {
        const benefit = cardBenefits.get(row.benefitId);
        const date = parseSheetDate(row.date);
        const cents = row.amountCents;
        if (!benefit || !date || !Number.isInteger(cents) || cents <= 0) continue;
        if (!isCadence(benefit.cadence) || benefit.cadence === "perk") continue;
        const period = currentPeriod(benefit.cadence, date, card.openedOn);
        const valid = [
          ...periodsThisYear(benefit.cadence, now, card.openedOn),
          currentPeriod(benefit.cadence, now, card.openedOn),
        ].some((p) => p?.key === period?.key);
        if (!period || !valid || date > now) {
          outside++;
          continue;
        }
        const key = `${benefit.id}|${period.key}`;
        const entry = totals.get(key) ?? {
          benefitId: benefit.id,
          periodKey: period.key,
          cents: 0,
          cap: benefit.amountCents,
        };
        entry.cents += cents;
        totals.set(key, entry);
      }

      if (totals.size === 0) {
        return {
          error: outside
            ? `None of the matched credits fall in the tracker's current periods (${outside} from earlier years skipped).`
            : "Match at least one credit to a benefit before saving.",
        };
      }

      let changed = 0;
      for (const [key, t] of totals) {
        const usedCents = Math.max(existing.get(key) ?? 0, Math.min(t.cents, t.cap));
        if (usedCents === existing.get(key)) continue;
        await setUsage(t.benefitId, user.id, t.periodKey, usedCents);
        changed++;
      }
      const skipped = outside ? ` Skipped ${outside} from before this year.` : "";
      return {
        message:
          changed === 0
            ? `Everything in this file was already recorded.${skipped}`
            : `Updated ${changed} credit period${changed === 1 ? "" : "s"} on ${card.name}.${skipped}`,
      };
    }

    case "card.add": {
      const template = getTemplate(action.templateKey);
      const name = action.name || template?.name || "";
      if (!name) return { error: "Pick a card from the list or give it a name." };
      const annualFeeCents =
        action.annualFeeCents !== null ? action.annualFeeCents : (template?.annualFee ?? 0) * 100;
      const id = crypto.randomUUID();
      await db.insert(perksCard).values({
        id,
        userId: user.id,
        name,
        issuer: template?.issuer ?? action.issuer,
        templateKey: template?.key ?? null,
        business: template?.business ?? Boolean(action.business),
        annualFeeCents,
        openedOn: action.openedOn,
      });
      if (template) await addTemplateBenefits(id, user.id, template.key);
      return { cardId: id, message: `Added ${name}.` };
    }

    case "card.update": {
      const current = await getCard(action.id, user.id);
      if (!current) return { error: "Card not found.", status: 404 };
      await db
        .update(perksCard)
        .set({
          name: action.name,
          issuer: action.issuer,
          annualFeeCents: action.annualFeeCents,
          openedOn: action.openedOn,
          business: action.business,
          closed: action.closed,
          closedOn: action.closed ? (current.closedOn ?? today()) : null,
        })
        .where(and(eq(perksCard.id, action.id), eq(perksCard.userId, user.id)));
      return { message: "Saved." };
    }

    case "card.delete": {
      await db
        .delete(perksCard)
        .where(and(eq(perksCard.id, action.id), eq(perksCard.userId, user.id)));
      return { message: "Card deleted." };
    }

    case "card.applyTemplate": {
      const card = await getCard(action.id, user.id);
      const template = getTemplate(action.templateKey);
      if (!card || !template) return { error: "Card or template not found.", status: 404 };
      await db
        .update(perksCard)
        .set({ templateKey: template.key })
        .where(and(eq(perksCard.id, card.id), eq(perksCard.userId, user.id)));
      await addTemplateBenefits(card.id, user.id, template.key);
      return { message: `Added ${template.name} credits.` };
    }

    case "card.applyCatalogUpdates": {
      const card = await getCard(action.cardId, user.id);
      if (!card?.templateKey) return { error: "Card or catalog template not found.", status: 404 };
      const benefits = await db
        .select()
        .from(perksBenefit)
        .where(and(eq(perksBenefit.cardId, card.id), eq(perksBenefit.userId, user.id)));
      const updates = catalogUpdates(card.templateKey, benefits);
      const count = updateCount(updates);
      if (updates.removed.length > 0) {
        await db.delete(perksBenefit).where(
          and(
            eq(perksBenefit.userId, user.id),
            inArray(
              perksBenefit.id,
              updates.removed.map((b) => b.id),
            ),
          ),
        );
      }
      const nextOrder = benefits.reduce((n, b) => Math.max(n, b.sortOrder + 1), 0);
      if (updates.added.length > 0) {
        await db.insert(perksBenefit).values(
          updates.added.map((t, i) => ({
            id: crypto.randomUUID(),
            cardId: card.id,
            userId: user.id,
            sortOrder: nextOrder + i,
            ...templateRow(t),
          })),
        );
      }
      for (const { benefit, template } of updates.changed) {
        const row = templateRow(template);
        await db
          .update(perksBenefit)
          .set({
            cadence: row.cadence,
            amountCents: row.amountCents,
            endsOn: row.endsOn,
            notes: row.notes,
          })
          .where(and(eq(perksBenefit.id, benefit.id), eq(perksBenefit.userId, user.id)));
      }
      return {
        message:
          count > 0
            ? `Applied ${count} catalog update${count === 1 ? "" : "s"} to ${card.name}.`
            : `${card.name} is already up to date.`,
      };
    }

    case "card.importSheet": {
      const { cards, error } = parseCardSheet(action.sheet);
      if (error) return { error };
      const { cards: existing } = await loadPortfolio(user.id);
      const byKey = new Map(
        existing.map((c) => [`${c.name.toLowerCase()}|${c.openedOn ?? ""}`, c]),
      );
      const have = new Set(byKey.keys());
      let added = 0;
      let updated = 0;
      for (const card of cards) {
        const key = `${card.name.toLowerCase()}|${card.openedOn ?? ""}`;
        const prior = byKey.get(key);
        if (prior && prior.msrCents === null && card.msrCents) {
          await db
            .update(perksCard)
            .set({
              msrCents: card.msrCents,
              msrDeadline: card.msrDeadline ?? null,
              msrSpentCents: card.msrSpentCents ?? 0,
              bonusText: card.bonusText ?? "",
              bonusReceivedOn: card.bonusReceivedOn ?? null,
            })
            .where(and(eq(perksCard.id, prior.id), eq(perksCard.userId, user.id)));
          updated++;
        }
        if (have.has(key)) continue;
        have.add(key);
        const id = crypto.randomUUID();
        await db.insert(perksCard).values({ id, userId: user.id, ...card });
        if (card.templateKey && !card.closed) {
          await addTemplateBenefits(id, user.id, card.templateKey);
        }
        added++;
      }
      if (added === 0) {
        return {
          message: updated
            ? `No new cards, but added sign-up bonus details to ${updated} card${updated === 1 ? "" : "s"}.`
            : "Every card in that list is already here.",
        };
      }
      return { message: `Imported ${added} card${added === 1 ? "" : "s"}.` };
    }

    case "benefit.add": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      await db.insert(perksBenefit).values({
        id: crypto.randomUUID(),
        cardId: card.id,
        userId: user.id,
        sortOrder: 1000,
        name: action.name,
        cadence: action.cadence,
        amountCents: action.amountCents,
        notes: action.notes,
        enrollRequired: action.enrollRequired,
        endsOn: action.endsOn,
      });
      return { message: "Added." };
    }

    case "benefit.update": {
      await db
        .update(perksBenefit)
        .set({
          name: action.name,
          cadence: action.cadence,
          amountCents: action.amountCents,
          notes: action.notes,
          enrollRequired: action.enrollRequired,
          endsOn: action.endsOn,
        })
        .where(and(eq(perksBenefit.id, action.id), eq(perksBenefit.userId, user.id)));
      return { message: "Saved." };
    }

    case "benefit.setFlag": {
      await db
        .update(perksBenefit)
        .set({ [action.flag]: action.value })
        .where(and(eq(perksBenefit.id, action.id), eq(perksBenefit.userId, user.id)));
      return {};
    }

    case "benefit.delete": {
      await db
        .delete(perksBenefit)
        .where(and(eq(perksBenefit.id, action.id), eq(perksBenefit.userId, user.id)));
      return {};
    }

    case "worth.save": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      const { benefits } = await loadPortfolio(user.id);
      for (const b of benefits.filter((x) => x.cardId === card.id)) {
        if (!(b.id in action.values)) continue;
        const cents = action.values[b.id] ?? null;
        if (cents !== b.myValueCents) {
          await db
            .update(perksBenefit)
            .set({ myValueCents: cents })
            .where(and(eq(perksBenefit.id, b.id), eq(perksBenefit.userId, user.id)));
        }
      }
      return { message: "Saved." };
    }

    case "bonus.update": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      await db
        .update(perksCard)
        .set({
          msrCents: action.msrCents,
          msrDeadline: action.msrDeadline,
          msrSpentCents: action.msrSpentCents,
          bonusText: action.bonusText,
          bonusReceivedOn: action.bonusReceivedOn,
        })
        .where(and(eq(perksCard.id, card.id), eq(perksCard.userId, user.id)));
      return { message: "Saved." };
    }

    case "bonus.setSpent": {
      await db
        .update(perksCard)
        .set({ msrSpentCents: action.spentCents })
        .where(and(eq(perksCard.id, action.cardId), eq(perksCard.userId, user.id)));
      return {};
    }

    case "bonus.markReceived": {
      await db
        .update(perksCard)
        .set({ bonusReceivedOn: today() })
        .where(and(eq(perksCard.id, action.cardId), eq(perksCard.userId, user.id)));
      return {};
    }

    case "offers.paste": {
      const card = action.cardId ? await getCard(action.cardId, user.id) : null;
      if (action.cardId && !card) return { error: "Card not found.", status: 404 };
      const parsed = parseOffers(action.text, today());
      if (parsed.length === 0) {
        return {
          error: "No offers found in that text. Copy the whole offers page and paste it again.",
        };
      }
      const [existing, hidden] = await Promise.all([
        listOffers(user.id),
        listHiddenMerchants(user.id),
      ]);
      const hiddenKeys = new Set(hidden.map((h) => h.merchantKey));
      let hiddenCount = 0;
      const have = new Set(existing.filter((o) => o.cardId === (card?.id ?? null)).map(offerKey));
      const rows = [];
      for (const o of parsed.slice(0, 300)) {
        const merchant = o.merchant.slice(0, 120);
        const details = o.details.slice(0, 300);
        const expiresOn = o.expiresOn ? parseSheetDate(o.expiresOn) : null;
        if (!merchant) continue;
        const key = offerKey({ merchant, details, expiresOn });
        if (have.has(key)) continue;
        have.add(key);
        // Save hidden-merchant offers with status "hidden" so the People tab still sees them.
        const isHidden = hiddenKeys.has(merchantKey(merchant));
        if (isHidden) hiddenCount++;
        rows.push({
          id: crypto.randomUUID(),
          userId: user.id,
          cardId: card?.id ?? null,
          merchant,
          details,
          valueCents: Number.isInteger(o.valueCents) ? o.valueCents : null,
          expiresOn,
          status: isHidden ? "hidden" : o.added ? "added" : "available",
        });
      }
      if (rows.length > 0) await db.insert(perksOffer).values(rows);
      if (card) {
        await db
          .update(perksCard)
          .set({ offersCheckedAt: new Date() })
          .where(and(eq(perksCard.id, card.id), eq(perksCard.userId, user.id)));
      }
      const skipped = parsed.length - rows.length;
      const shown = rows.length - hiddenCount;
      const notes = [
        skipped ? `skipped ${skipped} already saved` : "",
        hiddenCount ? `left out ${hiddenCount} from merchants you hid` : "",
      ].filter(Boolean);
      return {
        message: `Saved ${shown} offer${shown === 1 ? "" : "s"}${card ? ` to ${card.name}` : ""}${notes.length ? `, ${notes.join(", ")}` : ""}.`,
      };
    }

    case "offers.markChecked": {
      const card = await getCard(action.cardId, user.id);
      if (!card) return { error: "Card not found.", status: 404 };
      await db
        .update(perksCard)
        .set({ offersCheckedAt: new Date() })
        .where(and(eq(perksCard.id, card.id), eq(perksCard.userId, user.id)));
      return { message: `Marked ${card.name} checked (no new offers).` };
    }

    case "offers.setStatus": {
      await db
        .update(perksOffer)
        .set({ status: action.status })
        .where(and(eq(perksOffer.id, action.id), eq(perksOffer.userId, user.id)));
      return {};
    }

    case "offers.setGroupStatus": {
      await db
        .update(perksOffer)
        .set({ status: action.status })
        .where(and(inArray(perksOffer.id, action.ids), eq(perksOffer.userId, user.id)));
      return {};
    }

    case "offers.restore": {
      for (const item of action.items) {
        await db
          .update(perksOffer)
          .set({ status: item.status })
          .where(and(eq(perksOffer.id, item.id), eq(perksOffer.userId, user.id)));
      }
      return {};
    }

    case "offers.hideMerchant": {
      const key = merchantKey(action.merchant);
      await db
        .insert(perksHiddenMerchant)
        .values({ userId: user.id, merchantKey: key, label: action.merchant.slice(0, 120) })
        .onConflictDoNothing();
      return {};
    }

    case "offers.unhideMerchant": {
      await db
        .delete(perksHiddenMerchant)
        .where(
          and(
            eq(perksHiddenMerchant.userId, user.id),
            eq(perksHiddenMerchant.merchantKey, action.merchantKey),
          ),
        );
      // Restore offers pasted while the merchant was hidden.
      const hiddenOfferIds = (await listOffers(user.id))
        .filter((o) => o.status === "hidden" && merchantKey(o.merchant) === action.merchantKey)
        .map((o) => o.id);
      if (hiddenOfferIds.length > 0) {
        await db
          .update(perksOffer)
          .set({ status: "available" })
          .where(and(inArray(perksOffer.id, hiddenOfferIds), eq(perksOffer.userId, user.id)));
      }
      return {};
    }

    case "offers.delete": {
      await db
        .delete(perksOffer)
        .where(and(eq(perksOffer.id, action.id), eq(perksOffer.userId, user.id)));
      return {};
    }

    case "points.save": {
      await db
        .insert(perksPoints)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          program: action.program,
          balance: action.balance,
          centsPerPointX100: action.centsPerPointX100,
        })
        .onConflictDoUpdate({
          target: [perksPoints.userId, perksPoints.program],
          set: {
            balance: action.balance,
            centsPerPointX100: action.centsPerPointX100,
            updatedAt: new Date(),
          },
        });
      return { message: `Saved ${action.program}.` };
    }

    case "points.importBalances": {
      const rows = parseBalances(action.balances);
      if (rows.length === 0) {
        return { error: 'Paste lines like "Amex MR, 270520", one program per line.' };
      }
      const existing = new Map((await listPoints(user.id)).map((p) => [p.program, p]));
      for (const { program, balance } of rows) {
        const cpp =
          existing.get(program)?.centsPerPointX100 ??
          Math.round(defaultCentsPerPoint(program) * 100);
        await db
          .insert(perksPoints)
          .values({
            id: crypto.randomUUID(),
            userId: user.id,
            program,
            balance,
            centsPerPointX100: cpp,
          })
          .onConflictDoUpdate({
            target: [perksPoints.userId, perksPoints.program],
            set: { balance, updatedAt: new Date() },
          });
      }
      return { message: `Updated ${rows.length} balance${rows.length === 1 ? "" : "s"}.` };
    }

    case "points.delete": {
      await db
        .delete(perksPoints)
        .where(and(eq(perksPoints.id, action.id), eq(perksPoints.userId, user.id)));
      return {};
    }

    case "redemption.add": {
      await db.insert(perksRedemption).values({
        id: crypto.randomUUID(),
        userId: user.id,
        program: action.program,
        redeemedOn: action.redeemedOn ?? today(),
        points: action.points,
        feesCents: action.feesCents,
        cashCents: action.cashCents,
        note: action.note,
      });
      return { message: "Logged." };
    }

    case "redemption.delete": {
      await db
        .delete(perksRedemption)
        .where(and(eq(perksRedemption.id, action.id), eq(perksRedemption.userId, user.id)));
      return {};
    }

    case "referral.add": {
      await db.insert(perksReferral).values({
        id: crypto.randomUUID(),
        userId: user.id,
        templateKey: action.templateKey,
        cardName: action.cardName,
        url: action.url,
        reward: action.reward,
      });
      const first = user.name.split(" ")[0] || "Someone";
      const others = await otherUserIds(user.id);
      await Promise.allSettled(
        others.map((id) =>
          sendPush(id, {
            title: `${first} shared a ${action.cardName} referral link`,
            body: "Applying for this card? Use their link so the bonus stays in the group.",
            url: "/dashboard/bonuses#referrals",
            tag: "referral",
          }),
        ),
      );
      return {
        message: `Shared your ${action.cardName} link.${others.length ? " Everyone with notifications on was told." : ""}`,
      };
    }

    case "referral.delete": {
      await db
        .delete(perksReferral)
        .where(and(eq(perksReferral.id, action.id), eq(perksReferral.userId, user.id)));
      return { message: "Removed referral link." };
    }

    case "spendTarget.setSpent": {
      await db
        .update(perksSpendTarget)
        .set({ spentCents: action.spentCents, periodKey: today().slice(0, 4) })
        .where(and(eq(perksSpendTarget.id, action.id), eq(perksSpendTarget.userId, user.id)));
      return {};
    }

    case "spendTarget.setTracked": {
      await db
        .update(perksSpendTarget)
        .set({ tracked: action.tracked })
        .where(and(eq(perksSpendTarget.id, action.id), eq(perksSpendTarget.userId, user.id)));
      return {};
    }

    case "settings.setDigest": {
      await db
        .insert(perksSettings)
        .values({ userId: user.id, digestEnabled: action.enabled })
        .onConflictDoUpdate({
          target: perksSettings.userId,
          set: { digestEnabled: action.enabled },
        });
      return {};
    }

    case "settings.setShareRankings": {
      await db
        .insert(perksSettings)
        .values({ userId: user.id, shareRankings: action.enabled })
        .onConflictDoUpdate({
          target: perksSettings.userId,
          set: { shareRankings: action.enabled },
        });
      return {};
    }

    case "settings.sendDigestNow": {
      const sent = await sendDigest({ id: user.id, email: user.email, name: user.name }, today());
      if (!sent) return { message: "Nothing is expiring soon, so there is nothing to send." };
      return {
        message: process.env.RESEND_API_KEY
          ? `Sent to ${user.email}.`
          : "No email provider is configured, so the digest was printed to the server log.",
      };
    }
  }
}

export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseMobileAction(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await runAction(user, parsed.action);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  // Statement preview is read-only; every other action mutates state and returns a fresh snapshot.
  if (parsed.action.type === "statement.preview") {
    return NextResponse.json({ ok: true, ...result } satisfies MobileActionResponse);
  }

  revalidatePath("/dashboard", "layout");
  const bootstrap = await loadMobileBootstrap(user);
  return NextResponse.json({ ok: true, ...result, bootstrap } satisfies MobileActionResponse);
}
