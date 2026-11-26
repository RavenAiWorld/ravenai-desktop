/** @type {import('tailwindcss').Config} */

// Semantic tokens resolve to CSS variables in src/styles/raven/tokens.css and switch with `.dark`.
const rv = (name) => `rgb(var(--rv-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral zinc ramp used by light-mode markup.
        gray: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b'
        },
        // Plaza markup (adapted from New API) uses neutral; keep it on the same zinc ramp.
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b'
        },
        // Raven indigo: links, focus rings, selection and charts. Primary buttons use ink instead.
        primary: {
          50: '#f3f5fe',
          100: '#e8edfd',
          200: '#d3dcfb',
          300: '#b0c0f6',
          400: '#8299ee',
          500: '#4f6fe3',
          600: '#3e5bd8',
          700: '#3249b8',
          800: '#2b3e94',
          900: '#283775',
          950: '#1a2247'
        },
        accent: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b'
        },
        // Dark-mode surfaces: 950 canvas, 900 sidebar/inset, 800 cards, 700 borders.
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#3f3f46',
          700: '#27272a',
          800: '#18181b',
          900: '#111113',
          950: '#09090b'
        },
        rv: {
          canvas: rv('canvas'),
          subtle: rv('subtle'),
          surface: rv('surface'),
          raised: rv('raised'),
          muted: rv('muted'),
          hover: rv('hover'),
          thead: rv('thead'),
          line: rv('line'),
          'line-soft': rv('line-soft'),
          'line-strong': rv('line-strong'),
          fg: rv('fg'),
          'fg-2': rv('fg-2'),
          'fg-3': rv('fg-3'),
          'fg-4': rv('fg-4'),
          ink: rv('ink'),
          'ink-hover': rv('ink-hover'),
          'on-ink': rv('on-ink'),
          accent: rv('accent'),
          'accent-hover': rv('accent-hover'),
          'accent-fg': rv('accent-fg'),
          'accent-soft': rv('accent-soft'),
          success: rv('success'),
          'success-soft': rv('success-soft'),
          warning: rv('warning'),
          'warning-soft': rv('warning-soft'),
          danger: rv('danger'),
          'danger-soft': rv('danger-soft')
        }
      },
      fontFamily: {
        sans: [
          'Geist',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif'
        ],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
        '13': ['13px', { lineHeight: '20px' }]
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        md: '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
        lg: 'var(--rv-shadow-pop)',
        xl: '0 18px 44px -14px rgb(0 0 0 / 0.20)',
        '2xl': 'var(--rv-shadow-modal)',
        glass: 'var(--rv-shadow-pop)',
        'glass-sm': '0 2px 8px -2px rgb(0 0 0 / 0.08)',
        glow: 'none',
        'glow-lg': 'none',
        card: 'var(--rv-shadow-sm)',
        'card-hover': '0 6px 20px -8px rgb(0 0 0 / 0.14)',
        'inner-glow': 'none',
        ring: 'var(--rv-ring)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #3e5bd8 0%, #3249b8 100%)',
        'gradient-dark': 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
        'gradient-glass': 'none',
        'mesh-gradient': 'none'
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.22s ease-out',
        'scale-in': 'scaleIn 0.14s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'none'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderRadius: {
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '16px',
        '4xl': '20px'
      }
    }
  },
  plugins: []
}
