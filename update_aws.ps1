# AWS Update Script for BookMyVeg
# This script builds the client image, pushes it to ECR, and updates the EC2 instance.

$ACCOUNT_ID = "071370395808"
$REGION = "ap-south-1"
$ECR_BASE = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$CLIENT_REPO = "$ECR_BASE/bmv-client"
$EC2_IP = "43.205.177.124"
$KEY_PATH = "bmv-prod-key-final.pem"

Write-Host "--- 1. Authenticating with ECR ---" -ForegroundColor Cyan
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE

Write-Host "--- 2. Building Client Image ---" -ForegroundColor Cyan
# Using --platform linux/amd64 for EC2 compatibility
docker build --platform linux/amd64 -t bmv-client `
  --build-arg NEXT_PUBLIC_API_URL=https://bookmyveg.co.in/api/v1 `
  ./client

Write-Host "--- 3. Tagging and Pushing to ECR ---" -ForegroundColor Cyan
docker tag bmv-client:latest "${CLIENT_REPO}:latest"
docker push "${CLIENT_REPO}:latest"

Write-Host "--- 4. Uploading docker-compose.yml.prod to EC2 ---" -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i $KEY_PATH docker-compose.yml.prod "ec2-user@${EC2_IP}:/home/ec2-user/docker-compose.yml.prod"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Uploading docker-compose.yml.prod failed!"
    exit 1
}

Write-Host "--- 5. Updating EC2 Instance ---" -ForegroundColor Cyan
# SSH into EC2, login to ECR there, pull, and restart client
ssh -o StrictHostKeyChecking=no -i $KEY_PATH ec2-user@$EC2_IP "
  aws ecr get-login-password --region $REGION | sudo docker login --username AWS --password-stdin $ECR_BASE &&
  sudo docker-compose -f docker-compose.yml.prod pull client &&
  sudo docker-compose -f docker-compose.yml.prod up -d client
"

Write-Host "--- Update Complete! ---" -ForegroundColor Green
