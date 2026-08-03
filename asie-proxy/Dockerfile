FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
