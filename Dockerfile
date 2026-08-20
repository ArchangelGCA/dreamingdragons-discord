# dd-bot Discord bot image
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app
# /app is created by WORKDIR as root; hand it to the unprivileged node user.
RUN chown node:node /app
USER node

# Install production dependencies first (better layer caching).
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy bot source.
COPY --chown=node:node index.js deploy-commands.js ./
COPY --chown=node:node commands ./commands
COPY --chown=node:node utils ./utils
COPY --chown=node:node init ./init

# Deploys slash commands then starts the bot (see package.json "start").
CMD ["npm", "start"]
