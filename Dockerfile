FROM node:22-slim

WORKDIR /app
COPY output/. /app/

RUN mkdir logs && mkdir db

EXPOSE 3000

ENTRYPOINT ["tini", "--"]

CMD ["pnpm", "run",  "start"]
