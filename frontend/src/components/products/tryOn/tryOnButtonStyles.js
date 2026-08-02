// The AI Try-On flow's primary action buttons use a dedicated accent
// (#6de7ff) instead of the sitewide ink-900 .btn-primary — a deliberate,
// scoped choice for this one feature, not a change to the shared design
// system. Still follows the same shape rules as .btn-primary: no
// rounded-* class (flat corners, per DESIGN_TOKENS.md's radius.default),
// semibold label, a background-only hover shift, no shadow/gradient.
//
// Text is ink-900 (not white) — #6de7ff is a light, high-luminance cyan,
// and white text on it fails contrast badly. Hover is a manually darkened
// shade of the same hue rather than an opacity trick, to keep the hover
// state a flat, opaque color like every other button on the site.
export const TRYON_PRIMARY_BTN =
  'inline-flex items-center justify-center bg-[#6de7ff] text-ink-900 font-semibold text-editorial-label transition-colors duration-150 hover:bg-[#4fd3ec] disabled:opacity-40 disabled:cursor-not-allowed';
