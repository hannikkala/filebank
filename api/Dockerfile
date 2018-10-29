FROM node:10-slim

RUN mkdir -p /data/app
WORKDIR /data/app

COPY bin /data/app/bin/
COPY *.json /data/app/
COPY schemas /data/app/schemas/
COPY src /data/app/src/

RUN yarn install
RUN yarn run build
RUN yarn run lint

CMD node bin/www