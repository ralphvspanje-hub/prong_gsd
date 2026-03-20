import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill Promise.withResolvers for older browsers (needed by pdfjs-dist v4)
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function () {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

createRoot(document.getElementById("root")!).render(<App />);
