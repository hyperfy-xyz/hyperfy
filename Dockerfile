FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build; exit 0

# Stage 2: Run
FROM node:22

# Set the working directory
WORKDIR /app

# Copy the build folder from the previous stage
COPY --from=build /app/build ./build
COPY ./src ./src

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install --only=production

# Expose the port the app runs on
EXPOSE 3000

# Healthcheck using curl
HEALTHCHECK --interval=2s --timeout=10s --start-period=5s --retries=5 \
  CMD curl -f http://localhost:3000/status || exit 1

# Start the application
CMD ["npm", "run", "start"]
