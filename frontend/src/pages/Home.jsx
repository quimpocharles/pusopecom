import { useEffect, useState, useRef } from 'react';
import heroImage from '../assets/images/banner-home.jpg';
import tryOnPreviewFallback from '../assets/images/blueGilas.gif';
import collectionImage from '../assets/images/dwight.jpg';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  SparklesIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import CartDrawer from '../components/cart/CartDrawer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import productService from '../services/productService';
import settingsService from '../services/settingsService';
import SEO from '../components/common/SEO';

const Home = () => {
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('basketball');
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [tryOnSettings, setTryOnSettings] = useState({
    title: 'Try on the Gilas Pilipinas shirt!',
    image: '',
    productUrl: '/products/gilas-pilipinas-t-shirt',
  });
  const carouselRef = useRef(null);

  const categories = [
    { id: 'basketball', label: 'Basketball', icon: '🏀' },
    { id: 'volleyball', label: 'Volleyball', icon: '🏐' },
    { id: 'football', label: 'Football', icon: '⚽' },
  ];

  // Fetch site settings for try-on section
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsService.getSettings();
        if (res.data?.tryOn) {
          setTryOnSettings((prev) => ({
            title: res.data.tryOn.title || prev.title,
            image: res.data.tryOn.image || prev.image,
            productUrl: res.data.tryOn.productUrl || prev.productUrl,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

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
      <SEO
        title="Puso Pilipinas — Philippine Sports Merchandise"
        description="Shop authentic jerseys, apparel, and accessories for basketball, volleyball, and football. Free shipping on select items."
      />
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
      <section className="relative text-white overflow-hidden">
        <img
          src={heroImage}
          alt="Puso Pilipinas hero banner"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/85 via-primary-800/70 to-primary-900/40" />
        <div className="container-custom py-12 md:py-32 relative z-10">
          <div className="max-w-3xl">
            <p className="text-secondary-400 font-semibold mb-3 md:mb-4 tracking-wide uppercase text-xs md:text-sm">
              Official Licensed Merchandise
            </p>
            <h1 className="text-3xl md:text-display lg:text-display-lg mb-4 md:mb-6 font-bold text-balance">
              Show Your PUSO ❤️
            </h1>
            <p className="text-base md:text-2xl text-white/80 mb-6 md:mb-8 max-w-xl">
              Authentic jerseys and gear from PBA, UAAP, PVL, and more.
              Support Philippine sports with every purchase.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/products" className="btn-primary-light text-sm md:text-base">
                Shop All Products
              </Link>
              <Link to="/products?category=jersey" className="btn-secondary-light text-sm md:text-base">
                Browse Jerseys
              </Link>
            </div>
          </div>
        </div>
      </section>

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

      {/* Virtual Try-On Feature Highlight */}
      <section className="py-10 md:py-16 lg:py-24 bg-white">
        <div className="container-custom">
          <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              <div className="p-6 md:p-12 text-white">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5 md:px-4 md:py-2 mb-4 md:mb-6">
                  <SparklesIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-semibold text-xs md:text-sm">AI-Powered Feature</span>
                </div>
                <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
                  {tryOnSettings.title}
                </h2>
                <p className="text-sm md:text-lg text-white/90 mb-4 md:mb-6">
                  Virtual Try-on allow you to see how any shirt or jersey looks on you before buying! Upload your photo
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
                  to={tryOnSettings.productUrl}
                  className="hover-fill hover-fill-navy inline-flex items-center gap-2 bg-white text-primary-700 px-5 py-2.5 md:px-6 md:py-3 rounded-xl font-semibold text-sm md:text-base transition-all duration-200 active:scale-[0.98]"
                >
                  Try It Now
                  <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>
              <div className="hidden md:block p-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-sm mx-auto">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden mb-4">
                    <img
                      src={tryOnSettings.image || tryOnPreviewFallback}
                      alt="Virtual try-on demo"
                      className="w-full h-full object-cover"
                    />
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
            <div className="inline-flex bg-white rounded-xl p-1 md:p-1.5 shadow-soft">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-2 md:px-6 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 flex items-center gap-1.5 md:gap-2 ${
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
                  src={collectionImage}
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

      {/* FAQ Section */}
      <section className="py-12 md:py-24 bg-gray-50">
        <div className="container-custom max-w-3xl">
          <h2 className="text-xl md:text-display-sm font-semibold text-center mb-3 md:mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-gray-500 text-center mb-8 md:mb-12">
            Everything you need to know about Puso Pilipinas
          </p>

          <div className="divide-y divide-gray-200">
            {[
              {
                q: 'Are all your products authentic?',
                a: 'Yes! Every product we sell is 100% officially licensed merchandise. We source directly from authorized distributors and brands to guarantee authenticity. Each item comes with official tags and packaging.',
              },
              {
                q: 'How long does shipping take?',
                a: 'Metro Manila orders are delivered within 2-3 business days. Provincial orders typically arrive within 5-7 business days. We offer free shipping on all orders over ₱2,000.',
              },
              {
                q: 'What is your return policy?',
                a: 'We offer a hassle-free 30-day return policy. If you\'re not satisfied with your purchase, simply contact our support team and we\'ll arrange a return or exchange. Items must be in their original condition with tags attached.',
              },
              {
                q: 'How does Virtual Try-On work?',
                a: 'Our AI-powered Virtual Try-On lets you see how any jersey looks on you before buying. Simply upload a photo of yourself on the product page, and our technology will generate a realistic preview of you wearing the jersey.',
              },
              {
                q: 'What sizes do you carry?',
                a: 'We carry separate men\'s and women\'s product lines, as well as unisex options, in sizes from XS to 3XL for most jerseys and apparel. Each product page includes a detailed size chart with measurements in both inches and centimeters so you can find the perfect fit. Use the Men and Women filters in our shop to browse gender-specific collections.',
              },
              {
                q: 'Do you ship internationally?',
                a: 'Currently we ship within the Philippines. We\'re working on expanding to international shipping for our kababayans abroad. Sign up for our newsletter to be notified when international shipping becomes available.',
              },
            ].map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-5 md:py-6 text-left group"
                >
                  <span className="font-medium text-sm md:text-base text-gray-900 pr-4 group-hover:text-primary-600 transition-colors">
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-gray-400 group-hover:text-primary-600 transition-colors">
                    <svg
                      className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${openFaq === index ? 'rotate-45' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: openFaq === index ? '200px' : '0px',
                    opacity: openFaq === index ? 1 : 0,
                  }}
                >
                  <p className="text-sm md:text-base text-gray-600 pb-5 md:pb-6 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
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
              className="flex-1 px-4 py-3 md:px-5 md:py-3.5 rounded-xl text-gray-900 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="hover-fill hover-fill-navy bg-white text-primary-700 px-6 py-3 md:px-8 md:py-3.5 rounded-xl font-semibold text-sm md:text-base transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
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
