import { useContext } from "react";
import { ModalStackContext } from "../components/ModalProvider/ModalContext";

export function useModalHost() {
  const context = useContext(ModalStackContext);
  if (!context) {
    throw new Error("Modal components must be used within ModalProvider.");
  }
  return context;
}
