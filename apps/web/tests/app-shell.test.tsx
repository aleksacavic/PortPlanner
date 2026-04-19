import { ThemeProvider } from '@portplanner/design-system';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider mode="dark">{children}</ThemeProvider>;
}

describe('<App /> prototype-shell', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  it('renders without throwing', () => {
    expect(() =>
      render(
        <ThemeProvider mode="dark">
          <App />
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });

  it('renders the "PortPlanner" brand in the navbar', () => {
    const { getByText } = render(<App />, { wrapper });
    expect(getByText('PortPlanner')).toBeDefined();
  });

  it('renders the "Tools" left sidebar title', () => {
    const { getByText } = render(<App />, { wrapper });
    expect(getByText('Tools')).toBeDefined();
  });

  it('renders the "Properties" right sidebar title', () => {
    const { getByText } = render(<App />, { wrapper });
    expect(getByText('Properties')).toBeDefined();
  });

  it('renders the "Ready" status text', () => {
    const { getByText } = render(<App />, { wrapper });
    expect(getByText('Ready')).toBeDefined();
  });
});
