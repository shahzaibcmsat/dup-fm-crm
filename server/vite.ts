import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// Note: We avoid importing any dev-only modules (like 'vite' or vite.config)
// at the top level. cPanel production runs without devDependencies installed,
// so only load them dynamically inside setupVite() when in development.
// This keeps production from trying to resolve 'vite' at runtime.

const isDevelopment = process.env.NODE_ENV === "development";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Debug logging - only in development
export function debug(message: string, data?: any) {
  if (isDevelopment) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

// Info logging - always visible
export function info(message: string, data?: any) {
  console.log(`[INFO] ${message}`, data || '');
}

// Error logging - always visible
export function error(message: string, data?: any) {
  console.error(`[ERROR] ${message}`, data || '');
}

export async function setupVite(app: Express, server: Server) {
  // Lazy-load Vite only in development. Avoid importing vite.config.ts to
  // prevent bundling dev-only deps (vite, @vitejs/plugin-react) into prod.
  const { createServer: createViteServer, createLogger } = await import("vite");
  const { nanoid } = await import("nanoid");
  // Load React plugin only in development
  const { default: react } = await import("@vitejs/plugin-react");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const viteLogger = createLogger();
  const vite = await createViteServer({
    // Minimal inline config for dev middleware
    configFile: false,
    root: path.resolve(import.meta.dirname, "..", "client"),
    appType: "custom",
    // Ensure JSX uses the automatic runtime so `import React` is not required
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "..", "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "..", "shared"),
        "@assets": path.resolve(import.meta.dirname, "..", "attached_assets"),
      },
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
