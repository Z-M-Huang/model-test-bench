import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
const rootEl = document.getElementById('root') as HTMLElement | null;
if (!rootEl) throw new Error('Root element not found');

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
