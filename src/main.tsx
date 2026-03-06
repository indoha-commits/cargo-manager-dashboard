
  import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { AuthGateInternal } from "./app/auth/AuthGateInternal";

createRoot(document.getElementById("root")!).render(
  <AuthGateInternal>
    <App />
  </AuthGateInternal>
);
  