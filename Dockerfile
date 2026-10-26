# Ovumcy's own image is built FROM scratch: its layers contain app/, etc/ and
# usr/ and nothing else. StartOS launches a subcontainer and waits for
# <rootfs>/proc/1 to appear, which cannot happen in a rootfs with no /proc, so
# that image fails to start with "Failed to start subcontainer ovumcy". This
# image is the upstream binary, byte for byte, on a base that has the
# directories a container runtime expects — plus a shell and coreutils, which
# is what lets the data volume be chowned and the service run unprivileged.
#
# Pinned by digest, not by tag: the bytes copied below are then exactly the
# ones from the upstream build that was tested, and no later retag can change
# them. Bump both references together — see UPDATING.md.
FROM ghcr.io/ovumcy/ovumcy-web:sha-d28ddba@sha256:07d6a9bfc3483c61643c0f7828a73524c91a268767b9cae703364f649c7aaf19 AS upstream

FROM alpine:3.22

# ca-certificates for outbound webhook reminders over HTTPS; tzdata because
# cycle entries are dates and the server's day boundary follows TZ.
#
# The base is a floating tag on purpose, where the upstream binary above is a
# digest: this trust store is the one the app checks a webhook receiver's
# certificate against, and it only ever moves when this package is rebuilt. A
# CA withdrawn upstream (eMudhra, 2026-10-20) stays trusted in every .s9pk
# built before the withdrawal, so repin-and-rebuild is the fix, and `apk add`
# resolving fresh on each build is what makes the rebuild enough. Check it:
# `docker run --rm <image> sh -c 'apk info -v ca-certificates'`.
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 ovumcy \
    && adduser -S -D -H -u 10001 -G ovumcy -h /app ovumcy \
    && mkdir -p /app/data /app/fence \
    && chown -R 10001:10001 /app

COPY --from=upstream --chown=10001:10001 /app/ovumcy /app/ovumcy

WORKDIR /app
EXPOSE 8080
USER 10001:10001
CMD ["/app/ovumcy"]
