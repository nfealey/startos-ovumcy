# Updating the upstream version

Upstream is the prebuilt image `ghcr.io/ovumcy/ovumcy-web`. Nothing is built from source and there is no submodule — but the image this package ships is built from the root `Dockerfile`, which copies upstream's `/app/ovumcy` binary, unmodified and pinned by digest, onto an alpine base. Upstream's own image is `FROM scratch` and cannot start as a StartOS subcontainer (no `/proc` in its rootfs), which is why the copy exists; `README.md` § Image and Container Runtime has the detail.

## The pin is currently a commit, not a release

`v1.9.2` — the newest release when this package was written — cannot reset a password without a controlling terminal, and no StartOS action has one. The pin is therefore `sha-d28ddba`, a main-branch build carrying upstream's non-interactive `reset-password`; `sha-` tags name one commit each, so the pin is immutable.

**Move back to a release tag as soon as one contains that change.** The test is behavioral, not a changelog read — run it against the candidate image before repinning:

```bash
printf 'Throwaway-Pass-1!\n' | docker run --rm -i \
  -v "$PWD/probe-data:/app/data" -v "$PWD/probe-fence:/app/fence" \
  -e SECRET_KEY=probe -e DB_DRIVER=sqlite -e DB_PATH=/app/data/ovumcy.db \
  -e CALENDAR_FEED_FENCE_PATH=/app/fence/calendar-feed.fence \
  ghcr.io/ovumcy/ovumcy-web:<candidate> /app/ovumcy users create probe@example.com
```

Then start that image once (so it writes the fence), stop it, and run `reset-password probe@example.com` the same way. If it answers `secure password prompt requires an interactive terminal`, that release still predates the fix — stay on the commit pin. Throw the probe directories away afterwards.

## Determining the upstream version

The pin lives in the root `Dockerfile`, as the `FROM … AS upstream` line — a `sha-`/release tag **and** the digest it resolved to. Both move together; `startos/manifest/index.ts` just says `dockerBuild: {}`.

The latest upstream release:

```bash
gh release view -R ovumcy/ovumcy-web --json tagName -q .tagName
```

Confirm that tag actually has a published image for the architectures this package declares before pinning it — a release can exist before its image does:

```bash
docker manifest inspect ghcr.io/ovumcy/ovumcy-web:<tag> | jq -r '.manifests[].platform.architecture'
```

**Releases lag the default branch.** Upstream commits heavily between tags, so the newest release can be months behind `main`. Track tags anyway: a tag is a point upstream chose to stand behind, and its migrations and docs match. Do not pin a `sha-<commit>` tag to get ahead of a release.

## Applying the bump

1. Read upstream's `CHANGELOG.md` and the release notes between the pinned tag and the new one. Three things in particular change what this package has to do:
   - **New or changed environment variables.** Ovumcy has no config file; everything is environment. A new variable this package does not pass is silently left at the application's own default, which may not be the choice this package made. `appEnv` in `startos/utils.ts` is the list to reconcile, and the table in `README.md` § File Models and the `startos_managed_env_vars` block document it.
   - **Operator CLI changes.** `startos/actions/` drives `users create`, `users list`, `users delete`, `reset-password` and `notify`. A changed flag, prompt order or stdin convention breaks an action quietly — `users create` and `reset-password` in particular read the password as the first line of piped stdin.
   - **Migrations that refuse to run, or downgrade caveats.** Upstream documents both in `docs/self-hosted.md`.
2. Update the `FROM … AS upstream` line in the root `Dockerfile` — tag and digest together. Read the digest off the registry rather than trusting the tag:

   ```bash
   docker buildx imagetools inspect ghcr.io/ovumcy/ovumcy-web:<tag> --format '{{.Manifest.Digest}}'
   ```
3. Update `version` in `startos/versions/current.ts` to `<upstream version>:0`, and write `releaseNotes` in all five locales. A package-only change keeps the upstream version and raises the revision after the colon instead (`1.9.2:1`). While the pin is a commit build, the version's base stays at the release it descends from.
4. Add new user-facing strings to `startos/i18n/dictionaries/default.ts` and translate them in `translations.ts` for every locale — `satisfies Record<string, LangDict>` fails the build if a locale is incomplete. Note that the dictionary is keyed by index and the indices shift whenever a string is inserted, so adding one by hand means renumbering every locale below it; regenerate both files from the sources instead, carrying translations across by their English text.
5. `BUILDX_BUILDER=<an OCI-capable builder> make x86` (the default Docker driver cannot export OCI — see `AGENTS.md`), then install on a StartOS box and verify against reality rather than against `tsc`. At minimum: a real sign-in, one account created through `create-account`, and a backup/restore round-trip. The full protocol is `references/verify-on-startos.md` in the `package-service` skill of your packaging workspace.

## Architecture

This package declares `x86_64` and `aarch64`, and the `Makefile` builds both (`ARCHES := x86 arm`). Nothing extra is needed to keep that true across a bump: the upstream pin in the `Dockerfile` is a digest for an image **index**, not for one platform's manifest, so each arch builds against upstream's own binary for that arch. If you ever repin to a single-platform digest, the ARM build breaks — `docker buildx imagetools inspect <ref>` shows which kind you have.

The ARM `.s9pk` has not been run on ARM hardware. Every on-box check recorded in `AGENTS.md` was done on x86_64; verify on real ARM hardware before relying on it there.
