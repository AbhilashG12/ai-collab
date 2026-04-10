FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]