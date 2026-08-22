-- ---------------------------------------------------------------------------
-- Quantity/inventory integrity — security remediation. A negative
-- OrderItem.quantity previously turned decrementStock's conditional UPDATE
-- (`stock: { gte: quantity }` / `stock: { decrement: quantity }`) into a
-- silent stock/totalStock INCREASE, and let Order.subtotal go negative,
-- letting an attacker pair a real item with a fabricated negative-quantity
-- line for the same or another variant to reduce (or, combined with
-- Order.total's own Math.max(0, ...) floor, zero out) what they pay while
-- corrupting inventory counters. Application-layer validation (routes/
-- orders.js's express-validator chain + normalization step) and repository-
-- layer validation (productRepository.js's assertValidQuantity guard on
-- decrementStock/restoreStock) now both reject this before it reaches the
-- database — these CHECK constraints are the third, independent layer,
-- matching this schema's own established convention (see the
-- product_sizes_size_check / product_color_sizes_size_check constraints
-- above in the init migration) of backstopping app-level rules that
-- Prisma's schema language itself cannot express.
--
-- Verified against both the dev/prod and the isolated test database before
-- this migration was written: zero existing rows violate any of the five
-- constraints below (no order_items.quantity <= 0, no negative stock/
-- totalStock/totalSold anywhere) — safe to add with no backfill.
--
-- totalSold specifically: traced every write path in the application
-- before adding its constraint. The only place totalSold is ever written
-- is routes/orders.js's order-creation transaction
-- (`totalSold: { increment: item.quantity } }`), always a positive
-- increment once the quantity fix above holds; it defaults to 0 and is
-- never decremented anywhere (releases/expirations/cancellations/returns
-- only ever restore `stock`/`totalStock`, not totalSold), never set to an
-- explicit value by the admin product form, and never touched by any seed
-- script or existing test. totalSold is therefore monotonically
-- non-decreasing today and this constraint cannot reject any legitimate
-- operation.
-- ---------------------------------------------------------------------------

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_stock_check"
  CHECK ("stock" >= 0);

ALTER TABLE "product_color_sizes" ADD CONSTRAINT "product_color_sizes_stock_check"
  CHECK ("stock" >= 0);

ALTER TABLE "products" ADD CONSTRAINT "products_total_stock_check"
  CHECK ("totalStock" >= 0);

ALTER TABLE "products" ADD CONSTRAINT "products_total_sold_check"
  CHECK ("totalSold" >= 0);
