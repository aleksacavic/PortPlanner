import type { SemanticTokens } from '../tokens';
import { useTheme } from './useTheme';

/**
 * Returns the semantic tokens object for the currently active theme.
 * Used by canvas drawing code that cannot read CSS custom properties
 * from a rendering context (see design-tokens.md §"Canvas rendering").
 *
 * The hook re-runs on theme change, and effects that depend on the
 * returned object will trigger a redraw via their dependency array.
 */
export function useActiveThemeTokens(): SemanticTokens {
  return useTheme().tokens;
}
