import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./packages/content-renderer/react/theme/variables.css";
import "./packages/context-actions/react/theme/variables.css";
import "./packages/card/react/theme/variables.css";
import "./packages/modal/react/theme/variables.css";
import "./packages/tooltip/react/theme/variables.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
