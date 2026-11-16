FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend ./frontend
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node frontend/public ./frontend/public
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
COPY --chown=node:node backend ./backend
COPY --chown=node:node database ./database
COPY --chown=node:node scripts/create-admin.js ./scripts/create-admin.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=8s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/src/server.js"]
