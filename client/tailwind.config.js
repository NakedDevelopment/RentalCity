/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT:  'var(--color-primary)',
          light:    'var(--color-primary-light)',
        },

        neutral: {
          900: 'var(--color-neutral-900)',
          800: 'var(--color-neutral-800)',
          600: 'var(--color-neutral-600)',
          500: 'var(--color-neutral-500)',
          400: 'var(--color-neutral-400)',
          300: 'var(--color-neutral-300)',
          200: 'var(--color-neutral-200)',
          100: 'var(--color-neutral-100)',
          50:  'var(--color-neutral-50)',
        },

        status: {
          'locked-bg':      'var(--color-status-locked-bg)',
          'locked-text':    'var(--color-status-locked-text)',
          'accepted-bg':    'var(--color-status-accepted-bg)',
          'accepted-text':  'var(--color-status-accepted-text)',
        },

        notification:      'var(--color-notification)',
        'score-excellent': 'var(--color-score-excellent)',
        'score-moderate':  'var(--color-score-moderate)',

        blue: {
          50:  '#EEF4FF',
          100: '#D9E8FF',
          200: '#BAD1FF',
          300: '#85AAFF',
          400: '#5C8AFF',
          500: 'var(--color-primary)',
          600: 'var(--color-primary)',
          700: '#2558CC',
        },

        gray: {
          50:  'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-600)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
          950: 'var(--color-neutral-900)',
        },

        emerald: {
          50:  'var(--color-status-accepted-bg)',
          100: 'var(--color-status-accepted-bg)',
          500: 'var(--color-status-accepted-text)',
          600: 'var(--color-status-accepted-text)',
          700: 'var(--color-status-accepted-text)',
          800: 'var(--color-status-accepted-text)',
          900: 'var(--color-status-accepted-text)',
        },

        green: {
          600: 'var(--color-status-accepted-text)',
          700: 'var(--color-status-accepted-text)',
        },

        amber: {
          50:  'var(--color-status-locked-bg)',
          100: 'var(--color-status-locked-bg)',
          500: 'var(--color-status-locked-text)',
          600: 'var(--color-status-locked-text)',
          700: 'var(--color-status-locked-text)',
          800: 'var(--color-status-locked-text)',
          900: 'var(--color-status-locked-text)',
          950: 'var(--color-status-locked-text)',
        },

        red: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          400: 'var(--color-notification)',
          500: 'var(--color-notification)',
          600: '#E03E3E',
          700: '#C53030',
          800: '#9B2C2C',
        },

        rose: {
          100: '#FEE2E2',
          600: 'var(--color-notification)',
        },

        sky: {
          50:  '#EEF4FF',
          100: '#D9E8FF',
          200: '#BAD1FF',
          800: 'var(--color-primary)',
          900: 'var(--color-primary)',
        },

        indigo: {
          100: '#D9E8FF',
          200: '#BAD1FF',
          900: 'var(--color-primary)',
        },

        slate: {
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },

        orange: {
          500: 'var(--color-score-moderate)',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
      },
    },
  },
  plugins: [],
}
