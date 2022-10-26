import React from 'react';
import { createRoot } from 'react-dom/client';
import TagManager from 'react-gtm-module';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import Home from './pages/Home';

const tagManagerArgs = {
  gtmId: 'G-CTBS7D93PW',
};
TagManager.initialize(tagManagerArgs);

const rootDiv = document.getElementById('root');
if (rootDiv) {
  const rootElement = createRoot(rootDiv);
  rootElement.render(
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <QueryParamProvider adapter={ReactRouter6Adapter}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </QueryParamProvider>
    </BrowserRouter>,
  );
}
