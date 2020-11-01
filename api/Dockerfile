FROM node:lts-slim

RUN mkdir -p /data/app
WORKDIR /data/app

COPY bin /data/app/bin/
COPY *.sh /data/app/
COPY *.js /data/app/
COPY *.json /data/app/
COPY schemas /data/app/schemas/
COPY src /data/app/src/

RUN npm install
RUN npm run build
RUN npm run lint

CMD node bin/www