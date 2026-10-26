import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ModalStackContext } from "./ModalContext";

function ensureModalHost() {
  let host = document.querySelector("[data-modal-package-host]");
  if (host) {
    return host;
  }
  host = document.createElement("div");
  host.setAttribute("data-modal-package-host", "true");
  document.body.appendChild(host);
  return host;
}

export function ModalProvider({ children }) {
  const [host, setHost] = useState(null);
  const [stack, setStack] = useState([]);
  const nextIdRef = useRef(0);

  const register = useCallback((entry) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    setStack((current) => current.concat([{ ...entry, id }]));
    return id;
  }, []);

  const unregister = useCallback((id) => {
    setStack((current) => current.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const nextHost = ensureModalHost();
    setHost(nextHost);
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    document.body.classList.toggle("modal-package-open", stack.length > 0);
    return () => {
      document.body.classList.remove("modal-package-open");
    };
  }, [stack.length]);

  const value = useMemo(
    () => ({
      host,
      stack,
      register,
      unregister,
    }),
    [host, stack, register, unregister],
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
      {host ? createPortal(null, host) : null}
    </ModalStackContext.Provider>
  );
}
