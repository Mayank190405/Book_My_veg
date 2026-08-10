#!/bin/bash
# Direct EC2 Fast Rebuild & Reload Script
# Run directly on EC2 instance: ./ec2_direct_deploy.sh

set -e

# Automatically load NVM and Node/NPM/PM2 PATH on Ubuntu/Linux EC2
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
fi
LATEST_NODE=$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1 || true)
if [ -n "$LATEST_NODE" ]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
fi
export PATH=$PATH:/usr/local/bin:/usr/bin:~/.local/bin:~/.npm-global/bin

echo "⚡ [1/3] Pulling latest git repository updates..."
git pull origin main

echo "⚡ [2/3] Fast building Server & Client..."
(cd server && npm ci --prefer-offline --no-audit && npm run build)
(cd client && npm ci --prefer-offline --no-audit && npm run build)

echo "⚡ [3/3] Hot-restarting services..."
if command -v pm2 &> /dev/null; then
    pm2 restart all || pm2 start ecosystem.config.js
elif command -v docker-compose &> /dev/null; then
    sudo docker-compose -f docker-compose.yml restart || docker-compose restart
elif command -v docker &> /dev/null; then
    sudo docker compose restart || docker compose restart
else
    echo "⚠️ Neither PM2 nor Docker found. Build completed."
fi

echo "✅ Direct EC2 Deployment Finished in seconds!"
