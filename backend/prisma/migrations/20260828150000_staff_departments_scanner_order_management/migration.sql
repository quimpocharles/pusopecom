-- AlterEnum
-- Adds two narrowly-scoped StaffDepartment values (permission-model
-- launch-readiness fix): `scanner` (passes.checkin only) and
-- `order_management` (orders.view + orders.manage only). Purely additive —
-- no existing enum values, columns, or rows are touched.
ALTER TYPE "StaffDepartment" ADD VALUE 'scanner';
ALTER TYPE "StaffDepartment" ADD VALUE 'order_management';
