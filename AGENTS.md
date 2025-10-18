# Opencode Rules

- Follow all instructions carefully.
- Do not generate malicious code.
- Use tools appropriately.
- Maintain security best practices.
- Do not use sudo without asking the user first.
- Always update project-specific information inside this file (AGENTS.md) to document quirks, configurations, and details of this project for future reference.
- Use Context7 for library docs during research, planning, troubleshooting, or library-related tasks (e.g., resolve IDs with context7_resolve_library_id, fetch docs with context7_get_library_docs).
- Library/framework problems: Use Context7 to resolve library IDs and fetch docs (e.g., for Tailwind v4 migration).
- You must not use any git actions that change the history.
- If creating commits or branches, you must ask the user first (best with a: do you want this committed as: ...).
- Do not modify Vite config's HMR path or allowedHosts unless explicitly requested by the user.

# Project Information

- The project is hosted at dev.olomek.com.
- Use curl for troubleshooting network issues or API calls.
- Vector DB supports incremental sync: removes old/invalid data, adds new/updated for headlines, PDFs, images, and documents (DOCX, MD, ODT/ODS/ODP, XLSX). Init forces full sync; tracks with .vectordb_last_sync file. Documents are stored in public/documents/ and linked via documents table.
- Embedding uses free Xenova models; tests added for vector store functionality.
- Context7 MCP tool is available; it exposes local context7 knowledge services and should be used whenever tasks can benefit from that capability.
- Investigated 'serialize' npm modules: serialize-error and dom-serializer were unused dependencies, removed from package.json. No serialization logic needed porting to Prisma.
- Tailwind CSS is integrated with Vite using PostCSS v4. Content paths specified via @source directives in src/styles/tailwind-main.css and src/styles/tailwind-backend.css for separate purging. Configs: tailwind.postcss.config.main.js and tailwind.postcss.config.backend.js. Vite handles building, bundling, and hot-reload automatically.

- Tailwind purging: Ensure @source paths are relative to src/styles/ and use source(none) for separate scans. Check tailwind.postcss.config.*.js.

- General: Check AGENTS.md for project quirks; run npm run build to verify.

- Troubleshooting dev routes served through Vite/Nginx/Express should leverage the `curl` MCP tool for HTTP checks and Context7 for planning or research when blockers appear (domain: dev.olomek.com).
- Server Testing: Use `timeout 10s node server.cjs` instead of `node server.cjs` for testing to prevent hanging and allow prompt return.
- Vite Dev: Use `timeout 10s npm run dev` for testing to prevent blocking; otherwise runs indefinitely. If port 5173 in use, uses next available (e.g., 5174).
- Vite MPA dev rewrites: When mapping routes like `/`, `/admin/`, `/login/` during dev, make sure requests resolve to the real files under `/src/...` (e.g. `/src/bot/index.html`). Rewrites without `/src` 404 in dev while build output lives at `dist/src/...`.
- Vite dev server must bind to IPv4 (`server.host = '127.0.0.1'`) so Nginx proxying `localhost:5173` works; otherwise Vite may listen on IPv6 `::1` only and nginx returns 502/404.
- Vite dev rewrites strip query params before matching (see `vite.config.js`) so `/login?redirect=...` resolves correctly to `/src/login/login.html`.
- Admin Interface: Mobile-optimized with toggleable list/detail views for conversations, articles, and feedback. Uses hidden class for switching. Requires /js/purify.min.js, /js/marked.min.js, /js/markup.js in admin/index.html for message rendering. ToastUI editor height dynamically calculated to fill available space, with minimum 300px.
- Vite MPA rewrites: handled by the `mpa-rewrites` plugin in `vite.config.js` which remaps `/`, `/admin/`, `/dash/`, `/login/` to the corresponding `/src/.../index.html` files so dev requests do not 404.
- Vite rewrite middleware explicitly skips Vite internal endpoints (e.g. `/@vite/client`, `/@id/`, `/__vite_`) to keep HMR working after custom route rewrites.
- Dev proxy behavior: current Nginx routes `/admin`, `/dash`, and `/api` to the Express app on port 3000, so those paths bypass Vite dev HMR. Expect to hit the built assets from `dist` unless the proxy is adjusted for dev.
- `mpa-rewrites` skips rewriting any request already targeting `/src/...` so fonts and images under `src/assets` are served directly; Cloudflare can cache previous 404s, so add a cache-busting query if a stale error persists during validation.
- Express static middleware sets `Cache-Control` for `dist` assets: HTML gets `no-cache, must-revalidate`, fingerprinted assets get `public, max-age=1209600, immutable`. Fonts are covered by the immutable rule; uploads remain unaffected.
- Vite HMR path: Default `/vite/client` is blocked by Cloudflare due to `@` symbol. Use custom path like `/vite-hmr` in `vite.config.js` server.hmr.path to avoid issues with JS loading in dev.
- When working locally, keep Vite’s dev server and the Express API on separate ports (e.g. `5173` and `3000`). Configure `server.proxy` in `vite.config.js` so `/api` requests from the Vite dev origin hit `http://127.0.0.1:3000`. This avoids missing static/JS assets on `3000` while keeping HMR available on `5173`; alternatively run `vite build --watch` and a `nodemon` boot of Express to continuously serve the production bundle. Script `npm run dev:watch` launches that watcher combo.
- Startup defaults: run `npm run dev:watch` for local/staging work (Vite rebuilds `dist`, nodemon restarts Express on changes, served from port 3000). HMR is not required for this app—watcher builds are sufficient. For production/stable environments run `npm run build` and start the server with `npm start` (optionally via a process manager).
