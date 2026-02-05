# Puso Pilipinas - Sports Merchandise Store

A full-stack MERN ecommerce platform for Philippine sports merchandise, featuring Maya payment integration and email notifications.

## Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- Nodemailer (Gmail)
- Maya Checkout API
- Cloudinary (Image hosting)

### Frontend
- React 18 + Vite
- TailwindCSS
- React Router v6
- Zustand (State management)
- React Query
- React Hook Form + Zod
- Framer Motion

## Features

- ✅ User authentication (register, login, email verification, password reset)
- ✅ Product catalog with filtering (sport, team, category, size, price)
- ✅ Shopping cart with persistent storage
- ✅ Checkout flow with Maya payment integration
- ✅ Order management and tracking
- ✅ Email notifications (verification, order confirmation)
- ✅ Guest checkout option
- ✅ Admin dashboard capabilities
- ✅ Responsive design (mobile-first)
- ✅ NBA Store-inspired UI/UX

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

### 4. Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security > 2-Step Verification > App Passwords
4. Generate a new app password for "Mail"
5. Use this password in your `EMAIL_APP_PASSWORD` variable

### 5. Maya Payment Setup

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
│   ├── models/          # MongoDB models (User, Product, Order)
│   ├── routes/          # API routes (auth, products, orders)
│   ├── services/        # Business logic (email, Maya payment)
│   ├── middleware/      # Authentication middleware
│   ├── config/          # Configuration files
│   ├── server.js        # Express server setup
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── common/      # Reusable components
│   │   │   ├── layout/      # Layout components
│   │   │   ├── products/    # Product components
│   │   │   └── cart/        # Cart components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API service layer
│   │   ├── store/       # Zustand stores
│   │   ├── utils/       # Utility functions
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # Entry point
│   ├── public/
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
- `POST /resend-verification` - Resend verification email
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `GET /me` - Get current user

### Products (`/api/products`)
- `GET /products` - Get all products (with filters)
- `GET /products/:slug` - Get single product
- `POST /products` - Create product (Admin)
- `PUT /products/:id` - Update product (Admin)
- `DELETE /products/:id` - Delete product (Admin)

### Orders (`/api/orders`)
- `POST /orders` - Create order and initiate Maya checkout
- `GET /orders/:orderNumber` - Get order details
- `GET /orders/user/:userId` - Get user's orders
- `POST /webhooks/maya` - Maya payment webhook handler
- `PATCH /orders/:id/status` - Update order status (Admin)

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
- Category, sport, team, player
- Images (Cloudinary URLs)
- Sizes with stock levels
- Featured flag

### Order
- Order number (unique)
- User/guest info
- Items with details
- Shipping address
- Payment info (Maya)
- Order status, tracking

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

## Testing

### Sample Products

You can manually add products through the API or create a seed script. Example product:

```json
{
  "name": "Ginebra Home Jersey 2024",
  "slug": "ginebra-home-jersey-2024",
  "description": "Official Barangay Ginebra home jersey",
  "price": 1299,
  "salePrice": 999,
  "category": "jersey",
  "sport": "basketball",
  "team": "Barangay Ginebra San Miguel",
  "images": ["https://example.com/image.jpg"],
  "sizes": [
    { "size": "S", "stock": 10 },
    { "size": "M", "stock": 15 },
    { "size": "L", "stock": 12 },
    { "size": "XL", "stock": 8 }
  ],
  "featured": true,
  "active": true
}
```

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Contact: your-email@example.com

## License

MIT License

## Credits

Built with inspiration from NBA Store (store.nba.com)

---

Made with ❤️ for Philippine Sports
