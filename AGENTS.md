# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

## Changing this package

**The image is built here, and it cannot go back to upstream's.** `source: { dockerBuild: {} }` builds the root `Dockerfile`: upstream's binary, by digest, on alpine. Repinning `images.ovumcy.source` to `dockerTag: 'ghcr.io/ovumcy/ovumcy-web:…'` looks like a simplification — "use the published image" — and breaks every start with `Failed to start subcontainer ovumcy`. Upstream builds `FROM scratch` and its layers hold `app/`, `etc/` and `usr/` only; the SDK waits for `<rootfs>/proc/1` (`SubContainer.ts`), which a rootfs with no `/proc` never produces.

**Volumes arrive root-owned, and the app is uid 10001.** The `chown` oneshot in `startos/main.ts` and the `chown` at the top of `runCli` are both load-bearing, and both must stay: StartOS re-mounts the volumes root-owned on every start, and an action can run before the service has ever started. `idmap` is not the alternative — StartOS refuses it: `start-container bind-mount … --idmap 0:10001:1` fails with `open_tree_attr IDMAP: Operation not permitted`.

**Building needs a buildx builder that can export OCI.** Docker's default `docker` driver cannot, and `make` fails at the pack step with `OCI exporter is not supported for the docker driver`. Create one once — `docker buildx create --name startos-oci --driver docker-container` — and build with `BUILDX_BUILDER=startos-oci make`, or turn on Docker's containerd image store instead.

**`TRUST_PROXY_ENABLED=true` is what makes sign-in work, not a performance tweak.** Turning it off, or changing `TRUSTED_PROXIES` away from the OS proxy's address, makes fiber report scheme `http` against the browser's `https` Origin; its CSRF middleware then refuses every POST with `403` / `reason="invalid referer"`, which presents as "that action was refused" on a correct password. `appEnv` in `startos/utils.ts` has the full reasoning, including why trusting the header is safe on this path.

**Passwords go on stdin.** `users create` and `reset-password` read the password as the first line of piped stdin and refuse argv and the environment. That is what `asStdin` and `runCli(…, input)` exist for. Do not "simplify" it into an argument or an env var: it is an upstream invariant, and breaking it leaks credentials into process lists and logs.

**The upstream pin is a commit, deliberately, and it lives in the `Dockerfile`.** `reset-password` only accepts piped stdin in builds after v1.9.2 — the release demands a controlling terminal, which no action has. Moving the pin back to a release tag before upstream tags one containing that change silently breaks both reset paths; `UPDATING.md` has the condition to watch for. The `FROM` line carries both the `sha-` tag and the digest: bump them together, or the digest pins bytes the tag no longer names and the build fails.

**The fence volume must stay out of backups.** `startos/backups.ts` backs up `main` and `startos` and not `fence`, and the comment there explains why. Adding `fence` to `ofVolumes` looks like a fix for "a volume isn't backed up" and silently defeats calendar-feed revocation across restores.

**`store.json` is read as a projection in `main.ts`.** The mapper deliberately excludes `adminPassword`, so that setting or rotating it does not restart the daemon. If you add a key the daemon's environment depends on, add it to both `AppConfig` in `startos/fileModels/store.json.ts` and the mapper in `startos/main.ts` — the type makes the first half of that mandatory, nothing enforces the second.

**`AppConfig` is spelled out rather than derived.** `Store` comes from a `z.looseObject`, which carries an index signature, and `Omit<Store, …>` over an index signature discards every named property — leaving every environment value typed `unknown`. If you find yourself "tidying" that type into an `Omit`, `tsc` will tell you why not.

**Read before writing in action handlers.** Handlers use `.once()`; action *metadata* uses `.const(effects)`. A handler that reads with `.const` and then writes the same file hits the SDK's write-after-const guard.

**Account state is asked, not inferred.** `setAdminPassword` runs `users list` to decide between `users create` and `reset-password`, rather than branching on whether the store holds a password. The store and the database can legitimately disagree — a restored backup, an account deleted inside the app.

## Verification

What follows is what has actually been established, and how. The upstream contract this package depends on was verified directly against the pinned image, outside StartOS:

