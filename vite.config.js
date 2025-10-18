import { defineConfig } from 'vite';
import { resolve, extname } from 'path';
import postcss from 'postcss'; // Not needed as plugin, but ensure postcss.config.js is in root

export default defineConfig({
  plugins: [
    {
      name: 'mpa-rewrites',
      configureServer(server) {
        const staticRoutes = [
          {
            test: (pathname) => pathname.startsWith('/css/'),
            rewrite: (pathname) => `/src/styles/${pathname.slice(5)}?direct`,
          },
          {
            test: (pathname) => pathname.startsWith('/js/'),
            rewrite: (pathname) => `/src/components/${pathname.slice(4)}`,
          },
          {
            test: (pathname) => pathname.startsWith('/image/'),
            rewrite: (pathname) => `/src/assets/images/${pathname.slice(7)}`,
          },
          {
            test: (pathname) => pathname.startsWith('/fonts/'),
            rewrite: (pathname) => `/src/assets/fonts/${pathname.slice(7)}`,
          },
        ];

        const pageBases = [
          { prefix: '/admin/', src: '/src/admin/' },
          { prefix: '/dash/', src: '/src/dash/' },
          { prefix: '/login/', src: '/src/login/' },
          { prefix: '/', src: '/src/bot/' },
        ];

        server.middlewares.use((req, _res, next) => {
          const url = new URL(req.url, 'http://localhost');
          const { pathname } = url;

          if (pathname === '/' || pathname === '/index.html') {
            req.url = '/src/bot/index.html';
            return next();
          }

          if (pathname === '/admin' || pathname === '/admin/') {
            req.url = '/src/admin/index.html';
            return next();
          }

          if (pathname === '/dash' || pathname === '/dash/') {
            req.url = '/src/dash/index.html';
            return next();
          }

          if (pathname === '/login' || pathname === '/login/') {
            req.url = '/src/login/login.html';
            return next();
          }

          for (const route of staticRoutes) {
            if (route.test(pathname)) {
              req.url = route.rewrite(pathname);
              return next();
            }
          }

          const extension = extname(pathname);
          for (const base of pageBases) {
            if (pathname.startsWith(base.prefix) && pathname !== base.prefix) {
              if (base.prefix === '/' && pathname.startsWith('/src/')) {
                break;
              }
              const relativePath = pathname.slice(base.prefix.length);
              if (relativePath.length === 0) {
                break;
              }

              const needsDirect = extension === '.css';
              const rewriteTarget = `${base.src}${relativePath}${needsDirect ? '?direct' : ''}`;
              req.url = rewriteTarget;
              return next();
            }
          }

          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // allowedHosts: ['dev.olomek.com',  'localhost', '127.0.0.1']
    allowedHosts: 'auto',
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'), // Keep for easy imports
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
        login: resolve(__dirname, 'src/login/index.html'), // Served at /login.html (rename to index.html for /login/ folder)
      },
      output: {
        // Optional: Nest outputs to match input folders for easier Express serving
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
});
