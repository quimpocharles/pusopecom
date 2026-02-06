import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBagIcon,
  UserIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import productService from '../../services/productService';
import { useState, useRef, useEffect } from 'react';

// Get user initials from name
const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last || '?';
};

const Header = () => {
  const navigate = useNavigate();
  const cartCount = useCartStore((state) => state.getCartCount());
  const { user, isAuthenticated, logout } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // const [showSportsDropdown, setShowSportsDropdown] = useState(false);
  // const [showMobileSports, setShowMobileSports] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  // const sportsDropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const debounceRef = useRef(null);

  // Close sports dropdown on outside click
  // useEffect(() => {
  //   const handleClickOutside = (e) => {
  //     if (sportsDropdownRef.current && !sportsDropdownRef.current.contains(e.target)) {
  //       setShowSportsDropdown(false);
  //     }
  //     if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
  //       setShowSuggestions(false);
  //     }
  //   };
  //   document.addEventListener('mousedown', handleClickOutside);
  //   return () => document.removeEventListener('mousedown', handleClickOutside);
  // }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      navigate(`/products/${suggestions[selectedIndex].slug}`);
    } else if (searchTerm.trim()) {
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

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

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

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const navLinks = [
    { label: 'Shop All', href: '/products' },
    { label: 'Men', href: '/products?gender=men' },
    { label: 'Women', href: '/products?gender=women' },
    { label: 'Youth', href: '/products?gender=youth' },
  ];

  const sportsLinks = [
    { label: 'Basketball', href: '/products?sport=basketball' },
    { label: 'Volleyball', href: '/products?sport=volleyball' },
    { label: 'Football', href: '/products?sport=football' },
  ];

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-gray-100">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Mobile menu button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <span className="text-xl md:text-2xl font-bold text-primary-600">
              Puso Pilipinas
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="nav-link text-sm"
              >
                {link.label}
              </Link>
            ))}

            {/* Sports Dropdown */}
            {/* <div className="relative" ref={sportsDropdownRef}>
              <button
                onClick={() => setShowSportsDropdown(!showSportsDropdown)}
                className="nav-link text-sm inline-flex items-center gap-1"
              >
                Sports
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showSportsDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showSportsDropdown && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-44 bg-white rounded-xl shadow-card border border-gray-100 py-2 z-20 animate-slide-down">
                  {sportsLinks.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setShowSportsDropdown(false)}
                      className="block px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div> */}

            <Link to="/products?sale=true" className="nav-link text-sm text-accent-500 font-semibold">
              Sale
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-700" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`${isAuthenticated ? 'p-0.5' : 'p-2'} hover:bg-gray-100 rounded-full transition-colors`}
              >
                {isAuthenticated ? (
                  user?.avatar && !avatarError ? (
                    <img
                      src={user.avatar}
                      alt={user.firstName}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={() => setAvatarError(true)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
                      {getInitials(user?.firstName, user?.lastName)}
                    </div>
                  )
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-700" />
                )}
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-card border border-gray-100 py-2 z-20 animate-slide-down">
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                          {user?.avatar && !avatarError ? (
                            <img
                              src={user.avatar}
                              alt={user.firstName}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              onError={() => setAvatarError(true)}
                              referrerPolicy="no-referrer"
                            />
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
                        <Link
                          to="/orders"
                          className="block px-4 py-2.5 hover:bg-gray-50 text-sm"
                          onClick={() => setShowUserMenu(false)}
                        >
                          My Orders
                        </Link>
                        <Link
                          to="/account"
                          className="block px-4 py-2.5 hover:bg-gray-50 text-sm"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Account Settings
                        </Link>
                        {user?.role === 'admin' && (
                          <Link
                            to="/admin"
                            className="block px-4 py-2.5 hover:bg-gray-50 text-sm"
                            onClick={() => setShowUserMenu(false)}
                          >
                            Admin Dashboard
                          </Link>
                        )}
                        <div className="border-t border-gray-100 mt-2 pt-2">
                          <button
                            onClick={handleLogout}
                            className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-accent-500"
                          >
                            Sign Out
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className="block px-4 py-2.5 hover:bg-gray-50 text-sm font-medium"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          className="block px-4 py-2.5 hover:bg-gray-50 text-sm"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Create Account
                        </Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ShoppingBagIcon className="w-5 h-5 text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Search Bar (expandable) */}
      {showSearch && (
        <div className="border-t border-gray-100 bg-white animate-slide-down">
          <div className="container-custom py-4">
            <div className="relative max-w-2xl mx-auto" ref={searchContainerRef}>
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={handleSearchInput}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                  className="w-full px-5 py-3 pl-12 bg-gray-50 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setSuggestions([]); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </form>

              {/* Search Suggestions Dropdown */}
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
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === i ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
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
      )}

      {/* Mobile Menu */}
      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white z-50 animate-slide-down">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="text-xl font-bold text-primary-600">Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <nav className="p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="block py-3 text-lg font-medium text-gray-900 hover:text-primary-600 border-b border-gray-100"
                >
                  {link.label}
                </Link>
              ))}
              {/* Sports accordion */}
              <button
                onClick={() => setShowMobileSports(!showMobileSports)}
                className="flex items-center justify-between w-full py-3 text-lg font-medium text-gray-900 hover:text-primary-600 border-b border-gray-100"
              >
                Sports
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showMobileSports ? 'rotate-180' : ''}`} />
              </button>
              {showMobileSports && (
                <div className="pl-4">
                  {sportsLinks.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="block py-2.5 text-base text-gray-600 hover:text-primary-600 border-b border-gray-50"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
              <Link
                to="/products?sale=true"
                onClick={() => setShowMobileMenu(false)}
                className="block py-3 text-lg font-medium text-accent-500 hover:text-accent-600 border-b border-gray-100"
              >
                Sale
              </Link>
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {user?.avatar && !avatarError ? (
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={() => setAvatarError(true)}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
                        {getInitials(user?.firstName, user?.lastName)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowMobileMenu(false);
                    }}
                    className="btn-outline w-full text-sm"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setShowMobileMenu(false)}
                    className="btn-primary w-full text-center text-sm"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setShowMobileMenu(false)}
                    className="btn-outline w-full text-center text-sm"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
