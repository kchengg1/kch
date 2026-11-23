/**
 * Tables for apps/perks (credit card benefit tracker).
 * Money is stored as integer cents; calendar dates as YYYY-MM-DD strings.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./core";

export const perksCard = pgTable(
  "perks_card",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer").notNull().default(""),
    /** Key into the app's benefit catalog, when the card matches a known product. */
    templateKey: text("template_key"),
    business: boolean("business").notNull().default(false),
    annualFeeCents: integer("annual_fee_cents").notNull().default(0),
    /** Approval date. Drives the cardmember year and sign-up bonus eligibility. */
    openedOn: date("opened_on", { mode: "string" }),
    closedOn: date("closed_on", { mode: "string" }),
    closed: boolean("closed").notNull().default(false),
    /** Sign-up bonus: spend required, by when, how much is done, and what it pays. */
    msrCents: integer("msr_cents"),
    msrDeadline: date("msr_deadline", { mode: "string" }),
    msrSpentCents: integer("msr_spent_cents").notNull().default(0),
    bonusText: text("bonus_text").notNull().default(""),
    bonusReceivedOn: date("bonus_received_on", { mode: "string" }),
    /** Last time an offers page was pasted for this card, even if nothing new was found. */
    offersCheckedAt: timestamp("offers_checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_card_user_id_idx").on(t.userId)],
);

export const perksBenefit = pgTable(
  "perks_benefit",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => perksCard.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** monthly | quarterly | semiannual | annual | anniversary | quadrennial | perk */
    cadence: text("cadence").notNull(),
    /** Value available in each period. Zero for perks and reminders. */
    amountCents: integer("amount_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    enrollRequired: boolean("enroll_required").notNull().default(false),
    enrolled: boolean("enrolled").notNull().default(false),
    /** What the benefit is worth to the owner per year, when it differs from face value. */
    myValueCents: integer("my_value_cents"),
    /** False for credits the owner has decided are not worth chasing. */
    tracked: boolean("tracked").notNull().default(true),
    /** Last day the benefit exists, for limited-time credits. */
    endsOn: date("ends_on", { mode: "string" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_benefit_card_id_idx").on(t.cardId)],
);

export const perksUsage = pgTable(
  "perks_usage",
  {
    id: text("id").primaryKey(),
    benefitId: text("benefit_id")
      .notNull()
      .references(() => perksBenefit.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Identifies the period, e.g. 2026-11, 2026-Q4, 2026-H2, 2026, A2026. */
    periodKey: text("period_key").notNull(),
    usedCents: integer("used_cents").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("perks_usage_benefit_period_idx").on(t.benefitId, t.periodKey)],
);

export const perksOffer = pgTable(
  "perks_offer",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: text("card_id").references(() => perksCard.id, { onDelete: "set null" }),
    merchant: text("merchant").notNull(),
    details: text("details").notNull().default(""),
    /** Maximum reward when the offer states one in dollars. */
    valueCents: integer("value_cents"),
    expiresOn: date("expires_on", { mode: "string" }),
    /** available | added | used | dismissed | hidden (merchant the owner hid; shown only to others) */
    status: text("status").notNull().default("available"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_offer_user_id_idx").on(t.userId)],
);

/** A points or miles balance, with the owner's value for one point. */
export const perksPoints = pgTable(
  "perks_points",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    program: text("program").notNull(),
    balance: integer("balance").notNull().default(0),
    /** Cents per point in hundredths, so 1.5 cents is stored as 150. */
    centsPerPointX100: integer("cents_per_point_x100").notNull().default(100),
    /** True when the user explicitly overrode the automatic valuation estimate. */
    customValue: boolean("custom_value").notNull().default(false),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("perks_points_user_program_idx").on(t.userId, t.program)],
);

/** A past award booking, to see what points were actually worth. */
export const perksRedemption = pgTable(
  "perks_redemption",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    program: text("program").notNull(),
    redeemedOn: date("redeemed_on", { mode: "string" }).notNull(),
    points: integer("points").notNull(),
    feesCents: integer("fees_cents").notNull().default(0),
    cashCents: integer("cash_cents").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_redemption_user_id_idx").on(t.userId)],
);

/** A browser or phone that asked for push notifications. */
export const perksPushSubscription = pgTable(
  "perks_push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_push_subscription_user_id_idx").on(t.userId)],
);

/**
 * The app's push signing keys (VAPID), made on first use so there is nothing
 * to configure. A single row.
 */
export const perksVapid = pgTable("perks_vapid", {
  id: integer("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A referral link someone shares with the group. */
export const perksReferral = pgTable(
  "perks_referral",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Catalog key when the card is in the catalog, for matching to bonuses. */
    templateKey: text("template_key"),
    cardName: text("card_name").notNull(),
    url: text("url").notNull(),
    /** What the referrer earns, e.g. "15,000 points". */
    reward: text("reward").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_referral_user_id_idx").on(t.userId)],
);

/** Spend toward a reward unlocked by total spend, e.g. $75,000 on Sapphire Reserve. */
export const perksSpendTarget = pgTable(
  "perks_spend_target",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => perksCard.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    reward: text("reward").notNull().default(""),
    targetCents: integer("target_cents").notNull(),
    /** Spend logged for `periodKey` (a calendar year, e.g. "2026"). Older years read as 0. */
    spentCents: integer("spent_cents").notNull().default(0),
    periodKey: text("period_key").notNull().default(""),
    /** False once the owner hides a goal they do not care about. */
    tracked: boolean("tracked").notNull().default(true),
  },
  (t) => [uniqueIndex("perks_spend_target_card_name_idx").on(t.cardId, t.name)],
);

/** Merchants whose offers the owner never wants to see. */
export const perksHiddenMerchant = pgTable(
  "perks_hidden_merchant",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Normalised merchant name used for matching (lower case, no ® or ™). */
    merchantKey: text("merchant_key").notNull(),
    /** The name as it was shown, for the "show again" list. */
    label: text("label").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.merchantKey] })],
);

export const perksSettings = pgTable("perks_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
  /** Show this person's credit totals to others holding the same card. */
  shareRankings: boolean("share_rankings").notNull().default(true),
  lastDigestOn: date("last_digest_on", { mode: "string" }),
});

export const perksCardRelations = relations(perksCard, ({ many }) => ({
  benefits: many(perksBenefit),
}));

export const perksBenefitRelations = relations(perksBenefit, ({ one, many }) => ({
  card: one(perksCard, { fields: [perksBenefit.cardId], references: [perksCard.id] }),
  usage: many(perksUsage),
}));

export const perksUsageRelations = relations(perksUsage, ({ one }) => ({
  benefit: one(perksBenefit, { fields: [perksUsage.benefitId], references: [perksBenefit.id] }),
}));

export type PerksCard = typeof perksCard.$inferSelect;
export type PerksBenefit = typeof perksBenefit.$inferSelect;
export type PerksUsage = typeof perksUsage.$inferSelect;
export type PerksOffer = typeof perksOffer.$inferSelect;
export type PerksSettings = typeof perksSettings.$inferSelect;
export type PerksHiddenMerchant = typeof perksHiddenMerchant.$inferSelect;
export type PerksPoints = typeof perksPoints.$inferSelect;
export type PerksRedemption = typeof perksRedemption.$inferSelect;
export type PerksReferral = typeof perksReferral.$inferSelect;
export type PerksSpendTarget = typeof perksSpendTarget.$inferSelect;
