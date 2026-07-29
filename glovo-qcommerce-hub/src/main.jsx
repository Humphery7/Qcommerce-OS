import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
// Side-effect import: applies the persisted/system theme class to <html>
// immediately, before the first render, so there's no flash of the
// wrong theme. See src/store/useThemeStore.js.
import './store/useThemeStore';

// HashRouter (not BrowserRouter) because the built app is loaded from a
// file:// URL inside Electron — there's no server to handle deep-link
// history fallbacks, so hash-based routing is the correct choice here.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
