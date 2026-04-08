FROM node:18-bullseye
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .
EXPOSE 4000
CMD [ "npm", "start" ]