FROM node:22-slim

WORKDIR /app
COPY output/. /app/

RUN mkdir logs && mkdir db && mkdir source

EXPOSE 3000

CMD ["pnpm", "run",  "start"]
