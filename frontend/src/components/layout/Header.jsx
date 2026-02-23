import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../../assets/images/puso.png';
import {
  ShoppingBagIcon,
  UserIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import productService from '../../services/productService';
import activityService from '../../services/activityService';
import { toTitleCase } from '../../utils/text';
import { useState, useRef, useEffect } from 'react';

const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last || '?';
};

// Easing curves
const SPRING = 'cubic-bezier(0.34, 1.3, 0.64, 1)';
const EASE   = 'cubic-bezier(0.4, 0, 0.2, 1)';

const Header = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const cartCount = useCartStore((state) => state.getCartCount());
  const { user, isAuthenticated, logout } = useAuthStore();

  const [scrolled,        setScrolled]        = useState(false);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [showUserMenu,    setShowUserMenu]    = useState(false);
  const [showMobileMenu,  setShowMobileMenu]  = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const [showMobileSports,setShowMobileSports]= useState(false);
  const [avatarError,     setAvatarError]     = useState(false);
  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex,   setSelectedIndex]   = useState(-1);
  const searchContainerRef = useRef(null);
  const debounceRef        = useRef(null);

  // isExpanded: full-width transparent bar at top; collapses to dark pill on scroll
  const isExpanded = !scrolled;

  // ── Scroll listener ──────────────────────────────────────────────
  useEffect(() => {
    let ticking = false;
    const update = () => { setScrolled(window.scrollY > 60); ticking = false; };
    const onScroll = () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Color tokens (dark text at top, white text in pill) ─────────
  const iconCls   = isExpanded ? 'text-gray-700'          : 'text-white/80';
  const hoverBtn  = isExpanded ? 'hover:bg-black/[0.06]'  : 'hover:bg-white/10';

  // ── Shell style (outer full-width positioner) ────────────────────
  const shellStyle = {
    top: 'var(--header-top, 0px)',
    padding: isExpanded ? '0' : '14px 7%',
    transition: `padding 0.48s ${SPRING}, top 0.2s ease`,
  };

  // ── Nav inner style (the morphing pill) ─────────────────────────
  const navStyle = {
    height:               isExpanded ? '80px'        : '52px',
    padding:              isExpanded ? '0 40px'      : '0 20px',
    background:           isExpanded ? 'transparent' : 'rgba(10, 10, 10, 0.82)',
    borderRadius:         isExpanded ? '0px'         : '100px',
    border:               isExpanded ? '1px solid transparent' : '1px solid rgba(255,255,255,0.10)',
    boxShadow:            isExpanded ? 'none' : '0 4px 6px rgba(0,0,0,0.12), 0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter:       isExpanded ? 'blur(0px)'   : 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: isExpanded ? 'blur(0px)'   : 'blur(24px) saturate(180%)',
    transition: [
      `height           0.48s ${SPRING}`,
      `padding          0.48s ${SPRING}`,
      `background       0.45s ${EASE}`,
      `border-radius    0.48s ${SPRING}`,
      `border-color     0.45s ${EASE}`,
      `box-shadow       0.45s ${EASE}`,
      `backdrop-filter  0.45s ${EASE}`,
    ].join(', '),
  };

  // ── Search handlers ──────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      navigate(`/products/${suggestions[selectedIndex].slug}`);
    } else if (searchTerm.trim()) {
      activityService.trackSearch(searchTerm.trim());
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
    }
    setShowSearch(false);
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchTerm('');
    setSelectedIndex(-1);
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productService.getSearchSuggestions(value.trim());
        setSuggestions(res.data);
        setShowSuggestions(res.data.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handleSearchKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Escape') { setShowSuggestions(false); setSelectedIndex(-1); }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const navLinks = [
    { label: 'Shop All',    href: '/products' },
    { label: 'Men',         href: '/products?gender=men' },
    { label: 'Women',       href: '/products?gender=women' },
    { label: 'Youth',       href: '/products?gender=youth' },
  ];

  const sportsLinks = [
    { label: 'Basketball', href: '/products?sport=basketball' },
    { label: 'Volleyball', href: '/products?sport=volleyball' },
    { label: 'Football',   href: '/products?sport=football' },
  ];

  const linkCls = isExpanded
    ? 'text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-black/[0.06] transition-colors whitespace-nowrap'
    : 'text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/[0.08] transition-colors whitespace-nowrap';

  return (
    <>
      {/* ── Shell: fixed full-width positioner ─────────────────── */}
      <div
        className="fixed left-0 right-0 z-50 flex flex-col pointer-events-none"
        style={shellStyle}
      >
        {/* ── Pill nav ─────────────────────────────────────────── */}
        <header
          className="pointer-events-auto w-full flex items-center justify-between overflow-visible"
          style={navStyle}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className={`md:hidden p-2 -ml-1 ${hoverBtn} rounded-lg`}
            aria-label="Open menu"
          >
            <Bars3Icon className={`w-5 h-5 transition-colors duration-[450ms] ${iconCls}`} />
          </button>

          {/* Logo — allowed to overflow the navbar height */}
          <Link to="/" className="flex-shrink-0 relative z-10">
            <img src={Logo} alt="Puso Pilipinas" className="h-14 md:h-16 w-auto" />
          </Link>

          {/* Desktop nav — absolutely centred so it doesn't push the logo/actions */}
          <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              <Link key={link.label} to={link.href} className={linkCls}>
                {link.label}
              </Link>
            ))}
            <Link to="/products?sale=true" className={`${isExpanded ? 'text-gray-800 hover:text-gray-900 hover:bg-black/[0.06]' : 'text-white/90 hover:text-white hover:bg-white/[0.08]'} text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors`}>
              Sale
            </Link>
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center gap-1 md:gap-1.5">
            {/* Search */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 ${hoverBtn} rounded-full transition-colors`}
              aria-label="Search"
            >
              <MagnifyingGlassIcon className={`w-4 h-4 md:w-5 md:h-5 transition-colors duration-[450ms] ${iconCls}`} />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`${isAuthenticated ? 'p-0.5' : 'p-2'} ${hoverBtn} rounded-full transition-colors`}
                aria-label="Account menu"
              >
                {isAuthenticated ? (
                  user?.avatar && !avatarError ? (
                    <img
                      src={user.avatar}
                      alt={user.firstName}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover"
                      onError={() => setAvatarError(true)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
                      {getInitials(user?.firstName, user?.lastName)}
                    </div>
                  )
                ) : (
                  <UserIcon className={`w-4 h-4 md:w-5 md:h-5 transition-colors duration-[450ms] ${iconCls}`} />
                )}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-card border border-gray-100 py-2 z-20 animate-slide-down">
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                          {user?.avatar && !avatarError ? (
                            <img src={user.avatar} alt={user.firstName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" onError={() => setAvatarError(true)} referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                              {getInitials(user?.firstName, user?.lastName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                          </div>
                        </div>
                        <Link to="/orders"  className="block px-4 py-2.5 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>My Orders</Link>
                        <Link to="/account" className="block px-4 py-2.5 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>Account Settings</Link>
                        {user?.role === 'admin' && (
                          <Link to="/admin" className="block px-4 py-2.5 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>Admin Dashboard</Link>
                        )}
                        <div className="border-t border-gray-100 mt-2 pt-2">
                          <button onClick={handleLogout} className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-accent-500">
                            Sign Out
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link to="/login"    className="block px-4 py-2.5 hover:bg-gray-50 text-sm font-medium" onClick={() => setShowUserMenu(false)}>Sign In</Link>
                        <Link to="/register" className="block px-4 py-2.5 hover:bg-gray-50 text-sm"             onClick={() => setShowUserMenu(false)}>Create Account</Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={() => useCartStore.getState().openCart()}
              className={`relative p-2 ${hoverBtn} rounded-full transition-colors`}
              aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} item${cartCount !== 1 ? 's' : ''}` : ''}`}
            >
              <ShoppingBagIcon className={`w-4 h-4 md:w-5 md:h-5 transition-colors duration-[450ms] ${iconCls}`} />
              {cartCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold transition-colors duration-[450ms] ${isExpanded ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* Shop Now CTA — desktop only */}
            <Link
              to="/products"
              className={`hidden md:inline-flex items-center text-sm font-bold px-4 py-2 rounded-full transition-all whitespace-nowrap ml-1 active:scale-[0.97] ${isExpanded ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white text-gray-900 hover:bg-white/88'}`}
            >
              Shop Now
            </Link>
          </div>
        </header>

        {/* ── Search expansion (slides in below the pill) ───────── */}
        {showSearch && (
          <div className="pointer-events-auto mt-2 mx-1 animate-slide-down">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(10, 10, 10, 0.90)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              <div className="px-4 py-3">
                <div className="relative max-w-2xl mx-auto" ref={searchContainerRef}>
                  <form onSubmit={handleSearch} className="relative">
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={handleSearchInput}
                      onKeyDown={handleSearchKeyDown}
                      autoFocus
                      aria-label="Search products"
                      className="w-full px-5 py-3 pl-12 bg-white/10 text-white placeholder-white/30 border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-white/30 text-sm"
                    />
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <button
                      type="button"
                      onClick={() => { setShowSearch(false); setSuggestions([]); setShowSuggestions(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
                      aria-label="Close search"
                    >
                      <XMarkIcon className="w-4 h-4 text-white/40" />
                    </button>
                  </form>

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-card border border-gray-100 py-2 z-50 max-h-80 overflow-y-auto">
                      {suggestions.map((item, i) => (
                        <button
                          key={item.slug}
                          onClick={() => {
                            navigate(`/products/${item.slug}`);
                            setShowSearch(false);
                            setShowSuggestions(false);
                            setSuggestions([]);
                            setSearchTerm('');
                          }}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${selectedIndex === i ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                        >
                          {item.image && (
                            <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{toTitleCase(item.name)}</p>
                            <p className="text-sm text-gray-500">
                              {item.salePrice ? (
                                <>
                                  <span className="text-accent-500 font-semibold">₱{item.salePrice.toLocaleString()}</span>
                                  <span className="line-through ml-1 text-gray-400">₱{item.price.toLocaleString()}</span>
                                </>
                              ) : (
                                <span className="font-semibold">₱{item.price.toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile slide-in menu ──────────────────────────────────── */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowMobileMenu(false)} />
          <div
            className="fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 animate-slide-down flex flex-col"
            style={{
              background: 'rgba(10, 10, 10, 0.97)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <img src={Logo} alt="Puso Pilipinas" className="h-7 w-auto" />
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Close menu">
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>

            <nav className="p-4 flex-1 overflow-y-auto">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="block py-3.5 text-base font-medium text-white/80 hover:text-white border-b border-white/[0.06] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={() => setShowMobileSports(!showMobileSports)}
                className="flex items-center justify-between w-full py-3.5 text-base font-medium text-white/80 hover:text-white border-b border-white/[0.06] transition-colors"
              >
                Sports
                <ChevronDownIcon className={`w-4 h-4 text-white/40 transition-transform duration-200 ${showMobileSports ? 'rotate-180' : ''}`} />
              </button>
              {showMobileSports && (
                <div className="pl-4 border-b border-white/[0.06]">
                  {sportsLinks.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="block py-3 text-sm text-white/55 hover:text-white/90 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
              <Link
                to="/products?sale=true"
                onClick={() => setShowMobileMenu(false)}
                className="block py-3.5 text-base font-semibold text-white/90 hover:text-white border-b border-white/[0.06] transition-colors"
              >
                Sale
              </Link>
            </nav>

            <div className="p-4 border-t border-white/10">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {user?.avatar && !avatarError ? (
                      <img src={user.avatar} alt={user.firstName} className="w-9 h-9 rounded-full object-cover" onError={() => setAvatarError(true)} referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
                        {getInitials(user?.firstName, user?.lastName)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-white/40 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                    className="w-full text-sm font-medium text-white/70 border border-white/20 rounded-xl py-2.5 hover:bg-white/08 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link to="/login"    onClick={() => setShowMobileMenu(false)} className="block w-full text-center text-sm font-bold bg-white text-black rounded-full py-3 hover:bg-white/90 transition-colors">Sign In</Link>
                  <Link to="/register" onClick={() => setShowMobileMenu(false)} className="block w-full text-center text-sm font-medium text-white/70 border border-white/20 rounded-full py-3 hover:bg-white/08 transition-colors">Create Account</Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Header;
