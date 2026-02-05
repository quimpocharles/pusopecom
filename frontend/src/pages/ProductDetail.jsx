import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import VirtualTryOn from '../components/products/VirtualTryOn';
import productService from '../services/productService';
import useCartStore from '../store/cartStore';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [showTryOn, setShowTryOn] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productService.getProductBySlug(slug);
        setProduct(response.data);
        if (response.data.sizes.length > 0) {
          setSelectedSize(response.data.sizes[0].size);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
        setError('Product not found');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  const handleAddToCart = () => {
    if (!selectedSize) {
      setError('Please select a size');
      return;
    }

    const sizeStock = product.sizes.find(s => s.size === selectedSize);
    if (!sizeStock || sizeStock.stock < quantity) {
      setError('Not enough stock available');
      return;
    }

    addItem(product, selectedSize, quantity);
    navigate('/cart');
  };

  // Check if product is try-on eligible (jerseys, shirts, tshirts)
  const isTryOnEligible = product &&
    ['jersey', 'jerseys', 'tshirt', 'shirts', 'tops'].includes(product.category?.toLowerCase());

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-700">{error || 'Product not found'}</h1>
        </div>
      </Layout>
    );
  }

  const effectivePrice = product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const selectedSizeStock = product.sizes.find(s => s.size === selectedSize)?.stock || 0;

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden mb-4 relative">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {/* Try-On Badge */}
              {isTryOnEligible && (
                <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <SparklesIcon className="w-4 h-4" />
                  AI Try-On Available
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? 'border-primary-600' : 'border-gray-200'
                    }`}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {product.team && (
              <p className="text-primary-600 font-semibold mb-2">{product.team}</p>
            )}
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

            {/* Price */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold text-primary-600">
                ₱{effectivePrice.toFixed(2)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    ₱{product.price.toFixed(2)}
                  </span>
                  <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Save {product.discountPercentage}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 mb-6">{product.description}</p>

            {/* Badges */}
            <div className="flex gap-2 mb-6">
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm capitalize">
                {product.category}
              </span>
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm capitalize">
                {product.sport}
              </span>
            </div>

            {/* Virtual Try-On Button */}
            {isTryOnEligible && (
              <button
                onClick={() => setShowTryOn(true)}
                className="w-full mb-6 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                <SparklesIcon className="w-5 h-5" />
                Virtual Try-On - See It On You!
              </button>
            )}

            {/* Size Selection */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Select Size:</h3>
              <div className="flex gap-2">
                {product.sizes.map((sizeObj) => (
                  <button
                    key={sizeObj.size}
                    onClick={() => setSelectedSize(sizeObj.size)}
                    disabled={sizeObj.stock === 0}
                    className={`px-4 py-2 rounded border-2 font-semibold ${
                      selectedSize === sizeObj.size
                        ? 'border-primary-600 bg-primary-50 text-primary-600'
                        : sizeObj.stock === 0
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 hover:border-primary-600'
                    }`}
                  >
                    {sizeObj.size}
                  </button>
                ))}
              </div>
              {selectedSize && (
                <p className="text-sm text-gray-600 mt-2">
                  {selectedSizeStock} in stock
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Quantity:</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded border-2 border-gray-300 hover:border-primary-600"
                >
                  -
                </button>
                <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedSizeStock, quantity + 1))}
                  className="w-10 h-10 rounded border-2 border-gray-300 hover:border-primary-600"
                  disabled={quantity >= selectedSizeStock}
                >
                  +
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
                {error}
              </div>
            )}

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={product.totalStock === 0 || selectedSizeStock === 0}
              className="btn-primary w-full text-lg"
            >
              {product.totalStock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Try-On Modal */}
      {product && (
        <VirtualTryOn
          product={product}
          isOpen={showTryOn}
          onClose={() => setShowTryOn(false)}
        />
      )}
    </Layout>
  );
};

export default ProductDetail;
