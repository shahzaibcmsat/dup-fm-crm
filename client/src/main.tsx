import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Enable React 18 concurrent features for better performance
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
