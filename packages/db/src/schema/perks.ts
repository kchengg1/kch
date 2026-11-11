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
    /** available | added | used | dismissed */
    status: text("status").notNull().default("available"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("perks_offer_user_id_idx").on(t.userId)],
);

export const perksSettings = pgTable("perks_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
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
