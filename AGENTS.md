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
- Database Changes: Use `prisma migrate deploy` for applying schema changes via migrations. Migrations are used for DB management. Views removed from migrations and schema; complex queries now use raw SQL. Removed unused tables: `auth_sessions`, `question_cache`, `sessions`. When schema changes, create new migrations with `prisma migrate dev`. On new DB creation, `prisma db push` is run to apply schema directly. Migration SQL for current version embedded in migration files. Use Context7 for up-to-date Prisma docs on multi-DB support.

# Project Information

- The project is hosted at dev.olomek.com.
- Use curl for troubleshooting network issues or API calls.
- Vector DB supports incremental sync: removes old/invalid data, adds new/updated for headlines, PDFs, images, and documents (DOCX, MD, ODT/ODS/ODP, XLSX). Init forces full sync; tracks with .vectordb_last_sync file. Documents are stored in public/documents/ and linked via documents table.
- Embedding uses free Xenova models; tests added for vector store functionality.
- Context7 MCP tool is available; it exposes local context7 knowledge services and should be used whenever tasks can benefit from that capability.
- Investigated 'serialize' npm modules: serialize-error and dom-serializer were unused dependencies, removed from package.json. No serialization logic needed porting to Prisma.
- Path Migration: Image paths updated to absolute /assets/images/ for correct loading from public/assets/images/. Other assets use relative paths.
- ES Modules Adoption: diff_match_patch.js converted to ES module with exports. articles.js updated to use dynamic import for diff_match_patch instead of loadScript.
- Font Modernization: Self-hosted fonts (Roboto, Inter, Font Awesome) replaced with npm packages (@fontsource/roboto, @fontsource/inter, @fortawesome/fontawesome-free) for better bundling and maintenance. Font files removed from public/assets/fonts/.
- Tailwind CSS is integrated with Vite using PostCSS v4. Content paths specified via @source directives in src/styles/tailwind-main.css and src/styles/tailwind-backend.css for separate purging. Configs: tailwind.postcss.config.main.js and tailwind.postcss.config.backend.js. Vite handles building, bundling, and hot-reload automatically.

- Tailwind purging: Ensure @source paths are relative to src/styles/ and use source(none) for separate scans. Check tailwind.postcss.config.*.js.

- General: Check AGENTS.md for project quirks; run npm run build to verify.

