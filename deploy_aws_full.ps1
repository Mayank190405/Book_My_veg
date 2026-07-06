# AWS Complete Deployment Script for BookMyVeg
# This script builds both server and client images, tags them, pushes them to ECR, and redeploys them on EC2.

$ACCOUNT_ID = "071370395808"
$REGION = "ap-south-1"
$ECR_BASE = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$CLIENT_REPO = "$ECR_BASE/bmv-client"
$SERVER_REPO = "$ECR_BASE/bmv-server"
$EC2_IP = "43.205.177.124"
$KEY_PATH = "bmv-prod-key-final.pem"

Write-Host "--- 1. Loading AWS Credentials from .env.aws ---" -ForegroundColor Cyan
if (Test-Path ".env.aws") {
    Get-Content ".env.aws" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                $env:Var = $value
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "Loaded environmental variable: $key" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Warning ".env.aws file not found! Relying on global AWS CLI configuration."
}

Write-Host "--- 2. Authenticating Docker with AWS ECR ---" -ForegroundColor Cyan
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE
if ($LASTEXITCODE -ne 0) {
    Write-Error "ECR login failed!"
    exit 1
}

Write-Host "--- 3. Building & Pushing Server (Backend) ---" -ForegroundColor Cyan
docker build --platform linux/amd64 -t bmv-server ./server
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend docker build failed!"
    exit 1
}
docker tag bmv-server:latest "${SERVER_REPO}:latest"
docker push "${SERVER_REPO}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend ECR push failed!"
    exit 1
}

Write-Host "--- 4. Building & Pushing Client (Frontend) ---" -ForegroundColor Cyan
docker build --platform linux/amd64 -t bmv-client `
  --build-arg NEXT_PUBLIC_API_URL=https://bookmyveg.co.in/api/v1 `
  ./client
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend docker build failed!"
    exit 1
}
docker tag bmv-client:latest "${CLIENT_REPO}:latest"
docker push "${CLIENT_REPO}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend ECR push failed!"
    exit 1
}

Write-Host "--- 5. Uploading docker-compose.yml.prod to EC2 ---" -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i $KEY_PATH docker-compose.yml.prod "ec2-user@${EC2_IP}:/home/ec2-user/docker-compose.yml.prod"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Uploading docker-compose.yml.prod failed!"
    exit 1
}

Write-Host "--- 6. Updating Containers on EC2 Instance ---" -ForegroundColor Cyan
# SSH into EC2, authenticate with ECR, pull server & client, and restart them
ssh -o StrictHostKeyChecking=no -i $KEY_PATH ec2-user@$EC2_IP "
  aws ecr get-login-password --region $REGION | sudo docker login --username AWS --password-stdin $ECR_BASE &&
  sudo docker-compose -f docker-compose.yml.prod pull server client &&
  sudo docker-compose -f docker-compose.yml.prod up -d server client
"
if ($LASTEXITCODE -ne 0) {
    Write-Error "EC2 container update failed!"
    exit 1
}

Write-Host "--- AWS Update Complete & Application Redeployed! ---" -ForegroundColor Green
