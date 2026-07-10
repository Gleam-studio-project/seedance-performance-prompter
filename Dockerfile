FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip poppler-utils antiword \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY index.html app.js styles.css server.js SKILL.md README.md ./
COPY references ./references
COPY examples ./examples

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4174

EXPOSE 4174

USER node

CMD ["npm", "start"]
