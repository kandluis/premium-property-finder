import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { Home } from './pages/Home';
import { QueryParamProvider } from 'use-query-params';

const rootElement = document.getElementById('root');
ReactDOM.render(
  <Router>
    <QueryParamProvider ReactRouterRoute={Route}>
      <Home />
    </QueryParamProvider>
  </Router>,
  rootElement,
);
