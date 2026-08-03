import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../assets/images/Logo.png';
import footerService from '../../services/footerService';

// Icon *shapes* are explicitly exempt from "nothing hardcoded" (design
// system / icons stay in code) — only which platforms are shown, their
// URLs, and their order are CMS-driven. Unknown platforms fall back to a
// generic link glyph rather than being skipped.
const SOCIAL_ICON_PATHS = {
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
};
const GENERIC_SOCIAL_ICON_PATH = 'M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5a1 1 0 111.414 1.414l-1.5 1.5a2 2 0 102.828 2.828l3-3a2 2 0 000-2.828 1 1 0 111.414-1.414zm-3.656 3.656a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5a1 1 0 11-1.414-1.414l1.5-1.5a2 2 0 10-2.828-2.828l-3 3a2 2 0 000 2.828 1 1 0 11-1.414 1.414z';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  // Fully CMS-driven via /api/footer (FooterSettings, FooterLink,
  // SocialLink, PaymentIcon — all editable from Admin > Homepage >
  // Footer). null while loading = render nothing extra yet, rather than
  // flashing stale hardcoded content before the real data arrives.
  const [footer, setFooter] = useState(null);

  useEffect(() => {
    const fetchFooter = async () => {
      try {
        const res = await footerService.getFooter();
        setFooter(res.data);
      } catch (error) {
        console.error('Failed to fetch footer content:', error);
      }
    };
    fetchFooter();
  }, []);

  const companyDescription = footer?.settings?.companyDescription;
  const copyrightText = footer?.settings?.copyrightText || 'Puso Pilipinas. All rights reserved.';
  const linkGroups = footer?.linkGroups || [];
  const socialLinks = footer?.socialLinks || [];
  const paymentIcons = footer?.paymentIcons || [];

  return (
    <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="container-custom py-8 md:py-10">
        {/* Main row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Brand */}
          <div className="flex-shrink-0">
            <Link to="/" className="inline-block mb-3">
              <img src={Logo} alt="Puso Pilipinas" className="h-7 w-auto" />
            </Link>
            {companyDescription && (
              <p className="text-xs max-w-[220px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>
                {companyDescription}
              </p>
            )}
          </div>

          {/* Links */}
          {linkGroups.length > 0 && (
            <div className="flex gap-12 md:gap-16">
              {linkGroups.map((group) => (
                <div key={group.groupLabel}>
                  <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.09em' }}>{group.groupLabel}</h4>
                  <ul className="space-y-2">
                    {group.links.map((link) => (
                      <li key={link._id}>
                        <Link to={link.destination} className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                        >{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Social */}
          {socialLinks.length > 0 && (
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social._id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.platform}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d={SOCIAL_ICON_PATHS[social.platform?.toLowerCase()] || GENERIC_SOCIAL_ICON_PATH} />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            &copy; {currentYear} {copyrightText}
          </p>
          {paymentIcons.length > 0 && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {paymentIcons.map((icon) => icon.label).join(' · ')}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
