# Dockerfile para aplicação WhatsApp API
FROM node:20

# Diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Expõe a porta (pode ser sobrescrita pelo Easypanel)
EXPOSE 3000

# Comando para iniciar a API
CMD ["node", "src/server.js"]
