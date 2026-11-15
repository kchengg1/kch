/**
 * Colours for the small card icons shown beside card names. These are plain
 * colour swatches that echo each card's finish (silver, gold, navy), not
 * issuer artwork or logos.
 */
export type CardStyle = { from: string; to: string; chip: string; label: string };

const METAL = "#e3c770";
const SILVERCHIP = "#c9ced6";

const BY_TEMPLATE: Record<string, CardStyle> = {
  "amex-platinum": { from: "#eef0f3", to: "#a7afb9", chip: "#d9b65b", label: "Platinum finish" },
  "amex-business-platinum": {
    from: "#d9dde2",
    to: "#7c8590",
    chip: "#d9b65b",
    label: "Platinum finish",
  },
  "amex-gold": { from: "#f1d58a", to: "#b8862b", chip: SILVERCHIP, label: "Gold finish" },
  "amex-business-gold": { from: "#e9c56c", to: "#9a6c1c", chip: SILVERCHIP, label: "Gold finish" },
  "chase-sapphire-reserve": {
    from: "#2a3d66",
    to: "#0b1426",
    chip: SILVERCHIP,
    label: "Navy finish",
  },
  "chase-ink-business-preferred": {
    from: "#3b4048",
    to: "#121417",
    chip: METAL,
    label: "Charcoal finish",
  },
  "chase-hyatt": { from: "#3f80c4", to: "#173f72", chip: METAL, label: "Blue finish" },
  "chase-hyatt-business": { from: "#5f6b78", to: "#232a33", chip: METAL, label: "Slate finish" },
  "capital-one-venture-x": {
    from: "#3a3a44",
    to: "#0e0e13",
    chip: SILVERCHIP,
    label: "Graphite finish",
  },
  "capital-one-venture-x-business": {
    from: "#4a4a52",
    to: "#18181d",
    chip: SILVERCHIP,
    label: "Graphite finish",
  },
  "chase-sapphire-preferred": {
    from: "#3a6fb5",
    to: "#173a6e",
    chip: SILVERCHIP,
    label: "Blue finish",
  },
  "chase-aeroplan": { from: "#2b2f36", to: "#0e1013", chip: METAL, label: "Black finish" },
  "chase-freedom-flex": { from: "#4aa0e6", to: "#145a9c", chip: METAL, label: "Blue finish" },
  "chase-freedom-unlimited": { from: "#5aaee8", to: "#1d6aa8", chip: METAL, label: "Blue finish" },
  "chase-freedom": { from: "#4b9ce0", to: "#1a5e9e", chip: METAL, label: "Blue finish" },
  "chase-ink-business-cash": { from: "#8a96a3", to: "#46505b", chip: METAL, label: "Steel finish" },
  "chase-ink-business-unlimited": {
    from: "#7d8a98",
    to: "#3b4550",
    chip: METAL,
    label: "Steel finish",
  },
  "amex-everyday": { from: "#f4f6f9", to: "#c3ccd8", chip: METAL, label: "White finish" },
  "amex-blue-business-plus": {
    from: "#3d86d6",
    to: "#1a4f95",
    chip: SILVERCHIP,
    label: "Blue finish",
  },
  "atmos-summit": { from: "#2f4d6b", to: "#0f2236", chip: METAL, label: "Midnight finish" },
  "citi-aadvantage-platinum-select": {
    from: "#c0c7cf",
    to: "#7a8591",
    chip: METAL,
    label: "Silver finish",
  },
  "costco-citi": { from: "#3e5f8a", to: "#1a2f4d", chip: METAL, label: "Navy finish" },
  "citi-double-cash": { from: "#5a7088", to: "#25374a", chip: METAL, label: "Slate finish" },
  "discover-it": { from: "#f7a24b", to: "#d0600d", chip: METAL, label: "Orange finish" },
};

const BY_ISSUER: [RegExp, CardStyle][] = [
  [/american express|amex/i, { from: "#4f8fd1", to: "#1d4f91", chip: METAL, label: "Blue" }],
  [/chase/i, { from: "#2f8fde", to: "#0b4f8f", chip: METAL, label: "Blue" }],
  [/capital one/i, { from: "#2a6a8f", to: "#0b3550", chip: METAL, label: "Teal" }],
  [/citi/i, { from: "#3d7ab8", to: "#0f3c6b", chip: METAL, label: "Blue" }],
  [/bank of america|bofa/i, { from: "#d8434f", to: "#8e1622", chip: METAL, label: "Red" }],
  [/barclay/i, { from: "#3fb6e8", to: "#0b6f9c", chip: METAL, label: "Sky blue" }],
  [/u\.?s\.? bank/i, { from: "#3a4fa3", to: "#121f5c", chip: METAL, label: "Indigo" }],
  [/wells fargo/i, { from: "#d6453b", to: "#8c1810", chip: METAL, label: "Red" }],
  [/discover/i, { from: "#f7a24b", to: "#d0600d", chip: METAL, label: "Orange" }],
];

const DEFAULT: CardStyle = { from: "#9aa3ae", to: "#4b535d", chip: METAL, label: "Grey" };

export function cardStyle(templateKey?: string | null, issuer?: string | null): CardStyle {
  if (templateKey && BY_TEMPLATE[templateKey]) return BY_TEMPLATE[templateKey];
  const match = BY_ISSUER.find(([re]) => re.test(issuer ?? ""));
  return match ? match[1] : DEFAULT;
}
