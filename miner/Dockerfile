# Frontend Dockerfile (use Bun for faster installs/builds and nginx for a small runtime)
FROM node:lts-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@latest
# copy package manifests first to leverage layer caching
# Only copy files we know exist in this repo to avoid COPY failing when optional lockfiles are absent
COPY package.json pnpm-lock.yaml* ./
# install dependencies with bun (will create bun.lockb if not present)
RUN pnpm install
# copy rest of the sources and build
COPY . .
ENV NODE_ENV=production
RUN pnpm run build

# development image: run React development server with hot reload
FROM node:lts-alpine AS dev
WORKDIR /app
RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 3000
CMD ["pnpm", "start"]

# production image: serve static build with nginx
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html
# remove default nginx content
RUN rm -rf ./*
# copy built static files
COPY --from=build /app/build ./
# copy custom nginx config (overwrites default server config)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
