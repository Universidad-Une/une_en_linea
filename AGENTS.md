# AGENTS.md

## 1. Agent Behavior

- Inspect relevant files, dependencies, and existing patterns before making changes.
- Prefer extending existing implementations over rewriting working functionality.
- Make the smallest complete change that satisfies the request.
- Do not modify unrelated code, files, configuration, or dependencies.
- Preserve existing behavior, architecture, and visual design unless explicitly instructed otherwise.
- Prefer simple, maintainable solutions over unnecessary abstractions or dependencies.
- Resolve minor ambiguities using established project conventions. Request clarification when a decision materially affects business logic, data, or integrations.
- For complex tasks, establish a concise plan before implementation. Avoid unnecessary planning for trivial changes.
- Do not introduce speculative features or unsolicited improvements.

## 2. Development

### Technology and Styling

- Respect the project's existing framework versions, package manager, dependencies, and conventions.
- Prefer built-in framework functionality before installing third-party packages.
- Use Tailwind utilities for layouts, typography, spacing, colors, responsiveness, and interaction states.
- Use native CSS only when Tailwind cannot clearly express the required behavior or when a small fallback is justified.
- Reuse existing styles, design tokens, and components. Avoid duplicated styling and unnecessary arbitrary values.
- Use TypeScript where applicable; prefer explicit types and avoid `any` or `@ts-ignore` without justification.
- Write focused functions, descriptive identifiers, and reusable logic without overengineering.
- Remove unused imports, debugging statements, and dead code introduced by the task.

### Naming and Structure

Keep standard project directories in English:

`src/components`, `src/pages`, `src/layouts`, `src/styles`, `src/assets`, `src/lib`, `src/hooks`, `src/utils`, `src/types`, `src/content`.

For custom project files, components, folders, and routes:

- Use descriptive Spanish names and `snake_case`, e.g., `landing_principal.astro`, `formulario_informacion.astro`.
- Use `PascalCase` for component identifiers and TypeScript types; use `camelCase` for variables and functions.
- Preserve framework-required filenames, routing conventions, generated files, and third-party component names.
- Do not rename existing files or directories unless explicitly requested or necessary for the task.

## 3. Architecture

- Separate UI, business logic, validation, data access, configuration, and shared utilities.
- Keep components cohesive, reusable when appropriate, and focused on a clear responsibility.
- Reuse existing components before introducing new ones; avoid excessive component fragmentation.
- Do not modify shared components without checking their existing consumers.
- Prefer Astro components for static or server-rendered UI.
- Introduce client-side JavaScript or framework hydration only when the required interaction justifies it.
- Keep server-only logic and secrets outside client bundles.
- Maintain clear sources of truth; distinguish persistent data, temporary UI state, and derived values.
- Preserve existing API contracts, routing behavior, and integration boundaries unless changes are required.

## 4. UI/UX

- Respect the existing visual identity, typography, colors, spacing, and component patterns.
- Implement responsive layouts using a mobile-first approach where appropriate.
- Avoid horizontal overflow, inaccessible controls, and fixed dimensions that break smaller viewports.
- Use semantic HTML, accessible labels, visible focus indicators, adequate contrast, and meaningful image alternatives.
- Ensure keyboard accessibility and respect `prefers-reduced-motion`.
- Prefer subtle, purposeful animations; avoid unnecessary animation libraries.
- Provide clear loading, success, validation, and error feedback.
- Prevent accidental duplicate submissions and confirm destructive actions when appropriate.
- Do not redesign unrelated UI or introduce new visual styles without authorization.

## 5. Forms, APIs, and Data

- Validate external input server-side; client-side validation is supplementary.
- Enforce reasonable payload limits and use context-appropriate sanitization or escaping.
- Preserve user-entered information when recoverable form errors occur.
- Handle network failures, timeouts, unsuccessful responses, and unexpected external data.
- Keep external integrations isolated and configurable through environment variables.
- Use appropriate HTTP methods and response status codes.
- Do not fabricate production data or hardcode values that require authoritative sources.
- Preserve data integrity and compatibility with existing interfaces.
- Use appropriate numerical precision and rounding for monetary calculations.

## 6. Security

