import { useEffect, useState } from 'react';
import gilasImage from '../assets/images/gilas.png';
import pbaImage from '../assets/images/pba.png';
import uaapImage from '../assets/images/uaap.png';
import pvlImage from '../assets/images/pvl.png';
import ncaaImage from '../assets/images/ncaa.png';
import sbpImage from '../assets/images/sbp.png';
import smartOImage from '../assets/images/smart-o.png';
import collectionImage from '../assets/images/dwight.jpg';
import featuredTeamImage from '../assets/images/bahay.webp';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  SparklesIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '../components/layout/Layout';
import BeforeAfterSlider from '../components/home/BeforeAfterSlider';
import productService from '../services/productService';
import campaignService from '../services/campaignService';
import SEO from '../components/common/SEO';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [tryOnCampaign, setTryOnCampaign] = useState(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

  // Featured Team — swapped by hand once a month. Update these five fields
  // (image import above included) and nothing else needs to change. `color`
  // is the institution's own identity color (DESIGN_TOKENS.md §
  // institution.identity) — the one slot the platform's neutral palette
  // deliberately leaves open for an Organization's own color to lead.
  const featuredTeam = {
    name: 'Ateneo de Manila University',
    image: featuredTeamImage,
    imageAlt: 'Ateneo de Manila University fans on game day',
    blurb: 'From Katipunan to the Big Dome, Blue Eagle pride shows up every game day and never quiets down.',
    teamQuery: 'Ateneo de Manila University',
    color: '#0A2463',
  };
  const featuredTeamMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

  // AI Try-On section content — the active placement=tryOn campaign, fully
  // CMS-driven (headline/subheadline/copy/CTA/before-after images/featured
  // product/schedule/visibility all live on Campaign; see campaignRepository
  // .findActiveHomepageCampaign). Falls back to the approved default copy
  // below when no campaign is currently active, so the section — which
  // replaces Shop by Sport in this exact slot — never goes blank.
  useEffect(() => {
    const fetchTryOnCampaign = async () => {
      try {
        const res = await campaignService.getActiveCampaign('tryOn');
        setTryOnCampaign(res.data);
      } catch (error) {
        console.error('Failed to fetch AI Try-On campaign:', error);
      }
    };
    fetchTryOnCampaign();
  }, []);

  return (
    <Layout>
      <SEO
        title="Puso Pilipinas — Philippine Sports Merchandise | Basketball, Volleyball, E-Sports"
        description="Shop authentic jerseys, apparel, and accessories for basketball, volleyball, football, and e-sports. Rep Gilas Pilipinas, PBA, PVL, UAAP, NCAA, and more. Free shipping on select items."
      />
      {/* ── Landing: Latest Collection, promoted to the page's opening
          statement. Fills the first viewport and clears the fixed header
          itself (Layout gives Home zero top padding). ── */}
      <section className="relative min-h-[92vh] md:min-h-screen flex items-center pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden bg-ink-900">
        {/* Subtle grid texture — faded via radial mask, barely visible */}
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

        <div className="container-custom relative">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            {/* Image */}
            <div className="order-1">
              <div className="aspect-[4/5] border-2 border-white/15 overflow-hidden bg-[#1a1a1a]">
                <img
                  src={collectionImage}
                  alt="Latest Collection"
                  className="w-full h-full object-cover"
                  width={800}
                  height={1000}
                  loading="eager"
                />
              </div>
            </div>

            {/* Text */}
            <div className="order-2">
              <p
                className="text-xs md:text-sm font-semibold uppercase mb-3 md:mb-4 text-white/35"
                style={{ letterSpacing: '0.09em' }}
              >
                New Collection
              </p>
              <h1
                className="font-bold mb-4 md:mb-6 text-white"
                style={{
                  fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                  letterSpacing: '-0.035em',
                  lineHeight: 1.02,
                }}
              >
                Game Day Ready
              </h1>
              <p
                className="text-sm md:text-lg mb-6 md:mb-8 max-w-md text-white/40"
                style={{ lineHeight: 1.72 }}
              >
                Introducing our 2025 collection of authentic jerseys, training gear, and accessories.
                From courtside to streetwear — designed for fans who live and breathe Philippine sports.
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 text-sm md:text-base font-semibold border-2 border-white/25 text-white/70 px-7 py-3.5 hover:text-white hover:border-white/60 transition-colors duration-150"
              >
                explore the collection
                <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Try-On — replaces Shop by Sport in this exact slot (same
          background, same padding rhythm) rather than adding a section.
          Deliberately NOT another image-left/text-right split — Hero and
          Featured Team both already use that composition, and this is the
          platform's flagship differentiator, not a third repeat of it.
          Content follows Promise → Proof → Action: headline/subheadline set
          up the claim, the enlarged comparison proves it (the section's
          focal point — sized and spaced to read as a premium showcase, not
          a supporting feature), then a short copy line and the CTA close
          it. The CTA comes last on purpose — it's the action a fan takes
          once they've seen the demo, not before.
          Fully CMS-driven via the placement=tryOn Campaign: headline,
          subheadline, body copy, CTA label/destination, before/after
          images, featured product, schedule, and visibility are all
          editable from the admin without a deploy. The copy below is only
          the fallback shown while no campaign is configured — the slot
          this section occupies is not allowed to go blank. ── */}
      <section className="pt-4 pb-10 md:pt-6 md:pb-16 lg:pt-8 lg:pb-24 overflow-hidden bg-paper">
        <div className="container-custom">
          {/* Promise */}
          <div className="max-w-2xl mx-auto text-center mb-10 md:mb-16">
            <h2
              className="font-bold mb-4 md:mb-6 text-ink-900"
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              {tryOnCampaign?.headline || 'WEAR THE PUSO.'}
            </h2>
            <p className="text-lg md:text-xl font-semibold text-ink-700">
              {tryOnCampaign?.subheadline || "See yourself wearing your team's official merchandise before you buy."}
            </p>
          </div>

          {/* Proof — enlarged (~25% taller than the previous pass) and
              wider (max-w-6xl vs 4xl), so the comparison itself is the
              thing a fan's eye lands on first. */}
          <div className="max-w-6xl mx-auto">
            <BeforeAfterSlider
              beforeImage={tryOnCampaign?.beforeImage}
              afterImage={tryOnCampaign?.afterImage}
              aspectClassName="aspect-[2/3] md:aspect-[5/4]"
            />

            {/* Action — copy sells confidence, not the technology; CTA is
                the section's last word, after the demo has made its case. */}
            <div className="max-w-xl mx-auto text-center mt-8 md:mt-12">
              <p className="text-sm md:text-lg mb-6 md:mb-8 text-ink-500 whitespace-pre-line" style={{ lineHeight: 1.72 }}>
                {tryOnCampaign?.description || 'Upload one photo.\nSee yourself wearing your team\'s official jersey in seconds.'}
              </p>
              <Link
                to={
                  tryOnCampaign?.ctaLink ||
                  (tryOnCampaign?.featuredProduct ? `/products/${tryOnCampaign.featuredProduct.slug}?tryOn=1` : '/products')
                }
                className="btn-primary inline-flex items-center gap-2"
              >
                {tryOnCampaign?.ctaLabel || 'Try It On'}
                <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee bar ──────────────────────────────────────────── */}
      <div
        className="overflow-x-hidden text-xs md:text-sm bg-[#1a1a1a] text-white/35 border-t border-b border-white/5"
        style={{ padding: '10px 0' }}
      >
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 md:gap-14 px-6 md:px-8">
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-3 h-3 opacity-50" />
                <span>Try jerseys virtually before you buy</span>
              </span>
              <span className="text-white/10">✦</span>
              <span className="flex items-center gap-2">
                <TruckIcon className="w-3 h-3 opacity-50" />
                <span>Free shipping on orders over ₱2,000</span>
              </span>
              <span className="text-white/10">✦</span>
              <span>Authentic licensed merchandise</span>
              <span className="text-white/10">✦</span>
              <span>Support Philippine Sports 🇵🇭</span>
              <span className="text-white/10">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Products — clickable list with changing image */}
      {featuredProducts.length > 0 && (
        <section className="py-12 md:py-28 bg-[#1a1a1a]">
          <div className="container-custom">
            <p
              className="text-xs md:text-sm font-semibold uppercase mb-4 md:mb-6 text-white/35"
              style={{ letterSpacing: '0.09em' }}
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
                      className={`block text-left w-full transition-all duration-300 text-base md:text-2xl lg:text-[calc(2.2rem*0.9)] ${
                        activeFeatured === index ? 'text-white' : 'text-white/20 hover:text-white/45'
                      }`}
                    >
                      <span
                        className={`font-semibold leading-tight ${
                          activeFeatured === index ? 'underline decoration-white/35 decoration-2 underline-offset-4' : ''
                        }`}
                      >
                        {product.name.replace(/ (2024|2025|2024-25)$/, '')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Description of active product */}
                <p
                  className="text-sm md:text-base mt-5 md:mt-8 mb-5 md:mb-8 max-w-md transition-all duration-300 text-white/40"
                  style={{ lineHeight: 1.72 }}
                >
                  {featuredProducts[activeFeatured]?.description}
                </p>

                <Link
                  to={`/products/${featuredProducts[activeFeatured]?.slug}`}
                  className="inline-flex items-center gap-2 text-sm md:text-base font-bold bg-white text-ink-900 border-2 border-white px-7 py-3.5 hover:bg-ink-900 hover:text-white transition-colors duration-150"
                >
                  shop now
                  <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>

              {/* Right — product image */}
              <div className="order-first md:order-last">
                <div className="aspect-[4/5] border-2 border-white/15 overflow-hidden relative bg-[#1a1a1a]">
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

      {/* Featured Team — rotates monthly (EDITORIAL_LAYOUT_SYSTEM.md §
          Organization Spotlight: identity leads at masthead scale, a
          current moment follows at secondary weight). Background is the
          featured institution's own color, not a platform neutral — the
          one deliberate use of DESIGN_TOKENS.md's institution.identity
          slot, reserved exactly for a moment like this. Still reads as its
          own editorial page against the near-black sections around it,
          just via hue instead of light-vs-dark contrast. */}
      <section className="relative py-16 md:py-28 overflow-hidden" style={{ background: featuredTeam.color }}>
        {/* Texture — sporty diagonal stripes + a grain layer for a grungy
            finish, both CSS-only (no image asset), same technique as the
            landing section's grid overlay. Kept faint on purpose: texture,
            not decoration competing with the photo or the type. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 14px)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            opacity: 0.15,
            mixBlendMode: 'overlay',
          }}
        />

        <div className="container-custom relative">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            {/* Image */}
            <div className="order-1">
              <div className="aspect-[4/5] border-2 border-white/20 overflow-hidden">
                <img
                  src={featuredTeam.image}
                  alt={featuredTeam.imageAlt}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center top' }}
                  width={500}
                  height={915}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Text */}
            <div className="order-2">
              <p className="text-xs md:text-sm font-semibold uppercase mb-3 md:mb-4 tracking-[0.09em] text-white/55">
                Featured Team &middot; {featuredTeamMonth}
              </p>
              <h2 className="font-bold mb-4 md:mb-6 text-white" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
                {featuredTeam.name}
              </h2>
              <p className="text-sm md:text-lg mb-6 md:mb-8 max-w-md text-white/75" style={{ lineHeight: 1.72 }}>
                {featuredTeam.blurb}
              </p>
              <Link
                to={`/products?team=${encodeURIComponent(featuredTeam.teamQuery)}`}
                className="inline-flex items-center gap-2 text-sm md:text-base font-semibold border-2 border-white text-white px-7 py-3.5 hover:bg-white transition-colors duration-150"
                onMouseEnter={(e) => { e.currentTarget.style.color = featuredTeam.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#fff'; }}
              >
                Shop {featuredTeam.name.split(' ')[0]} Gear
                <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Partners ─────────────────────────────────────────── */}
      <style>{`
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
      <section className="bg-ink-900" style={{ padding: '64px 0 72px', overflow: 'hidden' }}>
        {/* Label */}
        <p
          className="text-center mb-10 text-white/30"
          style={{
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
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
                  className="border-2 border-white/15 bg-white/5"
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '84px',
                    minWidth: '172px',
                    margin: '0 10px',
                    padding: '0 32px',
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
                  className="border-2 border-white/15 bg-white/5"
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '84px',
                    minWidth: '172px',
                    margin: '0 10px',
                    padding: '0 32px',
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
      <section className="py-12 md:py-24 bg-[#1a1a1a]">
        <div className="container-custom max-w-3xl">
          <h2
            className="font-bold text-center mb-3 md:mb-4 text-white"
            style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em' }}
          >
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-center mb-8 md:mb-12 text-white/40">
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
              <div key={index} className="border-b border-white/10">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-5 md:py-6 text-left"
                  aria-expanded={openFaq === index}
                >
                  <span
                    className={`font-medium text-sm md:text-base pr-4 transition-colors ${
                      openFaq === index ? 'text-white' : 'text-white/70'
                    }`}
                  >
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-white/40">
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
                    className="text-sm md:text-base pb-5 md:pb-6 text-white/40"
                    style={{ lineHeight: 1.72 }}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
