# PocketBase server image — downloads the pinned binary for the target architecture.
# Supports linux/amd64, linux/arm64 and linux/arm (ARM VPS friendly).
FROM alpine:3.21 AS build

ARG PB_VERSION=0.39.11
# TARGETARCH is provided automatically by BuildKit/buildx; fall back to uname otherwise.
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget

WORKDIR /pb
RUN set -eux; \
    ARCH="${TARGETARCH:-$(uname -m)}"; \
    case "$ARCH" in \
        amd64|x86_64)   PB_ARCH=amd64 ;; \
        arm64|aarch64)  PB_ARCH=arm64 ;; \
        armv7l|arm)     PB_ARCH=armv7 ;; \
        *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;; \
    esac; \
    wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"; \
    unzip /tmp/pb.zip -d /pb; \
    rm /tmp/pb.zip

FROM alpine:3.21

RUN apk add --no-cache ca-certificates wget

WORKDIR /pb
COPY --from=build /pb/pocketbase /pb/pocketbase
COPY pb_migrations /pb/pb_migrations
COPY pocketbase/entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh /pb/pocketbase

EXPOSE 8090
VOLUME ["/pb/pb_data"]

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6 \
    CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/pb/entrypoint.sh"]
