# --- Estágio Base (Desenvolvimento & Construção) ---
FROM node:20-alpine AS base

WORKDIR /app

# Instala dependências do sistema necessárias para compilar pacotes nativos se houver
RUN apk add --no-cache libc6-compat

# Copia arquivos de dependência primeiro para aproveitar cache do Docker
COPY package*.json ./

# Instala dependências de forma limpa
RUN npm ci

# Copia o restante dos arquivos do repositório
COPY . .

# Expõe a porta 8080 configurada no vite.config.ts
EXPOSE 8080

# Comando padrão para rodar o servidor de desenvolvimento do Vite com suporte a conexões externas
CMD ["npm", "run", "dev", "--", "--host"]


# --- Estágio de Compilação de Produção ---
FROM base AS builder
# Vite lê estas vars em build time. Vazio = URL relativa (mesma origem via nginx).
ARG VITE_API_URL=""
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build


# --- Estágio de Servidor de Produção (Nginx leve para SPA) ---
FROM nginx:stable-alpine AS production

# Copia a build estática gerada pelo Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia a configuração customizada do Nginx para suportar SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
