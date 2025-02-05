FROM node:22 AS build

# Set the working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .
COPY .env.example .env

RUN npm run build || exit 0

ARG COMMIT_HASH=local
ENV COMMIT_HASH=${COMMIT_HASH:-local}

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD [ "npm", "run", "start" ]
