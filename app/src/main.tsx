import { createRoot } from "react-dom/client";
import App from "./App";
import Landing from "./Landing";
import "./styles.css";

// Two pages: the landing page at / and the vault app at /app.
const Page = location.pathname.startsWith("/app") ? App : Landing;
createRoot(document.getElementById("root")!).render(<Page />);
