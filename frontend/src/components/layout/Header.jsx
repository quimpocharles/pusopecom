import { Link, useNavigate, useLocation } from 'react-router-dom';
import LogoColor from '../../assets/images/puso.png';
import { ShoppingBagIcon, Bars3Icon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import usePassCartStore from '../../store/passCartStore';
import useAuthStore from '../../store/authStore';
import { useState, useRef, useEffect } from 'react';
import navigationLinkService from '../../services/navigationLinkService';

const Header = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const cartCount = useCartStore((state) => state.getCartCount());
  const passCount = usePassCartStore((state) => state.getPassCount());
  const totalCartCount = cartCount + passCount;
  const { user, isAuthenticated, logout } = useAuthStore();

  // Nav links — fully CMS-driven via NavigationLink (Admin > Homepage >
  // Navigation). No hardcoded fallback: an empty CMS means an empty nav,
  // same "don't pretend to be current" rule as the other homepage sections.
  const [navLinks, setNavLinks] = useState([]);
  useEffect(() => {
    const fetchNavLinks = async () => {
      try {
        const res = await navigationLinkService.getLinks();
        setNavLinks(res.data);
      } catch (error) {
        console.error('Failed to fetch navigation links:', error);
      }
    };
    fetchNavLinks();
  }, []);

  // Always a manual toggle — the hamburger is always visible, and the nav
  // panel only ever opens by clicking it (no more auto-shown home-hero list).
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);

  // ── Close the panel on an outside click ──────────
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
          directly beneath it, in the same bordered white styling. The
          hamburger is always visible; every nav item (Shop, sports, account)
          lives inside the panel it toggles — never shown any other way. */}
      {/* items-stretch (not items-start) so the logo row and the nav panel
          below always share one width — whichever is naturally wider —
          instead of each shrink-wrapping its own content and shifting
          the whole block sideways depending on whether the hamburger
          cell is present. */}
      <div className="pointer-events-auto bg-white p-2 lg:p-3 flex flex-col items-stretch border-2 border-ink-900" ref={navRef}>
        <div className="flex items-stretch bg-white border-ink-900 border-2">
          {/* Fixed h-11/h-12 on both this row's cells and the cart button
              (below) — not derived from padding + intrinsic image/icon
              size, which is what made the two boxes drift apart by a few
              px depending on breakpoint. Explicit height makes them match
              exactly, by construction, regardless of what's inside. */}
          <Link to="/" className="h-11 md:h-12 flex items-center px-3 md:px-4">
            <img src={LogoColor} alt="Puso Pilipinas" className="h-7 md:h-8 w-auto" />
          </Link>
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="h-11 md:h-12 flex items-center justify-center px-3 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white transition-colors duration-150"
            aria-label="Open menu"
            aria-expanded={navOpen}
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`flex flex-col items-start bg-white transition-all duration-200 ease-out overflow-hidden ${
            navOpen ? 'max-h-96 border-x-2 border-b-2 border-ink-900 py-2' : 'max-h-0 border-0'
          }`}
        >
          {navLinks.map((link) => {
            const isExternal = /^https?:\/\//.test(link.destination);
            const highlightCls = link.highlight ? 'text-primary-600 font-semibold' : '';
            return isExternal ? (
              <a
                key={link._id}
                href={link.destination}
                target={link.openInNewTab ? '_blank' : undefined}
                rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={() => setNavOpen(false)}
                className={`${itemCls} ${highlightCls}`}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link._id}
                to={link.destination}
                target={link.openInNewTab ? '_blank' : undefined}
                rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={() => setNavOpen(false)}
                className={`${itemCls} ${highlightCls}`}
              >
                {link.label}
              </Link>
            );
          })}
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

      {/* Right cluster — cart, its own independent bordered box. Same
          outer/inner padding structure as the left cluster's top row
          (p-2 lg:p-3 wrapper, px-3 md:px-4 py-2 md:py-2.5 inner control)
          so the two match height exactly at every breakpoint, not by
          eyeballed padding numbers. One button for both Merchandise and
          Passes — CartDrawer.jsx has an internal tab switch between the
          two; the badge here is their combined count. */}
      <div className="pointer-events-auto bg-white p-2 lg:p-3 border-2 border-ink-900">
        <button
          onClick={() => useCartStore.getState().openCart()}
          className="relative h-11 md:h-12 border-2 border-ink-900 flex items-center justify-center px-3 md:px-4 text-ink-900 hover:bg-ink-900 hover:text-white transition-colors duration-150"
          aria-label={`Cart${totalCartCount > 0 ? `, ${totalCartCount} item${totalCartCount !== 1 ? 's' : ''}` : ''}`}
        >
          <ShoppingBagIcon className="w-5 h-5" />
          {totalCartCount > 0 && (
            <span className="absolute -top-2 -right-2 text-[10px] w-4 h-4 rounded-full bg-ink-900 text-white flex items-center justify-center font-bold">
              {totalCartCount > 9 ? '9+' : totalCartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Header;
