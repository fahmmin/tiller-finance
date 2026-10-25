import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { EXPLORER } from "../chain";

type Toast = { id: number; kind: "pending" | "success" | "error"; title: string; body?: string; tx?: string };
type Push = (t: Omit<Toast, "id">, replace?: number) => number;

const Ctx = createContext<Push>(() => 0);
export const useToast = () => useContext(Ctx);

let next = 1;

/** Transaction toasts: one pending card that turns into a success or error card, with an explorer link. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback<Push>((t, replace) => {
    const id = replace ?? next++;
    setToasts((all) => [...all.filter((x) => x.id !== id), { ...t, id }]);
    if (t.kind !== "pending") setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 7000);
    return id;
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="toast-icon" aria-hidden="true">{t.kind === "pending" ? <i className="spinner" /> : t.kind === "success" ? "✓" : "!"}</span>
            <div>
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
              {t.tx && <a href={`${EXPLORER}/tx/${t.tx}`} target="_blank" rel="noreferrer">View on explorer</a>}
            </div>
            <button aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
