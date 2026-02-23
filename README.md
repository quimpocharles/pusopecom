# Puso Pilipinas - Sports Merchandise Store

A full-stack MERN ecommerce platform for Philippine sports merchandise, featuring a MoreLabs-inspired storefront design, Maya payment integration, and email notifications.

## Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication (local + Google OAuth)
- Nodemailer (SMTP)
- Maya Checkout API
- Cloudinary (Image hosting)
- Replicate API (Virtual try-on via Seedream 4.5)
- node-cron (Scheduled tasks)

### Frontend
- React 18 + Vite
- TailwindCSS
- React Router v6
- Zustand (State management)
- React Hook Form
- react-helmet-async (SEO)
- Recharts (Admin reports)

## Features

### Storefront
- Product catalog with filtering (sport, league, team, category, size, price, gender) and sort (Newest, Alphabetical, Most Bought, Trending)
- Product color variants with per-color sizes, stock, and images
- Search autocomplete with debounced suggestions and keyboard navigation
- Shopping cart with persistent storage (color-aware) as a global slide-out drawer
- Checkout flow with Maya payment integration (GCash + Maya)
- Guest checkout option
- Order management and tracking
- Product reviews and ratings
- Virtual try-on powered by Replicate (Seedream 4.5) with download and add-to-cart on result; predictions are cancelled automatically on timeout or error to avoid wasted credits
- Size chart modal on product detail page (XS–3XL with shoulder, chest, and body length measurements); full size list always shown — sizes with no stock are greyed out with a diagonal slash; hidden for sizeless products (caps, stickers, etc.)
- Mobile-first responsive design
- MoreLabs-inspired homepage design
- `sport: general` products appear across all sport filters

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
- **Venue Pick-Up**: free option; supports multiple pick-up slots per event, each with its own date, display hours, start time (PHT), and optional instructions; a slot is automatically hidden when its deadline passes (configurable — default 6 hours before start time)
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

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- SMTP email account
- Maya Checkout API account (https://developers.maya.ph/)
- Replicate account (https://replicate.com/) — for virtual try-on
- Cloudinary account (optional, for image hosting)

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

Create a `.env` file in the `backend` directory:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/puso-pilipinas

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration
EMAIL_HOST=mail.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password

# Maya Payment Gateway
MAYA_PUBLIC_KEY=pk-test-your-maya-public-key
MAYA_SECRET_KEY=sk-test-your-maya-secret-key
MAYA_SANDBOX=true

# Replicate (Virtual Try-On)
REPLICATE_API_TOKEN=your-replicate-api-token

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Admin
ADMIN_EMAIL=admin@example.com

# Server
PORT=5000
NODE_ENV=development
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Maya Payment Setup

1. Sign up at https://developers.maya.ph/
2. Get your sandbox API keys from the dashboard
3. Add the keys to your `.env` file
4. Set `MAYA_SANDBOX=false` for production

### 5. Replicate (Virtual Try-On) Setup

1. Sign up at https://replicate.com/
2. Get your API token from the dashboard
3. Add it as `REPLICATE_API_TOKEN` in your `.env`

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
- Backend API: http://localhost:5000

## Project Structure

```
puso-shop/
├── backend/
│   ├── models/          # Mongoose models (User, Product, Order, Review, League, SiteSettings,
│   │                    #   TryOnLog, UserActivity, VenuePickupConfig, ShippingEvent)
│   ├── routes/          # Express routes (auth, products, orders, reviews, reports, leagues,
│   │                    #   tryon, upload, settings, activity, shipping, pickup)
│   ├── lib/
│   │   ├── config/      # shipping.js — thresholds, DOMESTIC_RATES, COUNTRY_REGION_MAP, SHIPPING_METHODS
│   │   └── shipping/    # calculateShipping.js — getDomesticRate, getInternationalRate, getVenuePickupRate, isSlotActive
│   ├── __tests__/       # Vitest unit tests (calculateShipping)
│   ├── services/        # Business logic (email, Maya payment, Replicate, daily sales)
│   ├── middleware/      # auth.js — authenticate, isAdmin, optionalAuth
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
- `POST /` - Create order and initiate Maya checkout
- `GET /:orderNumber` - Get order details
- `GET /user/:userId` - Get user's orders
- `POST /:orderNumber/verify-payment` - Verify payment status with Maya
- `GET /admin/all` - Get all orders with status/payment filters (Admin)
- `GET /admin/stats` - Dashboard statistics (Admin)
- `GET /admin/export?period=daily|weekly|monthly|yearly|all` - Download transaction CSV (Admin)
- `PATCH /:id/status` - Update order status, courier, and tracking number (Admin)
- `POST /webhooks/maya` - Maya payment webhook handler

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
- `POST /` - Generate virtual try-on image via Replicate Seedream 4.5 (rate limited: 10/user/hr, 500/hr global; rate limiting disabled in dev)

### Upload (`/api/upload`)
- `POST /` - Upload single image to Cloudinary (Admin)
- `POST /multiple` - Upload up to 10 images to Cloudinary (Admin)

### Other
- `GET /health` - Server health check
- `GET /api/sitemap.xml` - Dynamic sitemap for SEO

## Database Models

### User
- Email (unique, verified), password (hashed with bcrypt)
- First name, last name, phone
- Avatar, auth provider (local / google / facebook)
- Email verification token, password reset token + expiry
- Saved shipping addresses with default flag
- Failed login attempts counter, account locked flag
- Role (customer / admin)

### Product
- Name, slug, description
- Price, sale price, discount percentage (virtual)
- Category, sport, team, player, league, gender
- Images (Cloudinary URLs)
- Sizes with stock levels (simple mode)
- Color variants with per-color sizes, stock, hex code, and image (variant mode)
- `totalStock` — auto-calculated from sizes/colors
- `totalSold` — incremented on every paid order, used for "Most Bought" sort
- `totalViews` — incremented on every product page view, used for "Trending" sort
- Try-on enabled flag, featured flag, active flag

### Order
- Order number (unique, auto-generated `PP-XXXXX-XXXX` format)
- User reference (optional, null for guest orders), email
- Items array (name, price, quantity, size, color, image)
- Shipping address (PSGC fields: address, city, province, region, barangay, zip)
- Subtotal, shipping fee, total
- `shippingMethod` — one of `domestic_flat_rate`, `domestic_free`, `international`, `venue_pickup`, `contact_us`
- `shippingRegion` — PSGC region code for domestic orders; zone name (SEA / Middle East / North America / Europe) for international; null for pick-up
- Payment method, payment status (pending / paid / failed / refunded)
- Maya payment ID and checkout URL
- Order status (processing / confirmed / shipped / delivered / cancelled)
- Courier, tracking number, notes

### Review
- Product reference, author name, email
- Rating (1–5), title, body
- Verified purchase flag
- Unique constraint: one review per email per product

### League
- Name, sports (array — basketball / volleyball / football / general; a league can belong to multiple sports e.g. UAAP covers basketball and volleyball)
- Teams array
- Active flag
- Unique constraint: name

### SiteSettings
- Singleton document (fetched via static `get()` method)
- Try-on configuration: title, promotional image, product URL

### TryOnLog
- Product reference (ObjectId), product name, product image (denormalized)
- Success flag
- Auto-expires after 90 days (TTL index)

### UserActivity
- User reference (optional, null for guests), session ID
- Type (view / search), product reference, search query
- Auto-expires after 90 days (TTL index)

### VenuePickupConfig
- Singleton document (one document per collection)
- Root-level: `enabled` flag, `deadlineHours` (default 6)
- `slots[]` array — each slot carries its own `venueName`, `venueAddress`, `pickupDate` (YYYY-MM-DD string), `pickupHours` (display string), `pickupStartTime` (HH:MM 24h PHT, for deadline), `specialInstructions`, `enabled`; multiple venues at different locations/dates are supported simultaneously
- A slot is hidden from buyers once `now ≥ slotStartPHT − deadlineHours`; deadline is computed by `isSlotActive()` in `calculateShipping.js` using `Date.UTC` PHT→UTC arithmetic

### ShippingEvent
- Written on every successfully paid order (both `verify-payment` and `webhooks/maya` paths)
- `orderId` (order number), `shippingMethod`, `orderTotal`, `region` (PSGC code or zone name)
- Powers the Shipping Analytics report (`GET /api/reports/shipping`)

## Payment Flow

1. User selects delivery method at checkout (domestic standard/free, international, or venue pick-up)
2. Backend creates order with `paymentStatus: pending`, `shippingMethod`, and `shippingRegion`
3. Backend initiates Maya checkout session and redirects user to payment page
4. User completes payment on Maya
5. Maya sends webhook to backend → order updated to `paymentStatus: paid`; `ShippingEvent` written for analytics
6. User can also trigger manual verification via `POST /orders/:orderNumber/verify-payment` (also writes `ShippingEvent`)
7. User receives order confirmation email
8. User is redirected to order confirmation page

## Email Templates

The application sends HTML-formatted, mobile-responsive emails for:
- Email verification
- Order confirmation
- Password reset
- Daily sales summary (sent to `ADMIN_EMAIL` at 11:59 PM PHT)

## Scheduled Jobs

- **Daily sales report** — runs at 11:59 PM Asia/Manila via `node-cron`; sends a summary email to `ADMIN_EMAIL` with total revenue, paid order count, items sold, average order value, top 5 products, order/payment status breakdowns, and new customer count

## Deployment

### Backend Deployment (Railway / Render / Heroku)

1. Set all environment variables in the hosting platform
2. Ensure `MONGODB_URI` points to MongoDB Atlas
3. Update `FRONTEND_URL` to your production domain
4. Set `MAYA_SANDBOX=false` and swap in production Maya keys
5. Set `NODE_ENV=production`

### Frontend Deployment (Vercel / Netlify)

1. Set `VITE_API_URL` to your backend URL
2. Build: `npm run build`
3. Deploy the `dist` folder

## Security

- JWT tokens expire after 7 days
- Passwords hashed with bcrypt (salt rounds: 10)
- Account locked after 5 consecutive failed login attempts
- Rate limiting on all API routes (100 req / 15 min); stricter on auth routes (20 req / 15 min); rate limiting disabled in development
- Dedicated try-on rate limits: 10 requests/user/hr, 500 requests/hr global (Replicate API cost protection)
- Helmet.js for security headers
- CORS restricted to `FRONTEND_URL`
- `trust proxy` enabled for Railway/Vercel reverse proxy compatibility
- Superadmin-only hard-delete restricted by email check

## Design System

Puso Store uses a **dark B&W editorial** aesthetic throughout the storefront.

### Color Tokens

| Token | Value | Usage |
|---|---|---|
| `dark-primary` | `#0a0a0a` | Main section backgrounds, hero |
| `dark-secondary` | `#1a1a1a` | Alternating sections (marquee, FAQ, featured) |
| `dark-elevated` | `#1a1a1c` | Browser chrome bar, card surfaces |
| `dark-surface` | `rgba(255,255,255,0.06)` | Subtle input backgrounds, tab containers |
| `white` | `#ffffff` | Primary headings, primary CTA background |
| `text-muted` | `rgba(255,255,255,0.38)` | Body text, subtext on dark |
| `text-dimmer` | `rgba(255,255,255,0.22)` | Hero "Puso." display text |
| `border-subtle` | `rgba(255,255,255,0.08)` | Dividers, section borders |
| `border-default` | `rgba(255,255,255,0.14)` | Outlined CTA border |
| `light-surface` | `#f9fafb` | Dome arc base (structural only) |

### Section Alternation

Sections alternate between `#0a0a0a` and `#1a1a1a` to create rhythm with visible but not harsh contrast:

```
Hero            #0a0a0a
Marquee         #1a1a1a
Try-On          #0a0a0a
Shop by Sport   #1a1a1a
Latest Coll.    #0a0a0a
Featured        #1a1a1a
Our Partners    #0a0a0a
FAQ             #1a1a1a
Newsletter      #0a0a0a
```

### Typography

- **Display font**: Dharma Gothic E (condensed, bold display typeface) — loaded via `@font-face` in `index.css`; applied globally to all `h1`, `h2`, `h3` via `@layer base`; weights: 900 (Heavy), 800 (ExBold), 700 (Bold)
- **Body font**: Pro Sans — loaded via `@font-face`; weights: 400 (Regular), 600/700 (Semibold)
- **Hero heading**: `font-size: clamp(5rem, 18vw, 14rem)`, `line-height: 0.90`, `letter-spacing: -0.01em`, `text-transform: uppercase`
- **Section labels**: `font-semibold`, `text-transform: uppercase`, `letter-spacing: 0.09em`, `color: rgba(255,255,255,0.35)`, `font-size: 11–13px`
- **Body text**: `color: rgba(255,255,255,0.38)`, `line-height: 1.7–1.72`
- **Active/interactive text**: `#fff` for selected state, `rgba(255,255,255,0.18)` for idle, `rgba(255,255,255,0.45)` on hover

### Hero Flag Animation

The word "Puso ❤️" in the hero uses a CSS-only animated Philippine flag gradient sweep:

```jsx
// CSS keyframe (inline <style> block in Home.jsx)
// @keyframes pusoFlagSweep {
//   0%   { background-position: 100% center; }
//   100% { background-position: 0%   center; }
// }

style={{
  background: 'linear-gradient(90deg, #0038A8 0%, #CE1126 18%, #FCD116 35%, #0038A8 50%, #CE1126 68%, #FCD116 85%, #0038A8 100%)',
  backgroundSize: '200% 100%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  animation: 'pusoFlagSweep 6s linear infinite',
}}
```

Double-repeat gradient (colors appear twice at 0–100%) + `background-size: 200%` ensures a seamless loop as `background-position` sweeps from `100% → 0%` (left-to-right visual flow).

### Interactive Element Colors (Light Pages)

On light-background pages (Products, ProductDetail), all interactive elements use `#0a0a0a` instead of navy for cohesiveness:

| Element | Class / Style |
|---|---|
| Selected size chip | `bg-[#0a0a0a] border-[#0a0a0a] text-white` |
| Add to Cart button | `bg-[#0a0a0a] text-white` |
| Submit Review button | `bg-[#0a0a0a] text-white` |
| Selected thumbnail border | `border-[#0a0a0a]` |
| Selected color swatch ring | `ring-[#0a0a0a]` |
| Rating bar fill | `bg-[#0a0a0a]` |
| Form focus rings | `focus:ring-[#0a0a0a]` |
| `btn-secondary` (global) | `border-gray-900` fill `#0a0a0a` |
| Star ratings | `text-yellow-400` (amber, not navy) |
| Buy Now hover button | `bg-[#0a0a0a] text-white` |

### CTA Buttons

**Primary (white pill):**
```jsx
style={{
  background: '#fff',
  color: '#0a0a0a',
  fontWeight: 700,
  borderRadius: '100px',
  padding: '13px 30px',
  textDecoration: 'none',
}}
```

**Secondary (outlined pill):**
```jsx
style={{
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.55)',
  borderRadius: '100px',
  padding: '13px 30px',
  textDecoration: 'none',
}}
```

Hover state on all pills: `opacity: 0.88`, `translateY(-1px)`.

### Badge / Label Pill

```jsx
style={{
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '100px',
  padding: '5px 16px',
}}
```
Content: 11px uppercase semibold, `color: rgba(255,255,255,0.38)`.

### Navbar Pill-Morph

The fixed header starts transparent (on home at top) and morphs to a frosted glass pill on scroll:

- **Shell**: `position: fixed; top: 0; left: 0; right: 0; z-index: 50; pointer-events: none`
- **Shell padding**: transitions from `'0'` → `'14px 7%'` (spring easing)
- **Nav inner**: `height` 80px→52px, `border-radius` 0→100px, `background` transparent→`rgba(10,10,10,0.82)`, `backdropFilter: blur(24px) saturate(180%)`
- **Easing**: `cubic-bezier(0.34, 1.3, 0.64, 1)` (spring with slight overshoot)
- **Duration**: 480ms for padding, 420ms for nav inner

### Section Transitions — Dome Arc

To create a "floating on a platform" effect between a dark section and the Try-On showcase:

```jsx
// CSS dome div (convex top edge, 104% wide, no SVG needed)
style={{
  position: 'absolute',
  bottom: 0,
  left: '-2%',
  width: '104%',
  height: 'clamp(160px, 28vw, 270px)',
  background: '#f9fafb',                      // matches next section bg
  borderRadius: '50% 50% 0 0 / 50px 50px 0 0', // gentle convex arc
  zIndex: 1,
}}

// Radial ground shadow (contact shadow on dome surface)
style={{
  background: 'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.13) 0%, transparent 72%)',
  width: '78%',
  height: '90px',
  // centered, absolute, bottom: 0
}}
```

### Background Texture

Hero and try-on sections use a subtle crosshatch grid + radial vignette:

```jsx
backgroundImage: [
  'repeating-linear-gradient(0deg, transparent, transparent 64px, rgba(255,255,255,0.025) 64px, rgba(255,255,255,0.025) 65px)',
  'repeating-linear-gradient(90deg, transparent, transparent 64px, rgba(255,255,255,0.025) 64px, rgba(255,255,255,0.025) 65px)',
].join(', '),
maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 100%)',
```

---

## Design Inspiration

- Dark editorial tech-product aesthetic (inspired by AI/SaaS landing pages)
- Philippine sports culture — identity driven by pride and community
- [MoreLabs](https://morelabs.com) — Original product interactions, button hover animations, circle collections section

## Support

For issues or questions, create an issue in the GitHub repository.

## License

MIT License

---

Made with pride for Philippine Sports
