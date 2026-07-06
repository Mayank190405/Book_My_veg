
# AWS Free Tier Deployment Guide: BookMyVeg (ECR & EC2)

This guide provides a structural roadmap for deploying the **BookMyVeg** multi-store retail platform to AWS Free Tier using **Amazon Elastic Container Registry (ECR)** and **Amazon EC2**.

---

## 1. Prerequisites & Infrastructure Setup
- **AWS Free Tier Account**: Accessible `t2.micro` instance (1 GiB RAM).
- **IAM User**: Ensure your user has `AmazonEC2FullAccess` and `AmazonECRFullAccess`.
- **AWS CLI**: Locally configured with `aws configure`.

---

## 2. Setting up ECR Repositories
Create two repositories to host your application images:

```bash
# Create Backend Repository
aws ecr create-repository --repository-name bmv-server

# Create Frontend Repository
aws ecr create-repository --repository-name bmv-client
```

---

## 3. Local Build & Push to ECR
Run these commands from your local root directory (ensure Docker is running):

### A. Authenticate Docker with ECR
```bash
# Replace <ACCOUNT_ID> and <REGION> with your details
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
```

### B. Build and Push Backend
```bash
docker build -t bmv-server ./server
docker tag bmv-server:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bmv-server:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bmv-server:latest
```

### C. Build and Push Frontend
```bash
docker build -t bmv-client ./client
docker tag bmv-client:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bmv-client:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bmv-client:latest
```

---

## 4. EC2 Provisioning
1. **Launch Instance**: Select `Amazon Linux 2023` (t2.micro).
2. **Security Group**: Allow incoming traffic on ports:
   - `22`: SSH
   - `80`: HTTP (Redirect to 3000 later)
   - `3000`: Client
   - `5000`: API
3. **Key Pair**: Download and use `ssh -i key.pem ec2-user@<IP>`.

---

## 5. EC2 Environment Configuration
Once logged into your EC2 instance via SSH:

```bash
# Update and install Docker
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

---

## 6. Final Deployment
Upload your `docker-compose.yml` to the EC2 instance (e.g., via SCP) and run:

```bash
# Authenticate EC2 with ECR
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# Start the application
docker-compose up -d
```

### Post-Deployment: Database Initialization
Run the production seed on the server container:
```bash
docker exec -it bmv-server npx prisma db push
docker exec -it bmv-server npx prisma db seed
```

---

## 7. Optimization Notes for `t2.micro`
- **Memory Swap**: Since `t2.micro` has only 1GB RAM, it is **highly recommended** to create a 2GB Swap file on EC2 to prevent container crashes during peak usage:
  ```bash
  sudo dd if=/dev/zero of=/swapfile bs=128M count=16
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  ```
- **Image Standalone**: The frontend `Dockerfile` uses `output: 'standalone'`, reducing runtime memory from ~400MB to ~150MB.

---

**Status**: Infrastructure configuration is now deployment-ready. 🚀☁️🛡️
