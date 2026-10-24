# Contributing to Print-cess

Thanks for helping. Print-cess handles other people's documents, so a few rules here are stricter
than usual. Please read them before you open a pull request.

## Ground rules

- **Use made-up data only.** Never put a real document, ID, passport, filename, QR code, transfer
  code, token or signed URL in an issue, a pull request, a test fixture, a screenshot or a log.
- **Report security problems privately.** Use **Security → Advisories → Report a vulnerability**,
  not a public issue. See [`SECURITY.md`](SECURITY.md).
- **Do not weaken a guarantee to make something easier.** The promises in the README (encrypted on
  the phone, keys out of the server, one document then deletion, no policy bypass) are the product.
  A change that bends one needs an issue and a design discussion first.
- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

For anything larger than a small fix, open an issue first so we can agree on the approach. It
saves you rewriting a pull request.

Good places to look:

- issues labelled `good first issue` or `help wanted`;
- translations in `packages/i18n` (13 languages; native-speaker review is always welcome);
- documentation that disagrees with the code.

## Setting up

You need Node.js 24.18.0 and pnpm 11.15.1 through Corepack. The Windows kiosk needs the .NET 8 SDK
on Windows.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
pnpm dev
```

The README's [Getting started](README.md#getting-started) section lists the pages to open.

## Making a change

1. Branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Add or update tests. Bugs get a test that fails before the fix.
4. Update the docs in `docs/` when behaviour changes. They are the project's design record.
5. Write commit messages as [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(scope): …`, `fix(scope): …`, `docs(scope): …`, `test(scope): …`, `chore(scope): …`.

Run the checks before you push:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

and, when you touch the flows themselves, `pnpm test:e2e`. The Windows kiosk builds and tests in
GitHub Actions; on Windows, the build and test commands are in
[`docs/WINDOWS_KIOSK_DEPLOYMENT.md`](docs/WINDOWS_KIOSK_DEPLOYMENT.md).

## Pull requests

- Fill in the pull request template. Say what you could not test, for example a real printer.
- CI must pass: `Web`, `Windows kiosk`, `Dependency audit` and `Secret scan helper`.
- Changes to the protocol, cryptography, API routes, kiosk infrastructure, workflows or security
  documents need a maintainer's review (see `.github/CODEOWNERS`).
- Pull requests are squash-merged.

## Licence

By contributing, you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE), the same as the rest of the project.
