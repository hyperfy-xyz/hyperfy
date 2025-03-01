FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
COPY .env.example .env
RUN npm run build || exit 0
ARG COMMIT_HASH=local
ENV COMMIT_HASH=${COMMIT_HASH:-local}
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=10s --start-period=5s --retries=5 \
  CMD curl -f http://localhost:3000/status || exit 1
CMD [ "npm", "run", "start" ]