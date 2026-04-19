import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { dark, emitCSSVarEntries } from '../tokens';
import { type ActiveTheme, ThemeContext, type ThemeMode } from './ThemeContext';

interface ThemeProviderProps {
  /** Theme mode. M1.1 accepts only `'dark'`. */
  mode?: ThemeMode;
  children: ReactNode;
}

export function ThemeProvider({ mode: initialMode = 'dark', children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  // M1.1 narrow: `active` always resolves to the same single theme as `mode`.
  const active: ActiveTheme = mode;

  // Inject semantic tokens as CSS custom properties on <html>, and apply
  // the theme-* class so CSS selectors can conditionally style.
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of emitCSSVarEntries(dark)) {
      root.style.setProperty(`--${name}`, value);
    }
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${active}`);
  }, [active]);

  const value = useMemo(() => ({ mode, active, setMode, tokens: dark }), [mode, active]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
