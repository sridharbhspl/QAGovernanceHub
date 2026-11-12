import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import { RootState } from './store';
import { getPreset, buildMuiTheme } from './theme/theme';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

/** Reads the theme preset from Redux and injects the MUI theme dynamically */
const DynamicThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const presetId = useSelector((state: RootState) => state.theme.presetId);
  const muiTheme = useMemo(() => buildMuiTheme(getPreset(presetId)), [presetId]);
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <DynamicThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DynamicThemeProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
