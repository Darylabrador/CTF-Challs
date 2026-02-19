FROM node:20-bookworm-slim AS web
WORKDIR /web
ENV NODE_ENV=production

COPY web/package.json web/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY web/index.js ./index.js
COPY web/public ./public

FROM python:3.12-slim-bookworm AS internal
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /internal

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY internal/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY internal/app.py ./app.py

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates libstdc++6 tini nginx \
 && rm -rf /var/lib/apt/lists/*

COPY --from=web /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=web /web /app/web
COPY --from=internal /internal /app/internal
COPY --from=internal /venv /venv

COPY nginx/nginx.conf /app/nginx/nginx.conf

RUN useradd -r -u 10001 appuser \
 && mkdir -p /app/nginx \
 && chown -R 10001:10001 /app /venv
USER 10001

EXPOSE 8080
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/usr/bin/tini","--","/entrypoint.sh"]