# Scanlink

Dynamic QR codes with scan tracking. Built on `apps/template`; see `/docs/NEW_APP.md`
for setup and launch steps.

## How it works

- Each code gets a short link `/q/<slug>` that is what's actually encoded in the QR image.
- `app/q/[slug]/route.ts` redirects to the current destination and records the scan
  after the response is sent (bots and link previews are ignored).
- `app/api/codes/[id]/qr` renders the QR as SVG or PNG for the owner.
- Free accounts get 3 codes (`lib/limits.ts`). Paid accounts get unlimited codes plus
  daily trends, top sources and countries on the code page.

## Tables

`qr_code` and `qr_scan` in `packages/db/src/schema/scanlink.ts`.
