import { createContext } from 'react';
import type { SemanticTokens } from '../tokens';

// M1.1 narrow type: mode is 'dark' only.
// Milestone 5 widens additively to `'dark' | 'light' | 'system'` and
// `'dark' | 'light'` for the active theme — see plan §6 progressive-
// implementation compliance table.
export type ThemeMode = 'dark';
export type ActiveTheme = 'dark';

export interface ThemeContextValue {
  mode: ThemeMode;
  active: ActiveTheme;
  setMode: (mode: ThemeMode) => void;
  tokens: SemanticTokens;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
