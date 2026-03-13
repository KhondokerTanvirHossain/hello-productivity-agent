import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, useNavigate } from "react-router-dom";
import App from "./App";
import "./index.css";

function NavigationListener() {
  const navigate = useNavigate();
  React.useEffect(() => {
    if (window.electronAPI?.onNavigate) {
      window.electronAPI.onNavigate((route) => {
        navigate(route);
      });
    }
  }, [navigate]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <NavigationListener />
      <App />
    </HashRouter>
  </React.StrictMode>
);
