FROM node:alpine as build

WORKDIR /build
ENV NODE_ENV=production

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY . .
RUN yarn build

FROM node:alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HEADLESS='yes'

COPY --from=build /build/node_modules node_modules
COPY --from=build /build/dist dist
COPY --from=build /root/.cache/puppeteer /home/pptruser/.cache/puppeteer
COPY . .

RUN apk add --no-cache chromium \ 
 && rm -rf /var/cache/apk/* /tmp/* \
 && addgroup pptruser \
 && adduser pptruser -D -G pptruser \
 && mkdir -p /home/pptruser/Downloads \
 && chown -R pptruser:pptruser /home/pptruser \
 && chown -R pptruser:pptruser /app

USER pptruser

CMD ["node", "dist/index.js"]
