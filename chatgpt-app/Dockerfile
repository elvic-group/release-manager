FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY public ./public
COPY src ./src
COPY tsconfig.json ./
EXPOSE 8787
CMD ["npm", "start"]
