import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useActiveThemeTokens, useTheme } from '../src';

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider mode="dark">{children}</ThemeProvider>;
}

describe('<ThemeProvider mode="dark">', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    // Clear any inline CSS variables set by a previous test.
    for (const prop of Array.from(document.documentElement.style)) {
      document.documentElement.style.removeProperty(prop);
    }
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  it('sets html.theme-dark class and provides dark tokens', () => {
    render(<ThemeProvider mode="dark">test</ThemeProvider>);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);

    const { result } = renderHook(() => useActiveThemeTokens(), { wrapper });
    expect(result.current.surface.base).toBe('#1a1a2e');
    expect(result.current.canvas.snap_indicator).toBe('#00e5a0');
  });

  it('exposes { mode, active, setMode } from useTheme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('dark');
    expect(result.current.active).toBe('dark');
    expect(typeof result.current.setMode).toBe('function');
  });
});
