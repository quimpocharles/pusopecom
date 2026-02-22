/**
 * Vercel Edge Middleware — OG tag injection for social crawlers
 *
 * When a known crawler requests a product URL, this intercepts the request,
 * fetches the product from the API, and returns a minimal HTML page with the
 * correct Open Graph / Twitter Card meta tags so link previews show the
 * product image, name, and price instead of the generic site tags.
 *
 * Regular users pass through untouched and receive the normal React SPA.
 *
 * Requires env var: API_BASE_URL (e.g. https://api.pusostore.com/api)
 */

const BOT_PATTERN =
  /facebookexternalhit|facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|bingbot|Googlebot|DuckDuckBot|Applebot|SkypeUriPreview|vkShare|W3C_Validator/i;

export async function middleware(request) {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';

  // Only intercept /products/:slug for known crawlers
  const match = url.pathname.match(/^\/products\/([^/]+)$/);
  if (!match || !BOT_PATTERN.test(ua)) return;

  const slug = match[1];
  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return;

  try {
    const res = await fetch(`${apiBase}/products/${slug}`);
    if (!res.ok) return;

    const { data: p } = await res.json();

    const title    = `${p.name} | Puso Pilipinas`;
    const desc     = (p.description || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').slice(0, 160);
    const image    = p.images?.[0] || '';
    const pageUrl  = url.href;
    const amount   = p.salePrice ?? p.price ?? 0;

    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">

  <!-- Open Graph -->
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image"       content="${image}">
  <meta property="og:image:width"  content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:type"        content="product">
  <meta property="og:site_name"   content="Puso Pilipinas">
  <meta property="og:url"         content="${pageUrl}">

  <!-- Product pricing (Facebook) -->
  <meta property="product:price:amount"   content="${amount}">
  <meta property="product:price:currency" content="PHP">

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image"       content="${image}">
</head>
<body></body>
</html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  } catch {
    return; // pass through on any error — React app handles it
  }
}

export const config = { matcher: ['/products/:path+'] };
