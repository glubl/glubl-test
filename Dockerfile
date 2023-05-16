FROM node as build

# ENV NODE_ENV=production
WORKDIR /build

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY . .
RUN yarn build

FROM node

ENV NODE_ENV=production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY --from=build /build/dist dist

ENTRYPOINT ["/bin/sh"]
CMD ["-c", "node dist/index.js"]