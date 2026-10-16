# Security and secrets

Never commit .env.local or other local environment files, raw datasets, database exports, user information, private keys or session cookies. Only .env.example is an allowed environment template. No server secret belongs in NEXT_PUBLIC_ variables. Use separate local credentials and random AUTH_SECRET; do not share credentials through chat or PRs. Rotate credentials disclosed in chat before any public deployment.

pnpm check:secrets compares source/config/docs with configured local secret values and checks selected token/private-key/credential-URI patterns without printing values. It is a conservative hygiene check, not an exhaustive vulnerability scan or proof that no secrets exist. Review the staged diff before publication; GitHub secret scanning is recommended where available.

Private writes require authenticated sessions. No shared guest identity is used. Bookmarks only match existing movies; they do not create ghost movies. Registration normalizes email, validates input and hashes passwords. Setup constraints enforce unique IDs/emails. Use HTTPS in production. Public deployment still needs a security review, sign-up/login abuse controls and TMDB attribution/terms review. V1 readiness is for reviewed university development, not a claim of production hardening.

Report vulnerabilities privately to the technical lead rather than posting credentials or exploit data publicly.

## Known dependency limitations

The last complete dependency audit found three Tailwind 3 transitive build-tool advisories: braces (high, GHSA-vfj7-8cjw-p6xm; no published fix reported), and postcss-selector-parser (low GHSA-w9m9-85wc-3x92; moderate GHSA-rj75-hqrm-r3gf). Review untrusted CSS/glob input exposure and test a tooling upgrade before public deployment. Build-only packages are development dependencies. Run pnpm audit for current results.
