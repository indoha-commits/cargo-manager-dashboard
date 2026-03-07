import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/index.css";
import { AuthGateInternal } from "./app/auth/AuthGateInternal";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthGateInternal>
      <App />
    </AuthGateInternal>
  </BrowserRouter>
);
