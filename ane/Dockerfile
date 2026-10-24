# syntax=docker/dockerfile:1.7

# =============================================================================
# ane — pnpm + Turborepo monorepo
#
# 版本只有两个来源，Dockerfile 里不重复写：
#   Node → ane/.node-version
#   pnpm → ane/package.json devEngines.packageManager.version
#
# 构建（在 ane/ 目录执行，即本文件所在目录）：
#   docker build --build-arg APP=web  -t ane-web  .
#   docker build --build-arg APP=docs -t ane-docs .
# 运行：
#   docker run --rm -p 8000:8000 ane-web
# =============================================================================

# -----------------------------------------------------------------------------
# 1) toolchain：fnm + Node + pnpm
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS toolchain

ARG FNM_VERSION=1.39.0
# 留空则读取 .node-version
ARG NODE_VERSION=
# 可选：Node 下载镜像，例如 https://npmmirror.com/mirrors/node
ARG NODE_DIST_MIRROR=

ENV FNM_DIR=/usr/local/share/fnm
ENV PNPM_HOME=/pnpm
ENV PATH=${FNM_DIR}/aliases/default/bin:${PNPM_HOME}:${PATH}
ENV NEXT_TELEMETRY_DISABLED=1

# fnm 固定版本 + 官方 release 包，避免 curl | bash 的不可复现性
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl git unzip; \
    rm -rf /var/lib/apt/lists/*; \
    case "$(dpkg --print-architecture)" in \
      amd64) fnm_asset=fnm-linux ;; \
      arm64) fnm_asset=fnm-arm64 ;; \
      *) echo "unsupported arch: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL \
      "https://github.com/Schniz/fnm/releases/download/v${FNM_VERSION}/${fnm_asset}.zip" \
      -o /tmp/fnm.zip; \
    unzip -q /tmp/fnm.zip -d /usr/local/bin; \
    chmod +x /usr/local/bin/fnm; \
    rm -f /tmp/fnm.zip; \
    fnm --version

WORKDIR /app

# Node：以 .node-version 为准，可用 --build-arg NODE_VERSION=24.x.y 覆盖
COPY .node-version ./
RUN set -eux; \
    if [ -n "${NODE_DIST_MIRROR}" ]; then export FNM_NODE_DIST_MIRROR="${NODE_DIST_MIRROR}"; fi; \
    version="${NODE_VERSION:-$(cat .node-version)}"; \
    echo "node ${version} (from .node-version)"; \
    fnm install "$version"; \
    fnm default "$version"; \
    node --version; \
    npm --version

# pnpm：版本从 devEngines 读取，避免两处维护
COPY package.json ./
RUN set -eux; \
    pnpm_version="$(node -p "require('./package.json').devEngines.packageManager.version")"; \
    test -n "$pnpm_version"; \
    echo "pnpm ${pnpm_version} (from devEngines)"; \
    npm install --global "pnpm@${pnpm_version}"; \
    pnpm --version

# -----------------------------------------------------------------------------
# 2) deps：只拷 manifest，依赖层可单独缓存
# -----------------------------------------------------------------------------
FROM toolchain AS deps

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml ./
COPY package.json ./
COPY apps/web/package.json                     apps/web/
COPY apps/docs/package.json                    apps/docs/
COPY packages/ui/package.json                  packages/ui/
COPY packages/eslint-config/package.json       packages/eslint-config/
COPY packages/typescript-config/package.json   packages/typescript-config/
# 若 duye / ceramics 子模块已初始化且需要参与构建，取消注释：
# COPY apps/duye/package.json                  apps/duye/
# COPY apps/ceramics/package.json              apps/ceramics/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# -----------------------------------------------------------------------------
# 3) builder：编译指定应用及其 workspace 依赖
# -----------------------------------------------------------------------------
FROM deps AS builder

ARG APP=web

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=cache,id=turbo-cache,target=/app/.turbo \
    pnpm exec turbo run build --filter="${APP}"

RUN test -f "apps/${APP}/.next/BUILD_ID"

# -----------------------------------------------------------------------------
# 4) runner：生产运行，同版本 Node/pnpm + 仅生产依赖
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runner

ARG APP=web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000
ENV HOSTNAME=0.0.0.0
ENV FNM_DIR=/usr/local/share/fnm
ENV PNPM_HOME=/pnpm
ENV PATH=${FNM_DIR}/aliases/default/bin:${PNPM_HOME}:${PATH}
ENV APP=${APP}

# 复用构建阶段完全一致的 Node（含已安装的 pnpm）
COPY --from=toolchain /usr/local/share/fnm /usr/local/share/fnm

WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json                     apps/web/
COPY apps/docs/package.json                    apps/docs/
COPY packages/ui/package.json                  packages/ui/
COPY packages/eslint-config/package.json       packages/eslint-config/
COPY packages/typescript-config/package.json   packages/typescript-config/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter "${APP}..." --store-dir=/pnpm/store

COPY --from=builder /app/apps/${APP}/.next          ./apps/${APP}/.next
COPY --from=builder /app/apps/${APP}/public         ./apps/${APP}/public
COPY --from=builder /app/apps/${APP}/next.config.js ./apps/${APP}/next.config.js

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 8000
CMD ["sh", "-c", "exec pnpm --filter \"$APP\" start"]
