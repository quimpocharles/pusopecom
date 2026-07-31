-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google', 'facebook');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'admin');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('jersey', 'tshirt', 'cap', 'shorts', 'accessories');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('basketball', 'volleyball', 'football', 'general');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('men', 'women', 'youth', 'unisex');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('processing', 'confirmed', 'shipped', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('view', 'search');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "ageVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "googleId" TEXT,
    "facebookId" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'local',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "accountLocked" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'customer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "region" TEXT,
    "barangay" TEXT,
    "zipCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "category" "ProductCategory" NOT NULL,
    "sport" "Sport" NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'unisex',
    "league" TEXT,
    "team" TEXT,
    "player" TEXT,
    "images" TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "tryOnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totalStock" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_colors" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "hex" TEXT,
    "image" TEXT,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_color_sizes" (
    "id" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_color_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "shipToFullName" TEXT NOT NULL,
    "shipToPhone" TEXT NOT NULL,
    "shipToCountry" TEXT NOT NULL DEFAULT 'Philippines',
    "shipToAddress" TEXT NOT NULL,
    "shipToCity" TEXT NOT NULL,
    "shipToProvince" TEXT NOT NULL,
    "shipToRegion" TEXT,
    "shipToBarangay" TEXT,
    "shipToZipCode" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'maya',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "mayaPaymentId" TEXT,
    "mayaCheckoutUrl" TEXT,
    "orderStatus" "OrderStatus" NOT NULL DEFAULT 'processing',
    "courier" TEXT,
    "trackingNumber" TEXT,
    "shippingMethod" TEXT,
    "shippingRegion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT,
    "image" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sports" "Sport"[],
    "teams" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "email" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shippingMethod" TEXT NOT NULL,
    "orderTotal" DOUBLE PRECISION NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "tryOnTitle" TEXT NOT NULL DEFAULT 'Try on the Gilas Pilipinas shirt!',
    "tryOnImage" TEXT NOT NULL DEFAULT '',
    "tryOnProductUrl" TEXT NOT NULL DEFAULT '/products/gilas-pilipinas-t-shirt',
    "tryOnAdVideoUrl" TEXT NOT NULL DEFAULT '',
    "tryOnAdButtonText" TEXT NOT NULL DEFAULT 'Visit Playtime.ph',
    "tryOnAdButtonUrl" TEXT NOT NULL DEFAULT 'https://www.playtime.ph/',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_on_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "productImage" TEXT,
    "success" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "try_on_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "type" "ActivityType" NOT NULL,
    "productId" TEXT,
    "query" TEXT,
    "category" TEXT,
    "sport" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_pickup_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "deadlineHours" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_pickup_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_slots" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "pickupDate" TEXT,
    "pickupHours" TEXT,
    "pickupStartTime" TEXT,
    "specialInstructions" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pickup_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_facebookId_key" ON "users"("facebookId");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_sport_league_team_category_gender_active_idx" ON "products"("sport", "league", "team", "category", "gender", "active");

-- CreateIndex
CREATE INDEX "products_totalSold_idx" ON "products"("totalSold");

-- CreateIndex
CREATE INDEX "products_totalViews_idx" ON "products"("totalViews");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_productId_size_key" ON "product_sizes"("productId", "size");

-- CreateIndex
CREATE INDEX "product_colors_productId_idx" ON "product_colors"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_color_sizes_colorId_size_key" ON "product_color_sizes"("colorId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_orderStatus_userId_createdAt_idx" ON "orders"("paymentStatus", "orderStatus", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_name_key" ON "leagues"("name");

-- CreateIndex
CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_productId_email_key" ON "reviews"("productId", "email");

-- CreateIndex
CREATE INDEX "try_on_logs_productId_idx" ON "try_on_logs"("productId");

-- CreateIndex
CREATE INDEX "try_on_logs_createdAt_idx" ON "try_on_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_activities_userId_type_idx" ON "user_activities"("userId", "type");

-- CreateIndex
CREATE INDEX "user_activities_sessionId_type_idx" ON "user_activities"("sessionId", "type");

-- CreateIndex
CREATE INDEX "user_activities_timestamp_idx" ON "user_activities"("timestamp");

-- CreateIndex
CREATE INDEX "pickup_slots_configId_idx" ON "pickup_slots"("configId");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_color_sizes" ADD CONSTRAINT "product_color_sizes_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "product_colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_logs" ADD CONSTRAINT "try_on_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_configId_fkey" FOREIGN KEY ("configId") REFERENCES "venue_pickup_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Size validity — Mongoose enforced this via a Schema enum validator on
-- sizeStockSchema / colorSizeStockSchema. `size` is a plain TEXT column here
-- (see prisma/schema.prisma header comment for why it's not a Prisma enum),
-- so the same value list is enforced with a CHECK constraint instead.
-- ---------------------------------------------------------------------------

ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_size_check"
  CHECK ("size" IN ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'));

ALTER TABLE "product_color_sizes" ADD CONSTRAINT "product_color_sizes_size_check"
  CHECK ("size" IN ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'));

-- ---------------------------------------------------------------------------
-- Full-text search — replaces the MongoDB $text index created at startup in
-- server.js today (`{ name: 'text', description: 'text', team: 'text',
-- player: 'text' }`, no field weighting specified, i.e. all four fields
-- equally weighted). Kept equally weighted here to match existing search
-- behavior exactly; a deliberate ranking change (e.g. weighting name/team
-- above description) is a real product decision to make separately, not
-- something to smuggle into a persistence migration.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.team, '') || ' ' ||
    coalesce(NEW.player, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, team, player ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("searchVector");
