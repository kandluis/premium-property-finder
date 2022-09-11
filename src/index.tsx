import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import Home from './pages/Home';

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
