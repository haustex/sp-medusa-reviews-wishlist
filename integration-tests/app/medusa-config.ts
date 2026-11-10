import path from "node:path"
import { defineConfig } from "@medusajs/framework/utils"

// Test app for the E2E suite. Only started through scripts/guard.mjs, which on
// the Haus Kayu host allows nothing but the rw-spike-* containers and ports 9700+.
const pluginDir = process.env.RW_PLUGIN_DIR || path.resolve(__dirname, "../..")
const uploads = process.env.RW_UPLOAD_DIR || path.join(__dirname, "static")

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    workerMode: "shared",
    http: {
      storeCors: "*",
      adminCors: "*",
      authCors: "*",
      jwtSecret: "rw-e2e-jwt",
      cookieSecret: "rw-e2e-cookie",
    },
  },
  admin: { disable: process.env.RW_ADMIN !== "1", backendUrl: "/" },
  plugins: [
    {
      resolve: pluginDir,
      options: {
        auto_approve: process.env.RW_AUTO_APPROVE === "1",
        reviews: { min_body_length: 5, max_photos: 2, max_photo_bytes: 200 * 1024 },
        review_requests: {
          trigger: (process.env.RW_TRIGGER as "delivered" | "shipped" | "completed") || "shipped",
          delay_days: 0,
          rules: [{ sales_channel_id: "sc_never", trigger: "completed", delay_days: 99 }],
          link_url: "https://storefront.e2e.test/review/{token}",
          backend_url: "http://127.0.0.1:9700",
          token_ttl_days: 1,
        },
        rate_limit: { window_seconds: 60, max: Number(process.env.RW_RATE_MAX || 1000) },
        wishlist: { counts: true },
        showCredit: true,
      },
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/file",
      options: { providers: [{ resolve: "@medusajs/medusa/file-local", id: "local", options: { upload_dir: uploads, backend_url: "http://127.0.0.1:9700/static" } }] },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          { resolve: "./src/modules/e2e-notification", id: "e2e", options: { channels: ["email"] } },
          { resolve: "@medusajs/medusa/notification-local", id: "local", options: { channels: ["feed"] } },
        ],
      },
    },
  ],
})
