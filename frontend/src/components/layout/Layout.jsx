import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from '../cart/CartDrawer';
import QuickAddModal from '../cart/QuickAddModal';
import AnnouncementBar from '../common/AnnouncementBar';

// 2rem = 32px — must match AnnouncementBar's h-8
const BAR_HEIGHT = '2rem';

const Layout = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const [barVisible, setBarVisible] = useState(() => {
    try { return sessionStorage.getItem('announcement-dismissed') !== 'true'; }
    catch { return true; }
  });

  // Sync CSS variable so the header slides down when the bar is visible
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--header-top',
      barVisible ? BAR_HEIGHT : '0px'
    );
  }, [barVisible]);

  const handleDismissBar = () => {
    try { sessionStorage.setItem('announcement-dismissed', 'true'); } catch {}
    setBarVisible(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to main content
      </a>
      {barVisible && <AnnouncementBar onDismiss={handleDismissBar} />}
      <Header />
      {/* pt accounts for fixed header (pt-20 = 80px) + optional announcement bar (pt-8 = 32px) */}
      <main id="main-content" className={`flex-1 overflow-x-hidden ${isHome ? '' : barVisible ? 'pt-28' : 'pt-20'}`}>
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <QuickAddModal />
    </div>
  );
};

export default Layout;
