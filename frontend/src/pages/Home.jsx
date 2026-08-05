import { useEffect, useState, Fragment } from 'react';
import collectionImage from '../assets/images/dwight.jpg';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import BeforeAfterSlider from '../components/home/BeforeAfterSlider';
import productService from '../services/productService';
import campaignService from '../services/campaignService';
import faqService from '../services/faqService';
import promoMessageService from '../services/promoMessageService';
import homepageSectionService from '../services/homepageSectionService';
import featuredTeamService from '../services/featuredTeamService';
import partnerLogoService from '../services/partnerLogoService';
import fitCheckCampaignService from '../services/fitCheckCampaignService';
import SEO from '../components/common/SEO';

// Default render order — used until the CMS-driven order loads, so nothing
// visibly reshuffles once it does (this matches the self-healing default
// order homepageSectionRepository seeds new installs with).
const DEFAULT_SECTION_ORDER = ['hero', 'aiTryOn', 'marquee', 'featuredProducts', 'trendingFitChecks', 'featuredTeam', 'partners', 'faq'];

// Repeats `items` until there are at least `minCount`, so the marquee track
// stays visually full even with a small partner roster. The caller then
// renders this list twice back-to-back so a translateX(-50%) loop is
// always seamless, regardless of how many logos exist.
function fillRow(items, minCount = 8) {
  if (items.length === 0) return [];
  const repeated = [];
  while (repeated.length < minCount) repeated.push(...items);
  return repeated;
}

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [heroCampaign, setHeroCampaign] = useState(null);
  const [tryOnCampaign, setTryOnCampaign] = useState(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [marqueeMessages, setMarqueeMessages] = useState([]);
  // null while loading = render every section in DEFAULT_SECTION_ORDER, so
  // the page never flashes empty before the CMS config arrives.
  const [sectionConfig, setSectionConfig] = useState(null);
  // Featured Team — fully CMS-driven via FeaturedTeam (Admin > Homepage >
  // Featured Team). No hardcoded fallback: when nothing is active/in-window,
  // the section is omitted entirely rather than showing stale content.
  const [featuredTeam, setFeaturedTeam] = useState(null);
  const [partnerLogos, setPartnerLogos] = useState([]);
  // Trending Fit Checks (Phase 4) — aggregated counts only, no customer
  // photos, ever (see tryOnLogRepository.trending). Empty until real
  // recent activity exists, and the section below stays hidden until then.
  const [trendingFitChecks, setTrendingFitChecks] = useState([]);

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

  useEffect(() => {
    fitCheckCampaignService.getTrending()
      .then((res) => setTrendingFitChecks(res.data))
      .catch((error) => console.error('Failed to fetch trending Fit Checks:', error));
  }, []);

  // Hero — the active placement=hero campaign, fully CMS-driven (eyebrow/
  // headline/description/CTA/image/accentColor/schedule/visibility all live
  // on Campaign; see campaignRepository.findActiveHomepageCampaign). Falls
  // back to the approved default copy below when no campaign is currently
  // active or scheduled, so the page's opening statement never goes blank.
  useEffect(() => {
    const fetchHeroCampaign = async () => {
      try {
        const res = await campaignService.getActiveCampaign('hero');
        setHeroCampaign(res.data);
      } catch (error) {
        console.error('Failed to fetch Hero campaign:', error);
      }
    };
    fetchHeroCampaign();
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

  // FAQ — fully CMS-driven via FAQItem (question/answer/displayOrder/active
  // all editable from Admin > Homepage > FAQ). No fallback list here: an
  // empty CMS means an empty section, not stale hardcoded copy pretending
  // to be current.
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await faqService.getFaqs();
        setFaqs(res.data);
      } catch (error) {
        console.error('Failed to fetch FAQs:', error);
      }
    };
    fetchFaqs();
  }, []);

  // Marquee bar — fully CMS-driven via PromoMessage (placement=marquee),
  // same model that backs the Announcement Bar, schedule-filtered the same
  // way. Hides entirely rather than showing stale hardcoded lines when the
  // CMS has nothing active.
  useEffect(() => {
    const fetchMarquee = async () => {
      try {
        const res = await promoMessageService.getMessages('marquee');
        setMarqueeMessages(res.data);
      } catch (error) {
        console.error('Failed to fetch marquee messages:', error);
      }
    };
    fetchMarquee();
  }, []);

  // Featured Team — fully CMS-driven, see the state comment above.
  useEffect(() => {
    const fetchFeaturedTeam = async () => {
      try {
        const res = await featuredTeamService.getActiveTeam();
        setFeaturedTeam(res.data);
      } catch (error) {
        console.error('Failed to fetch featured team:', error);
      }
    };
    fetchFeaturedTeam();
  }, []);

  // Partner Logos — fully CMS-driven via PartnerLogo (Admin > Homepage >
  // Partners). Ordered by priority (desc) then displayOrder, same as the
  // API returns.
  useEffect(() => {
    const fetchPartnerLogos = async () => {
      try {
        const res = await partnerLogoService.getLogos();
        setPartnerLogos(res.data);
      } catch (error) {
        console.error('Failed to fetch partner logos:', error);
      }
    };
    fetchPartnerLogos();
  }, []);

  // Section order/visibility — fully CMS-driven via HomepageSection
  // (Admin > Homepage > Sections). Sections are rendered in this order and
  // inactive ones are skipped entirely, not just hidden.
  useEffect(() => {
    const fetchSectionConfig = async () => {
      try {
        const res = await homepageSectionService.getSections();
        setSectionConfig(res.data);
      } catch (error) {
        console.error('Failed to fetch homepage section config:', error);
      }
    };
    fetchSectionConfig();
  }, []);

  const heroSection = (
    /* ── Landing: Latest Collection, promoted to the page's opening
        statement. Fills the first viewport and clears the fixed header
        itself (Layout gives Home zero top padding). ── */
    <section key="hero" className="relative min-h-[92vh] md:min-h-screen flex items-center pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden bg-ink-900">
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
                src={heroCampaign?.image || collectionImage}
                alt={heroCampaign?.headline || 'Latest Collection'}
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
              {heroCampaign?.eyebrow || 'New Collection'}
            </p>
            <h1
              className="font-bold mb-4 md:mb-6 text-white"
              style={{
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                letterSpacing: '-0.035em',
                lineHeight: 1.02,
              }}
            >
              {heroCampaign?.headline || 'Game Day Ready'}
            </h1>
            <p
              className="text-sm md:text-lg mb-6 md:mb-8 max-w-md text-white/40 whitespace-pre-line"
              style={{ lineHeight: 1.72 }}
            >
              {heroCampaign?.description ||
                'Introducing our 2025 collection of authentic jerseys, training gear, and accessories. From courtside to streetwear — designed for fans who live and breathe Philippine sports.'}
            </p>
            <Link
              to={
                heroCampaign?.ctaLink ||
                (heroCampaign?.featuredProduct ? `/products/${heroCampaign.featuredProduct.slug}` : '/products')
              }
              className="inline-flex items-center gap-2 text-sm md:text-base font-semibold border-2 border-white/25 text-white/70 px-7 py-3.5 hover:text-white transition-colors duration-150"
              onMouseEnter={(e) => { if (heroCampaign?.accentColor) e.currentTarget.style.borderColor = heroCampaign.accentColor; }}
              onMouseLeave={(e) => { if (heroCampaign?.accentColor) e.currentTarget.style.borderColor = ''; }}
            >
              {heroCampaign?.ctaLabel || 'explore the collection'}
              <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );

  const aiTryOnSection = (
    /* ── AI Try-On — replaces Shop by Sport in this exact slot (same
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
        this section occupies is not allowed to go blank. ── */
    <section key="aiTryOn" className="pt-4 pb-10 md:pt-6 md:pb-16 lg:pt-8 lg:pb-24 overflow-hidden bg-paper">
      <div className="container-custom">
        {/* Promise — subheadline is deliberately lighter than the headline
            on mobile (text-base vs the old text-lg, ~11% smaller, and
            Tailwind's bundled line-height drops with it, 28px→24px) so
            "WEAR THE PUSO." reads as the one strong statement, not a
            a tie. Unchanged at md: and up. */}
        <div className="max-w-2xl mx-auto text-center mb-5 md:mb-16">
          <h2
            className="font-bold text-ink-900"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            {tryOnCampaign?.headline || 'WEAR THE PUSO.'}
          </h2>
          <p className="text-base md:text-xl font-semibold text-ink-700">
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
            beforeLabel="You"
            afterLabel="Game Day"
          />

          {/* Action — copy sells confidence, not the technology; CTA is
              the section's last word, after the demo has made its case. */}
          <div className="max-w-xl mx-auto text-center mt-8 md:mt-12">
            <p className="text-sm md:text-lg mb-6 md:mb-8 text-ink-500 whitespace-pre-line" style={{ lineHeight: 1.72 }}>
              {tryOnCampaign?.description ||
                "Upload one photo and see yourself wearing your team's official jersey in seconds."}
            </p>
            <Link
              to={
                tryOnCampaign?.ctaLink ||
                (tryOnCampaign?.featuredProduct ? `/products/${tryOnCampaign.featuredProduct.slug}?tryOn=1` : '/products')
              }
              className="btn-primary inline-flex items-center gap-2"
            >
              {tryOnCampaign?.ctaLabel || 'Try Fit Check'}
              <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );

  const marqueeSection = marqueeMessages.length > 0 && (
    /* ── Marquee bar ──────────────────────────────────────────── */
    <div
      key="marquee"
      className="overflow-x-hidden text-xs md:text-sm bg-[#1a1a1a] text-white/35 border-t border-b border-white/5"
      style={{ padding: '10px 0' }}
    >
      <div className="animate-marquee whitespace-nowrap flex">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-8 md:gap-14 px-6 md:px-8">
            {marqueeMessages.map((msg) => (
              <span key={`${i}-${msg._id}`} className="flex items-center gap-8 md:gap-14">
                <span>{msg.link ? <a href={msg.link} className="hover:text-white/60">{msg.text}</a> : msg.text}</span>
                <span className="text-white/10">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const featuredProductsSection = featuredProducts.length > 0 && (
    /* Featured Products — clickable list with changing image */
    <section key="featuredProducts" className="py-12 md:py-28 bg-[#1a1a1a]">
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
  );

  const trendingFitChecksSection = trendingFitChecks.length > 0 && (
    /* Trending Fit Checks — aggregated counts only, no customer photos.
       Product name/image/price come from the live Product row, the count
       from tryOnLogRepository.trending(); nothing here is admin-authored
       copy, so unlike Featured Products/Team this section's label lives in
       code, matching Featured Products' own "our featured gear" eyebrow. */
    <section key="trendingFitChecks" className="py-12 md:py-24 bg-white">
      <div className="container-custom">
        <p
          className="text-xs md:text-sm font-semibold uppercase mb-4 md:mb-6 text-ink-900/35"
          style={{ letterSpacing: '0.09em' }}
        >
          trending fit checks
        </p>

        <div className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-2">
          {trendingFitChecks.map((product) => (
            <Link
              key={product.productId}
              to={`/products/${product.slug}?tryOn=1`}
              className="flex-shrink-0 w-40 md:w-56 group"
            >
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative mb-3">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-ink-900">
                  {product.count} tried this on
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold text-ink-900 truncate">{product.name}</p>
              <p className="text-sm text-ink-900/50">
                ₱{(product.salePrice ?? product.price).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );

  const featuredTeamBgColor = featuredTeam?.backgroundColor || '#0A2463';
  const featuredTeamTextColor = featuredTeam?.textColor || '#ffffff';
  const featuredTeamDisplayMonth = featuredTeam?.displayMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const featuredTeamHeadline = featuredTeam?.headline || featuredTeam?.team;
  const featuredTeamCtaUrl = featuredTeam?.ctaUrl || (featuredTeam ? `/products?team=${encodeURIComponent(featuredTeam.team)}` : '/products');
  const featuredTeamCtaLabel = featuredTeam?.ctaLabel || (featuredTeam ? `Shop ${featuredTeam.team.split(' ')[0]} Gear` : '');

  const featuredTeamSection = featuredTeam && (
    /* Featured Team — fully CMS-driven (FeaturedTeam; Admin > Homepage >
        Featured Team). Background is the featured institution's own color,
        not a platform neutral — the one deliberate use of
        DESIGN_TOKENS.md's institution.identity slot, reserved exactly for
        a moment like this (EDITORIAL_LAYOUT_SYSTEM.md § Organization
        Spotlight). Still reads as its own editorial page against the
        near-black sections around it, just via hue instead of
        light-vs-dark contrast. No hardcoded fallback: this section is
        simply omitted when nothing is active/in-window. */
    <section key="featuredTeam" className="relative py-16 md:py-28 overflow-hidden" style={{ background: featuredTeamBgColor }}>
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
          {featuredTeam.featuredImage && (
            <div className="order-1">
              <div className="aspect-[4/5] border-2 border-white/20 overflow-hidden">
                <img
                  src={featuredTeam.featuredImage}
                  alt={featuredTeam.featuredImageAlt || featuredTeam.team}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center top' }}
                  width={500}
                  height={915}
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Text */}
          <div className="order-2">
            <p className="text-xs md:text-sm font-semibold uppercase mb-3 md:mb-4 tracking-[0.09em]" style={{ color: `${featuredTeamTextColor}8c` }}>
              Featured Team &middot; {featuredTeamDisplayMonth}
            </p>
            <h2 className="font-bold mb-4 md:mb-6" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.035em', lineHeight: 1.05, color: featuredTeamTextColor }}>
              {featuredTeamHeadline}
            </h2>
            {featuredTeam.description && (
              <p className="text-sm md:text-lg mb-6 md:mb-8 max-w-md" style={{ lineHeight: 1.72, color: `${featuredTeamTextColor}bf` }}>
                {featuredTeam.description}
              </p>
            )}
            <Link
              to={featuredTeamCtaUrl}
              className="inline-flex items-center gap-2 text-sm md:text-base font-semibold border-2 px-7 py-3.5 transition-colors duration-150"
              style={{ borderColor: featuredTeamTextColor, color: featuredTeamTextColor }}
              onMouseEnter={(e) => { e.currentTarget.style.background = featuredTeamTextColor; e.currentTarget.style.color = featuredTeamBgColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = featuredTeamTextColor; }}
            >
              {featuredTeamCtaLabel}
              <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );

  // Split into two alternating rows (row 1 = even index, row 2 = odd),
  // each duplicated once so a translateX(-50%) loop is always seamless
  // regardless of how many logos are active — see fillRow's own comment.
  const partnerRow1 = fillRow(partnerLogos.filter((_, i) => i % 2 === 0));
  const partnerRow2 = fillRow(partnerLogos.filter((_, i) => i % 2 === 1));

  const partnerLogoBox = (logo, key) => {
    const img = (
      <img
        src={logo.logoUrl}
        alt={logo.name}
        style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.62 }}
      />
    );
    return (
      <div
        key={key}
        className="border-2 border-white/15 bg-white/5"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '160px',
          height: '84px',
          margin: '0 10px',
          padding: '18px 24px',
        }}
      >
        {/* Fixed box + object-fit: contain — every logo scales to the same
            bounding box regardless of its native aspect ratio, instead of
            a fixed height letting wide logos render bigger than square/
            narrow ones. (A fixed box width also matters for the marquee's
            own math: the seamless translateX(-50%) loop assumes every box
            is the same width.) */}
        {logo.destinationUrl ? (
          <a href={logo.destinationUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center">
            {img}
          </a>
        ) : img}
      </div>
    );
  };

  const partnersSection = partnerLogos.length > 0 && (
    <Fragment key="partners">
      {/* ── Our Partners — fully CMS-driven via PartnerLogo (Admin >
          Homepage > Partners). No hardcoded fallback: the section is
          omitted entirely when there are no active logos. ── */}
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
          {partnerRow1.length > 0 && (
            <div style={{ overflow: 'hidden', marginBottom: '12px' }}>
              <div className="partners-track-l" style={{ display: 'flex', width: 'max-content' }}>
                {[...partnerRow1, ...partnerRow1].map((logo, i) => partnerLogoBox(logo, `${logo._id}-${i}`))}
              </div>
            </div>
          )}

          {/* Row 2 — left to right */}
          {partnerRow2.length > 0 && (
            <div style={{ overflow: 'hidden' }}>
              <div className="partners-track-r" style={{ display: 'flex', width: 'max-content' }}>
                {[...partnerRow2, ...partnerRow2].map((logo, i) => partnerLogoBox(logo, `${logo._id}-${i}`))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Fragment>
  );

  const faqSection = faqs.length > 0 && (
    /* FAQ Section — fully CMS-driven (FAQItem); the section itself
        disappears rather than showing stale copy when the CMS has no
        active items. */
    <section key="faq" className="py-12 md:py-24 bg-[#1a1a1a]">
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
          {faqs.map((faq, index) => (
            <div key={faq._id} className="border-b border-white/10">
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
                  {faq.question}
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
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const sectionsByKey = {
    hero: heroSection,
    aiTryOn: aiTryOnSection,
    marquee: marqueeSection,
    featuredProducts: featuredProductsSection,
    trendingFitChecks: trendingFitChecksSection,
    featuredTeam: featuredTeamSection,
    partners: partnersSection,
    faq: faqSection,
  };

  const sectionOrder = sectionConfig
    ? sectionConfig.filter((s) => s.active).map((s) => s.key)
    : DEFAULT_SECTION_ORDER;

  return (
    <Layout>
      <SEO
        title="Puso Pilipinas — Philippine Sports Merchandise | Basketball, Volleyball, E-Sports"
        description="Shop authentic jerseys, apparel, and accessories for basketball, volleyball, football, and e-sports. Rep Gilas Pilipinas, PBA, PVL, UAAP, NCAA, and more. Free shipping on select items."
      />
      {sectionOrder.map((key) => sectionsByKey[key] || null)}
    </Layout>
  );
};

export default Home;
