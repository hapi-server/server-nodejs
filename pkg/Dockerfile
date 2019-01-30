FROM node:6-alpine
WORKDIR /app
COPY package.json /app
RUN apk update && apk upgrade && apk add --no-cache bash git python curl
RUN npm install
COPY . /app
