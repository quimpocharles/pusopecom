# Puso Pilipinas - Sports Merchandise Store

A full-stack MERN ecommerce platform for Philippine sports merchandise, featuring a MoreLabs-inspired storefront design, Maya payment integration, and email notifications.

## Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication (local + Google OAuth)
- Nodemailer (Gmail)
- Maya Checkout API
- Cloudinary (Image hosting)

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
- Product catalog with filtering (sport, team, category, size, price, gender)
- Product color variants with per-color sizes, stock, and images
- Search autocomplete with debounced suggestions and keyboard navigation
- Shopping cart with persistent storage (color-aware)
- Checkout flow with Maya payment integration
- Guest checkout option
- Order management and tracking
- Product reviews and ratings
- Virtual try-on for jerseys
- Mobile-first responsive design
- MoreLabs-inspired homepage design

### User Account
- Authentication (register, login, email verification, password reset, Google OAuth)
- Account dashboard with profile, addresses, and password management
- PSGC-based Philippine address forms with region/province/city resolution
- Multiple saved addresses with default selection
- Email notifications (verification, order confirmation)

### SEO
- Per-page meta tags and Open Graph tags via react-helmet-async
- JSON-LD structured data (Product schema with ratings)
- Dynamic sitemap.xml generation from active products
- robots.txt with admin/auth page exclusions

### Admin
- Product management (CRUD with color variant support)
- Order management with status updates and tracking
- Reports dashboard (sales trends, top products, order analytics, customer insights)
- League and team management

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
10. **Instafeed / Social Section** - 8 circular images arranged around centered text (desktop: CSS grid, mobile: stacked rows)
11. **Newsletter** - Email signup with gradient background

### UI/UX Details

- **Button hover fill-up effect** - Color fills from bottom to top using CSS `::before` pseudo-elements with `translateY` transitions
- **Product card hover** - Second image crossfades in on hover with a slide-up "Buy Now" button
- **Cart side drawer** - Clicking "Buy Now" opens a slide-in drawer with size and quantity selectors
- **Shop by League circles** - Shows 3.5 circles on screen with horizontal scroll, hover scale effect
- **Featured product switcher** - Clickable product names with active underline; image and description swap on click
- **Instafeed layout** - Desktop uses a 5-column CSS grid with images flanking centered text; mobile stacks 4 circles, text, 4 circles

### Seeded Data

