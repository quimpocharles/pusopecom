# Puso Pilipinas - Sports Merchandise Store

A full-stack ecommerce platform for Philippine sports merchandise, featuring the PusoStore Editorial System storefront design, Xendit payment integration, and email notifications.

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL (Railway) + Prisma ORM
- JWT Authentication (local + Google OAuth; Facebook OAuth scaffolded in the schema but not yet wired)
- Nodemailer (SMTP)
- Xendit (primary payment gateway; per-channel processing fee passed to the customer) with Maya (legacy, transition window) as a second gateway
- Cloudinary (Image hosting)
- WaveSpeed AI (Virtual try-on, default — nano-banana-2, configurable via `WAVESPEED_MODEL`) with Replicate (Seedream 4.5) as fallback when `WAVESPEED_API_KEY` is unset
- Redis (rate limiting persistence; optional — falls back to in-memory when unset)
- Pino (structured JSON logging) + Sentry (error tracking, optional)
- node-cron (Scheduled tasks)
- express-validator (request validation), qrcode + pdfkit (Pass QR/PDF), sharp (images), exceljs (CSV exports)
- GitHub Actions CI, gating Railway deploys on the test suite passing

### Frontend
- React 18 + Vite
- TailwindCSS
- React Router v6
- Zustand (State management)
- React Hook Form
- react-helmet-async (SEO)
- Recharts (Admin reports)
- @zxing/browser (Pass QR check-in scanning), html2canvas + jspdf (ticket/QR download), zod, select-philippines-address

## Features

### Storefront
- Product catalog with filtering (sport, league, team, category, size, price, gender) and sort (Newest, Alphabetical, Most Bought, Trending)
- Product color variants with per-color sizes, stock, and images
- Search autocomplete with debounced suggestions and keyboard navigation
- Shopping cart with persistent storage (color-aware) as a global slide-out drawer
- Checkout flow with Xendit payment integration (GCash, Maya, Card, Apple Pay, QR Ph), with the gateway's per-channel processing fee disclosed and folded into the locked total before checkout (ADR-010)
- Guest checkout option
- Order management and tracking
- Pass event-admission checkout (tiers, per-tier capacity, QR credentials) — always separate from Merchandise, never mixed in one Order (ADR-011 addendum)
- Product reviews and ratings
- Virtual try-on powered by WaveSpeed AI (default) or Replicate (fallback) with download and add-to-cart on result; predictions are cancelled automatically on timeout or error to avoid wasted credits
- Size chart modal on product detail page (XS–3XL with shoulder, chest, and body length measurements); full size list always shown — sizes with no stock are greyed out with a diagonal slash; hidden for sizeless products (caps, stickers, etc.)
- Mobile-first responsive design
- PusoStore Editorial homepage design
- `sport: general` products appear across all sport filters

### Pass Event Admission (ADR-011)
- Event admission as a new Commerce Item category, shipped as **Pass** (née Ticket) — a time-boxed event at a Venue, with a scannable credential per admitted person
- `PassEvent` / `PassTier` / `Venue` / `VenueSection` models; every tier is capacity-based (`capacity` / `sold` counters, decremented atomically — per-seat selection was deliberately scrapped, ADR-011 addendum)
- A `Pass` is the fulfillment unit itself (one per admitted person), issued at order placement; the frontend renders its QR code and supports download (html2canvas/jspdf)
- **Pass-only checkout** — never mixed with Merchandise in one Order or one checkout (ADR-011 addendum); a Pass order needs only contact info, no shipping address, and `shippingFee` is forced to 0 server-side
- Staff check-in scanning via @zxing/browser (`POST /api/pass-events/passes/:passId/checkin` and the QR-token lookup), with an offline pre-sync payload (`GET /api/pass-events/:eventId/passes/sync`)

### User Account
- Authentication (register, login, email verification, password reset, Google OAuth)
- Account locking after 5 failed login attempts
- Account dashboard with profile, addresses, and password management
- PSGC-based Philippine address forms with region/province/city resolution
- Multiple saved addresses with default selection
- Email notifications (verification, order confirmation, daily sales report)

### SEO
- Per-page meta tags and Open Graph tags via react-helmet-async
- JSON-LD structured data (Product schema with ratings)
- Dynamic sitemap.xml generation from active products
- robots.txt with admin/auth page exclusions
- Homepage meta targets basketball, volleyball, football, and **e-sports** keywords to attract e-sports enthusiasts
- E-Sports tab in Shop by Sport section surfaces the `sport=esports` filter to crawlers
- **Vercel Edge Middleware** (`frontend/middleware.js`) — intercepts `/products/:slug` requests from known social crawlers (Facebook, WhatsApp, iMessage, Telegram, Slack, Discord, LinkedIn, Google, Bing, etc.), fetches product data from `VITE_API_URL` server-side, and returns a minimal HTML page with correct `og:title`, `og:description`, `og:image`, `product:price:*`, and Twitter Card tags; regular users pass through to the React SPA untouched
- Viewport zoom disabled via `user-scalable=no, maximum-scale=1.0` in the HTML meta tag
- Font filenames and CSS family names obfuscated (`puso-display`, `puso-body`) to prevent font identification from network requests

