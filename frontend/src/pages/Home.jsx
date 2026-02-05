import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  SparklesIcon,
  TruckIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import CartDrawer from '../components/cart/CartDrawer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import productService from '../services/productService';

const Home = () => {
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('basketball');
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const carouselRef = useRef(null);

  const categories = [
    { id: 'basketball', label: 'Basketball', icon: '🏀' },
    { id: 'volleyball', label: 'Volleyball', icon: '🏐' },
    { id: 'football', label: 'Football', icon: '⚽' },
  ];

  // Fetch featured products
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await productService.getProducts({ featured: true, category: 'jersey', limit: 3 });
        setFeaturedProducts(res.data);
      } catch (error) {
        console.error('Failed to fetch featured products:', error);
      }
    };
    fetchFeatured();
  }, []);

  // Fetch products by sport when active category changes
  useEffect(() => {
    const fetchByCategory = async () => {
      setCategoryLoading(true);
      try {
        const res = await productService.getProducts({ sport: activeCategory, limit: 20 });
        setCategoryProducts(res.data);
      } catch (error) {
        console.error('Failed to fetch category products:', error);
      } finally {
        setCategoryLoading(false);
      }
    };
    fetchByCategory();
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [activeCategory]);

  const handleBuyNow = (product) => {
    setPendingProduct(product);
    setCartOpen(true);
  };

  // Scroll carousel
  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <Layout>
      {/* Marquee Announcement Bar */}
      <div className="bg-primary-600 text-white py-2 md:py-2.5 overflow-x-hidden text-xs md:text-sm">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 md:gap-12 px-4 md:px-6">
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-secondary-400" />
                <span>Try jerseys virtually before you buy!</span>
              </span>
              <span className="text-white/40">✦</span>
              <span className="flex items-center gap-2">
                <TruckIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span><strong>FREE SHIPPING</strong> on orders over ₱2,000</span>
              </span>
              <span className="text-white/40">✦</span>
              <span>Authentic licensed merchandise</span>
              <span className="text-white/40">✦</span>
              <span className="flex items-center gap-2">
                <span>Support Philippine Sports 🇵🇭</span>
              </span>
              <span className="text-white/40">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <div className="container-custom py-12 md:py-32">
          <div className="max-w-3xl">
            <p className="text-secondary-400 font-semibold mb-3 md:mb-4 tracking-wide uppercase text-xs md:text-sm">
              Official Licensed Merchandise
            </p>
            <h1 className="text-3xl md:text-display lg:text-display-lg mb-4 md:mb-6 font-bold text-balance">
              Wear Your Team's Pride
            </h1>
            <p className="text-base md:text-2xl text-white/80 mb-6 md:mb-8 max-w-xl">
              Authentic jerseys and gear from PBA, UAAP, PVL, and more.
              Support Philippine sports with every purchase.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/products" className="btn-primary-light text-sm md:text-base">
                Shop All Products
              </Link>
              <Link to="/products?category=jerseys" className="btn-secondary-light text-sm md:text-base">
                Browse Jerseys
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="bg-gray-50 border-b border-gray-100">
        <div className="container-custom py-4 md:py-6">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-16 text-center text-sm md:text-base">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="flex text-secondary-500">
                {[...Array(5)].map((_, i) => (
                  <StarSolid key={i} className="w-4 h-4 md:w-5 md:h-5" />
                ))}
              </div>
              <span className="font-semibold text-gray-900">4.9/5</span>
              <span className="text-gray-500">(2,500+ reviews)</span>
            </div>
            <div className="text-gray-500">
              <span className="font-semibold text-gray-900">50,000+</span> jerseys sold
            </div>
            <div className="text-gray-500">
              <span className="font-semibold text-gray-900">100%</span> authentic products
            </div>
          </div>
        </div>
      </section>

      {/* Virtual Try-On Feature Highlight */}
      <section className="py-10 md:py-16 lg:py-24 bg-white">
        <div className="container-custom">
          <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              <div className="p-6 md:p-12 text-white">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 md:px-4 md:py-2 mb-4 md:mb-6">
                  <SparklesIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-semibold text-xs md:text-sm">AI-Powered Feature</span>
                </div>
                <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
                  Virtual Try-On
                </h2>
                <p className="text-sm md:text-lg text-white/90 mb-4 md:mb-6">
                  See how any jersey looks on you before buying! Upload your photo
                  and our AI will show you wearing your favorite team's gear.
                </p>
                <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8 text-sm md:text-base">
                  {['Upload any photo of yourself', 'AI generates realistic preview', 'Buy with confidence'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 md:gap-3">
                      <div className="w-5 h-5 md:w-6 md:h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/products?category=jerseys"
                  className="inline-flex items-center gap-2 bg-white text-primary-700 px-5 py-2.5 md:px-6 md:py-3 rounded-full font-semibold text-sm md:text-base hover:bg-gray-100 transition-colors"
                >
                  Try It Now
                  <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>
              <div className="hidden md:block p-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-sm mx-auto">
                  <div className="aspect-[3/4] bg-white/20 rounded-xl flex items-center justify-center mb-4">
                    <div className="text-center">
                      <SparklesIcon className="w-16 h-16 mx-auto mb-4 text-white/60" />
                      <p className="text-white/80 font-medium">Your try-on preview</p>
                      <p className="text-white/60 text-sm">appears here</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/20 rounded-lg p-3 text-center">
                      <p className="text-white/60 text-xs">Upload Photo</p>
                    </div>
                    <div className="flex-1 bg-white rounded-lg p-3 text-center">
                      <p className="text-primary-700 text-xs font-semibold">Generate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Sport - Tabbed Carousel (MoreLabs style) */}
      <section className="py-10 md:py-16 lg:py-24 bg-gray-50 overflow-hidden">
        <div className="container-custom">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-xl md:text-display-sm mb-2 md:mb-4 font-semibold">Shop by Sport</h2>
            <p className="text-gray-600 text-sm md:text-lg mb-6 md:mb-8">Find gear for your favorite league</p>

            {/* Category Tabs */}
            <div className="inline-flex bg-white rounded-full p-1 md:p-1.5 shadow-soft">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-2 md:px-6 md:py-3 rounded-full font-semibold text-xs md:text-sm transition-all duration-300 flex items-center gap-1.5 md:gap-2 ${
                    activeCategory === cat.id
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Product Carousel */}
          <div className="relative">
            {/* Scroll Right Button */}
            <button
              onClick={() => scrollCarousel('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-card flex items-center justify-center hover:shadow-card-hover transition-shadow hidden md:flex"
            >
              <ChevronRightIcon className="w-6 h-6 text-gray-600" />
            </button>

            {/* Carousel Container */}
            <div
              ref={carouselRef}
              className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {categoryLoading ? (
                <div className="w-full flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : categoryProducts.length > 0 ? (
                categoryProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex-shrink-0 w-[220px] md:w-[280px] snap-start"
                  >
                    <ProductCard product={product} onBuyNow={handleBuyNow} />
                  </div>
                ))
              ) : (
                <div className="w-full text-center py-12">
                  <p className="text-gray-500">No {activeCategory} products available yet</p>
                  <Link to="/products" className="btn-primary mt-4 inline-block">
                    Browse All Products
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* View All Link */}
          <div className="text-center mt-8">
            <Link
              to={`/products?sport=${activeCategory}`}
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold"
            >
              View All {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Products
              <ChevronRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Latest Collection — image left, text right */}
      <section className="py-12 md:py-28 bg-white">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-6 md:gap-16 items-center">
            {/* Image */}
            <div className="order-1">
              <div className="aspect-[4/5] bg-gray-100 rounded-2xl md:rounded-3xl overflow-hidden">
                <img
                  src="https://placehold.co/800x1000/0A2463/FFFFFF?text=2025+Collection"
                  alt="Latest Collection"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Text */}
            <div className="order-2">
              <p className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 md:mb-4">New Collection</p>
              <h2 className="text-xl md:text-display-sm lg:text-display mb-4 md:mb-6 font-semibold">
                Game Day Ready
              </h2>
              <p className="text-sm md:text-lg text-gray-600 mb-6 md:mb-8 leading-relaxed">
                Introducing our 2025 collection of authentic jerseys, training gear, and accessories.
                From courtside to streetwear — designed for fans who live and breathe Philippine sports.
              </p>
              <Link
                to="/products"
                className="btn-secondary inline-flex items-center gap-2 text-sm md:text-base"
              >
                explore the collection
                <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products — clickable list with changing image */}
      {featuredProducts.length > 0 && (
        <section className="py-12 md:py-28 bg-gray-50">
          <div className="container-custom">
            <p className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 md:mb-6">our featured gear</p>

            <div className="grid md:grid-cols-2 gap-6 md:gap-16 items-start">
              {/* Left — product list */}
              <div>
                <div className="space-y-1 md:space-y-2">
                  {featuredProducts.map((product, index) => (
                    <button
                      key={product._id}
                      onClick={() => setActiveFeatured(index)}
                      className={`block text-left w-full transition-all duration-300 text-base md:text-2xl lg:text-[calc(2.2rem*0.9)] ${
                        activeFeatured === index
                          ? 'text-gray-900'
                          : 'text-gray-300 hover:text-gray-500'
                      }`}
                    >
                      <span className={`font-semibold leading-tight ${
                        activeFeatured === index ? 'underline underline-offset-4 decoration-2' : ''
                      }`}>
                        {product.name.replace(/ (2024|2025|2024-25)$/, '')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Description of active product */}
                <p className="text-sm md:text-base text-gray-600 mt-5 md:mt-8 mb-5 md:mb-8 leading-relaxed max-w-md transition-all duration-300">
                  {featuredProducts[activeFeatured]?.description}
                </p>

                <Link
                  to={`/products/${featuredProducts[activeFeatured]?.slug}`}
                  className="btn-secondary inline-flex items-center gap-2 text-sm md:text-base"
                >
                  shop now
                  <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>

              {/* Right — product image */}
              <div className="order-first md:order-last">
                <div className="aspect-[4/5] bg-gray-100 rounded-2xl md:rounded-3xl overflow-hidden relative">
                  {featuredProducts.map((product, index) => (
                    <img
                      key={product._id}
                      src={product.images?.[0] || '/placeholder.jpg'}
                      alt={product.name}
                      className={`w-full h-full object-cover transition-opacity duration-500 absolute inset-0 ${
                        activeFeatured === index ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Shop by League — horizontal scroll, 3.5 visible */}
      <section className="py-12 md:py-24 bg-white overflow-hidden">
        <div className="container-custom mb-6 md:mb-10">
          <h2 className="text-xl md:text-display-sm font-semibold">Shop by League</h2>
        </div>

        <div
          className="flex overflow-x-auto scrollbar-hide pl-4 sm:pl-6 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] pt-4 -mt-4 gap-5 md:gap-10"
        >
          {[
            { name: 'Gilas Pilipinas', abbr: 'GILAS', bg: '#0A2463', text: '#FFFFFF', link: '/products?team=Gilas+Pilipinas' },
            { name: 'PBA', abbr: 'PBA', bg: '#1E3A8A', text: '#F59E0B', link: '/products?sport=basketball' },
            { name: 'UAAP', abbr: 'UAAP', bg: '#16A34A', text: '#FFFFFF', link: '/products?sport=basketball' },
            { name: 'PVL', abbr: 'PVL', bg: '#EC4899', text: '#FFFFFF', link: '/products?sport=volleyball' },
            { name: 'NCAA', abbr: 'NCAA', bg: '#DC2626', text: '#FFFFFF', link: '/products?sport=basketball' },
            { name: 'Philippine Azkals', abbr: 'PFF', bg: '#0D9488', text: '#FFFFFF', link: '/products?sport=football' },
            { name: 'Alas Pilipinas', abbr: 'ALAS', bg: '#7C3AED', text: '#FFFFFF', link: '/products?sport=volleyball' },
          ].map((league) => (
            <Link
              key={league.abbr}
              to={league.link}
              className="flex flex-col items-center group flex-shrink-0 w-[calc((100vw-80px)/3.5)] md:w-[calc((100vw-160px)/3.5)]"
            >
              <div
                className="w-[70%] mx-auto aspect-square rounded-full flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300"
                style={{ backgroundColor: league.bg }}
              >
                <span
                  className="text-sm md:text-lg lg:text-xl font-bold tracking-wide select-none"
                  style={{ color: league.text }}
                >
                  {league.abbr}
                </span>
              </div>
              <span className="mt-3 md:mt-5 font-semibold text-gray-900 group-hover:text-primary-600 transition-colors text-center text-xs md:text-base lg:text-lg">
                {league.name}
              </span>
            </Link>
          ))}
          {/* Right padding spacer */}
          <div className="flex-shrink-0 w-4 sm:w-6 lg:w-8" />
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { icon: ShieldCheckIcon, title: '100% Authentic', desc: 'Official licensed products' },
              { icon: TruckIcon, title: 'Free Shipping', desc: 'On orders over ₱2,000' },
              { icon: ArrowPathIcon, title: 'Easy Returns', desc: '30-day return policy' },
              { icon: SparklesIcon, title: 'Virtual Try-On', desc: 'See it before you buy' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4">
                  <item.icon className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-0.5 md:mb-1 text-sm md:text-base">{item.title}</h3>
                <p className="text-xs md:text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instafeed / Social Section */}
      {(() => {
        const feedImages = [
          { src: 'https://placehold.co/400x500/0A2463/FFFFFF?text=Game+Day', alt: 'Game day fans' },
          { src: 'https://placehold.co/400x400/1E3A8A/F59E0B?text=PBA+Action', alt: 'PBA action' },
          { src: 'https://placehold.co/400x500/EC4899/FFFFFF?text=PVL+Match', alt: 'PVL volleyball' },
          { src: 'https://placehold.co/400x400/16A34A/FFFFFF?text=UAAP+Fans', alt: 'UAAP fans' },
          { src: 'https://placehold.co/400x400/DC2626/FFFFFF?text=Jersey+Drop', alt: 'New jersey' },
          { src: 'https://placehold.co/400x500/0D9488/FFFFFF?text=Azkals+⚽', alt: 'Azkals football' },
          { src: 'https://placehold.co/400x400/7C3AED/FFFFFF?text=Fan+Zone', alt: 'Fan zone' },
          { src: 'https://placehold.co/400x500/F59E0B/1E3A8A?text=Merch+🏆', alt: 'Merchandise' },
        ];
        const topRow = feedImages.slice(0, 4);
        const bottomRow = feedImages.slice(4, 8);
        return (
          <section className="bg-primary-50 py-10 md:py-0 overflow-x-hidden">
            {/* Mobile layout */}
            <div className="md:hidden">
              {/* Top row circles */}
              <div className="flex justify-center gap-2 px-3">
                {topRow.map((img, i) => (
                  <div key={i} className="w-[22%] flex-shrink-0 aspect-square rounded-full overflow-hidden">
                    <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Center text */}
              <div className="text-center px-6 py-8">
                <a href="https://instagram.com/pusopilipinas" target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary-600 underline underline-offset-4">
                  @pusopilipinas
                </a>
                <h2 className="text-2xl font-bold text-gray-900 mt-2 mb-2">
                  Let's get social
                </h2>
                <p className="text-sm text-gray-600 mb-5">
                  Stay in the loop and connect with us on your favorite social platforms.
                </p>
                <a
                  href="https://instagram.com/pusopilipinas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 w-full justify-center text-sm"
                >
                  follow us
                  <ChevronRightIcon className="w-4 h-4" />
                </a>
              </div>

              {/* Bottom row circles */}
              <div className="flex justify-center gap-2 px-3">
                {bottomRow.map((img, i) => (
                  <div key={i} className="w-[22%] flex-shrink-0 aspect-square rounded-full overflow-hidden">
                    <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden md:grid relative" style={{
              gridTemplateColumns: '0.8fr 1fr 2.4fr 1fr 0.8fr',
              gridTemplateRows: '1fr 1fr',
              gap: '16px',
              minHeight: '520px',
            }}>
              {/* Row 1 images */}
              <div className="rounded-full overflow-hidden -ml-[20%]" style={{ gridColumn: 1, gridRow: 1 }}>
                <img src={topRow[0].src} alt={topRow[0].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-[2rem] overflow-hidden" style={{ gridColumn: 2, gridRow: 1 }}>
                <img src={topRow[1].src} alt={topRow[1].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-full overflow-hidden" style={{ gridColumn: 4, gridRow: 1 }}>
                <img src={topRow[2].src} alt={topRow[2].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-[2rem] overflow-hidden -mr-[20%]" style={{ gridColumn: 5, gridRow: 1 }}>
                <img src={topRow[3].src} alt={topRow[3].alt} className="w-full h-full object-cover" />
              </div>

              {/* Row 2 images */}
              <div className="rounded-[2rem] overflow-hidden -ml-[20%]" style={{ gridColumn: 1, gridRow: 2 }}>
                <img src={bottomRow[0].src} alt={bottomRow[0].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-full overflow-hidden" style={{ gridColumn: 2, gridRow: 2 }}>
                <img src={bottomRow[1].src} alt={bottomRow[1].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-[2rem] overflow-hidden" style={{ gridColumn: 4, gridRow: 2 }}>
                <img src={bottomRow[2].src} alt={bottomRow[2].alt} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-full overflow-hidden -mr-[20%]" style={{ gridColumn: 5, gridRow: 2 }}>
                <img src={bottomRow[3].src} alt={bottomRow[3].alt} className="w-full h-full object-cover" />
              </div>

              {/* Center text */}
              <div className="flex flex-col items-center justify-center text-center px-8" style={{ gridColumn: 3, gridRow: '1 / 3' }}>
                <a href="https://instagram.com/pusopilipinas" target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary-600 underline underline-offset-4">
                  @pusopilipinas
                </a>
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-4 mb-4">
                  Let's get social
                </h2>
                <p className="text-gray-600 mb-8 max-w-sm">
                  Stay in the loop and connect with us on your favorite social platforms.
                </p>
                <a
                  href="https://instagram.com/pusopilipinas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  follow us
                  <ChevronRightIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Newsletter */}
      <section className="py-12 md:py-16 lg:py-24 bg-primary-600">
        <div className="container-custom max-w-2xl text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">
            Join the Puso Pilipinas Family
          </h2>
          <p className="text-sm md:text-lg text-white/80 mb-6 md:mb-8">
            Get exclusive deals, early access to new releases, and 10% off your first order.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 md:px-5 md:py-3.5 rounded-full text-gray-900 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="bg-white text-primary-700 px-6 py-3 md:px-8 md:py-3.5 rounded-full font-semibold text-sm md:text-base hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
          <p className="text-xs md:text-sm text-white/60 mt-3 md:mt-4">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>
      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => {
          setCartOpen(false);
          setPendingProduct(null);
        }}
        pendingProduct={pendingProduct}
      />
    </Layout>
  );
};

export default Home;
