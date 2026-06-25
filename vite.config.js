import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';

const hasMkcert = fs.existsSync('.ssl/cert.pem') && fs.existsSync('.ssl/key.pem');

// Leaflet map tiles are loaded from CARTO's CDN as <img> elements.
// 'unsafe-inline' on style-src is required for Leaflet's inline positioning styles.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "connect-src 'self'",
].join('; ');

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: hasMkcert ? [] : [basicSsl()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    headers: { 'Content-Security-Policy': CSP },
    ...(hasMkcert && {
      https: {
        cert: fs.readFileSync('.ssl/cert.pem'),
        key: fs.readFileSync('.ssl/key.pem'),
      },
    }),
  },
  preview: {
    headers: { 'Content-Security-Policy': CSP },
  },
});
