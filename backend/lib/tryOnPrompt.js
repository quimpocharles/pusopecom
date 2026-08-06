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

ABSOLUTE, NON-NEGOTIABLE CONSTRAINT — PERSON IDENTITY:
Do NOT change, regenerate, beautify, or reinterpret the person in any way. The output must be pixel-identical in identity to ${person.inline} — same exact face, facial structure, eyes, nose, mouth, skin tone, facial hair, expression, body shape, and body-to-head proportions. If you are not confident you can preserve these exactly, keep the original person region untouched and only edit the clothing region. Changing the person's identity, likeness, or proportions is a critical failure of this task — more important than any requirement below.

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
- Keep the person's face, body shape, body-to-head proportions, skin tone, hairstyle, and pose exactly as shown — this repeats the constraint above because it is the most important rule
- Make the garment fit naturally with realistic folds, drape, and fabric tension
- Ensure the collar, sleeves, and hem align naturally with the body
- Maintain the person's original background
- The final output must look like a professional product photo of the same real person wearing this exact garment

IMAGE DEFINITIONS:
- ${garment.label}: Garment reference (design reference only; internal tags are NOT part of the design)
- ${person.label}: Person to wear the garment — identity and proportions must remain identical to this`;
}
