import { createRoot } from "react-dom/client";
import AppShell from "./app/Shell";
import Landing from "./Landing";
import Stats from "./Stats";
import "./styles.css";
import "./explainers.css";
import "./app/app.css";

// The landing page at /, public stats at /stats, the multi-page vault app under /app.
const Page = location.pathname.startsWith("/app") ? AppShell : location.pathname.startsWith("/stats") ? Stats : Landing;
createRoot(document.getElementById("root")!).render(<Page />);
