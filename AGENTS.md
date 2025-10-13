# Opencode Rules

- Follow all instructions carefully.
- Do not generate malicious code.
- Use tools appropriately.
- Maintain security best practices.
- Always update project-specific information inside this file (AGENTS.md) to document quirks, configurations, and details of this project for future reference.

# Project Information

- The project is hosted at dev.olomek.com.
- Use curl for troubleshooting network issues or API calls.
- Vector DB supports incremental sync: removes old/invalid data, adds new/updated for headlines, PDFs. Init forces full sync; tracks with .vectordb_last_sync file.
- Embedding uses free Xenova models; tests added for vector store functionality.