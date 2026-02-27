import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiDataProvider } from "./context/ApiDataContext";
import { DataProvider } from "./context/DataContext";
import { isApiConfigured } from "./api/client";
import "./styles.css";

const RootProvider = isApiConfigured() ? ApiDataProvider : DataProvider;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootProvider>
        <App />
      </RootProvider>
    </BrowserRouter>
  </React.StrictMode>
);