### Shipping & Fulfillment
- Dynamic shipping options calculated at checkout via `POST /api/shipping/options`
- **Domestic (Philippines)**: flat-rate per PSGC region (₱99–₱200); free for orders ₱2,000+
- **International**: flat rate ₱2,100 for mapped zones (SEA, Middle East, North America, Europe); "Contact Us" for unmapped countries
- **Venue Pick-Up**: free option; each slot is labelled "Pick Up at [Venue Name]" at checkout; supports multiple slots across different venues simultaneously (e.g. Araneta Coliseum on Feb 26, MoA Arena on Feb 27), each with its own venue name, address, date, display hours, and optional instructions; a slot is automatically hidden when its deadline passes (configurable — default 6 hours before start time)
- Free shipping progress bar in the cart drawer + dismissible announcement bar at the top of every page
- Shipping method and region stored on every order for analytics

### Admin
- Product management (CRUD with color variant support, try-on toggle)
- Soft delete for all admins; hard (permanent) delete restricted to `quimpo.charles@gmail.com`
- Order management with status updates, courier selection (LBC, J&T Express, Ninja Van, etc.), and tracking number — saved as read-only text with an edit button to revise
- User management with pagination, search, and role filter
- Site settings management (try-on feature configuration)
- Reports dashboard (sales trends, top products, order analytics, customer insights, virtual try-on analytics)
- **Shipping Analytics** — donut chart + breakdown table by shipping method (domestic standard/free, international by zone, venue pick-up); 4 summary cards; date range filter; CSV export
- **Venue Pick-Up settings** — enable/disable toggle, configurable deadline hours; slot management UI with Add/Remove per slot; each slot has its own venue name, venue address, date, start time (PHT), display hours, and special instructions; multiple venues at different locations can be active simultaneously; live deadline label turns red when a slot's deadline has passed
- Daily sales summary email (sent at 11:59 PM PHT via node-cron)
- League and team management
- **Inventory CSV export** — downloads all products with size breakdown, remaining stock per size, total QTY, and unit price; filename: `YYMMDD - Inventory Report.csv`
- **Transaction CSV export** — downloads orders filtered by period (Daily, Weekly, Monthly, Annual, All Time) with report date range header; filename: `YYMMDD - [Period] Transaction Report.csv`

### Homepage Sections

The homepage follows a dark B&W editorial aesthetic (`#0a0a0a` / `#1a1a1a` alternating sections):

1. **Hero** (`#0a0a0a`) — Dark section with crosshatch grid, radial glow, badge pill, large display heading "Show Your / Puso ❤️", animated Philippine flag gradient sweep on "Puso ❤️", pill CTAs (hidden on desktop, visible on mobile/tablet), bouncing scroll hint; height is `min-h-[88vh]` on all viewports
2. **Marquee Bar** (`#1a1a1a`) — Scrolling ticker with shipping info and promos
3. **Virtual Try-On Showcase** (`#0a0a0a`) — Centered text + floating browser-frame mockup on a CSS dome arc
4. **Shop by Sport** (`#1a1a1a`) — Tabbed carousel (Basketball, Volleyball, Football, E-Sports) with dark-themed tab pills
5. **Latest Collection** (`#0a0a0a`) — Image left, text right; outlined pill CTA
6. **Featured Products** (`#1a1a1a`) — Clickable product name list; active name white with underline, inactive muted; white pill CTA
7. **Our Partners** (`#0a0a0a`) — Dual-row infinite auto-scrolling logo marquee; top row scrolls left-to-right, bottom row right-to-left; Row 1: Gilas, PBA, PVL, Smart-O (32 cards, 16 per copy); Row 2: UAAP, NCAA, SBP (30 cards, 15 per copy); both sized to guarantee gap-free loop on screens up to 2560px wide
8. **FAQ** (`#1a1a1a`) — Accordion with `rgba(255,255,255,0.08)` dividers; no blue accents
9. **Newsletter** (`#0a0a0a`) — Dark input + white pill submit button; top border separator
10. **Instafeed / Social** — Currently hidden (`{false && ...}`)

### UI/UX Details

