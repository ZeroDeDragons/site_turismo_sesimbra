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
        perfil: resolve(__dirname, 'perfil.html'),
        paginaadmin: resolve(__dirname, 'paginaadmin.html'),
        login: resolve(__dirname, 'login.html'),
        // FORÇANDO O VITE A ENCONTRAR E COMPILAR OS SEUS COMPONENTES:
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
});
