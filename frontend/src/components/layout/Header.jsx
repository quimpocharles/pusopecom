import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBagIcon,
  UserIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import { useState } from 'react';

const Header = () => {
  const navigate = useNavigate();
  const cartCount = useCartStore((state) => state.getCartCount());
  const { user, isAuthenticated, logout } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
      setShowSearch(false);
      setSearchTerm('');
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const navLinks = [
    { label: 'Basketball', href: '/products?sport=basketball' },
    { label: 'Volleyball', href: '/products?sport=volleyball' },
    { label: 'Football', href: '/products?sport=football' },
    { label: 'All Products', href: '/products' },
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
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <UserIcon className="w-5 h-5 text-gray-700" />
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
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm text-gray-500">Signed in as</p>
                          <p className="font-semibold truncate">{user?.email}</p>
                        </div>
                        <Link
                          to="/orders"
                          className="block px-4 py-2.5 hover:bg-gray-50 text-sm"
                          onClick={() => setShowUserMenu(false)}
                        >
                          My Orders
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
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full px-5 py-3 pl-12 bg-gray-50 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </form>
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
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
              {isAuthenticated ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Signed in as {user?.firstName}</p>
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
