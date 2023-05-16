FROM node:alpine as build

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache chromium 
  && rm -rf /var/cache/apk/* /tmp/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY . .
RUN yarn build

RUN addgroup pptruser \
 && adduser pptruser -D -G pptruser \
 && mkdir -p /home/pptruser/Downloads \
 && chown -R pptruser:pptruser /home/pptruser \
 && chown -R pptruser:pptruser /app

USER pptruser

CMD ["yarn", "start"]