"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          console.log("Service worker registered");
        } catch (error) {
          console.error("Service worker registration failed:", error);
        }
      });
    }
  }, []);

  return null;
}
