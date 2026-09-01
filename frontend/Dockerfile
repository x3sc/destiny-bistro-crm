FROM node:22-bookworm-slim AS build

ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor/decode-uri-component ./vendor/decode-uri-component
RUN npm ci
COPY . .
RUN npx expo export --platform web

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
