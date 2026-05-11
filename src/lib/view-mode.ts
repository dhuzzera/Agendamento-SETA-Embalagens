import { useEffect, useState } from "react";

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

export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => getViewMode());
  useEffect(() => {
    const onChange = () => setMode(getViewMode());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [mode, setViewMode];
}
