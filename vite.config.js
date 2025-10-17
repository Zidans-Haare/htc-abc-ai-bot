import { defineConfig } from 'vite';
import { resolve } from 'path';
import postcss from 'postcss'; // Not needed as plugin, but ensure postcss.config.js is in root

export default defineConfig({
  plugins: [
    // Remove Vue—add back if using .vue files
    // vue(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), // Keep for easy imports
    },
  },
  css: {
    postcss: './postcss.config.js', // Enables your Tailwind/PostCSS setup
  },
  build: {
    rollupOptions: {
      input: {
        // Maps your subfolder HTMLs to output paths (e.g., dist/bot/index.html served at /bot/)
        bot: resolve(__dirname, 'src/bot/index.html'),    // Will be root (/) with server tweak below
        admin: resolve(__dirname, 'src/admin/index.html'), // Served at /admin/
        dash: resolve(__dirname, 'src/dash/index.html'),   // Served at /dash/
        login: resolve(__dirname, 'src/login/login.html'), // Served at /login.html (rename to index.html for /login/ folder)
      },
      output: {
        // Optional: Nest outputs to match input folders for easier Express serving
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
  server: {
    // Dev server rewrites: Make / load bot, /admin load admin.html, etc.
    // This simulates prod routing without a full proxy
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') {
          req.url = '/bot/index.html'; // Redirect root to bot
        } else if (req.url.startsWith('/admin')) {
          req.url = req.url.replace('/admin', '/admin/index.html');
        } else if (req.url.startsWith('/dash')) {
          req.url = req.url.replace('/dash', '/dash/index.html');
        } else if (req.url === '/login') {
          req.url = '/login/login.html';
        }
        next();
      });
    },
  },
});
