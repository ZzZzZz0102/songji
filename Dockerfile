FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY tools ./tools
ENV HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/main.mjs"]
