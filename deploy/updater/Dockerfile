# dd-bot auto-updater (continuous deployment sidecar).
#
# A tiny image that can drive the host's Docker via the mounted socket. The
# official docker CLI image already bundles the `compose` and `buildx` plugins;
# we only add git (to pull the repo) and bash/tini for the loop.
#
# Multi-arch: docker:*-cli ships linux/amd64 and linux/arm64 (ARM VPS friendly).
FROM docker:27-cli

RUN apk add --no-cache bash git tini ca-certificates

COPY update.sh /usr/local/bin/update.sh
RUN chmod +x /usr/local/bin/update.sh

# tini as PID 1 so `docker stop` cleanly interrupts the sleep loop.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/update.sh"]
