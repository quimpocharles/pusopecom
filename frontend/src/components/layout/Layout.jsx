import Header from './Header';
import Footer from './Footer';
import CartDrawer from '../cart/CartDrawer';

const marqueeItems = [
  { icon: '✨', text: 'Try jerseys virtually before you buy!' },
  { icon: '🚚', text: 'FREE SHIPPING on orders over ₱2,000' },
  { icon: null, text: 'Authentic licensed merchandise' },
  { icon: '🇵🇭', text: 'Support Philippine Sports' },
];

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to main content
      </a>
      {/* Announcement bar — scrolls with page, not sticky */}
      <div className="bg-primary-600 text-white py-1.5 overflow-x-hidden text-xs flex-shrink-0">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-6">
              {marqueeItems.map((item, j) => (
                <span key={j} className="flex items-center gap-8">
                  <span className="flex items-center gap-2">
                    {item.icon && <span>{item.icon}</span>}
                    <span dangerouslySetInnerHTML={{ __html: item.text.replace('FREE SHIPPING', '<strong>FREE SHIPPING</strong>') }} />
                  </span>
                  <span className="text-white/40">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Header />
      <main id="main-content" className="flex-1 overflow-x-hidden">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default Layout;
