#!/bin/bash
# Direct EC2 Fast Rebuild & Reload Script
# Run directly on EC2 instance: ./ec2_direct_deploy.sh

set -e

# 1. Load NVM if present
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
elif [ -s "/root/.nvm/nvm.sh" ]; then
    . "/root/.nvm/nvm.sh"
fi

# 2. Dynamically locate npm & node binaries on Ubuntu EC2
NPM_PATH=$(command -v npm || find $HOME /root /usr /usr/local /snap -name npm 2>/dev/null | head -n 1 || true)

if [ -n "$NPM_PATH" ]; then
    NODE_BIN_DIR=$(dirname "$NPM_PATH")
    export PATH="$NODE_BIN_DIR:$PATH"
fi

export PATH=$PATH:/usr/local/bin:/usr/bin:~/.local/bin:~/.npm-global/bin

NPM_EXEC=$(command -v npm || echo "$NPM_PATH")

if [ -z "$NPM_EXEC" ] || [ ! -f "$NPM_EXEC" ]; then
    echo "❌ NPM binary not found in system or NVM. Please check Node installation."
    exit 1
fi

echo "⚡ [1/3] Pulling latest git repository updates..."
git pull origin main

echo "⚡ [2/3] Fast building Server & Client..."
echo "🔨 Building Server..."
$NPM_EXEC --prefix server ci --prefer-offline --no-audit
$NPM_EXEC --prefix server run build

echo "🔨 Building Client..."
$NPM_EXEC --prefix client ci --prefer-offline --no-audit
$NPM_EXEC --prefix client run build

echo "⚡ [3/3] Hot-restarting services..."
PM2_EXEC=$(command -v pm2 || find $HOME /root /usr /usr/local /snap -name pm2 2>/dev/null | head -n 1 || true)

if [ -n "$PM2_EXEC" ] && [ -f "$PM2_EXEC" ]; then
    $PM2_EXEC restart all || $PM2_EXEC start ecosystem.config.js
elif command -v docker-compose &> /dev/null; then
    sudo docker-compose -f docker-compose.yml restart || docker-compose restart
elif command -v docker &> /dev/null; then
    sudo docker compose restart || docker compose restart
else
    echo "⚠️ Neither PM2 nor Docker found. Build completed."
fi

echo "✅ Direct EC2 Deployment Finished in seconds!"
