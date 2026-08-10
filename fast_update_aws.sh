#!/bin/bash
# High-Speed AWS Build & Deployment Script for BookMyVeg
# Run from local machine or server with AWS CLI configured.

set -e

# Auto-load NVM, Node, and AWS paths
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
fi
LATEST_NODE=$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1 || true)
if [ -n "$LATEST_NODE" ]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
fi
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin:/usr/bin:~/.local/bin:~/.aws/bin

ACCOUNT_ID="071370395808"
REGION="ap-south-1"
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
CLIENT_REPO="${ECR_BASE}/bmv-client"
SERVER_REPO="${ECR_BASE}/bmv-server"
EC2_IP="43.205.177.124"
KEY_PATH="bmv-prod-key-final.pem"

if ! command -v aws &> /dev/null; then
    echo "⚠️ AWS CLI is not installed in system PATH."
    echo "💡 If you are running directly on the Ubuntu EC2 server, please run:"
    echo "   ./ec2_direct_deploy.sh"
    exit 1
fi

echo "⚡ [1/4] Authenticating with AWS ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE

export DOCKER_BUILDKIT=1

echo "⚡ [2/4] Building Next.js Client & Express Server with Docker BuildKit Caching..."
docker build --build-arg NEXT_PUBLIC_API_URL=https://bookmyveg.co.in/api/v1 -t bmv-client ./client
docker build -t bmv-server ./server

echo "⚡ [3/4] Tagging and Pushing to ECR..."
docker tag bmv-client:latest "${CLIENT_REPO}:latest"
docker tag bmv-server:latest "${SERVER_REPO}:latest"
docker push "${CLIENT_REPO}:latest"
docker push "${SERVER_REPO}:latest"

echo "⚡ [4/4] Restarting EC2 Containers..."
if [ -f "$KEY_PATH" ]; then
    scp -o StrictHostKeyChecking=no -i $KEY_PATH docker-compose.yml.prod "ec2-user@${EC2_IP}:/home/ec2-user/docker-compose.yml.prod"

    ssh -o StrictHostKeyChecking=no -i $KEY_PATH ec2-user@$EC2_IP "
      aws ecr get-login-password --region $REGION | sudo docker login --username AWS --password-stdin $ECR_BASE &&
      sudo docker-compose -f docker-compose.yml.prod pull &&
      sudo docker-compose -f docker-compose.yml.prod up -d --remove-orphans
    "
fi

echo "✅ Ultra-Fast Deployment Completed Successfully!"