Run `node backend/seed-100.js` to populate the database with 100 placeholder products:
- 50 Basketball products (PBA teams, UAAP teams, Gilas Pilipinas)
- 30 Volleyball products (PVL teams, Alas Pilipinas)
- 20 Football products (PFL teams, Philippine Azkals)
- Categories: jerseys, t-shirts, caps, shorts, accessories
- 16 featured items, ~26 on sale

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Gmail account (for email service)
- Maya Checkout API account (https://developers.maya.ph/)
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

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password

# Maya Payment Gateway
MAYA_PUBLIC_KEY=pk-test-your-maya-public-key
MAYA_SECRET_KEY=sk-test-your-maya-secret-key

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

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

### 4. Seed Products (Optional)

```bash
cd backend
node seed-100.js
```

### 5. Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security > 2-Step Verification > App Passwords
4. Generate a new app password for "Mail"
5. Use this password in your `EMAIL_APP_PASSWORD` variable

### 6. Maya Payment Setup

1. Sign up at https://developers.maya.ph/
2. Get your sandbox API keys from the dashboard
3. Add the keys to your `.env` file
4. For production, replace with production keys

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
- Backend: http://localhost:5000

## Project Structure

```
puso-shop/
├── backend/
│   ├── models/          # MongoDB models (User, Product, Order, League)
│   ├── routes/          # API routes (auth, products, orders, reviews, reports, leagues)
│   ├── services/        # Business logic (email, Maya payment)
│   ├── middleware/      # Authentication middleware
│   ├── config/          # Configuration files
│   ├── seed-100.js      # Product seeder (100 items)
│   ├── server.js        # Express server setup
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── common/      # SEO, LoadingSpinner
│   │   │   ├── layout/      # Header (with search autocomplete), Footer, Layout
│   │   │   ├── products/    # ProductCard (hover swap, color swatches)
│   │   │   ├── address/     # AddressForm (PSGC resolution)
│   │   │   ├── admin/       # Admin report components
│   │   │   ├── auth/        # OAuth components
│   │   │   └── cart/        # CartDrawer (size/quantity selector)
│   │   ├── pages/       # Page components (Home, Products, Account, admin/*)
│   │   ├── services/    # API service layer (product, auth, order, league, report)
│   │   ├── store/       # Zustand stores (cart, auth)
│   │   ├── utils/       # Utility functions
│   │   ├── index.css    # Global styles (button fill-up effects)
│   │   ├── App.jsx      # Main app component
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
- `POST /login` - User login
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

### Products (`/api/products`)
- `GET /` - Get all products (with filters: sport, team, category, gender, sale, price range, search)
- `GET /search/suggestions?q=term` - Search autocomplete suggestions
- `GET /:slug` - Get single product by slug
- `GET /admin/all` - Get all products including inactive (Admin)
- `GET /admin/:id` - Get product by ID (Admin)
- `GET /admin/stats` - Product statistics (Admin)
- `POST /` - Create product (Admin)
- `PUT /:id` - Update product (Admin)
- `DELETE /:id` - Soft-delete product (Admin)

### Orders (`/api/orders`)
- `POST /` - Create order and initiate Maya checkout
- `GET /:orderNumber` - Get order details
- `GET /user/:userId` - Get user's orders
- `GET /admin/all` - Get all orders (Admin)
- `GET /admin/stats` - Dashboard statistics (Admin)
- `PATCH /:id/status` - Update order status (Admin)
- `POST /webhooks/maya` - Maya payment webhook handler

### Reviews (`/api/reviews`)
- `GET /products/:slug/reviews` - Get product reviews with summary
- `POST /products/:slug/reviews` - Submit a review (authenticated)

### Reports (`/api/reports`)
- `GET /sales` - Sales analytics with date range (Admin)
- `GET /products` - Product performance analytics (Admin)
- `GET /orders` - Order analytics (Admin)
- `GET /customers` - Customer insights (Admin)

### Other
- `GET /api/sitemap.xml` - Dynamic sitemap for SEO

## Database Models

### User
- Email (unique, verified)
- Password (hashed)
- Name, phone
- Shipping addresses
- Role (customer/admin)

### Product
- Name, slug, description
- Price, sale price
- Category, sport, team, player, league
- Images (Cloudinary URLs)
- Sizes with stock levels (simple mode)
- Color variants with per-color sizes, stock, hex code, and image (variant mode)
- Review stats (avg rating, review count)
- Featured flag, active flag

### Order
- Order number (unique, auto-generated)
- User/guest info
- Items with details (including optional color)
- Shipping address (with PSGC fields)
- Payment info (Maya checkout ID, URL)
- Order status, tracking number

## Payment Flow

1. User completes checkout form
2. Backend creates order in database
3. Backend initiates Maya checkout session
4. User is redirected to Maya payment page
5. User completes payment
6. Maya sends webhook to backend
7. Backend updates order status
8. User receives confirmation email
9. User is redirected to order confirmation page

## Email Templates

The application sends HTML-formatted, mobile-responsive emails for:
- Email verification
- Order confirmation
- Password reset

## Deployment

### Backend Deployment (Heroku/Railway)

1. Set all environment variables in the hosting platform
2. Ensure MongoDB Atlas connection string is set
3. Update `FRONTEND_URL` to your production domain
4. Deploy the backend

### Frontend Deployment (Vercel/Netlify)

1. Set `VITE_API_URL` to your backend URL
2. Build the frontend: `npm run build`
3. Deploy the `dist` folder

## Security Considerations

- JWT tokens expire after 7 days
- Passwords are hashed with bcrypt
- Rate limiting on API endpoints
- Helmet.js for security headers
- CORS configured for frontend domain
- Input validation with express-validator
- MongoDB injection prevention

## Design Inspiration

- [MoreLabs](https://morelabs.com) - Homepage layout, button hover animations, product interactions, circle collections section, instafeed layout
- Philippine sports culture - Color palette (Deep Navy, Championship Gold, Flag Red)

## Support

For issues or questions:
- Create an issue in the GitHub repository

## License

MIT License

---

Made with pride for Philippine Sports
