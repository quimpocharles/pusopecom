import { Link, useNavigate, useLocation } from 'react-router-dom';
import LogoColor from '../../assets/images/puso.png';
import { ShoppingBagIcon, Bars3Icon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import { useState, useRef, useEffect } from 'react';

const navLinks = [
  { label: 'Shop',       href: '/products' },
  { label: 'Basketball', href: '/products?sport=basketball' },
  { label: 'Volleyball', href: '/products?sport=volleyball' },
  { label: 'Football',   href: '/products?sport=football' },
];

const Header = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const cartCount = useCartStore((state) => state.getCartCount());
  const { user, isAuthenticated, logout } = useAuthStore();

  const [scrolled, setScrolled] = useState(false);
  const [navOpen,  setNavOpen]  = useState(false); // manual toggle once scrolled / on inner pages
  const navRef = useRef(null);

  const isHome      = location.pathname === '/';
  const isExpanded  = !scrolled;
  // Home hero shows the panel automatically; everywhere else the hamburger
  // toggles the same small panel — never a separate full-height drawer.
  const showExpandedNav = isHome && isExpanded;
  const navPanelOpen = showExpandedNav || navOpen;

  // ── Scroll listener ──────────────────────────────────────────────
  useEffect(() => {
    let ticking = false;
    const update = () => { setScrolled(window.scrollY > 60); ticking = false; };
    const onScroll = () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Close the manually-toggled panel on an outside click ──────────
  useEffect(() => {
    if (!navOpen) return;
    const handlePointerDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [navOpen]);

  // Close on navigation, so it doesn't stay open after a link is followed.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const shellStyle = {
    top: 'var(--header-top, 0px)',
    transition: 'top 0.2s ease',
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const itemCls = 'px-4 py-1.5 text-sm font-medium text-ink-900 hover:bg-ink-900 hover:text-white transition-colors w-full text-left whitespace-nowrap';

  return (
    <div
      className="fixed left-0 right-0 z-50 flex items-start justify-between p-3 md:p-4 pointer-events-none"
      style={shellStyle}
    >
      {/* Left cluster — logo + hamburger box, with the nav panel attached
          directly beneath it, in the same bordered white styling. Home
          hero shows the panel automatically; elsewhere the hamburger
          toggles it — always this small attached panel, never a
          full-height drawer. */}
      {/* items-stretch (not items-start) so the logo row and the nav panel
          below always share one width — whichever is naturally wider —
          instead of each shrink-wrapping its own content and shifting
          the whole block sideways depending on whether the hamburger
          cell is present. */}
      <div className="pointer-events-auto bg-white p-2 lg:p-3 flex flex-col items-stretch border-2 border-ink-900" ref={navRef}>
        <div className="flex items-stretch bg-white border-ink-900">
          <Link to="/" className="flex items-center px-3 md:px-4 py-2 md:py-2.5">
            <img src={LogoColor} alt="Puso Pilipinas" className="h-7 md:h-8 w-auto" />
          </Link>
          {!showExpandedNav && (
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="flex items-center justify-center px-3 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white transition-colors duration-150"
              aria-label="Open menu"
              aria-expanded={navPanelOpen}
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
          )}
        </div>

        <div
          className={`flex flex-col items-start bg-white transition-all duration-200 ease-out overflow-hidden ${
            navPanelOpen ? 'max-h-96 border-x-2 border-y-2 border-ink-900 py-2' : 'max-h-0 border-0'
          }`}
        >
          {navLinks.map((link) => (
            <Link key={link.label} to={link.href} onClick={() => setNavOpen(false)} className={itemCls}>
              {link.label}
            </Link>
          ))}
          <div className="h-px w-full bg-ink-200 my-1" />
          {isAuthenticated ? (
            <>
              <Link to="/account" onClick={() => setNavOpen(false)} className={itemCls}>
                {user?.firstName || 'My Account'}
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin" onClick={() => setNavOpen(false)} className={itemCls}>
                  Admin Dashboard
                </Link>
              )}
              <button onClick={() => { handleLogout(); setNavOpen(false); }} className={itemCls}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setNavOpen(false)} className={itemCls}>
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Right cluster — cart, its own independent bordered box. */}
      <button
        onClick={() => useCartStore.getState().openCart()}
        className="pointer-events-auto relative flex items-center justify-center px-3 md:px-4 py-2 md:py-2.5 bg-white border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white transition-colors duration-150"
        aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} item${cartCount !== 1 ? 's' : ''}` : ''}`}
      >
        <ShoppingBagIcon className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 text-[10px] w-4 h-4 rounded-full bg-ink-900 text-white flex items-center justify-center font-bold">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default Header;
