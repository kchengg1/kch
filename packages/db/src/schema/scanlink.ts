/**
 * Tables for apps/scanlink (dynamic QR codes with scan tracking).
 * App-specific tables live in their own file so the core stays readable.
 */
import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./core";

export const qrCode = pgTable(
  "qr_code",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Short public identifier used in the scan URL: /q/<slug> */
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    /** Denormalised counter so the list page needs no aggregate query. */
    scanCount: integer("scan_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("qr_code_user_id_idx").on(t.userId)],
);

export const qrScan = pgTable(
  "qr_scan",
  {
    id: text("id").primaryKey(),
    codeId: text("code_id")
      .notNull()
      .references(() => qrCode.id, { onDelete: "cascade" }),
    scannedAt: timestamp("scanned_at").notNull().defaultNow(),
    referer: text("referer"),
    userAgent: text("user_agent"),
    /** Two-letter country code when the host (e.g. Vercel) provides it. */
    country: text("country"),
  },
  (t) => [index("qr_scan_code_id_scanned_at_idx").on(t.codeId, t.scannedAt)],
);

export const qrCodeRelations = relations(qrCode, ({ one, many }) => ({
  user: one(user, { fields: [qrCode.userId], references: [user.id] }),
  scans: many(qrScan),
}));

export const qrScanRelations = relations(qrScan, ({ one }) => ({
  code: one(qrCode, { fields: [qrScan.codeId], references: [qrCode.id] }),
}));

export type QrCode = typeof qrCode.$inferSelect;
export type QrScan = typeof qrScan.$inferSelect;
