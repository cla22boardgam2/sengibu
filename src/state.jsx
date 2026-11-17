import { createContext, useCallback, useContext, useState } from "react";
import { loadState, saveState } from "./lib/store.js";

const Ctx = createContext(null);

export function AppStateProvider({ children, goTo = () => {} }) {
  const [state, setState] = useState(loadState);
  const [saveFailed, setSaveFailed] = useState(false);

  // fn(prev) => next. 바뀔 때마다 바로 브라우저에 저장한다.
  const update = useCallback((fn) => {
    setState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      setSaveFailed(!saveState(next));
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ state, update, goTo, saveFailed }}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  return [v.state, v.update];
}

export function useApp() {
  return useContext(Ctx);
}