- **Button hover fill-up effect** - Color fills from bottom to top using CSS `::before` pseudo-elements with `translateY` transitions
- **Product card hover** - Second image crossfades in on hover with a slide-up "Buy Now" button (`#0a0a0a` bg, white text)
- **Cart side drawer** - Clicking "Buy Now" opens a slide-in drawer with size and quantity selectors; "Buy it with" upsell section shows complementary products with inline color swatch + size chip selectors — Add button disabled until a size is chosen
- **Size chart modal** - "Size Guide" link next to the Size heading opens a modal with XS–3XL measurements (shoulder, chest, body length); full size grid always rendered — unavailable sizes are greyed out with a diagonal slash overlay
- **Our Partners marquee** - Dual-row infinite auto-scroll; top row L→R (`partnersMarqueeL`, 76s), bottom row R→L (`partnersMarqueeR`, 76s); Row 1 has 32 cards (Gilas/PBA/PVL/Smart-O, 16 per copy × ~192px = ~3072px), Row 2 has 30 cards (UAAP/NCAA/SBP, 15 per copy × ~192px = ~2880px); both cover screens up to 2560px
- **Featured product switcher** - Clickable product names with active underline; image and description swap on click
- **Instafeed layout** - Desktop uses a 5-column CSS grid with images flanking centered text; mobile stacks 4 circles, text, 4 circles
- **Navbar & footer** - `#0a0a0a` background with white text; Logo.png replaces text branding; footer is compact single-row layout (`py-8 md:py-10`), small logo (`h-7`), social icon buttons with `rgba(255,255,255,0.06)` bg; footer social links point to Facebook and Instagram (no X/Twitter)
- **ProductCard dark mode** - Pass `dark={true}` prop for white text (home page dark sections); default is dark gray text for light-background pages (Products, You May Also Like)
- **Product detail back navigation** - `← Back` button left of breadcrumb calls `navigate(-1)` to return to previous page
- **Virtual try-on result** - Download button (saves base64 image) + "Add to Cart" button; no retry button to discourage spam
- **Virtual try-on loading** - Lower half shows a Playtime.ph video ad (autoplay, audio on) with an overlaid CTA button; disclaimer hidden during loading to maximise ad space
- **Products sort** - Dropdown in filter bar: Newest, Alphabetical, Most Bought, Trending (persisted in URL)

## Prerequisites

