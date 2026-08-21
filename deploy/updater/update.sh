#!/usr/bin/env bash
#
# dd-bot auto-updater (continuous deployment sidecar).
#
# Watches the git remote for new commits on the tracked branch and, when the
# deployed code is behind, pulls the new code and rebuilds the stack IN PLACE:
# it rebuilds the images and recreates only the changed containers. Named
# volumes (e.g. PocketBase's pb_data) are never touched, so no data is lost.
#
# This container is itself part of the compose stack. It deliberately never
# rebuilds/recreates the `updater` service so an update can't kill this running
# loop half-way through. (To update the updater itself, run once by hand:
#   docker compose up -d --build updater)
#
# Everything is controlled from .env — see AUTO_UPDATE* / GIT_PULL_TOKEN there.

set -uo pipefail

REPO_DIR="${REPO_DIR:-/repo}"
BRANCH="${AUTO_UPDATE_BRANCH:-master}"
REMOTE="${AUTO_UPDATE_REMOTE:-origin}"
INTERVAL="${AUTO_UPDATE_INTERVAL:-300}"
SELF_SERVICE="${AUTO_UPDATE_SELF_SERVICE:-updater}"

log() { echo "[autoupdate $(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

cd "$REPO_DIR" || { log "FATAL: repo dir '$REPO_DIR' not mounted."; exit 1; }

# The bind-mounted repo is owned by the host user, but we run as root -> git
# refuses to operate on "dubious ownership" trees unless we allow it.
git config --global --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

# ── Disabled mode ────────────────────────────────────────────────────────
# Keep the container alive (so flipping AUTO_UPDATE=true + `up -d updater`
# is enough) but do nothing.
if [ "${AUTO_UPDATE:-false}" != "true" ]; then
  log "AUTO_UPDATE is not 'true' -> continuous deployment is OFF. Idling."
  log "Enable it with AUTO_UPDATE=true in .env, then: docker compose up -d updater"
  exec tail -f /dev/null
fi

# ── Preflight ────────────────────────────────────────────────────────────
if ! docker compose version >/dev/null 2>&1; then
  log "FATAL: 'docker compose' is unavailable. Is /var/run/docker.sock mounted?"
  exit 1
fi

# Auto-detect the compose project this updater belongs to, so we drive the
# EXACT same stack (and its existing volumes) the host started — no matter
# what the project directory is named. An explicit COMPOSE_PROJECT_NAME wins.
detect_project() {
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    echo "$COMPOSE_PROJECT_NAME"; return
  fi
  docker inspect "$(hostname)" \
    --format '{{ index .Config.Labels "com.docker.compose.project" }}' \
    2>/dev/null || true
}

PROJECT="$(detect_project)"
PROJECT_ARGS=()
if [ -n "$PROJECT" ]; then
  PROJECT_ARGS=(-p "$PROJECT")
else
  log "WARN: could not detect the compose project name; using compose default."
fi

# Optional auth for PRIVATE repos (GitHub PAT / fine-grained token or deploy
# token). Public repos need nothing here. Applied only to network ops (fetch),
# never persisted to the repo's git config.
FETCH_AUTH=()
if [ -n "${GIT_PULL_TOKEN:-}" ]; then
  BASIC="$(printf 'x-access-token:%s' "$GIT_PULL_TOKEN" | base64 | tr -d '\n')"
  FETCH_AUTH=(-c "http.extraheader=AUTHORIZATION: basic ${BASIC}")
fi

log "Continuous deployment ON. remote=$REMOTE branch=$BRANCH interval=${INTERVAL}s project=${PROJECT:-<default>}"

# Rebuild + recreate every service EXCEPT this updater. Recomputed each time so
# it tracks services added/removed by the very commit we just pulled. Profiles
# (e.g. tunnel) are honoured via COMPOSE_PROFILES from the environment.
rebuild_stack() {
  local services
  services="$(docker compose "${PROJECT_ARGS[@]}" config --services 2>/dev/null \
              | grep -vx "$SELF_SERVICE" || true)"

  if [ -z "$services" ]; then
    log "ERROR: no services to update (excluding '$SELF_SERVICE'). Skipping rebuild."
    return 1
  fi

  log "Building: $(echo "$services" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  docker compose "${PROJECT_ARGS[@]}" build $services || return 1

  log "Recreating changed containers (data volumes preserved)..."
  # No --remove-orphans on purpose: it would delete containers of inactive
  # profiles (e.g. cloudflared when COMPOSE_PROFILES is unset).
  # shellcheck disable=SC2086
  docker compose "${PROJECT_ARGS[@]}" up -d $services || return 1

  # Reclaim disk from the images the rebuild superseded (dangling only = safe).
  docker image prune -f >/dev/null 2>&1 || true
  return 0
}

apply_update() {
  local before after
  before="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  log "New commits on ${REMOTE}/${BRANCH}. Updating code (was ${before})..."
  # Hard-reset to the fetched tip: on a deploy box the working tree should
  # mirror the remote exactly. Untracked files (.env, pb_data bind mounts, ...)
  # are left alone; no `git clean` is ever run.
  if ! git reset --hard FETCH_HEAD; then
    log "ERROR: 'git reset --hard' failed. Aborting this cycle."
    return 1
  fi
  after="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  log "Code now at ${after}."
  if rebuild_stack; then
    log "Update complete -> ${after}."
  else
    log "ERROR: rebuild failed at ${after}; existing containers keep running. Will retry."
    return 1
  fi
}

# ── Poll loop ──────────────────────────────────────────────────────────────
while true; do
  if git "${FETCH_AUTH[@]}" fetch --quiet "$REMOTE" "$BRANCH" 2>/dev/null; then
    local_head="$(git rev-parse HEAD 2>/dev/null || echo 'local')"
    remote_head="$(git rev-parse FETCH_HEAD 2>/dev/null || echo 'remote')"
    if [ "$local_head" != "$remote_head" ]; then
      log "Behind: local=${local_head:0:7} remote=${remote_head:0:7}"
      apply_update || true
    fi
  else
    log "WARN: 'git fetch $REMOTE $BRANCH' failed (network/auth?). Retrying in ${INTERVAL}s."
  fi
  sleep "$INTERVAL"
done
