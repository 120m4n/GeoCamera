import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';

const hasMkcert = fs.existsSync('.ssl/cert.pem') && fs.existsSync('.ssl/key.pem');

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
    ...(hasMkcert && {
      https: {
        cert: fs.readFileSync('.ssl/cert.pem'),
        key: fs.readFileSync('.ssl/key.pem'),
      },
    }),
  },
});
