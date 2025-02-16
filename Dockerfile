FROM node:22 AS build

# Set the working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --force

# Copy the rest of the application code
COPY . .
COPY .env.example .env

RUN npm run build || exit 0

ARG COMMIT_HASH=local
ENV COMMIT_HASH=${COMMIT_HASH:-local}

# Expose the port the app runs on
EXPOSE 3000

# Healthcheck using curl
HEALTHCHECK --interval=2s --timeout=10s --start-period=5s --retries=5 \
  CMD curl -f http://localhost:3000/status || exit 1

# Start the application
CMD [ "npm", "run", "start" ]