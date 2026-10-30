import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import 'lenis/dist/lenis.css';
import App from './App';
import { initTheme } from './state/themeStore';
import './styles/global.scss';

initTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
