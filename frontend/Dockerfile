# Next.js frontend (development)
FROM node:20-alpine

WORKDIR /app

# GNU ps (procps) so dev tooling that runs `ps --no-headers` works; BusyBox ps does not support it
RUN apk add --no-cache procps

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Disable "open in editor" on non-macOS (Docker/Linux) to avoid "Terminal editors can only be used on macOS"
ENV REACT_EDITOR=echo

# Next.js dev server: listen on all interfaces for Docker
EXPOSE 40001
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "40001"]
