FROM node:22-alpine

WORKDIR /app

# Primero solo package*.json para aprovechar la cache de capas
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4200
# --host 0.0.0.0 para que sea accesible desde fuera del contenedor
# --poll para detectar cambios en archivos montados desde macOS
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
