FROM node:18-bullseye

# Install build essentials for native C++ modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first
COPY package*.json ./
COPY prisma ./prisma/

# Install everything and force a rebuild of native modules
RUN npm install
RUN npm rebuild node-pty

# Copy the rest of the code
COPY . .

EXPOSE 4000

# Use the dev script we set up earlier
CMD ["npm", "run", "dev"]