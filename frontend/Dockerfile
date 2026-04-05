# 默认经 DaoCloud 拉取 Docker Hub 官方库镜像，避免国内直连 registry-1.docker.io 超时。
# 海外构建可：docker compose build --build-arg BASE_REGISTRY=docker.io/library
ARG BASE_REGISTRY=docker.m.daocloud.io/library
FROM ${BASE_REGISTRY}/node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ${BASE_REGISTRY}/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
