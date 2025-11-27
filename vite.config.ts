import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
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
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    // Minification settings (esbuild is faster than terser)
    minify: 'esbuild',
    // Asset handling
    assetsInlineLimit: 4096, // Inline assets < 4KB as base64
    // Source maps for production debugging (disable for faster builds)
    sourcemap: false,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Module preload polyfill
    modulePreload: {
      polyfill: true,
    },
    // Target modern browsers for smaller bundle size
    target: 'es2020',
    // Report compressed size
    reportCompressedSize: false, // Faster builds
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      '@supabase/supabase-js',
      'wouter',
      'lucide-react',
      'zod',
      'react-hook-form',
      'date-fns',
    ],
    // Exclude large dependencies that don't need pre-bundling
    exclude: ['ag-grid-community', 'ag-grid-react'],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
  },
};
});
