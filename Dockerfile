FROM node:22-slim

WORKDIR /app
COPY output/. /app/

EXPOSE 3000

ENTRYPOINT ["tini", "--"]

CMD ["pnpm", "run",  "start"]
