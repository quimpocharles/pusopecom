/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Deep Navy Blue (trust, Filipino pride)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#0A2463',
          700: '#081d4f',
          800: '#06163b',
          900: '#040f27',
          950: '#020813',
        },
        // Secondary - Championship Gold
        secondary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F59E0B',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Accent - Philippine Flag Red
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#CE1126',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
        // Semantic colors
        navy: '#0A2463',
        gold: '#F59E0B',
        cream: '#FAFAF9',

        // --- Editorial Design Language tokens (docs/design/DESIGN_TOKENS.md) ---
        // Namespaced under `ink`/`paper` deliberately, rather than reusing
        // `gray`/`primary`, so a component can opt into the new neutral
        // scale explicitly without any risk of an unmigrated page's
        // existing `gray-*`/`primary-*` usage silently changing underneath
        // it. Only the neutrals are added here — `signal.*` (verified/live/
        // error) and `institution.identity` are deferred to the phase that
        // migrates Badge/Alert, which this pass doesn't touch.
        ink: {
          900: '#0E0E0E', // primary text, strongest surface — soft black, not #000
          700: '#3A3A3A', // secondary text, the "strong" border value
          500: '#767676', // tertiary text, placeholder, disabled
          200: '#E4E4E2', // the "quiet" border value
        },
        paper: {
          DEFAULT: '#FAFAF8', // base surface — warm off-white, not #FFFFFF
        },

        // Merchandising labels — Sale, Try-On — a fourth, narrow color
        // category alongside ink/paper/signal, added after evaluating the
        // migrated Products page against real reference. These are
        // functionally meaningful, repeatable commerce states a fan scans
        // for, not decoration — same "color is meaning" test signal.* is
        // held to — but deliberately distinct hues from signal.verified/
        // live/error so a merchandising label is never mistaken for a
        // Trust or urgency signal. Scoped to exactly these two labels;
        // not a general-purpose accent palette.
        merch: {
          sale: '#6B4E71',
          tryon: '#2E6B7A',
          new: '#3D5A80', // muted steel blue — distinct from every other hue in use
        },
      },
      fontFamily: {
        sans: ['puso-body', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['puso-display', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],

        // Editorial type scale (DESIGN_TOKENS.md § Typography Scale).
        // Prefixed `editorial-` so it can't collide with the display-* scale
        // above, which existing unmigrated pages still depend on.
        'editorial-caption': ['0.75rem', { lineHeight: '1.5' }],
        'editorial-label': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'editorial-body': ['1rem', { lineHeight: '1.6' }],
        'editorial-title': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'editorial-headline': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'editorial-display': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '4xl': '2rem',

        // DESIGN_TOKENS.md radius.default. Revised from 2px to a true 0
        // after checking the migrated Products page against real
        // reference — a 2px softening still read as "rounded" at card
        // scale, not sharp. Named `editorial`, not `default`, so it never
        // silently changes what bare `rounded` or `rounded-xl` mean for
        // anything still unmigrated.
        editorial: '0px',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.05)',
        'card-hover': '0 0 0 1px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
