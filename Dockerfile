FROM node:24.22.1-alpine AS test
WORKDIR /app
COPY package*.json server.js app.js index.html ./
COPY test ./test
RUN npm test

FROM node:24.22.1-alpine
ENV NODE_ENV=production PORT=3006
WORKDIR /app
COPY --from=test --chown=node:node /app/package.json /app/server.js /app/app.js /app/index.html ./
USER node
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3006/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
