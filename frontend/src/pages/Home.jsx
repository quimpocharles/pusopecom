import { useEffect, useState, useRef } from 'react';
import gilasImage from '../assets/images/gilas.png';
import pbaImage from '../assets/images/pba.png';
import uaapImage from '../assets/images/uaap.png';
import pvlImage from '../assets/images/pvl.png';
import ncaaImage from '../assets/images/ncaa.png';
import sbpImage from '../assets/images/sbp.png';
import smartOImage from '../assets/images/smart-o.png';
import bahayImage from '../assets/images/bahay.webp';
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
import LoadingSpinner from '../components/common/LoadingSpinner';
import useCartStore from '../store/cartStore';
import productService from '../services/productService';
import settingsService from '../services/settingsService';
import SEO from '../components/common/SEO';

const Home = () => {
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('basketball');
  const openCart = useCartStore((state) => state.openCart);
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
    { id: 'esports', label: 'E-Sports', icon: '🎮' },
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
    openCart(product);
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
        title="Puso Pilipinas — Philippine Sports Merchandise | Basketball, Volleyball, E-Sports"
        description="Shop authentic jerseys, apparel, and accessories for basketball, volleyball, football, and e-sports. Rep Gilas Pilipinas, PBA, PVL, UAAP, NCAA, and more. Free shipping on select items."
      />
      {/* ── Hero Section: Virtual Try-On Lead ───────────────────────── */}
      <section
        className="relative flex flex-col items-center text-center overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              'repeating-linear-gradient(0deg,   transparent, transparent 64px, rgba(255,255,255,0.025) 64px, rgba(255,255,255,0.025) 65px)',
              'repeating-linear-gradient(90deg,  transparent, transparent 64px, rgba(255,255,255,0.025) 64px, rgba(255,255,255,0.025) 65px)',
            ].join(', '),
            maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 100%)',
          }}
        />
        {/* Radial glow at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(255,255,255,0.055) 0%, transparent 70%)' }}
        />

        {/* ── Top content: badge · H1 · subline · CTA ── */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-28 pb-12 md:pt-36 md:pb-16 w-full">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-6 md:mb-8"
            style={{
              background: 'linear-gradient(90deg, #0038A8 0%, #CE1126 18%, #FCD116 35%, #0038A8 50%, #CE1126 68%, #FCD116 85%, #0038A8 100%)',
              backgroundSize: '200% 100%',
              animation: 'pusoFlagSweep 6s linear infinite',
              borderRadius: '100px',
              padding: '5px 16px',
            }}
          >
            <SparklesIcon className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              ✦ AI-Powered Feature
            </span>
          </div>

          {/* H1 */}
          <h1
            className="text-white font-black text-center"
            style={{
              fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              marginBottom: '20px',
            }}
          >
            See it on you,<br />before you buy.
          </h1>

          {/* Subline tagline */}
          <p
            className="text-center"
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'rgba(255,255,255,0.50)',
              letterSpacing: '-0.01em',
              marginBottom: '36px',
            }}
          >
            Wear your Puso — before checkout.
          </p>

          {/* Primary CTA — animated Philippine flag gradient */}
          <Link
            to={tryOnSettings.productUrl}
            className="inline-flex items-center gap-2 font-bold active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(90deg, #0038A8 0%, #CE1126 18%, #FCD116 35%, #0038A8 50%, #CE1126 68%, #FCD116 85%, #0038A8 100%)',
              backgroundSize: '200% 100%',
              animation: 'pusoFlagSweep 6s linear infinite',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
              borderRadius: '100px',
              padding: '14px 32px',
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            Try On a Jersey Now
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Browser mockup ── */}
        <div className="relative w-full" style={{ zIndex: 2 }}>
          {/* Ground shadow on the section floor */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '78%',
              maxWidth: '800px',
              height: '90px',
              background: 'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.20) 0%, transparent 72%)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />

          {/* Floating mockup card */}
          <div
            className="relative flex justify-center"
            style={{ padding: '0 clamp(12px, 4vw, 48px)', zIndex: 2 }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '940px',
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              {/* Browser chrome bar */}
              <div
                style={{
                  background: '#1a1a1c',
                  padding: '11px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {[0.18, 0.18, 0.18].map((op, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: `rgba(255,255,255,${op})`, flexShrink: 0 }} />
                ))}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.01em', userSelect: 'none' }}>
                    pusostore.com — Virtual Try-On
                  </div>
                </div>
              </div>

              {/* Screen content */}
              <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0d0d0d' }}>
                <img
                  src={tryOnSettings.image || tryOnPreviewFallback}
                  alt="Virtual try-on demo — see yourself wearing Philippine sports jerseys"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                  loading="eager"
                />
                {/* Glass overlay with admin-configurable title + CTA */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.42)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    textAlign: 'center',
                    gap: '20px',
                  }}
                >
                  <p style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 'clamp(0.95rem, 2.4vw, 1.625rem)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 16px rgba(0,0,0,0.7)',
                    maxWidth: '560px',
                  }}>
                    ✦ {tryOnSettings.title}
                  </p>
                  <Link
                    to={tryOnSettings.productUrl}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      background: '#fff',
                      color: '#0a0a0a',
                      fontWeight: 700,
                      fontSize: 'clamp(12px, 1.4vw, 15px)',
                      padding: 'clamp(10px, 1.2vw, 14px) clamp(20px, 2.5vw, 32px)',
                      borderRadius: '100px',
                      textDecoration: 'none',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
                      transition: 'opacity 0.18s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    Try It Now
                    <ChevronRightIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEO trust line */}
        <p
          className="relative z-10 text-center px-6 pt-3 pb-6"
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.25)',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.7,
          }}
        >
          Authentic jerseys and gear for basketball, volleyball, football &amp; e-sports — Gilas Pilipinas, PBA, PVL, UAAP, NCAA, and beyond.
        </p>

        {/* Platform — full-width stage with rounded top corners, flat into next section */}
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            bottom: 0,
            left: 0,
            right: 0,
            height: '35%',
            background: '#f5f5f7',
            borderRadius: 'clamp(20px, 4vw, 48px) clamp(20px, 4vw, 48px) 0 0',
            zIndex: 1,
          }}
        />

        <style>{`
          @keyframes heroScrollBob {
            0%, 100% { transform: translateX(-50%) translateY(0);  opacity: 0.6; }
            50%       { transform: translateX(-50%) translateY(7px); opacity: 1;   }
          }
          @keyframes pusoFlagSweep {
            0%   { background-position: 100% center; }
            100% { background-position: 0%   center; }
          }
          @keyframes partnersMarqueeL {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          @keyframes partnersMarqueeR {
            from { transform: translateX(-50%); }
            to   { transform: translateX(0); }
          }
          .partners-track-l { animation: partnersMarqueeL 76s linear infinite; }
          .partners-track-r { animation: partnersMarqueeR 76s linear infinite; }
        `}</style>
      </section>

      {/* Shop by Sport - Tabbed Carousel */}
      <section className="pt-4 pb-10 md:pt-6 md:pb-16 lg:pt-8 lg:pb-24 overflow-hidden" style={{ background: '#f5f5f7' }}>
        <div className="container-custom">
          <div className="text-center mb-8 md:mb-10">
            <h2
              className="text-xl md:text-display-sm mb-2 md:mb-4 font-semibold"
              style={{ color: '#0a0a0a' }}
            >
              Shop by Sport
            </h2>
            <p className="text-sm md:text-lg mb-6 md:mb-8" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Find gear for your favorite league
            </p>

            {/* Category Tabs */}
            <div
              className="inline-flex rounded-xl p-1 md:p-1.5"
              style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={activeCategory === cat.id}
                  className="px-3 py-2 md:px-6 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 flex items-center gap-1.5 md:gap-2"
                  style={
                    activeCategory === cat.id
                      ? { background: '#0a0a0a', color: '#fff' }
                      : { color: 'rgba(0,0,0,0.45)' }
                  }
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
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all hidden md:flex"
              style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.12)' }}
              aria-label="Scroll products"
            >
              <ChevronRightIcon className="w-6 h-6" style={{ color: '#0a0a0a' }} />
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
                  <p style={{ color: 'rgba(0,0,0,0.45)' }}>No {activeCategory} products available yet</p>
                  <Link
                    to="/products"
                    className="mt-4 inline-flex items-center gap-2 font-semibold active:scale-[0.97] transition-transform"
                    style={{
                      background: '#0a0a0a',
                      color: '#fff',
                      borderRadius: '100px',
                      padding: '12px 28px',
                      fontSize: '14px',
                      textDecoration: 'none',
                    }}
                  >
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
              className="inline-flex items-center gap-2 font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'rgba(0,0,0,0.55)', textDecoration: 'none' }}
            >
              View All {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Products
              <ChevronRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Marquee bar ──────────────────────────────────────────── */}
      <div
        className="overflow-x-hidden text-xs md:text-sm"
        style={{
          background: '#1a1a1a',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 0',
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 md:gap-14 px-6 md:px-8">
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-3 h-3 opacity-50" />
                <span>Try jerseys virtually before you buy</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
              <span className="flex items-center gap-2">
                <TruckIcon className="w-3 h-3 opacity-50" />
                <span>Free shipping on orders over ₱2,000</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
              <span>Authentic licensed merchandise</span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
              <span>Support Philippine Sports 🇵🇭</span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Collection — image left, text right */}
      <section className="py-12 md:py-28" style={{ background: '#0a0a0a' }}>
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-6 md:gap-16 items-center">
            {/* Image */}
            <div className="order-1">
              <div
                className="aspect-[4/5] rounded-2xl md:rounded-3xl overflow-hidden"
                style={{ background: '#1a1a1a' }}
              >
                <img
                  src={collectionImage}
                  alt="Latest Collection"
                  className="w-full h-full object-cover"
                  width={800}
                  height={1000}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Text */}
            <div className="order-2">
              <p
                className="text-xs md:text-sm font-semibold uppercase mb-3 md:mb-4"
                style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.09em' }}
              >
                New Collection
              </p>
              <h2
                className="font-bold mb-4 md:mb-6"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  letterSpacing: '-0.035em',
                  lineHeight: 1.05,
                  color: '#fff',
                }}
              >
                Game Day Ready
              </h2>
              <p
                className="text-sm md:text-lg mb-6 md:mb-8"
                style={{ color: 'rgba(255,255,255,0.38)', lineHeight: 1.72 }}
              >
                Introducing our 2025 collection of authentic jerseys, training gear, and accessories.
                From courtside to streetwear — designed for fans who live and breathe Philippine sports.
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 text-sm md:text-base font-semibold active:scale-[0.97] transition-all"
                style={{
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.7)',
                  borderRadius: '100px',
                  padding: '13px 30px',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
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
        <section className="py-12 md:py-28" style={{ background: '#1a1a1a' }}>
          <div className="container-custom">
            <p
              className="text-xs md:text-sm font-semibold uppercase mb-4 md:mb-6"
              style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.09em' }}
            >
              our featured gear
            </p>

            <div className="grid md:grid-cols-2 gap-6 md:gap-16 items-start">
              {/* Left — product list */}
              <div>
                <div className="space-y-1 md:space-y-2">
                  {featuredProducts.map((product, index) => (
                    <button
                      key={product._id}
                      onClick={() => setActiveFeatured(index)}
                      className="block text-left w-full transition-all duration-300 text-base md:text-2xl lg:text-[calc(2.2rem*0.9)]"
                      style={{ color: activeFeatured === index ? '#fff' : 'rgba(255,255,255,0.18)' }}
                      onMouseEnter={e => { if (activeFeatured !== index) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                      onMouseLeave={e => { if (activeFeatured !== index) e.currentTarget.style.color = 'rgba(255,255,255,0.18)'; }}
                    >
                      <span
                        className="font-semibold leading-tight"
                        style={activeFeatured === index ? {
                          textDecoration: 'underline',
                          textDecorationColor: 'rgba(255,255,255,0.35)',
                          textUnderlineOffset: '4px',
                          textDecorationThickness: '2px',
                        } : {}}
                      >
                        {product.name.replace(/ (2024|2025|2024-25)$/, '')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Description of active product */}
                <p
                  className="text-sm md:text-base mt-5 md:mt-8 mb-5 md:mb-8 max-w-md transition-all duration-300"
                  style={{ color: 'rgba(255,255,255,0.38)', lineHeight: 1.72 }}
                >
                  {featuredProducts[activeFeatured]?.description}
                </p>

                <Link
                  to={`/products/${featuredProducts[activeFeatured]?.slug}`}
                  className="inline-flex items-center gap-2 text-sm md:text-base font-bold active:scale-[0.97] transition-all"
                  style={{
                    background: '#fff',
                    color: '#0a0a0a',
                    borderRadius: '100px',
                    padding: '13px 30px',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  shop now
                  <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>

              {/* Right — product image */}
              <div className="order-first md:order-last">
                <div
                  className="aspect-[4/5] rounded-2xl md:rounded-3xl overflow-hidden relative"
                  style={{ background: '#1a1a1a' }}
                >
                  {featuredProducts.map((product, index) => (
                    <img
                      key={product._id}
                      src={product.images?.[0] || '/placeholder.jpg'}
                      alt={product.name}
                      className={`w-full h-full object-cover transition-opacity duration-500 absolute inset-0 ${
                        activeFeatured === index ? 'opacity-100' : 'opacity-0'
                      }`}
                      width={800}
                      height={1000}
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Our Partners ─────────────────────────────────────────── */}
      <section style={{ background: '#0a0a0a', padding: '64px 0 72px', overflow: 'hidden' }}>
        {/* Label */}
        <p
          className="text-center mb-10"
          style={{
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            fontWeight: 600,
          }}
        >
          Our Partners
        </p>

        {/* Marquee area — edge fades via mask */}
        <div
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
            maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
          }}
        >
          {/* Row 1 — right to left */}
          <div style={{ overflow: 'hidden', marginBottom: '12px' }}>
            <div className="partners-track-l" style={{ display: 'flex', width: 'max-content' }}>
              {Array.from({ length: 32 }, (_, i) => [gilasImage, pbaImage, pvlImage, smartOImage][i % 4]).map((src, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '84px',
                    minWidth: '172px',
                    margin: '0 10px',
                    padding: '0 32px',
                    borderRadius: '100px',
                    border: '1px solid rgba(255,255,255,0.11)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <img src={src} alt="" style={{ height: '48px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.62 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — left to right */}
          <div style={{ overflow: 'hidden' }}>
            <div className="partners-track-r" style={{ display: 'flex', width: 'max-content' }}>
              {Array.from({ length: 30 }, (_, i) => [uaapImage, ncaaImage, sbpImage][i % 3]).map((src, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '84px',
                    minWidth: '172px',
                    margin: '0 10px',
                    padding: '0 32px',
                    borderRadius: '100px',
                    border: '1px solid rgba(255,255,255,0.11)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <img src={src} alt="" style={{ height: '48px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.62 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-24" style={{ background: '#1a1a1a' }}>
        <div className="container-custom max-w-3xl">
          <h2
            className="font-bold text-center mb-3 md:mb-4"
            style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em', color: '#fff' }}
          >
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-center mb-8 md:mb-12" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Everything you need to know about Puso Pilipinas
          </p>

          <div>
            {[
              {
                q: 'Are all your products authentic?',
                a: 'Yes! Every product we sell is 100% officially licensed merchandise. We source directly from authorized distributors and brands to guarantee authenticity. Each item comes with official tags and packaging.',
              },
              {
                q: 'How long does shipping take?',
                a: 'Metro Manila orders are delivered within 2-3 business days. Provincial orders typically arrive within 5-7 business days. International orders vary by destination but generally take 7-21 business days. We offer free shipping on Philippine orders over ₱2,000.',
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
                a: 'Yes! We ship worldwide so our kababayans abroad can rep Philippine sports no matter where they are. International shipping rates and delivery times vary by destination and will be calculated at checkout.',
              },
            ].map((faq, index) => (
              <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-5 md:py-6 text-left"
                  aria-expanded={openFaq === index}
                >
                  <span
                    className="font-medium text-sm md:text-base pr-4 transition-colors"
                    style={{ color: openFaq === index ? '#fff' : 'rgba(255,255,255,0.7)' }}
                  >
                    {faq.q}
                  </span>
                  <span
                    className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center"
                    style={{ color: 'rgba(255,255,255,0.38)' }}
                  >
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
                  <p
                    className="text-sm md:text-base pb-5 md:pb-6"
                    style={{ color: 'rgba(255,255,255,0.38)', lineHeight: 1.72 }}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instafeed / Social Section */}
      {false && (() => {
        const feedImages = [
          { src: bahayImage, alt: 'Game day Ateneo fans', bg: '#0A2463', pos: 'center 70%' },
          { src: 'https://placehold.co/400x400/1E3A8A/F59E0B?text=PBA+Action', alt: 'PBA action', bg: '#1E3A8A' },
          { src: 'https://placehold.co/400x500/EC4899/FFFFFF?text=PVL+Match', alt: 'PVL volleyball', bg: '#EC4899' },
          { src: 'https://placehold.co/400x400/16A34A/FFFFFF?text=UAAP+Fans', alt: 'UAAP fans', bg: '#16A34A' },
          { src: 'https://placehold.co/400x400/DC2626/FFFFFF?text=Jersey+Drop', alt: 'New jersey', bg: '#DC2626' },
          { src: 'https://placehold.co/400x500/0D9488/FFFFFF?text=Azkals+⚽', alt: 'Azkals football', bg: '#0D9488' },
          { src: 'https://placehold.co/400x400/7C3AED/FFFFFF?text=Fan+Zone', alt: 'Fan zone', bg: '#7C3AED' },
          { src: 'https://placehold.co/400x500/F59E0B/1E3A8A?text=Merch+🏆', alt: 'Merchandise', bg: '#F59E0B' },
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
                  <div key={i} className="relative w-[22%] flex-shrink-0 aspect-square group">
                    <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: img.bg }} />
                    <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" style={img.pos ? { objectPosition: img.pos } : undefined} width={400} height={400} loading="lazy" />
                    </div>
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
                  <div key={i} className="relative w-[22%] flex-shrink-0 aspect-square group">
                    <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: img.bg }} />
                    <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" style={img.pos ? { objectPosition: img.pos } : undefined} width={400} height={400} loading="lazy" />
                    </div>
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
              <div className="group relative -ml-[20%]" style={{ gridColumn: 1, gridRow: 1 }}>
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: topRow[0].bg }} />
                <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                  <img src={topRow[0].src} alt={topRow[0].alt} className="w-full h-full object-cover" style={topRow[0].pos ? { objectPosition: topRow[0].pos } : undefined} width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative" style={{ gridColumn: 2, gridRow: 1 }}>
                <div className="absolute inset-0 rounded-[2rem] transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: topRow[1].bg }} />
                <div className="absolute inset-0 z-10 rounded-[2rem] overflow-hidden">
                  <img src={topRow[1].src} alt={topRow[1].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative" style={{ gridColumn: 4, gridRow: 1 }}>
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: topRow[2].bg }} />
                <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                  <img src={topRow[2].src} alt={topRow[2].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative -mr-[20%]" style={{ gridColumn: 5, gridRow: 1 }}>
                <div className="absolute inset-0 rounded-[2rem] transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: topRow[3].bg }} />
                <div className="absolute inset-0 z-10 rounded-[2rem] overflow-hidden">
                  <img src={topRow[3].src} alt={topRow[3].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>

              {/* Row 2 images */}
              <div className="group relative -ml-[20%]" style={{ gridColumn: 1, gridRow: 2 }}>
                <div className="absolute inset-0 rounded-[2rem] transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: bottomRow[0].bg }} />
                <div className="absolute inset-0 z-10 rounded-[2rem] overflow-hidden">
                  <img src={bottomRow[0].src} alt={bottomRow[0].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative" style={{ gridColumn: 2, gridRow: 2 }}>
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: bottomRow[1].bg }} />
                <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                  <img src={bottomRow[1].src} alt={bottomRow[1].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative" style={{ gridColumn: 4, gridRow: 2 }}>
                <div className="absolute inset-0 rounded-[2rem] transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: bottomRow[2].bg }} />
                <div className="absolute inset-0 z-10 rounded-[2rem] overflow-hidden">
                  <img src={bottomRow[2].src} alt={bottomRow[2].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
              </div>
              <div className="group relative -mr-[20%]" style={{ gridColumn: 5, gridRow: 2 }}>
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: bottomRow[3].bg }} />
                <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                  <img src={bottomRow[3].src} alt={bottomRow[3].alt} className="w-full h-full object-cover" width={400} height={400} loading="lazy" />
                </div>
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
      <section
        className="py-12 md:py-16 lg:py-24"
        style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="container-custom max-w-2xl text-center">
          <h2
            className="font-bold mb-3 md:mb-4"
            style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em', color: '#fff' }}
          >
            Join the Puso Pilipinas Family
          </h2>
          <p className="text-sm md:text-lg mb-6 md:mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Get exclusive deals, early access to new releases, and 10% off your first order.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 md:px-5 md:py-3.5 rounded-xl text-sm md:text-base focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
              }}
            />
            <button
              type="submit"
              className="font-semibold text-sm md:text-base transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#fff',
                color: '#0a0a0a',
                borderRadius: '100px',
                padding: '12px 28px',
              }}
            >
              Subscribe
            </button>
          </form>
          <p className="text-xs md:text-sm mt-3 md:mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
