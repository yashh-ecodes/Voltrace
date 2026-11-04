/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'], brand: ['"Outfit Variable"', 'Outfit', '"Inter Variable"', 'system-ui', 'sans-serif'] },
      colors: {
        bg: '#F8FAFC', card: '#FFFFFF', subtle: '#F1F5F9', ink: '#172B4D', muted: '#64748B', faint: '#94A3B8',
        line: '#E2E8F0', primary: { DEFAULT: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', soft: '#EAF3FF' },
        teal: { DEFAULT: '#14B8A6', 600: '#0D9488', 700: '#0F766E', soft: '#E6F7F4' },
        ok: { DEFAULT: '#16A34A', ink: '#15803D', soft: '#ECFDF3', line: '#BBF7D0' },
        warn: { DEFAULT: '#F59E0B', ink: '#B45309', soft: '#FFF8EB', line: '#FDE68A' },
        crit: { DEFAULT: '#EF4444', ink: '#B91C1C', soft: '#FEF2F2', line: '#FECACA' },
      },
      fontSize: { '2xs': ['11px', '14px'] },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 2px rgba(23,43,77,0.04), 0 1px 3px rgba(23,43,77,0.04)',
        lift: '0 8px 24px -8px rgba(23,43,77,0.18)',
        fab: '0 10px 24px -6px rgba(59,130,246,0.55)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        sweep: { '0%': { transform: 'translateY(-10%)' }, '100%': { transform: 'translateY(110%)' } },
        pulsering: { '0%': { transform: 'scale(.9)', opacity: .6 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
      },
      animation: {
        'fade-up': 'fade-up .32s cubic-bezier(.2,.8,.2,1) both',
        'sheet-up': 'sheet-up .3s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .2s ease-out both',
        sweep: 'sweep 1.6s ease-in-out infinite alternate',
        pulsering: 'pulsering 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
}
