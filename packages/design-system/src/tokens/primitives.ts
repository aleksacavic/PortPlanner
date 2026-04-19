// Layer 1 — Primitive design tokens. Raw values.
// Components MUST NOT import this file. Use semantic tokens via CSS custom
// properties (var(--…)) or, in canvas code, via useActiveThemeTokens().
// Grep gate G3.1 enforces: only files under tokens/semantic-*.ts may import
// from './primitives'.

export const color = {
  gray: {
    50: '#f8f9fb',
    100: '#f0f2f5',
    200: '#e2e6ed',
    300: '#c8d0dc',
    400: '#9aa8bf',
    500: '#7a90b8',
    600: '#4a5a7a',
    700: '#3a4a6a',
    800: '#2a3550',
    900: '#1e2636',
    925: '#1a2030',
    950: '#161b26',
    1000: '#0d1117',
  },
  blue: {
    100: '#cce0ff',
    300: '#4a9eff',
    400: '#3b8bd4',
    500: '#2a7fff',
    600: '#1a6fee',
    700: '#0a5fd4',
  },
  green: {
    200: '#88ffe0',
    400: '#00e5a0',
    500: '#00d4aa',
    600: '#00b894',
    700: '#009978',
  },
  amber: {
    300: '#ffc14d',
    400: '#f5a623',
    500: '#e09520',
    600: '#b57800',
  },
  red: {
    300: '#ff7a7a',
    400: '#e05555',
    500: '#c74444',
    600: '#a33333',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

export const text_color = {
  on_dark: {
    primary: '#c8d8f0',
    secondary: '#7a90b8',
    tertiary: '#4a5a7a',
  },
  on_light: {
    primary: '#1a2030',
    secondary: '#4a5a7a',
    tertiary: '#7a90b8',
  },
} as const;

export const size = {
  0: '0',
  1: '2px',
  2: '4px',
  3: '6px',
  4: '8px',
  6: '12px',
  8: '16px',
  10: '20px',
  12: '24px',
  16: '32px',
  20: '40px',
  24: '48px',
  32: '64px',
} as const;

export const radius = {
  sm: '3px',
  md: '5px',
  lg: '7px',
  xl: '12px',
  full: '9999px',
} as const;

export const font = {
  family: {
    sans: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Consolas", monospace',
  },
  size: {
    xs: '8px',
    sm: '9px',
    base: '10px',
    md: '11px',
    lg: '12px',
    xl: '14px',
    '2xl': '16px',
    '3xl': '20px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letter_spacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.05em',
    wider: '0.08em',
    widest: '0.12em',
  },
  line_height: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.2)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 8px 28px rgba(0,0,0,0.6)',
  xl: '0 12px 40px rgba(0,0,0,0.8)',
} as const;

export const motion = {
  duration: {
    fast: '100ms',
    normal: '150ms',
    slow: '250ms',
    slower: '400ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
} as const;
