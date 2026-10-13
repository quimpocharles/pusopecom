import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { HELP_ARTICLES, getCategoryWithCounts } from '../data/helpCenterContent.js';

/**
 * Staff Help Center — gated on authenticate+isAdmin only, deliberately with
 * no requirePermission() call anywhere in this file. Every legitimate staff
 * account (any department, same as the Dashboard itself) can read every
 * article regardless of what their department can otherwise do — this is
 * general onboarding content, not an operational capability. Content lives
 * in data/helpCenterContent.js, never in the frontend bundle, so the
 * article text itself is never reachable without a valid admin session —
 * see CLAUDE.md/AGENTS.md: a guarded frontend route alone is not enough.
 */

const router = express.Router();
router.use(authenticate, isAdmin);

function plainTextOf(article) {
  const parts = [article.title, article.summary, ...(article.keywords || [])];
  for (const block of article.body) {
    if (block.text) parts.push(block.text);
    if (block.items) parts.push(...block.items);
  }
  return parts.join(' ').toLowerCase();
}

function matchesQuery(article, q) {
  if (!q) return true;
  return plainTextOf(article).includes(q.toLowerCase());
}

function toSummary(article) {
  const { slug, categoryId, title, summary, keywords, departments, sourceRef, verified } = article;
  return { slug, categoryId, title, summary, keywords, departments, sourceRef, verified };
}

router.get('/categories', (req, res) => {
  res.json({ success: true, data: getCategoryWithCounts() });
});

router.get('/articles', (req, res) => {
  try {
    const { category, q, department } = req.query;
    let results = HELP_ARTICLES;

    if (category) results = results.filter((a) => a.categoryId === category);
    if (department) results = results.filter((a) => !a.departments?.length || a.departments.includes(department));
    if (q) results = results.filter((a) => matchesQuery(a, q));

    res.json({ success: true, data: results.map(toSummary) });
  } catch (error) {
    logger.error({ err: error }, 'List help articles error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve help articles' });
  }
});

router.get('/articles/:slug', (req, res) => {
  const article = HELP_ARTICLES.find((a) => a.slug === req.params.slug);
  if (!article) {
    return res.status(404).json({ success: false, message: 'Help article not found' });
  }
  res.json({ success: true, data: article });
});

export default router;
