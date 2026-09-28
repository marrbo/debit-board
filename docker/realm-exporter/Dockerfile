# docker/realm-exporter/Dockerfile
FROM node:20-alpine

# `docker-cli` para falar com o socket. Sem `dockerd`, sem runtime.
RUN apk add --no-cache docker-cli

WORKDIR /app

# Instala apenas em produção — o sidecar não tem devDependencies.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY index.mjs ./

# Nenhum processo roda como root.
# `docker` na imagem Alpine não precisa de root pra falar com o socket
# quando o container monta `/var/run/docker.sock` (o CLI é o cliente).
RUN addgroup -S exporter && adduser -S exporter -G exporter
USER exporter

EXPOSE 3099
CMD ["node", "index.mjs"]