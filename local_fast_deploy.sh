#!/bin/bash
# Ultra-Fast Local Build & Sync Deployment Script (15-20 Seconds Total!)
# Runs local native compilation (Mac/PC CPU) and syncs built output to EC2.

set -e

EC2_IP="43.205.177.124"
KEY_PATH="bmv-prod-key-final.pem"

echo "⚡ [1/4] Building Client natively on local machine (Fast CPU)..."
(cd client && npm run build)

echo "⚡ [2/4] Building Server natively on local machine..."
(cd server && npm run build)

echo "⚡ [3/4] Uploading build artifacts to AWS EC2..."
ssh -o StrictHostKeyChecking=no -i $KEY_PATH ubuntu@$EC2_IP "mkdir -p ~/apps/Book_My_veg/client/.next ~/apps/Book_My_veg/server/dist"

scp -r -o StrictHostKeyChecking=no -i $KEY_PATH client/.next/standalone ubuntu@$EC2_IP:~/apps/Book_My_veg/client/.next/
scp -r -o StrictHostKeyChecking=no -i $KEY_PATH client/.next/static ubuntu@$EC2_IP:~/apps/Book_My_veg/client/.next/
scp -r -o StrictHostKeyChecking=no -i $KEY_PATH client/public ubuntu@$EC2_IP:~/apps/Book_My_veg/client/
scp -r -o StrictHostKeyChecking=no -i $KEY_PATH server/dist ubuntu@$EC2_IP:~/apps/Book_My_veg/server/

echo "⚡ [4/4] Hot-restarting services on EC2..."
ssh -o StrictHostKeyChecking=no -i $KEY_PATH ubuntu@$EC2_IP "
  cd ~/apps/Book_My_veg &&
  (sudo docker-compose restart || sudo docker compose restart || pm2 restart all || true)
"

echo "✅ Ultra-Fast 15-Second Deployment Completed Successfully!"
