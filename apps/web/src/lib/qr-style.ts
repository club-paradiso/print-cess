/**
 * Colours for every QR code the service draws. They are canvas pixels, not CSS,
 * so they cannot read the design tokens; they mirror `--pc-text-primary` (Ink
 * Navy) on `--pc-surface`. Keep the code ink-dark on plain white: a phone
 * camera reads contrast, not brand, and a tinted code scans worse.
 */
export const QR_COLORS = { dark: "#1e1b4b", light: "#ffffff" } as const;
