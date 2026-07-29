/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        'surface-bright': 'var(--surface-bright)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container': 'var(--surface-container)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'inverse-surface': 'var(--inverse-surface)',
        'inverse-on-surface': 'var(--inverse-on-surface)',
        'surface-tint': 'var(--surface-tint)',
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        'primary-container': 'var(--primary-container)',
        'on-primary-container': 'var(--on-primary-container)',
        'inverse-primary': 'var(--inverse-primary)',
        secondary: 'var(--secondary)',
        'on-secondary': 'var(--on-secondary)',
        'secondary-container': 'var(--secondary-container)',
        'on-secondary-container': 'var(--on-secondary-container)',
        tertiary: 'var(--tertiary)',
        'on-tertiary': 'var(--on-tertiary)',
        'tertiary-container': 'var(--tertiary-container)',
        'on-tertiary-container': 'var(--on-tertiary-container)',
        error: 'var(--error)',
        'on-error': 'var(--on-error)',
        'error-container': 'var(--error-container)',
        'on-error-container': 'var(--on-error-container)',
        background: 'var(--background)',
        'on-background': 'var(--on-background)',
        'surface-variant': 'var(--surface-variant)',
        outline: 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
        accent: 'var(--accent)',
        'on-accent': 'var(--on-accent)',
        'accent-container': 'var(--accent-container)',
        'on-accent-container': 'var(--on-accent-container)',
        'glovo-yellow': '#FFC244',
        'glovo-green': '#00A082',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SF Mono', 'monospace']
      },
      fontSize: {
        'display-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-sm': ['15px', { lineHeight: '22px', fontWeight: '500' }],
        'body-md': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'label-caps': ['10px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '600' }],
        'mono-data': ['12px', { lineHeight: '18px', fontWeight: '400' }]
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
        popover: '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        'elevated': '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)'
      }
    }
  },
  plugins: []
};
