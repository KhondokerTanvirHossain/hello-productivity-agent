import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plugin to remove crossorigin attributes that break file:// protocol in Electron
function removeCrossOrigin() {
  return {
    name: "remove-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), removeCrossOrigin()],
  base: "./", // Relative paths for Electron file:// loading
  server: {
    port: 5173,
  },
});
