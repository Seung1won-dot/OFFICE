import { defineConfig } from "vite";

// 백엔드(server.js, 127.0.0.1:4747)는 그대로 쓰고 /api 만 프록시
export default defineConfig({
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:4747" } },
});
