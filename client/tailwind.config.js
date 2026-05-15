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
