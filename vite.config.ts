import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    // Gzip compression for faster downloads
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files > 10KB
      deleteOriginFile: false,
    }),
    // Brotli compression (better than gzip, if server supports it)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'react-vendor': ['react', 'react-dom', 'react-hook-form'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover',
            '@radix-ui/react-alert-dialog',
          ],
          'charts-vendor': ['recharts', 'date-fns'],
          'forms-vendor': ['@hookform/resolvers', 'zod'],
          'supabase': ['@supabase/supabase-js'],
          'ag-grid': ['ag-grid-react', 'ag-grid-community'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Minification settings (esbuild is faster than terser)
    minify: 'esbuild',
    // Asset handling
    assetsInlineLimit: 4096, // Inline assets < 4KB as base64
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@supabase/supabase-js',
    ],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
