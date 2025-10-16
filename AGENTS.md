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
- Vector DB supports incremental sync: removes old/invalid data, adds new/updated for headlines, PDFs. Init forces full sync; tracks with .vectordb_last_sync file.
- Embedding uses free Xenova models; tests added for vector store functionality.
- Context7 MCP tool is available; it exposes local context7 knowledge services and should be used whenever tasks can benefit from that capability.
- Investigated 'serialize' npm modules: serialize-error and dom-serializer were unused dependencies, removed from package.json. No serialization logic needed porting to Prisma.
- Tailwind CSS is built using PostCSS with @tailwindcss/postcss v4. Content paths specified via @source directives in src/main.css and src/backend.css with source(none) for separate purging. Configs: tailwind.postcss.config.main.js and tailwind.postcss.config.backend.js. Run npm run build:main-css or npm run build:backend-css. The server auto-rebuilds CSS on start if sources changed.



- Tailwind CSS builds: If purging fails (identical bloated CSS), ensure @source paths are relative to src/ and use source(none) for separate scans. Check tailwind.postcss.config.*.js.


- General: Check AGENTS.md for project quirks; run npm run build:* to verify.

