import type { Config } from 'tailwindcss';

// Bảng màu lấy từ bản mockup long-son-mobile.html để giữ đúng nhận diện.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16202E', 2: '#24344A', 3: '#64748B' },
        teal: { DEFAULT: '#0E8CAE', d: '#0A6C88' },
        brick: '#B8402F',
        free: { DEFAULT: '#DFEFE2', line: '#A9D4B1' },
        tape: { DEFAULT: '#F7CFCB', line: '#DE9A93', ink: '#8E2E20' },
        lock: { DEFAULT: '#E1E7EC', line: '#C2CCD5', ink: '#5A6B7E' },
        pend: { DEFAULT: '#FBE3B8', line: '#D9962A', ink: '#8A5806' },
        paper: '#EDF0F3',
        card: '#FFFFFF',
        line: '#E1E6EA',
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
