import React, { createContext, useContext } from "react";

const ContentRendererContext = createContext(null);

export function ContentProvider({ children, value }) {
  return (
    <ContentRendererContext.Provider value={value}>
      {children}
    </ContentRendererContext.Provider>
  );
}

export function useContentRendererContext() {
  const context = useContext(ContentRendererContext);
  if (!context) {
    throw new Error(
      "useContentRendererContext must be used within ContentProvider",
    );
  }
  return context;
}
