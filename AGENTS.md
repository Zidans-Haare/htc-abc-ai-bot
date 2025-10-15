# Opencode Rules

- Follow all instructions carefully.
- Do not generate malicious code.
- Use tools appropriately.
- Maintain security best practices.
- Do not use sudo without asking the user first.
- Always update project-specific information inside this file (AGENTS.md) to document quirks, configurations, and details of this project for future reference.

# Project Information

- The project is hosted at dev.olomek.com.
- Use curl for troubleshooting network issues or API calls.
- Vector DB supports incremental sync: removes old/invalid data, adds new/updated for headlines, PDFs. Init forces full sync; tracks with .vectordb_last_sync file.
- Embedding uses free Xenova models; tests added for vector store functionality.
- Context7 MCP tool is available; it exposes local context7 knowledge services and should be used whenever tasks can benefit from that capability.
- Investigated 'serialize' npm modules: serialize-error and dom-serializer were unused dependencies, removed from package.json. No serialization logic needed porting to Prisma.
- Tailwind CSS is built using @tailwindcss/cli v4. Modify src/main.css or src/backend.css for @source directives to specify content paths, then run npm run build:main-css or npm run build:backend-css. The server auto-rebuilds main CSS on start if sources changed.
