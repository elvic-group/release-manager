FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY chatgpt-app/package*.json ./
RUN npm ci
COPY chatgpt-app/public ./public
COPY chatgpt-app/src ./src
COPY chatgpt-app/tsconfig.json ./
EXPOSE 8787
CMD ["sh", "-c", "npm run migrate && npm start"]
