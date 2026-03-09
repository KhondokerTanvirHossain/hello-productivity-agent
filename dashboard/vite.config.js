import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/blocks": "http://localhost:9147",
      "/summary": "http://localhost:9147",
    },
  },
});
