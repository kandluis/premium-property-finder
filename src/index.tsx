import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TagManager from 'react-gtm-module';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { ColorModeContext } from './common';
import Home from './pages/Home';

const tagManagerArgs = {
  gtmId: 'G-CTBS7D93PW',
};
TagManager.initialize(tagManagerArgs);

function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<'light' | 'dark'>((prefersDarkMode) ? 'dark' : 'light');
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );
  const theme = React.useMemo(
    () => createTheme({
      palette: {
        mode,
      },
    }),
    [mode],
  );
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter basename={process.env.PUBLIC_URL}>
          <QueryParamProvider adapter={ReactRouter6Adapter}>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </QueryParamProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

const rootDiv = document.getElementById('root');
if (rootDiv) {
  const rootElement = createRoot(rootDiv);
  rootElement.render(<App />);
}
