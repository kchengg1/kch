"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";
import { cn } from "@kch/ui";
import { restoreOffersAction, setOffersStatusAction } from "@/app/dashboard/actions";

type Restore = { id: string; status: string }[];
type Toast = { text: string; restore: Restore; key: number };

const UndoContext = createContext<(text: string, restore: Restore) => void>(() => {});

/** How long the Undo bar stays up after a swipe. */
const UNDO_MS = 6000;
/** Share of the row's width a swipe must cover to count. */
const COMMIT_SHARE = 0.35;

/**
 * Wraps the offers list so a swipe can offer Undo. The bar lives here, not in
 * the row, because the row disappears as soon as the server confirms the change.
 */
export function SwipeUndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();
  const show = useCallback((text: string, restore: Restore) => {
    setToast({ text, restore, key: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <UndoContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-center justify-between gap-4 rounded-[var(--radius)] bg-foreground px-4 py-3 text-sm text-background shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
        >
          <span className="min-w-0 truncate">{toast.text}</span>
          <button
            type="button"
            className="shrink-0 font-semibold text-primary-foreground underline-offset-2 hover:underline"
            onClick={() => {
              const restore = toast.restore;
              setToast(null);
              startTransition(() => restoreOffersAction(restore));
            }}
          >
            Undo
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}

/**
 * One offer row that can be swiped on a touchscreen: left to skip, right to
 * mark used. Mouse users and anyone who prefers tapping keep the buttons.
 */
export function SwipeRow({
  merchant,
  items,
  className,
  children,
}: {
  merchant: string;
  /** Every card's copy of this offer, with its status before the swipe (for Undo). */
  items: Restore;
  className?: string;
  children: ReactNode;
}) {
  const showUndo = useContext(UndoContext);
  const [, startTransition] = useTransition();
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const [gone, setGone] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null; id: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLLIElement>) {
    if (e.pointerType !== "touch" || gone) return;
    drag.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
    setSettling(false);
  }

  function onPointerMove(e: PointerEvent<HTMLLIElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    // Decide once whether this is a sideways swipe or a scroll, then stick with it.
    if (!d.axis && Math.abs(mx) + Math.abs(my) > 8)
      d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (d.axis === "x") setDx(mx);
  }

  function onPointerUp(e: PointerEvent<HTMLLIElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.id || d.axis !== "x") return;
    const width = row.current?.offsetWidth ?? 360;
    setSettling(true);
    if (Math.abs(dx) < width * COMMIT_SHARE) {
      setDx(0);
      return;
    }
    const status = dx > 0 ? "used" : "dismissed";
    setDx(dx > 0 ? width : -width);
    setGone(true);
    showUndo(`${status === "used" ? "Marked used" : "Skipped"}: ${merchant}`, items);
    startTransition(() =>
      setOffersStatusAction(
        items.map((i) => i.id),
        status,
      ),
    );
  }

  const reveal = Math.min(1, Math.abs(dx) / 120);
  return (
    <li
      ref={row}
      data-swipe-row
      className="relative touch-pan-y overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setSettling(true);
        setDx(0);
      }}
    >
      {/* What a swipe will do, revealed behind the row as it moves. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center px-4 text-sm font-semibold text-white",
          dx > 0 ? "justify-start bg-success" : "justify-end bg-muted-foreground",
        )}
        style={{ opacity: dx === 0 ? 0 : reveal }}
      >
        {dx > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Used
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Skip <X className="h-4 w-4" />
          </span>
        )}
      </div>
      <div
        className={cn("relative bg-card", className)}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: settling ? "transform 200ms ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </li>
  );
}
