FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

# Créer le dossier data pour la persistance
RUN mkdir -p /app/data

# Exposer le port
EXPOSE 3000

# Variable d'environnement pour l'URL sécurisée
ENV SECURE_PATH=""
ENV NODE_ENV=production

# Démarrer l'application
CMD ["npm", "start"]
