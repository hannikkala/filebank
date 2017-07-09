FROM node:7

RUN mkdir -p /data/app
WORKDIR /data/app

COPY bin /data/app/bin/
COPY *.json /data/app/
COPY schemas /data/app/schemas/
COPY src /data/app/src/

RUN npm install
RUN npm run build

CMD node bin/www