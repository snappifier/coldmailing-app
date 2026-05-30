<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Use current versions and best practices

Every time you use a technology (library, framework, runtime, API), verify against its official documentation that you are using the current recommended version and idioms. Do not rely on patterns from training data — they may be stale or deprecated.

- Before writing code with a library, check its installed version and the latest stable release, read the relevant official docs / changelog / migration guide, and heed deprecation notices.
- Prefer the modern, non-deprecated API even when the old one still works. Example: Zod 4 uses top-level `z.email()` / `z.url()` / `z.uuid()`, not the deprecated `z.string().email()` etc.
- When unsure whether an API or version is current, look it up rather than guessing, and state in your response what you verified.
