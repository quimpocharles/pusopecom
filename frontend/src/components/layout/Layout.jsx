import Header from './Header';
import Footer from './Footer';
import CartDrawer from '../cart/CartDrawer';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default Layout;
