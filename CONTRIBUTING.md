# Contributing to Dotstell

Thank you for your interest in contributing. Dotstell is built in the open and all kinds of contributions are welcome.

## Ways to contribute

- **Bug reports** — open an issue with steps to reproduce, expected vs actual behaviour
- **Feature requests** — open an issue describing the use case and why it matters
- **Code** — bug fixes, new features, performance improvements
- **Documentation** — improve the README, add inline comments, write guides
- **Design** — UI improvements, accessibility fixes, icon suggestions

## Before opening a large PR

Please open an issue first for any significant change so we can discuss approach, scope and fit before you invest time writing code. Small fixes (typos, obvious bugs) can go straight to a PR.

## Development setup

See the [Getting Started](README.md#getting-started) section in the README. The short version:

```bash
git clone https://github.com/dotstell/dotstell.git
cd dotstell
pnpm install
cp .env.local.example .env.local   # fill in your Supabase credentials
pnpm dev
```

## Branch workflow

| Branch | Purpose |
|---|---|
| `main` | Stable — reflects the latest release |
| `develop` | Active development — open PRs against this branch |

Always branch off `develop` and open your PR back into `develop`.

```bash
git checkout develop
git checkout -b feat/your-feature-name
# make changes
git push origin feat/your-feature-name
# open PR → develop
```

## Database changes

Schema lives in two places, on purpose:

- `supabase/migrations/` — what an **existing** database applies, in order.
- `supabase/schema.sql` — what a **fresh** install runs (see the README setup steps).

**A schema change needs to land in both.** Add the migration, then fold the same objects
into `schema.sql` so a new install ends up with the database production actually has.

Skipping the second half is not cosmetic. `schema.sql` had drifted by 19 objects, including
`notes.deleted_at` (which nearly every query filters on), `bookmarks.reading_time` and
`hostname` (which the save route writes), and the three `match_*` functions behind AI
search — so a fresh self-hosted install was broken on basic use, with nothing in the setup
steps to explain why.

`node scripts/check-schema-sync.mjs` compares the two and lists anything missing. CI runs
it on any PR touching `supabase/`.

## Commit messages

Use conventional commit prefixes:

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change with no behaviour change |
| `style:` | Formatting, whitespace |
| `test:` | Adding or updating tests |
| `chore:` | Build config, dependencies |

Example: `feat: add wikilink autocomplete dropdown`

## Code style

- TypeScript — no `any` unless genuinely unavoidable
- Tailwind CSS v4 for styling — avoid inline styles in new components where possible
- No commented-out code in PRs
- Keep components small and focused

## License

By contributing you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