- Node.js (v20 recommended — matches CI)
- PostgreSQL (Railway or local)
- SMTP email account
- Xendit account (https://www.xendit.co/) — primary payment gateway
- Maya Checkout API account (https://developers.maya.ph/) — legacy gateway, transition window only
- WaveSpeed account (https://wavespeed.ai/) — for virtual try-on (default provider)
- Replicate account (https://replicate.com/) — optional, fallback virtual try-on provider
- Cloudinary account (optional, for image hosting)
- Redis (optional — local: `brew install redis && brew services start redis`; production: Railway's Redis plugin)
- Sentry account (optional — for error tracking; https://sentry.io)

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd puso-shop
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory (see `backend/.env.example` for the authoritative, always-current list):

```env
# PostgreSQL (Railway) — see backend/prisma/schema.prisma
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration
EMAIL_HOST=mail.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password

# Xendit (primary payment gateway — ADR-010)
XENDIT_SECRET_KEY=xnd_development_your-xendit-secret-key
XENDIT_WEBHOOK_TOKEN=your-xendit-webhook-verification-token

# Maya (legacy gateway — transition window; only in-flight orders still use it)
MAYA_PUBLIC_KEY=your-maya-public-key
MAYA_SECRET_KEY=your-maya-secret-key

# WaveSpeed AI (Virtual Try-On) — default provider when set.
# WAVESPEED_MODEL: seedream | nano-banana-2 | nano-banana-pro
WAVESPEED_API_KEY=your-wavespeed-api-key
WAVESPEED_MODEL=nano-banana-2

# Replicate (Virtual Try-On) — fallback used only when WAVESPEED_API_KEY is unset
REPLICATE_API_TOKEN=your-replicate-api-token
REPLICATE_MODEL=nano-banana-2

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
# OAuth - Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Admin
ADMIN_EMAIL=admin@example.com

# Server
PORT=5001
NODE_ENV=development

# Sentry (error tracking) — optional, leave unset to disable; app runs fine without it
SENTRY_DSN=your-sentry-dsn

# Logging
# LOG_LEVEL=info

# Redis (rate limiting persistence; later: caching, job queue) — optional,
# leave unset to disable; falls back to in-memory rate limiting.
REDIS_URL=redis://localhost:6379
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5001/api
```

### 4. Payment Gateway Setup (Xendit primary)

1. Sign up at https://www.xendit.co/
2. Get your secret key (`XENDIT_SECRET_KEY`) and set a shared webhook verification token (`XENDIT_WEBHOOK_TOKEN`) — Xendit signs every webhook with that token (verified via `crypto.timingSafeEqual`), so a verified payload is trusted directly, no re-pull (ADR-010)
3. Add both keys to your `.env` file
4. Maya remains configured (equivalent `MAYA_PUBLIC_KEY`/`MAYA_SECRET_KEY`) for the transition window, so any order already mid-checkout on it still resolves; it is not the default for new checkouts

### 5. WaveSpeed (Virtual Try-On) Setup

1. Sign up at https://wavespeed.ai/
2. Get your API key from the dashboard
3. Add it as `WAVESPEED_API_KEY` in your `.env`, and pick a model via `WAVESPEED_MODEL` (`seedream`, `nano-banana-2`, or `nano-banana-pro`)
4. If `WAVESPEED_API_KEY` is left unset, the app falls back to Replicate — sign up at https://replicate.com/ and set `REPLICATE_API_TOKEN` instead

### 6. Redis Setup (optional)

Powers persistent rate limiting (falls back to in-memory when unset — the app runs fine without it).

- **Local**: `brew install redis && brew services start redis`, then set `REDIS_URL=redis://localhost:6379`
- **Production (Railway)**: add the Redis plugin to your project, then set `REDIS_URL` on the backend service and redeploy

### 7. Sentry Setup (optional)

Real error tracking — without it, errors are still logged (structured, via Pino) but not aggregated or alerted on.

1. Sign up at https://sentry.io/ (free tier: 5k errors/month)
2. Create a Node.js/Express project, copy its DSN
3. Add it as `SENTRY_DSN` in your `.env`

## Running the Application

### Development Mode

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001

## Project Structure

```
puso-shop/
├── .github/
│   └── workflows/       # ci.yml — backend + frontend tests/build, gates Railway deploys via "Wait for CI"
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma  # Postgres schema — User, Product (+variants), Order, Review, League,
│   │   │                  #   SiteSettings, TryOnLog, UserActivity, VenuePickupConfig, ShippingEvent,
│   │   │                  #   Organization, Team, OrganizationParticipation, AthleteAffiliation
│   │   └── migrations/
│   ├── repositories/    # DB access layer — one module per Prisma model, thin wrapper over prisma client
│   ├── routes/          # Express routes (auth, products, orders, reviews, reports, leagues,
│   │                    #   tryon, upload, settings, activity, shipping, pickup)
│   ├── lib/
│   │   ├── prisma.js    # Singleton PrismaClient
│   │   ├── logger.js    # Singleton Pino logger
│   │   ├── sentry.js    # Sentry.init (no-ops without SENTRY_DSN)
│   │   ├── redis.js     # Singleton ioredis client (null without REDIS_URL)
│   │   ├── config/      # shipping.js — thresholds, DOMESTIC_RATES, COUNTRY_REGION_MAP, SHIPPING_METHODS
│   │   └── shipping/    # calculateShipping.js — getDomesticRate, getInternationalRate, getVenuePickupRate, isSlotActive
│   ├── __tests__/       # Vitest unit tests (calculateShipping, prisma singleton)
│   ├── services/        # Business logic (email, Xendit/Maya payment, WaveSpeed/Replicate try-on, daily sales)
│   ├── middleware/      # auth.js — authenticate, isAdmin, optionalAuth
│   ├── scripts/         # One-off/CLI scripts (data imports, migration pilots)
│   ├── server.js        # Express app, middleware, cron job
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/      # SEO, LoadingSpinner, AnnouncementBar
│   │   │   ├── layout/      # Header (search autocomplete, CSS-var top offset), Footer, Layout
│   │   │   ├── products/    # ProductCard (hover swap, color swatches), VirtualTryOn
│   │   │   ├── address/     # AddressForm (PSGC resolution)
│   │   │   ├── admin/       # AdminLayout, AdminRoute, report section components, DateRangeSelector
│   │   │   ├── auth/        # OAuth components
│   │   │   └── cart/        # CartDrawer, CartUpsell, FreeShippingBar
│   │   ├── pages/
│   │   │   ├── admin/       # AdminDashboard, AdminProducts, AdminOrders, AdminUsers,
│   │   │   │                #   AdminReports, AdminSettings, AdminPickup, AdminShippingReports
│   │   │   └── ...          # Home, Products, ProductDetail, Checkout, Account, etc.
│   │   ├── services/    # API service layer (product, auth, order, league, report, activity, pickup)
│   │   ├── store/       # Zustand stores (cart, auth)
│   │   ├── utils/       # shipping.js (frontend mirror), text.js
│   │   ├── index.css    # Global styles
│   │   ├── App.jsx      # Routes (lazy-loaded)
│   │   └── main.jsx     # Entry point (HelmetProvider)
│   ├── middleware.js    # Vercel Edge Middleware (OG tag injection for social crawlers)
│   ├── public/          # robots.txt, static assets
│   ├── index.html
│   └── package.json
│
└── README.md
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Create new user account
- `GET /verify-email?token=xxx` - Verify email address
- `POST /login` - User login (locks after 5 failed attempts)
- `POST /google` - Google OAuth login
- `POST /resend-verification` - Resend verification email
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `GET /me` - Get current user
- `PUT /profile` - Update profile (name, phone)
- `PUT /password` - Change password
- `POST /addresses` - Add shipping address
- `PUT /addresses/:addressId` - Update shipping address
- `DELETE /addresses/:addressId` - Delete shipping address
- `GET /admin/users` - Get all users with pagination, search, role filter (Admin)

### Products (`/api/products`)
- `GET /` - Get all products (filters: sport, league, team, category, gender, sale, price range, search, featured; sort: newest, alphabetical, most-bought, trending)
- `GET /search/suggestions?q=term` - Search autocomplete suggestions
- `GET /recommendations/cart?cartProductIds=...` - Complementary product recommendations for cart upsell
- `GET /:slug` - Get single product by slug
- `GET /admin/all` - Get all products including inactive (Admin)
- `GET /admin/:id` - Get product by ID (Admin)
- `GET /admin/stats` - Product statistics (Admin)
- `GET /admin/export` - Download inventory CSV (Admin)
- `POST /` - Create product (Admin)
- `PUT /:id` - Update product (Admin)
- `DELETE /:id` - Soft-delete product (sets `active: false`) (Admin)
- `DELETE /:id/permanent` - Hard-delete product from DB (superadmin only)

### Orders (`/api/orders`)
- `POST /` - Create order (Merchandise items or Passes, never both) and initiate the gateway checkout
- `GET /:orderNumber` - Get order details
- `GET /user/:userId` - Get user's orders
- `POST /:orderNumber/verify-payment` - Verify payment status with the gateway
- `GET /admin/all` - Get all orders with status/payment filters (Admin)
- `GET /admin/stats` - Dashboard statistics (Admin)
- `GET /admin/export?period=daily|weekly|monthly|yearly|all` - Download transaction CSV (Admin)
- `PATCH /:id/status` - Update order status, courier, and tracking number (Admin)
- `POST /webhooks/maya` - Maya payment webhook handler (legacy; treated as a trigger, re-verified via an authenticated pull)
- `POST /webhooks/xendit` - Xendit payment webhook handler (verified via the signed `x-callback-token`, payload trusted directly)

### Pass Events (`/api/pass-events`)
- `GET /` - List active pass events (public)
- `GET /:slug` - Get a pass event by slug (public)
- `GET /my/passes` - Get the current user's Passes (authenticated)
- `GET /admin/all` - List all pass events incl. inactive (Admin)
- `GET /admin/:id` - Get a pass event (Admin)
- `POST /` - Create a pass event (Admin)
- `PUT /:id` - Update a pass event (Admin)
- `DELETE /:id` - Soft-delete a pass event (Admin)
- `POST /:id/tiers` - Add a tier to a pass event (Admin)
- `PUT /tiers/:tierId` - Update a tier (Admin)
- `DELETE /tiers/:tierId` - Delete a tier (Admin)
- `GET /checkin/upcoming` - Upcoming events for the check-in scanner (Admin)
- `GET /:eventId/passes/sync` - Offline pre-sync payload of a scanning event's Passes (Admin)
- `GET /passes/lookup/:qrToken` - Look up a Pass by QR token (Admin)
- `POST /passes/:passId/checkin` - Check a Pass in (Admin)

### Reviews (`/api/products`)
- `GET /:slug/reviews` - Get product reviews with summary
- `GET /reviews/my` - Get product IDs the current user has reviewed (authenticated)
- `POST /:slug/reviews` - Submit a review (authenticated)

### Reports (`/api/reports`)
- `GET /sales` - Sales analytics with date range (Admin)
- `GET /products` - Product performance analytics (Admin)
- `GET /orders` - Order analytics (Admin)
- `GET /customers` - Customer insights (Admin)
- `GET /tryon` - Virtual try-on analytics (Admin)
- `GET /shipping` - Shipping method breakdown with date range filter; returns `methodBreakdown` (aggregated by method + region), `rawEvents` (for CSV export), `totalOrders` (Admin)

### Shipping (`/api/shipping`)
- `POST /options` - Calculate shipping options for a cart; body: `{ cartTotal, country, region? }`; returns `{ shippingOptions }` — each active venue pickup slot appears as a separate entry with a unique `slotId`

### Venue Pick-Up (`/api/admin/pickup`)
- `GET /` - Get current venue pick-up configuration (Admin)
- `PUT /` - Replace entire configuration; body: `{ enabled, venueName, venueAddress, deadlineHours, slots[] }`; validates venue fields when enabled and each slot's required fields independently (Admin)

### Leagues (`/api/leagues`)
- `GET /` - Get all active leagues (public)
- `GET /admin/all` - Get all leagues including inactive (Admin)
- `POST /` - Create league (Admin)
- `PUT /:id` - Update league (Admin)
- `DELETE /:id` - Soft-delete league (Admin)

### Activity (`/api/activity`)
- `POST /view` - Log product view (increments `totalViews` on product)
- `POST /search` - Log search query

### Settings (`/api/settings`)
- `GET /` - Get site settings (public)
- `PUT /` - Update site settings (Admin)

### Virtual Try-On (`/api/tryon`)
- `POST /` - Generate virtual try-on image via WaveSpeed AI (default; model set by `WAVESPEED_MODEL`) or Replicate Seedream 4.5 (fallback when `WAVESPEED_API_KEY` is unset); rate limited: 10/user/hr, 500/hr global; rate limiting disabled in dev; provider + duration recorded on every attempt, surfaced via `GET /api/reports/tryon`'s `byProvider` breakdown

### Upload (`/api/upload`)
- `POST /` - Upload single image to Cloudinary (Admin)
- `POST /multiple` - Upload up to 10 images to Cloudinary (Admin)

### Other
- `GET /health` - Server health check
- `GET /api/sitemap.xml` - Dynamic sitemap for SEO

## Database Models

Persistence is PostgreSQL (Railway) via Prisma — see `backend/prisma/schema.prisma` for the authoritative, always-current schema and the reasoning behind every non-obvious choice (it's heavily commented). Summary below; field-by-field Mongoose→Postgres migration rationale lives in `docs/decisions/0000-decision-log.md` (ADR-007).

### User
- Email (unique, verified), password (hashed with bcrypt)
- First name, last name, phone
- Avatar, auth provider (local / google / facebook)
- Email verification token, password reset token + expiry
- `Address[]` — real table (was an embedded array), each with its own default flag
- Failed login attempts counter, account locked flag
- Role (customer / admin)

### Product
- Name, slug, description
- Price, sale price
- Category, sport, gender enums; `league` / `team` / `player` free-text (legacy, still the only fields any route reads)
- `organizationId` / `teamId` — nullable FKs added by the Organization-first pilot migration (see Organization below); populated for exactly one pilot Organization (Far Eastern University) so far, `null` for every other product
- Images (Cloudinary URLs)
- `ProductSize[]` — real table (simple mode: size + stock)
- `ProductColor[]` → `ProductColorSize[]` — real tables (variant mode: per-color sizes, stock, hex, image)
- `totalStock` — auto-calculated from sizes/colors
- `totalSold` — incremented on every paid order, used for "Most Bought" sort
- `totalViews` — incremented on every product page view, used for "Trending" sort
- `searchVector` — Postgres `tsvector`, populated by a DB trigger (not app code), backing full-text search
- Try-on enabled flag, featured flag, active flag

### Order
- Order number (unique, auto-generated `PP-XXXXX-XXXX` format)
- User reference (optional, null for guest orders), email
- `OrderItem[]` — real table; name/price/image are a snapshot at order time, not a live reference
- Shipping address fields (`shipTo*`, PSGC: address, city, province, region, barangay, zip)
- Subtotal, shipping fee, total
- `shippingMethod` — one of `domestic_flat_rate`, `domestic_free`, `international`, `venue_pickup`, `contact_us`
- `shippingRegion` — PSGC region code for domestic orders; zone name (SEA / Middle East / North America / Europe) for international; null for pick-up
- Payment method, payment status (pending / paid / failed / refunded)
- `paymentChannel` — the gateway channel chosen at checkout (GCASH / MAYA / CARD / APPLE_PAY / QRPH); `gatewayFeeAmount` — the per-channel processing fee folded into `total` (ADR-010)
- Payment reference/ID and checkout URL; the detailed attempt history lives in the `Payment` entity (ADR-008), one row per checkout session attempt
- Order status (processing / confirmed / shipped / delivered / cancelled)
- Courier, tracking number, notes
- Stock is reserved atomically at order creation (real DB transaction), not at payment confirmation — closes the overselling race the pre-migration platform audit flagged as Critical

### Organization / Team / OrganizationParticipation / AthleteAffiliation
- Added by the Organization-first pilot migration (ADR-001/002) — the anchor entity CLAUDE.md's Domain Model treats as foundational, introduced without disturbing anything existing
- A League (UAAP, PBA, PVL) and an Athlete are not separate tables — each is an `Organization` row, distinguished by `kind` (`institution` / `league` / `athlete`) and by which relationship edges point at it
- **Ownership** (`Organization` → `Team`, e.g. FEU owns FEU Tamaraws) is a real FK; **participation** (e.g. FEU participates in UAAP without being owned by it) is a separate join table, `OrganizationParticipation`
- `AthleteAffiliation` is time-bounded (`startDate`/`endDate`) — zero rows exist yet, no athlete data has been migrated
- Single-pilot scope: only Far Eastern University + UAAP exist as real rows; every other Organization is still represented by the flat `Product.league`/`team`/`player` strings and the pre-existing `League` model until the full cutover

### Pass Event Admission (ADR-011)
- `PassEvent` — a time-boxed event at a Venue; carries `startsAt`/`endsAt`, an optional on-sale window (`salesStartAt`/`salesEndAt`), `teamNames`, and an `active` flag
- `Venue` / `VenueSection` — physical location and plain named areas (no seating-type distinction beyond `name`); `Venue` has an optional `seatingChartUrl` static reference image
- `PassTier` — the Product-Variant equivalent for a Pass (e.g. GA, VIP, Lower Box A), tied to one `VenueSection`, with its own `price` and capacity (`capacity` / `sold` counters, atomically decremented — per-seat selection was scrapped, ADR-011 addendum)
- `Pass` — the individual scannable admission credential, one per admitted person, issued at order placement (`status: issued`); carries a `qrToken`/`qrCodeUrl` and a typed `PassLog` history (`created` / `status_changed`)
- `PassStatus` — `issued / checked_in / cancelled / refunded`, advanced by a race-safe atomic transition map (`PASS_TRANSITIONS`)
- Pass fulfillment is the credential itself, not a Shipment; a Pass order carries contact info only (no shipping address) and `shippingFee` is forced to 0 server-side

### Review
- Product reference, author name, email
- Rating (1–5), title, body
- Verified purchase flag
- Unique constraint: one review per email per product

### League
- Name, sports (array — basketball / volleyball / football / general; a league can belong to multiple sports e.g. UAAP covers basketball and volleyball)
- Teams array (free-text; not yet joined to the real `Team` table above except for the pilot)
- `organizationId` — nullable bridge FK to `Organization`, populated only for the pilot
- Active flag; unique constraint: name

### SiteSettings
- Singleton row
- Try-on configuration: title, promotional image, product URL

### TryOnLog
- Product reference (optional FK), product name, product image (denormalized)
- Success flag
- `provider` (e.g. `wavespeed:nano-banana-2`, `replicate`) and `durationMs` — recorded on every attempt, surfaced via `GET /api/reports/tryon`'s `byProvider` breakdown
- Auto-expires after 90 days — replaces Mongo's TTL index with a daily node-cron job (`server.js`, 3:00 AM PHT) calling `tryOnLogRepository.deleteOlderThan(90)`

### UserActivity
- User reference (optional, null for guests), session ID
- Type (view / search), product reference, search query
- Auto-expires after 90 days — same daily cron job as `TryOnLog` above, calling `userActivityRepository.deleteOlderThan(90)`

### VenuePickupConfig
- Singleton row
- Root-level: `enabled` flag, `deadlineHours` (default 6)
- `PickupSlot[]` — real table; each slot carries its own `venueName`, `venueAddress`, `pickupDate` (YYYY-MM-DD string), `pickupHours` (display string), `pickupStartTime` (HH:MM 24h PHT, for deadline), `specialInstructions`, `enabled`; multiple venues at different locations/dates are supported simultaneously
- A slot is hidden from buyers once `now ≥ slotStartPHT − deadlineHours`; deadline is computed by `isSlotActive()` in `calculateShipping.js` using `Date.UTC` PHT→UTC arithmetic

### ShippingEvent
- Written on every successfully paid order (both `verify-payment` and the gateway webhook paths)
- `orderId` (order number), `shippingMethod`, `orderTotal`, `region` (PSGC code or zone name)
- Powers the Shipping Analytics report (`GET /api/reports/shipping`)

## Payment Flow

1. User fills Contact Information (email, phone, full name — always collected for all delivery types)
2. User selects delivery method (domestic standard/free, international, or one of the active venue pick-up slots)
3. User selects the payment channel in PusoStore's own checkout UI (GCash / Maya / Card / Apple Pay / QR Ph) — the exact per-channel Xendit processing fee is disclosed here and included in the total before checkout locks in (ADR-010)
4. Backend creates order with `paymentStatus: pending`, `shippingMethod`, `shippingRegion`, and the chosen `paymentChannel`
5. Backend initiates the gateway checkout session, already scoped to that one channel, and redirects the user
6. User completes payment on the gateway
7. The gateway's webhook resolves the order → `paymentStatus: paid`; `ShippingEvent` written for analytics. Xendit's webhook is trusted directly once its `x-callback-token` is verified; Maya's is instead treated as a trigger and re-verified via an authenticated status pull
8. User can also trigger manual verification via `POST /orders/:orderNumber/verify-payment` (also writes `ShippingEvent`)
9. User receives order confirmation email
10. User is redirected to order confirmation page

## Email Templates

The application sends HTML-formatted, mobile-responsive emails for:
- Email verification
- Order confirmation
- Password reset
- Daily sales summary (sent to `ADMIN_EMAIL` at 11:59 PM PHT)

## Scheduled Jobs

- **Daily sales report** — runs at 11:59 PM Asia/Manila via `node-cron`; sends a summary email to `ADMIN_EMAIL` with total revenue, paid order count, items sold, average order value, top 5 products, order/payment status breakdowns, and new customer count
- **TryOnLog/UserActivity cleanup** — runs at 3:00 AM Asia/Manila via `node-cron`; deletes rows older than 90 days from both tables, replacing MongoDB's TTL indexes (Postgres has no equivalent)

## Deployment

Deploys are gated on CI: `.github/workflows/ci.yml` runs the backend and frontend test suites on every push to `main`, and Railway's **Wait for CI** setting holds the deploy until that check passes — a failing/pending run blocks the deploy, it doesn't just get logged.

### Domains

- `pusostore.com` — the public storefront.
- `mail.pusostore.com` — employee login, pointed at the Admin Dashboard (`/admin`). Linked from the admin sidebar (see `AdminLayout.jsx`). If this ever needs to call the API from its own origin rather than just reaching the same frontend deployment, it has to be added alongside `FRONTEND_URL` wherever CORS is enforced (see Security) — CORS here only allows a single origin today.

### Backend Deployment (Railway)

1. Set all environment variables in the hosting platform, including `DATABASE_URL` (Postgres) — as a **secret**, not a plain-text **variable** (Railway UI has both; a secret is encrypted, a variable is shown in cleartext)
2. Add the Redis plugin if you want persistent rate limiting (optional); Railway usually wires `REDIS_URL` automatically
3. Update `FRONTEND_URL` to your production domain
4. Set production Xendit keys (`XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`) — Maya keys remain for the transition window only
5. Set `NODE_ENV=production`
6. Add `DATABASE_URL` as a GitHub Actions secret too (repo Settings → Secrets and variables → Actions → Secrets tab → Repository secrets) so CI can run the backend suite
7. **After changing any environment variable, redeploy — a restart alone does not pick up the new value**

#### Prisma migrations

Migrations are applied automatically by the `prestart` npm hook: `prestart` runs `prisma migrate deploy` before `node server.js` starts. `package.json`'s `start` script is `node server.js`, and npm runs `prestart` before `start` on every deploy, so a fresh deployment always applies pending migrations before the server accepts traffic. `prisma migrate deploy` is idempotent and transactional — it only applies migrations not yet in the `_prisma_migrations` table, and a concurrent run is safe.

For this to work:

- **Deploy start command must be `npm start`** (keep Railway's default Node start command; do not point it at `node server.js` directly, which would skip `prestart`).
- **The `prisma` CLI must be present in the installed dependencies on Railway.** It is currently a `devDependency`. Railway's Node/Nixpacks build runs `npm install` (installing devDependencies) by default, so the CLI is present. If you configure Railway with `npm install --omit=dev` (or `NODE_ENV=production` before install), the `prisma` CLI would be pruned and `prestart` would fail — in that case, ensure the build installs devDependencies, or move `prisma` to `dependencies`.
- Railway deploys as a **single instance** by default; do not scale the backend to multiple replicas without adding a job-leader mechanism (see the scheduled-jobs note below), since the in-process `node-cron` jobs would otherwise run once per replica.

Verify after a deploy with `npx prisma migrate status` — it should report "Database schema is up to date!".

#### Scheduled jobs & scaling (single-instance required)

The backend runs its scheduled jobs **in-process** (node-cron, registered at module load in `server.js`), so the backend must be deployed as **exactly one Railway instance**. Do not scale the backend to multiple replicas without a job-leader mechanism — the in-process jobs would otherwise run once per replica.

Job-by-job duplicate-execution safety (single instance is required; these are the current guarantees):

| Job (cron) | Idempotent under a re-run? |
|---|---|
| Daily/Weekly/Monthly/Quarterly business reports (`0 5 ...`) | **No** — `archiveRun` creates a `ReportRun` blindly; a re-run (or multi-instance) duplicates the report email and archive row. Manual regenerate via Admin > Reports is intentional and separate. |
| `expireStaleOrders` (`0 * * * *`) | Yes — `tryResolvePayment` only transitions from `paymentStatus='pending'`. |
| `sendPaymentReminders` (`5 * * * *`) | Yes — tracks `paymentReminderTiers`. |
| `sweepFulfillmentSLA` (`10 * * * *`) | Yes — atomic `fromStatus` guard on transition. |
| `sendRefundReminders` (`15 * * * *`) | Yes — deduped per refund per staffer. |
| TryOnLog/UserActivity cleanup (`0 3 * * *`) | Yes — idempotent `deleteOlderThan`. |

If you ever need >1 backend instance, either (a) move these jobs to a dedicated single job worker, or (b) add a distributed lock. Not done here — it would add infrastructure for a deployment that is single-instance today.

### Frontend Deployment (Vercel / Netlify)

1. Set `VITE_API_URL` to your backend URL
2. Build: `npm run build`
3. Deploy the `dist` folder

## Security

- JWT tokens expire after 7 days
- Passwords hashed with bcrypt (salt rounds: 10)
- Account locked after 5 consecutive failed login attempts
- Rate limiting on all API routes (100 req / 15 min); stricter on auth routes (20 req / 15 min); rate limiting disabled in development; counts persist in Redis when `REDIS_URL` is set (falls back to in-memory otherwise — resets on every restart/deploy)
- Dedicated try-on rate limits: 10 requests/user/hr, 500 requests/hr global (WaveSpeed/Replicate API cost protection)
- Helmet.js for security headers
- CORS restricted to `FRONTEND_URL`
- `trust proxy` enabled for Railway/Vercel reverse proxy compatibility
- Superadmin-only hard-delete restricted by email check
- No webhook payload is trusted at face value — verified per gateway's own mechanism. Xendit signs every webhook with a shared secret (`XENDIT_WEBHOOK_TOKEN`, compared via `crypto.timingSafeEqual`), so a verified payload is trusted directly, no re-pull. Maya offers no signing scheme, so its POST is treated only as a trigger to re-confirm status via an authenticated pull against Maya's own API (plus IP allowlisting), same as the manual `/verify-payment` path
- Structured logging (Pino) + optional Sentry error tracking (`SENTRY_DSN`) — off by default to avoid cost, on by adding the DSN

## Design System

**The PusoStore Editorial System is the canonical design system — read `docs/design/EDITORIAL_DESIGN_LANGUAGE.md` first** (the design philosophy — why) **then `docs/design/DESIGN_SYSTEM.md`** (the concrete specification — buttons, panels, inputs, spacing, radius, elevation, grid, and every other primitive). Built from first principles around what PusoStore actually is — the home of Philippine sports culture, identity driven by pride and community — rather than a generic storefront template: sharp geometry, restrained flat surfaces, and typography carrying the weight a decorative treatment would otherwise have to.

Migration across the app is incremental and ongoing — see `docs/design/MIGRATION_PLAN.md` for the current status of every page and shared component. `Header.jsx`, `Products.jsx`, `ProductCard.jsx`, and the shared `Button`/`Panel` components are migrated; `Home.jsx` and the remaining pages still run the platform's earlier dark B&W visual language (`#0a0a0a`/`#1a1a1a` alternating section backgrounds, Dharma Gothic E display face, Pro Sans body face, pill-shaped CTAs, a frosted-glass navbar) until their turn in the plan. That earlier language isn't described further here to avoid duplicating detail that will drift from the code the moment it changes — see `Home.jsx` and `index.css` directly for the exact current values, or the design-system docs for what they're being replaced with.

## Support

For issues or questions, create an issue in the GitHub repository.

## License

MIT License

---

Made with pride for Philippine Sports
