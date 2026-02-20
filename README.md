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

### Admin
- Product management (CRUD with color variant support, try-on toggle)
- Soft delete for all admins; hard (permanent) delete restricted to `quimpo.charles@gmail.com`
- Order management with status updates, courier selection (LBC, J&T Express, Ninja Van, etc.), and tracking number — saved as read-only text with an edit button to revise
- User management with pagination, search, and role filter
- Site settings management (try-on feature configuration)
- Reports dashboard (sales trends, top products, order analytics, customer insights, virtual try-on analytics)
- Daily sales summary email (sent at 11:59 PM PHT via node-cron)
- League and team management
- **Inventory CSV export** — downloads all products with size breakdown, remaining stock per size, total QTY, and unit price; filename: `YYMMDD - Inventory Report.csv`
- **Transaction CSV export** — downloads orders filtered by period (Daily, Weekly, Monthly, Annual, All Time) with report date range header; filename: `YYMMDD - [Period] Transaction Report.csv`

### Homepage Sections

The homepage follows a MoreLabs.com-inspired layout with the following sections:

1. **Marquee Announcement Bar** - Scrolling ticker with shipping info and promos
2. **Hero Section** - Full-width gradient banner with CTAs
3. **Social Proof Bar** - Star ratings, sales count, authenticity badge
4. **Virtual Try-On Highlight** - AI-powered jersey try-on feature showcase
5. **Shop by Sport** - Tabbed carousel (Basketball, Volleyball, Football) with product cards
6. **Latest Collection** - Image left, text right layout for newest collection
7. **Featured Products** - Interactive section where clicking product names swaps the image and description
8. **Shop by League** - Horizontal scroll with circular league logos (Gilas, PBA, UAAP, PVL, NCAA, Azkals, Alas Pilipinas)
9. **Trust Section** - Authenticity, shipping, returns, and try-on badges
10. **Instafeed / Social Section** - 8 circular images arranged around centered text (desktop: CSS grid, mobile: stacked rows) — currently hidden
11. **Newsletter** - Email signup with gradient background

### UI/UX Details

- **Button hover fill-up effect** - Color fills from bottom to top using CSS `::before` pseudo-elements with `translateY` transitions
- **Product card hover** - Second image crossfades in on hover with a slide-up "Buy Now" button
- **Cart side drawer** - Clicking "Buy Now" opens a slide-in drawer with size and quantity selectors; "Buy it with" upsell section shows complementary products with inline color swatch + size chip selectors — Add button disabled until a size is chosen
- **Size chart modal** - "Size Guide" link next to the Size heading opens a modal with XS–3XL measurements (shoulder, chest, body length); full size grid always rendered — unavailable sizes are greyed out with a diagonal slash overlay
- **Shop by League circles** - Left-aligned heading + circles, shows 3.5 circles on wide viewports with horizontal scroll, each links to exact league or team filter
- **Featured product switcher** - Clickable product names with active underline; image and description swap on click
- **Instafeed layout** - Desktop uses a 5-column CSS grid with images flanking centered text; mobile stacks 4 circles, text, 4 circles
- **Navbar & footer** - Off-black `#26282f` background with white text; Logo.png replaces text branding; footer social links point to Facebook and Instagram (no X/Twitter)
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
│   ├── models/          # Mongoose models (User, Product, Order, Review, League, SiteSettings, TryOnLog, UserActivity)
│   ├── routes/          # Express routes (auth, products, orders, reviews, reports, leagues, tryon, upload, settings, activity)
│   ├── services/        # Business logic (email, Maya payment, Replicate, daily sales)
│   ├── middleware/      # auth.js — authenticate, isAdmin, optionalAuth
│   ├── config/          # Configuration files
│   ├── server.js        # Express app, middleware, cron job
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/      # SEO, LoadingSpinner
│   │   │   ├── layout/      # Header (search autocomplete), Footer, Layout
│   │   │   ├── products/    # ProductCard (hover swap, color swatches), VirtualTryOn
│   │   │   ├── address/     # AddressForm (PSGC resolution)
│   │   │   ├── admin/       # Admin report chart components
│   │   │   ├── auth/        # OAuth components
│   │   │   └── cart/        # CartDrawer, CartUpsell
│   │   ├── pages/       # Page components (Home, Products, ProductDetail, Account, admin/*)
│   │   ├── services/    # API service layer (product, auth, order, league, report, activity)
│   │   ├── store/       # Zustand stores (cart, auth)
│   │   ├── utils/       # Utility functions
│   │   ├── index.css    # Global styles (button fill-up effects)
│   │   ├── App.jsx      # Routes (lazy-loaded)
│   │   └── main.jsx     # Entry point (HelmetProvider)
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
- Name, sport (basketball / volleyball / football / general)
- Teams array
- Active flag
- Unique constraint: name + sport combination

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

## Payment Flow

1. User completes checkout form
2. Backend creates order in database with `paymentStatus: pending`
3. Backend initiates Maya checkout session
4. User is redirected to Maya payment page
5. User completes payment
6. Maya sends webhook to backend → order updated to `paymentStatus: paid`
7. User can also trigger manual verification via `POST /orders/:orderNumber/verify-payment`
8. User receives order confirmation email
9. User is redirected to order confirmation page

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

## Design Inspiration

- [MoreLabs](https://morelabs.com) — Homepage layout, button hover animations, product interactions, circle collections section, instafeed layout
- Philippine sports culture — Color palette (Deep Navy, Championship Gold, Flag Red)

## Support

For issues or questions, create an issue in the GitHub repository.

## License

MIT License

---

Made with pride for Philippine Sports
