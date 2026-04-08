# collab-server/Dockerfile
FROM node:18-bullseye
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
EXPOSE 1234
CMD [ "npm", "start" ]