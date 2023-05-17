FROM node:alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV HEADLESS='yes'

COPY package.json .
COPY yarn.lock .
RUN yarn install

COPY . .
RUN yarn build

RUN apk add --no-cache chromium \ 
 && rm -rf /var/cache/apk/* /tmp/* \
 && addgroup pptruser \
 && adduser pptruser -D -G pptruser \
 && mkdir -p /home/pptruser/Downloads \
 && chown -R pptruser:pptruser /home/pptruser \
 && chown -R pptruser:pptruser /app

USER pptruser

CMD ["node", "dist/index.js"]