- Troubleshooting dev routes served through Vite/Nginx/Express should leverage the `curl` MCP tool for HTTP checks and Context7 for planning or research when blockers appear (domain: dev.olomek.com).
- Server Testing: Use `timeout 10s node server.cjs` instead of `node server.cjs` for testing to prevent hanging and allow prompt return.
- Vite Dev: Use `timeout 10s npm run dev` for testing to prevent blocking; otherwise runs indefinitely. If port 5173 in use, uses next available (e.g., 5174).
- Vite MPA dev rewrites: When mapping routes like `/`, `/admin/`, `/login/` during dev, make sure requests resolve to the real files under `/src/...` (e.g. `/src/bot/index.html`). Rewrites without `/src` 404 in dev while build output lives at `dist/src/...`.
- Vite dev server must bind to IPv4 (`server.host = '127.0.0.1'`) so Nginx proxying `localhost:5173` works; otherwise Vite may listen on IPv6 `::1` only and nginx returns 502/404.
- Vite dev rewrites strip query params before matching (see `vite.config.js`) so `/login?redirect=...` resolves correctly to `/src/login/index.html`.
- Admin Interface: Mobile-optimized with toggleable list/detail views for conversations, articles, and feedback. Uses hidden class for switching. Requires ../components/purify.min.js, ../components/marked.min.js, ../components/markup.js in admin/index.html for message rendering. ToastUI editor height dynamically calculated to fill available space, with minimum 300px.
- Vite MPA rewrites: handled by the `mpa-rewrites` plugin in `vite.config.js` which remaps `/`, `/admin/`, `/dash/`, `/login/` to the corresponding `/src/.../index.html` files so dev requests do not 404. Static asset rewrites (/css/, /js/, /image/) removed as paths migrated to relative.
- Vite rewrite middleware explicitly skips Vite internal endpoints (e.g. `/@vite/client`, `/@id/`, `/__vite_`) to keep HMR working after custom route rewrites.
- Dev proxy behavior: current Nginx routes `/admin`, `/dash`, and `/api` to the Express app on port 3000, so those paths bypass Vite dev HMR. Expect to hit the built assets from `dist` unless the proxy is adjusted for dev.
- Assets are served directly from src/assets/; relative paths used in HTML for portability.
- Express static middleware sets `Cache-Control` for `dist` assets: HTML gets `no-cache, must-revalidate`, fingerprinted assets get `public, max-age=1209600, immutable`. Fonts are covered by the immutable rule; uploads remain unaffected.
- Vite HMR path: Default `/vite/client` is blocked by Cloudflare due to `@` symbol. Use custom path like `/vite-hmr` in `vite.config.js` server.hmr.path to avoid issues with JS loading in dev.
- When working locally, keep Vite’s dev server and the Express API on separate ports (e.g. `5173` and `3000`). Configure `server.proxy` in `vite.config.js` so `/api` requests from the Vite dev origin hit `http://127.0.0.1:3000`. This avoids missing static/JS assets on `3000` while keeping HMR available on `5173`; alternatively run `vite build --watch` and a `nodemon` boot of Express to continuously serve the production bundle. Script `npm run dev:watch` launches that watcher combo.
- Startup defaults: run `npm run dev:watch` for local/staging work (Vite rebuilds `dist`, nodemon restarts Express on changes, served from port 3000). HMR is not required for this app—watcher builds are sufficient. For production/stable environments run `npm run build` and start the server with `npm start` (optionally via a process manager).
- Vite font warnings: `vite build --watch` logs unresolved `.woff/.woff2` references via `logger.warnOnce`. Overriding `logger.warn` or `logLevel` alone will not suppress them—also stub `logger.warnOnce` (and any other desired methods) before passing the custom logger to `defineConfig`.
- Nginx Configuration: For production, Nginx proxies to Express on port 3000. Example config for dev.olomek.com in /etc/nginx/sites-available/dev redirects HTTP to HTTPS and proxies all requests to http://127.0.0.1:3000. Includes SSL certs and headers for real IP forwarding.
- Optional Dependencies: Packages like @google/generative-ai, @anthropic-ai/sdk, @huggingface/transformers, chromadb, mysql2, pg, weaviate-client are installed only if their features are enabled via env vars (e.g., AI_PROVIDER=google for Google Gemini, EMBEDDING_LIBRARY=huggingface for Hugging Face, VECTOR_DB_TYPE=chroma for ChromaDB, etc.).
- Test Suite: Comprehensive tests added for security, setup, features, and utils. Run `npm test` (interactive chooser) or `npm run test:direct` (direct with .env.test). Use `npm test -- --env .env` to skip prompt and use .env. DB tests require DATABASE_URL=file:test-temp.db in .env.test; tables include users, hochschul_abc, conversations, feedback. Rate limit test skipped in direct runs; auth mocks use dynamic user storage for create/verify consistency. Security tests include SQL injection prevention, XSS in body/head, and CSP for same-domain files.
- Database Views: Removed `top_questions_view` and `unanswered_questions_view` to eliminate DB views. Queries now use raw SQL via `prisma.$queryRaw` in dashboard endpoints for better control and no view maintenance.
- AI Providers: Support for multiple providers (chatAi university, openai official, Google Gemini, Anthropic Claude, XAI) via AI_PROVIDER env var. Providers are lazy-loaded on first use. No fallbacks to old vars; code breaks if AI_API_KEY not set. Streaming integrated; Gemini uses contents array, Claude uses messages array, others use OpenAI format.
- Backup System: Fine-grained backup for users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard (analytics including daily_question_stats, daily_unanswered_stats, question_analysis_cache, article_views, page_views, token_usage, user_sessions). Uses ZIP files stored in BACKUP_PATH (default 'backups/'). Includes schema hash and full schema.prisma for version compatibility. Admin-only access via /backup route. Import modes: replace, append-override, append-keep. UI in admin panel under "Backup" button. Automatically uses temp DB and `prisma migrate diff` for safe import on schema mismatches, generating upgrade SQL to migrate data to current schema.
- Upload serving: `server/controllers/imageController.cjs` resolves original assets from `uploads/images` (project root) and caches resized variants in `cache/uploads`. Keep these paths aligned with Express static middleware so `/uploads/**` stays reachable (e.g., dev.olomek.com/uploads/...). Admin gallery thumbnails request `_600px` variants to use the cached resize route.
- Document uploads: Express/Multer allow up to `UPLOAD_LIMIT_MB` (default 10 MB, production `.env` currently sets 50 MB), but Nginx keeps the default 1 MB `client_max_body_size`. Increase that directive (e.g., `client_max_body_size 50m;`) in the server block so larger PDF uploads from `/admin/documente` succeed instead of returning 413.
- PM2 Configuration: Server managed with PM2 using `ecosystem.config.js` (renamed from `start-bot-with-pm2.conf.js` to avoid PM2 treating it as a script). Watches `.env` for changes with 2000ms delay, auto-restarts on modifications. Start with `pm2 start ecosystem.config.js`; for production, use `pm2 start ecosystem.config.js --name htw`.
- Database Maintenance Workflow: This project uses Prisma migrations for database versioning and schema management. Always create migrations for schema changes using `prisma migrate dev --name descriptive-name`. Test migrations on staging before production. Backup databases before applying migrations. Use `prisma migrate deploy` for production deployments. This is the recommended strategy and should be followed.
