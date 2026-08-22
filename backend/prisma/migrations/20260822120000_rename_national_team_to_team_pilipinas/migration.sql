-- ---------------------------------------------------------------------------
-- Rename the "National Team" display/filter label to "Team Pilipinas".
--
-- Why this touches more than `leagues.name`: the string is used as BOTH a
-- display label AND a functional free-text filter value. `Product.league` /
-- `Product.team` are free-text strings that `/products?league=X` and the
-- `/products?team=X` shop links match against (buildListingWhere, case-
-- insensitive equals). Renaming the League's display name without also
-- rewriting the product strings that were tagged with the old value would
-- silently break league/team filtering for those products. So every
-- confirmed occurrence is updated in ONE transaction so the rename is
-- atomic — no state where some rows say "Team Pilipinas" and the products
-- they filter still say "National Team".
--
-- Scope/limits (do NOT broaden):
--   * Exact-match `= 'National Team'` only — nothing containing the phrase
--     as a substring, and no unrelated League/Organization/CMS row.
--   * IDs, slugs, and all other values are untouched.
--   * The same value may legitimately appear in `products.team` when a
--     product was tagged to the league via the free-text `team` field
--     (legacy data), so it's included to keep the ?team= filter working too.
--   * Marketing/notification prose fields (Campaign.title,
--     PromoMessage.text, Notification.body) are deliberately NOT rewritten:
--     they are editorial copy ("...the national team...") where the phrase
--     is grammatical prose and NOT the navigation/filter label. A blind
--     string-replace there would corrupt sentences. The navigation/filter
--     label is what the rename is about.
--
-- Verified-against-test-db note: run these SELECTs first to confirm the
-- blast radius before applying; only exact-match rows are updated.
-- ---------------------------------------------------------------------------

-- 1. The League display (and ?league= filter value).
UPDATE "leagues"
SET "name" = 'Team Pilipinas'
WHERE "name" = 'National Team';

-- 2. Products whose free-text league was tagged with the old league name.
UPDATE "products"
SET "league" = 'Team Pilipinas'
WHERE "league" = 'National Team';

-- 3. Products whose free-text team mirrored the league name (legacy) — keep
--    the ?team= filter working for the same products.
UPDATE "products"
SET "team" = 'Team Pilipinas'
WHERE "team" = 'National Team';

-- 4. The Organization row backing the league (kind = league), if named after
--    the old label — keeps the Organization-first navigation consistent.
UPDATE "organizations"
SET "name" = 'Team Pilipinas'
WHERE "name" = 'National Team' AND "kind" = 'league';

-- 5. CMS navigation label that referenced the old name.
UPDATE "navigation_links"
SET "label" = 'Team Pilipinas'
WHERE "label" = 'National Team';

-- 6. Featured Team panel that referenced the old name (drives its own
--    ?team= shop link via ctaUrl defaulting to /products?team={team}).
UPDATE "featured_teams"
SET "team" = 'Team Pilipinas', "headline" = 'Team Pilipinas'
WHERE "team" = 'National Team';