- `users create` accepts the password as **one** piped line, and works on a database that does not exist yet (it creates and migrates it);
- `reset-password` accepts one piped line too, in builds after v1.9.2, but refuses until a started server has written the fence marker;
- both, plus `users list`, work **while the daemon holds the database** — concurrent SQLite access is fine;
- the daemon runs, listens and arms the fence (verified against the upstream image as **root**, before this package rebuilt the image to run as uid 10001);
- a password set by either command is accepted by the real web login (a wrong one is rejected), and a reset forces a password change at next sign-in while a freshly created account goes to onboarding.

Against the image this package now builds, also outside StartOS: a volume left root-owned refuses a write from uid 10001 (`touch: Permission denied`); the oneshot's `chown` command, verbatim, fixes that; `exec.user: 'ovumcy'` resolves to uid 10001; and `users create` with the password on stdin succeeds as that user on a root-owned-then-chowned volume.

The CSRF refusal was reproduced and fixed outside StartOS too, against the packaged image with `AUDIT_LOG_ENABLED=true` (which is what prints `reason=`). Sending the login POST with the browser's `Host` and `Origin: https://…`: with `TRUST_PROXY_ENABLED=false` it answers `403` / `reason="invalid referer"`; with the same request carrying `X-Forwarded-Proto: https` from a peer inside `TRUSTED_PROXIES` it answers `303` and signs in. An `http://` Origin succeeds either way, which is what isolates the failure to the scheme half of fiber's origin comparison.

**On a StartOS box, confirmed working end to end** (2026-10-16/17, **x86_64 only**, over the https LAN address): the package installs, the critical task appears, *Set Admin Password* completes, the daemon starts and passes its health check, the web interface loads, and a real sign-in succeeds. Four more paths were exercised on the box on 2026-10-17: *Reset Account Password* returns a password that signs in and is then forced to change (which is upstream's post-reset behavior, not a fault); cycle data logged through the UI survives a stop/start of the service; *Create Account* adds a second account that signs in; and each account sees only its own calendar, while *List Accounts* shows both with no cycle data. Both defects found along the way are therefore fixed on real hardware and not only in reproduction — the scratch-image `Failed to start subcontainer ovumcy`, and the CSRF refusal. A successful sign-in is also what confirms the proxy's source address really is `10.0.3.1`, which was read from the OS sources rather than observed: trusting that address is the only reason the origin check passes.

**The on-box run above was `1.9.2:1`, pinned to `sha-8918dac`.** `1.9.2:2` moves the pin to `sha-d28ddba` for four upstream security fixes (stale-tab account binding on the settings, onboarding and dashboard writes; the CSRF token refresh no longer spending a one-time 2FA or recovery value; Go 1.27.3 for CVE-2026-111943 in `crypto/x509`, which reaches this package through outbound webhook delivery; and `golang.org/x/{crypto,net}`) and rebuilds the alpine base so its certificate store drops the compromised eMudhra authority — a package rebuild is the only way that trust store moves, which is why a dormant package is not a safe one. `appEnv` needed no change: the compare between the two commits adds no environment variable and changes no CLI, and upstream's new `TRUSTED_PROXIES` guidance — name the address the proxy's requests *arrive from*, not its own LAN address — is what this package already does with `10.0.3.1`. The upstream CLI contract was re-probed against the new pin outside StartOS (`users create` and `reset-password` each on one piped stdin line, `users list`, the fence armed by a started server). Nothing of `1.9.2:2` has been on a box yet.

Still not exercised on a box: the update path, the backup/restore round-trip including the fence's disarm-on-restore behavior, `COOKIE_SECURE` over an onion address in Tor Browser, the `.ics` feed in a real calendar client, and the reminder webhook pass. The fence is the gap that matters most, because it is the one behavior here that no other package has and that a user would never think to check: the mechanism is upstream's and the volume layout implements it, but nobody has watched a revoked feed URL stay dead across a restore. Work the verification protocol from the `package-service` skill in your packaging workspace (`.claude/skills/package-service/references/verify-on-startos.md`; the published guide is at <https://docs.start9.com/packaging>).
