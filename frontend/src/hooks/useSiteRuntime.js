import { useContext } from "react";
import { SiteRuntimeContext } from "../contexts/SiteRuntimeContext";

export default function useSiteRuntime() {
  const value = useContext(SiteRuntimeContext);
  if (!value)
    throw new Error("useSiteRuntime must be used within a SiteRuntimeProvider");
  return value;
}
