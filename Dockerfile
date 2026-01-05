FROM node:22-slim

WORKDIR /app
COPY output/. /app/

RUN npm install pnpm -g && mkdir logs && mkdir db && mkdir source

EXPOSE 3000

CMD ["pnpm", "run",  "start"]
