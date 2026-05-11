# Contributing to Teamsly

Thanks for considering a contribution. Bug reports, fixes, features, and docs
are all welcome.

## Contributor License Agreement (CLA)

Before any code contribution can be merged, the contributor must sign a
Contributor License Agreement.

The CLA grants the project a license to use your contribution, including the
right to relicense it. This is what keeps it possible for the project to be
offered under both AGPL-3.0 (for open self-hosters) and a commercial license
(for organizations that cannot accept AGPL terms). Without the CLA, neither
arrangement is possible once external code is mixed in.

The CLA does **not** require you to assign copyright — you retain ownership of
your contribution. It only grants the project a broad license to use it.

When you open a pull request, you will be asked to sign the CLA via a bot
comment (cla-assistant.io). The PR cannot be merged until that is done. The
process takes about one minute and only needs to happen once per contributor.

If you do not wish to sign the CLA, you are still free to fork the project and
use, modify, and distribute your fork under AGPL-3.0 terms.

## Reporting bugs

Open an issue at <https://github.com/mayurrawte/teamsly/issues> with:

- What you expected to happen
- What actually happened
- Steps to reproduce (or a minimal repro repo)
- Your environment (OS, Node version, browser if relevant)

For security issues, please email the maintainer directly rather than opening a
public issue.

## Development setup

```bash
git clone https://github.com/mayurrawte/teamsly
cd teamsly
npm install
cp .env.example .env.local   # fill in Azure AD credentials
npm run dev
```

For UI-only work that does not require Microsoft Graph, you can develop against
`/demo`, which uses mock data and needs no auth.

## Code style

- TypeScript for everything in `src/`.
- Follow the patterns already in the codebase rather than introducing new ones.
- Run `npm run lint` and `npm run type-check` before opening a PR.
- Keep commits focused and use the existing message style: `type(scope):
  summary` in lowercase (see `git log` for examples).

## Pull request checklist

Before requesting review:

- [ ] Tests / lint / type-check pass locally
- [ ] CLA is signed (the bot will prompt on PR open)
- [ ] STATUS.md updated if you shipped a tracked feature
- [ ] No unrelated changes mixed into the same PR

## License

By contributing, you agree that your contribution will be licensed under
AGPL-3.0 (the project's license) and that the project owner may also relicense
your contribution under other terms as permitted by the CLA.
