"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Label } from "@kch/ui";
import type { FormState } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { merchantKey } from "@/lib/offer-groups";
import { detectCardFromOffersText, parseOffers } from "@/lib/offer-parse";
import { offerReturn, rateLabel } from "@/lib/offer-value";
import { formatDate } from "@/lib/periods";

const field =
  "w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

const SELECT_PASTE_CARD_EVENT = "perks:select-paste-card";

/** Link that jumps to the "Add offers" box with a specific card pre-selected. */
export function PasteJumpLink({
  cardId,
  cardName,
  className,
  children,
}: {
  cardId: string;
  cardName: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href="#add-offers"
      title={`Jump to paste offers for ${cardName}`}
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent<string>(SELECT_PASTE_CARD_EVENT, { detail: cardId }));
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document
          .getElementById("add-offers")
          ?.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
        window.history.replaceState(null, "", "#add-offers");
        const textarea = document.getElementById("paste");
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.focus({ preventScroll: true });
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}

/** Paste an offers page, check what was read from it, then save. */
export function OfferPaste({
  action,
  cards,
  today,
  hiddenKeys,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  /** `checked` says when offers were last pasted for the card, e.g. "updated today (Nov 15)". */
  cards: { id: string; name: string; checked: string }[];
  today: string;
  /** Merchant keys marked not interested; their offers are skipped on save. */
  hiddenKeys: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const hidden = useMemo(() => new Set(hiddenKeys), [hiddenKeys]);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [autoDetectedName, setAutoDetectedName] = useState<string | null>(null);
  useEffect(() => {
    const onSelect = (event: Event) => {
      const nextId = (event as CustomEvent<string>).detail;
      if (typeof nextId === "string" && cards.some((c) => c.id === nextId)) {
        setCardId(nextId);
        setAutoDetectedName(null);
      }
    };
    window.addEventListener(SELECT_PASTE_CARD_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_PASTE_CARD_EVENT, onSelect);
  }, [cards]);
  const selectedCard = cards.find((c) => c.id === cardId);
  const lastChecked = selectedCard?.checked;
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await action(prev, form);
    if (result?.message) {
      setText("");
      setRemoved(new Set());
      setAutoDetectedName(null);
      router.refresh();
    }
    return result;
  }, undefined);
  const parsed = useMemo(() => parseOffers(text, today), [text, today]);
  const kept = parsed.filter((_, i) => !removed.has(i));

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cardId">Card these offers are on</Label>
        <select
          id="cardId"
          name="cardId"
          className={`${field} h-10`}
          value={cardId}
          onChange={(e) => {
            setCardId(e.target.value);
            setAutoDetectedName(null);
          }}
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="">No specific card</option>
        </select>
        {autoDetectedName && (
          <p className="text-xs font-medium text-primary">
            Auto-selected {autoDetectedName} from the pasted page.
          </p>
        )}
        {lastChecked && (
          <p className="text-sm text-muted-foreground">Offers for this card were {lastChecked}.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paste">Pasted offers page</Label>
        <textarea
          id="paste"
          value={text}
          onChange={(e) => {
            const nextText = e.target.value;
            setText(nextText);
            setRemoved(new Set());
            const detectedId = detectCardFromOffersText(nextText, cards);
            if (detectedId) {
              setCardId(detectedId);
              setAutoDetectedName(cards.find((c) => c.id === detectedId)?.name ?? null);
            } else {
              setAutoDetectedName(null);
            }
          }}
          rows={7}
          placeholder={"lululemon\nSpend $150 or more, get $30 back\nExpires 12/15/2026"}
          className={`${field} py-2 font-mono text-xs`}
        />
      </div>
      <input type="hidden" name="offers" value={JSON.stringify(kept)} />

      {text.trim() && parsed.length === 0 && (
        <Alert variant="error">
          No offers recognised yet. Each offer needs a merchant line and a deal line such as
          &ldquo;Spend $80 or more, get $15 back&rdquo;.
          {selectedCard
            ? ` If ${selectedCard.name} has no new offers, you can mark it checked below.`
            : ""}
        </Alert>
      )}
      {parsed.length > 0 && (
        <div className="rounded-[var(--radius)] border bg-card">
          <p className="border-b px-4 py-2.5 text-sm font-medium">
            {kept.length} offer{kept.length === 1 ? "" : "s"} found. Remove any that look wrong.
          </p>
          <ul className="divide-y text-sm">
            {parsed.map((o, i) =>
              removed.has(i) ? null : (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {o.merchant} {o.added && <Badge variant="success">Added</Badge>}{" "}
                      {hidden.has(merchantKey(o.merchant)) ? (
                        <Badge variant="secondary">Not interested, will be skipped</Badge>
                      ) : (
                        offerReturn(o.details) && (
                          <Badge variant="outline">{rateLabel(offerReturn(o.details)!.rate)}</Badge>
                        )
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {o.details || "Added to card, deal details not on this page"}
                      {o.valueCents !== null && ` · up to ${formatCents(o.valueCents)}`}
                      {` · ${o.expiresOn ? `expires ${formatDate(o.expiresOn, today)}` : "no expiry found"}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoved(new Set(removed).add(i))}
                    aria-label={`Remove ${o.merchant}`}
                  >
                    Remove
                  </Button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || kept.length === 0}>
          {pending
            ? "Saving…"
            : kept.length
              ? `Save ${kept.length} offer${kept.length === 1 ? "" : "s"}${selectedCard ? ` to ${selectedCard.name}` : ""}`
              : "Save offers"}
        </Button>
        {selectedCard && kept.length === 0 && (
          <Button type="submit" name="markChecked" value="1" variant="outline" disabled={pending}>
            Mark {selectedCard.name} checked (no new offers)
          </Button>
        )}
      </div>
    </form>
  );
}
