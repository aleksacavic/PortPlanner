import { ThemeProvider } from '@portplanner/design-system';
import '@portplanner/design-system/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider mode="dark">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
