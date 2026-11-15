# ORVA Development Workflow

## Local setup

Requirements: Node.js 22 and pnpm 10.8.

```bash
pnpm install
pnpm dev
```

The web application runs from the `apps/web` workspace.

## Quality gates

Run these commands before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

GitHub Actions runs the same checks on pushes to `main` and pull requests.

## Preview and screenshots

A GitHub push does not itself create a browser screenshot. Configure a Vercel project with repository `fbrhrdynt/orva_project` and Root Directory `apps/web`. Enable deployment on pushes to `main`.

After a successful deployment, use the deployment's public Preview/Production URL to capture desktop and mobile screenshots. Do not represent a design mockup as a screenshot of the running application.
