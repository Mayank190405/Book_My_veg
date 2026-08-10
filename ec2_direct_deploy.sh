#!/bin/bash
# Direct EC2 Fast Rebuild & Reload Script
# Supports both Native Node/PM2 and Docker/Docker-Compose environments

set -e

# 1. Source NVM if present
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "/root/.nvm/nvm.sh" ] && \. "/root/.nvm/nvm.sh"

export PATH=$PATH:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:/usr/local/bin:/usr/bin:~/.local/bin:~/.npm-global/bin

echo "⚡ [1/3] Pulling latest git repository updates..."
git pull origin main

NPM_PATH=$(command -v npm || find $HOME /root /usr /usr/local /snap -name npm 2>/dev/null | head -n 1 || true)

if [ -n "$NPM_PATH" ] && [ -f "$NPM_PATH" ]; then
    NODE_BIN_DIR=$(dirname "$NPM_PATH")
    export PATH="$NODE_BIN_DIR:$PATH"
    NPM_EXEC="$NPM_PATH"
else
    NPM_EXEC=""
fi

if [ -n "$NPM_EXEC" ]; then
    echo "⚡ [2/3] Fast building Server & Client natively with Node..."
    $NPM_EXEC --prefix server ci --prefer-offline --no-audit
    $NPM_EXEC --prefix server run build

    $NPM_EXEC --prefix client ci --prefer-offline --no-audit
    $NPM_EXEC --prefix client run build

    echo "⚡ [3/3] Hot-restarting services..."
    PM2_EXEC=$(command -v pm2 || find $HOME /root /usr /usr/local /snap -name pm2 2>/dev/null | head -n 1 || true)
    if [ -n "$PM2_EXEC" ]; then
        $PM2_EXEC restart all || $PM2_EXEC start ecosystem.config.js
    else
        echo "✅ Native build completed successfully!"
    fi
else
    echo "⚡ [2/3] Building & updating via Docker Compose with BuildKit cache..."
    export DOCKER_BUILDKIT=1
    REGION="ap-south-1"
    ECR_BASE="071370395808.dkr.ecr.ap-south-1.amazonaws.com"

    # Attempt ECR authentication if AWS CLI is installed
    if command -v aws &> /dev/null; then
        aws ecr get-login-password --region $REGION 2>/dev/null | sudo docker login --username AWS --password-stdin $ECR_BASE 2>/dev/null || true
    fi

    # Check if docker-compose.yml.prod can be pulled, else fallback to building from source docker-compose.yml
    if command -v docker-compose &> /dev/null; then
        sudo docker-compose -f docker-compose.yml.prod pull 2>/dev/null && sudo docker-compose -f docker-compose.yml.prod up -d || sudo docker-compose -f docker-compose.yml up -d --build
    elif command -v docker &> /dev/null; then
        sudo docker compose -f docker-compose.yml.prod pull 2>/dev/null && sudo docker compose -f docker-compose.yml.prod up -d || sudo docker compose -f docker-compose.yml up -d --build
    else
        echo "❌ Neither Node/NPM nor Docker Compose found on EC2 instance."
        exit 1
    fi
    echo "⚡ [3/3] Docker containers updated and running!"
fi

echo "✅ Direct EC2 Deployment Finished Successfully!"
