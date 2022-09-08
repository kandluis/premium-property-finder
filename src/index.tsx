import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { Home } from './pages/Home';

const rootElement = createRoot(document.getElementById('root')!);
rootElement.render(
  <BrowserRouter>
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </QueryParamProvider>
  </BrowserRouter>,
);
