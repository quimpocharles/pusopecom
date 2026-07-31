-- CreateIndex
CREATE INDEX "products_searchVector_idx" ON "products" USING GIN ("searchVector");
