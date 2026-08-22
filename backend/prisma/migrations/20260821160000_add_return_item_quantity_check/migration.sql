ALTER TABLE "return_items" ADD CONSTRAINT "return_items_quantity_check"
  CHECK ("quantity" > 0);
