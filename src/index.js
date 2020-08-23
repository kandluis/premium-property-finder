import React from "react";
import ReactDOM from "react-dom";
import { Router } from '@reach/router'


import { Home } from "./pages/Home.js";
import { Details } from "./pages/Details.js";

const rootElement = document.getElementById("root");
ReactDOM.render(
  <Router>
    <Home default />
    <Details path="/details/:propertyId" />
  </Router>,
  rootElement
);
