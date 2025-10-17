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
- Server Testing: Use `timeout 10s node server.cjs` instead of `node server.cjs` for testing to prevent hanging and allow prompt return.
- Vite Dev: Use `timeout 10s npm run dev` for testing to prevent blocking; otherwise runs indefinitely. If port 5173 in use, uses next available (e.g., 5174).
- Admin Interface: Mobile-optimized with toggleable list/detail views for conversations, articles, and feedback. Uses hidden class for switching. Requires /js/purify.min.js, /js/marked.min.js, /js/markup.js in admin/index.html for message rendering. ToastUI editor height dynamically calculated to fill available space, with minimum 300px.

