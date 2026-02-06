import mongoose from 'mongoose';

const sizeStockSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size']
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
}, { _id: false });

const colorSizeStockSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size']
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
}, { _id: false });

const colorVariantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
    trim: true
  },
  hex: {
    type: String,
    trim: true
  },
  image: {
    type: String
  },
  sizes: [colorSizeStockSchema]
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['jersey', 'tshirt', 'cap', 'shorts', 'accessories']
  },
  sport: {
    type: String,
    required: [true, 'Sport is required'],
    enum: ['basketball', 'volleyball', 'football', 'general']
  },
  gender: {
    type: String,
    required: true,
    enum: ['men', 'women', 'youth', 'unisex'],
    default: 'unisex'
  },
  league: {
    type: String,
    trim: true
  },
  team: {
    type: String,
    trim: true
  },
  player: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  sizes: [sizeStockSchema],
  colors: [colorVariantSchema],
  featured: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  totalStock: {
    type: Number,
    default: 0
  },
  avgRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Calculate total stock before saving
productSchema.pre('save', function(next) {
  let total = 0;
  if (this.sizes && this.sizes.length > 0) {
    total += this.sizes.reduce((sum, s) => sum + s.stock, 0);
  }
  if (this.colors && this.colors.length > 0) {
    total += this.colors.reduce((sum, c) =>
      sum + c.sizes.reduce((sSum, s) => sSum + s.stock, 0), 0);
  }
  this.totalStock = total;
  next();
});

// Create slug from name if not provided
productSchema.pre('validate', function(next) {
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Virtual for effective price (sale price if available, otherwise regular price)
productSchema.virtual('effectivePrice').get(function() {
  return this.salePrice || this.price;
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.salePrice && this.salePrice < this.price) {
    return Math.round(((this.price - this.salePrice) / this.price) * 100);
  }
  return 0;
});

// Include virtuals in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);

export default Product;
