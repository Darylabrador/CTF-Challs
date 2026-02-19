FROM node:20-alpine

RUN apk add --no-cache ca-certificates tini && update-ca-certificates

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --chown=node:node index.js ./
COPY --chown=node:node public ./public

USER node

EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","index.js"]