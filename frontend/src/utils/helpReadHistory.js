// Help Center read history — browser-local only, per docs/HELP_CENTER.md's
// access model notes. Deliberately not a backend endpoint/table: this is a
// per-viewer convenience (what have I already read, what did I open last),
// not state that needs to be shared across devices or read back by anyone
// else. Shape: { [articleSlug]: isoTimestampString }.
//
// Every access is wrapped — localStorage can throw (private browsing,
// storage disabled, quota exceeded) or hold malformed JSON (another
// extension/tab wrote garbage under this key). None of that should ever
// break the Help Center; it should just behave as if nothing was ever read.

const STORAGE_KEY = 'pusoHelpCenterReadHistory';

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** The full { slug: isoTimestamp } map. Never throws. */
export function getReadHistory() {
  return readRaw();
}

/** Records/updates the visit timestamp for one article. Never throws. */
export function recordArticleVisit(slug) {
  if (!slug) return;
  try {
    const history = readRaw();
    history[slug] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage unavailable/full/blocked — read history is a nice-to-have,
    // never something that should stop the article itself from working.
  }
}

/** The slug with the most recent valid timestamp in a history map, or null. */
export function getMostRecentSlug(history) {
  let bestSlug = null;
  let bestTime = -Infinity;
  for (const [slug, iso] of Object.entries(history || {})) {
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t) && t > bestTime) {
      bestTime = t;
      bestSlug = slug;
    }
  }
  return bestSlug;
}
