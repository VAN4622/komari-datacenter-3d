import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/ui-sdk.css';
import '@/styles/rack-3d.css';
import '@/styles/hall.css';
import App from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
