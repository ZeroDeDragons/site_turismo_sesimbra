import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/\.netlify\/functions/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        paginaAdmin: resolve(__dirname, 'paginaAdmin.html'),
        login: resolve(__dirname, 'login.html'),
        registo: resolve(__dirname, 'registo.html'),
        header: resolve(__dirname, 'componentes/menu/header.js'),
        cartao: resolve(__dirname, 'componentes/cartao/cartao.js'),
        mapa: resolve(__dirname, 'componentes/mapa/mapa.js')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './components')
    }
  }
<<<<<<< HEAD
});
=======
});
>>>>>>> ab6c34930675a2be95c5cba4fbea6f5316e191bf
