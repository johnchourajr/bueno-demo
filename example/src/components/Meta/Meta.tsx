"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "bueno-screen-demo:meta";

type MetaContextValue = {
  /** True when the page is a demo of itself; false shows a plain product demo. */
  meta: boolean;
  setMeta: (meta: boolean) => void;
};

const MetaContext = createContext<MetaContextValue>({
  meta: true,
  setMeta: () => {},
});

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "off") setMetaState(false);
    } catch {
      // Storage can be blocked; the page defaults to meta.
    }
  }, []);

  const setMeta = useCallback((next: boolean) => {
    setMetaState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Not remembered across visits, which is fine.
    }
  }, []);

  return (
    <MetaContext.Provider value={{ meta, setMeta }}>
      {children}
    </MetaContext.Provider>
  );
}

export function useMeta() {
  return useContext(MetaContext);
}
