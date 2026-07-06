#!/bin/bash
# Install Docker
dnf update -y
dnf install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Get Public IP (IMDSv2 Compatible)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Create app directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Create docker-compose.yml with Fixes for Redis and SSL
cat <<EOF > docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: bmv-db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_password
      POSTGRES_DB: bookmyveg
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: bmv-redis
    restart: always
    ports:
      - "6379:6379"

  server:
    image: 071370395808.dkr.ecr.ap-south-1.amazonaws.com/bmv-server:latest
    container_name: bmv-server
    restart: always
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres_password@db:5432/bookmyveg?schema=public&sslmode=disable
      JWT_SECRET: supersecret
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PORT: 5000
      CLIENT_URL: http://${PUBLIC_IP}:3000
    depends_on:
      - db
      - redis

  client:
    image: 071370395808.dkr.ecr.ap-south-1.amazonaws.com/bmv-client:latest
    container_name: bmv-client
    restart: always
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://${PUBLIC_IP}:5000/api/v1
    depends_on:
      - server

volumes:
  postgres_data:
EOF

# Authenticate with ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 071370395808.dkr.ecr.ap-south-1.amazonaws.com

# Start services
docker-compose --env-file /dev/null up -d

# Create Swap file
dd if=/dev/zero of=/swapfile bs=128M count=16
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
