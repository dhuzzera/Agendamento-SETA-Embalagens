import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const KEY = "seta:viewMode";
const EVT = "seta:viewModeChange";

export type ViewMode = "admin" | "representative";

export function getViewMode(): ViewMode {
  if (typeof window === "undefined") return "admin";
  return (localStorage.getItem(KEY) as ViewMode) || "admin";
}

export function setViewMode(mode: ViewMode) {
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVT, { detail: mode }));
}

export class ViewModePermissionError extends Error {
  constructor() {
    super("Apenas administradores podem alternar para o modo Representante.");
    this.name = "ViewModePermissionError";
  }
}

export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  // Effective mode: non-admins are always locked to "representative".
  const compute = (): ViewMode => {
    if (!isAdmin) return "representative";
    return getViewMode();
  };

  const [mode, setMode] = useState<ViewMode>(() => compute());

  useEffect(() => {
    setMode(compute());
    const onChange = () => setMode(compute());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const guardedSet = (m: ViewMode) => {
    if (!isAdmin) {
      throw new ViewModePermissionError();
    }
    setViewMode(m);
  };

  return [mode, guardedSet];
}
