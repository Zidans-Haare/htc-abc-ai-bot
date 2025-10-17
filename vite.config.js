import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        bot: 'src/bot/index.html',
        login: 'src/login/login.html',
        admin: 'src/admin/index.html',
        dash: 'src/dash/index.html'
      }
    }
  },
  css: {
    postcss: './tailwind.postcss.config.main.js'
  },
   server: {
     allowedHosts: ['dev.olomek.com', 'localhost'],
     proxy: {
       '/api': 'http://localhost:3000',
       '/admin': 'http://localhost:3000',
       '/dash': 'http://localhost:3000'
     }
   }
});