- Never hardcode or expose secrets, credentials, private tokens, or server environment variables.
- Do not commit sensitive `.env` files; document required variables in `.env.example`.
- Treat external input as untrusted and enforce authorization on the server.
- Avoid unsafe HTML rendering, injection vulnerabilities, and unnecessary exposure of personal data.
- Do not weaken security controls to simplify development.
- Never perform destructive database operations, force pushes, irreversible migrations, or production configuration changes without explicit authorization.
- Prefer reversible changes and preserve existing user data.

## 7. Development Server

- Identify the installed Astro version and project scripts before starting a server.
- Check for existing processes and avoid duplicate development servers.
- For Astro 7+, prefer background mode:

```bash
astro dev --background
```

- Manage it using `astro dev status`, `astro dev logs`, and `astro dev stop`.
- For Astro 6 or earlier, use the existing development script or an appropriate process manager.
- Invoke the project's locally installed Astro CLI through its package manager when necessary.
- Never terminate unrelated processes, alter ports unnecessarily, or expose development services publicly without authorization.

## 8. Testing and Validation

- Run relevant available type checks, linting, tests, and builds after modifications.
- For Astro, use configured scripts or equivalent commands such as `npx astro check` and `npm run build`.
- Verify affected routes, imports, interactions, form behavior, and error scenarios.
- Check relevant responsive layouts and ensure shared components have not regressed.
- Add or update focused automated tests when existing testing infrastructure and task complexity justify them.
- Do not introduce testing frameworks without justification.
- Never disable tests to conceal failures or claim verification that was not performed.
- Clearly report validation failures or environmental limitations.

## 9. Git and Change Management

- Inspect repository status before broad modifications and preserve uncommitted user changes.
- Do not revert unrelated work, overwrite user modifications, or modify lockfiles without justification.
- Keep changes focused; avoid mixing feature implementation with unrelated refactoring.
- Refactor only when requested or necessary to implement the task correctly.
- Review final diffs for accidental changes.
- Do not commit, push, force-push, or modify remote branches without authorization.
- Do not commit generated build artifacts unless required by the repository.

## 10. Documentation

Official Astro documentation: https://docs.astro.build

Consult the relevant official guides when working with:

- [Routing](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling and Tailwind](https://docs.astro.build/en/guides/styling/)
- [Internationalization](https://docs.astro.build/en/guides/internationalization/)
- [CLI reference](https://docs.astro.build/en/reference/cli-reference/)

- Prefer documentation matching the installed framework version.
- Update the README or relevant documentation when setup, configuration, public interfaces, or architecture change.
- Document new environment variables without exposing their values.
- Use comments to explain non-obvious decisions, assumptions, or constraints rather than repeating the code.
- Do not create unnecessary documentation files.

## 11. Agent Workflow

Follow this workflow for development tasks:

1. **Inspect:** Review instructions, relevant files, architecture, and dependencies.
2. **Plan:** Determine the smallest correct implementation and identify compatibility risks.
3. **Implement:** Follow established conventions without unrelated modifications.
4. **Validate:** Run applicable checks, inspect the diff, and verify affected behavior.
5. **Report:** Summarize changes, affected files, validation results, and remaining limitations.

Never report a task as fully completed if essential requirements remain unfinished or verification has not been performed.

## 12. Core Principle

**Understand the existing system, implement the smallest complete and maintainable solution, preserve unrelated functionality, validate the result, and report accurately.**

## 13. Language and Communication

- Use Spanish (Mexico) for agent responses, implementation plans, progress reports, and explanations.
- Write project documentation, README content, and custom code comments in Spanish.
- Keep programming language syntax, framework APIs, commands, dependencies, and technical terminology in their original language.
- Preserve standard English directory names and framework-required filenames.
- Follow the project's naming conventions: Spanish `snake_case` for custom files, folders, and routes; `camelCase` for variables and functions; `PascalCase` for types and component identifiers.
- Preserve existing identifiers, API contracts, database schemas, and external integration field names regardless of language.
- Do not translate third-party code, error messages, configuration keys, or established technical terms unnecessarily.
- Use English when an external integration, specification, or explicitly requested deliverable requires it.
- Maintain consistent terminology across code, documentation, and agent reports.
