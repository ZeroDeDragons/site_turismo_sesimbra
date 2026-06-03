import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        registo: resolve(__dirname, 'registo.html'),
        admin: reolver(__dirname,'paginaAdmin.html')
      },
    },
  },
});
