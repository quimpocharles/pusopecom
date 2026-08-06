// Shared Virtual Try-On prompt — the actual generation requirements
// (ignore internal tags, preserve exterior logos/prints exactly, keep the
// person's face/body/pose unchanged, natural fit/drape, keep the
// background, professional-product-photo output) are identical across
// every AI provider Fit Check has used. Only how each provider's
// multi-image API refers to "image 1"/"image 2" differs, since each one's
// own docs/convention names them differently — WaveSpeed as "Figure N",
// Replicate as "the Nth image". Previously two independently-maintained
// copies of this string (one per service) that had already drifted in
// wording once; this is the single source of truth going forward.
export function buildTryOnPrompt(productName, { garment, person }) {
  return `Virtual try-on: Take the person from ${person.inline} and dress them in the wearable exterior of the garment from ${garment.inline}.

CRITICAL REQUIREMENTS:
- The garment is a ${productName || 'shirt or jersey'}
- Use ONLY the exterior wearable fabric of the garment
- IGNORE, REMOVE, or HIDE any internal elements such as:
  - neck tags
  - size tags
  - wash/care labels
  - brand tags located inside the collar or seams
- Internal tags MUST NOT appear on the outside of the garment

- PRESERVE EXACTLY all exterior logos, text, numbers, patterns, prints, embroidery, and designs
- Do NOT alter, blur, stretch, mirror, or recreate any exterior design detail
- Keep the person's face, body shape, skin tone, hairstyle, and pose exactly as shown
- Make the garment fit naturally with realistic folds, drape, and fabric tension
- Ensure the collar, sleeves, and hem align naturally with the body
- Maintain the person's original background
- The final output must look like a professional product photo of a real person wearing this exact garment

IMAGE DEFINITIONS:
- ${garment.label}: Garment reference (design reference only; internal tags are NOT part of the design)
- ${person.label}: Person to wear the garment`;
}
