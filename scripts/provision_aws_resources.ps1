# Provision AWS Resources for BookMyVeg (BMV) Platform
# Runs locally on User machine using the authenticated AWS CLI

$REGION = "ap-south-1"
$INSTANCE_TYPE = "t3.micro" # Changed from t3.medium to t3.micro for Free Tier sandbox eligibility
$AMI_ID = "ami-001e7cc215773c7fb" # Ubuntu 24.04 LTS (x86_64) in ap-south-1
$VOLUME_SIZE = 30 # GB GP3 SSD

Write-Host "=========================================" -ForegroundColor Green
Write-Host "AWS RESOURCE PROVISIONING FOR BOOKMYVEG  " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Get AWS Account ID
$ACCOUNT_ID = (aws sts get-caller-identity --query "Account" --output text).Trim()
if (-not $ACCOUNT_ID) {
    Write-Error "Failed to fetch AWS Account ID. Make sure AWS CLI is logged in."
    exit 1
}
Write-Host "Using AWS Account ID: $ACCOUNT_ID" -ForegroundColor Cyan

# 1. Create S3 Bucket
$BUCKET_NAME = "bmv-db-backups-$ACCOUNT_ID"
Write-Host "`n[Step 1] Creating S3 Backup Bucket: s3://$BUCKET_NAME..." -ForegroundColor Yellow
$bucketCheck = aws s3api head-bucket --bucket $BUCKET_NAME 2>&1
if ($bucketCheck -like "*Not Found*") {
    aws s3api create-bucket --bucket $BUCKET_NAME --region $REGION --create-bucket-configuration LocationConstraint=$REGION
    Write-Host "S3 bucket created successfully." -ForegroundColor Green
} else {
    Write-Host "S3 bucket already exists. Reusing it." -ForegroundColor Gray
}

# 2. Create ECR Repositories
Write-Host "`n[Step 2] Creating ECR Repositories..." -ForegroundColor Yellow

$repos = @("bmv-server", "bmv-client")
foreach ($repo in $repos) {
    $repoCheck = aws ecr describe-repositories --repository-names $repo --region $REGION 2>&1
    if ($repoCheck -like "*RepositoryNotFoundException*") {
        aws ecr create-repository --repository-name $repo --region $REGION
        Write-Host "Created ECR repository: $repo" -ForegroundColor Green
    } else {
        Write-Host "ECR repository $repo already exists. Reusing." -ForegroundColor Gray
    }
}

# 3. Create SSH Key Pair
Write-Host "`n[Step 3] Creating EC2 Key Pair..." -ForegroundColor Yellow
$KEY_NAME = "bmv-key-pair-new"
$KEY_FILE = "bmv-key-pair-new.pem"

if (Test-Path $KEY_FILE) {
    Write-Host "Private key file $KEY_FILE already exists locally. Reusing it." -ForegroundColor Gray
} else {
    # Check if key pair already registered in AWS
    $keyCheck = aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION 2>&1
    if ($keyCheck -notlike "*InvalidKeyPair.NotFound*") {
        Write-Warning "Key pair $KEY_NAME already exists in AWS but file not found. Deleting old AWS key pair to generate new one..."
        aws ec2 delete-key-pair --key-name $KEY_NAME --region $REGION
    }
    aws ecr get-login-password --region $REGION | Out-Null # Wake up CLI
    aws ec2 create-key-pair --key-name $KEY_NAME --query "KeyMaterial" --output text --region $REGION > $KEY_FILE
    Write-Host "Created new key pair and saved to: $KEY_FILE" -ForegroundColor Green
}

# 4. Create Security Group
Write-Host "`n[Step 4] Creating Security Group..." -ForegroundColor Yellow
$SG_NAME = "bmv-production-sg"
$sgCheck = aws ec2 describe-security-groups --group-names $SG_NAME --region $REGION 2>&1
if ($sgCheck -like "*InvalidGroup.NotFound*") {
    $SG_ID = (aws ec2 create-security-group --group-name $SG_NAME --description "Security group for BMV application" --region $REGION --query "GroupId" --output text).Trim()
    Write-Host "Created Security Group $SG_NAME (ID: $SG_ID)" -ForegroundColor Green

    # Add inbound rules
    Write-Host "Configuring port access (22, 80, 443, 3000, 5000) from anywhere..." -ForegroundColor Gray
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $REGION | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $REGION | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $REGION | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region $REGION | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5000 --cidr 0.0.0.0/0 --region $REGION | Out-Null
    Write-Host "Security group rules configured." -ForegroundColor Green
} else {
    $SG_ID = (aws ec2 describe-security-groups --group-names $SG_NAME --region $REGION --query "SecurityGroups[0].GroupId" --output text).Trim()
    Write-Host "Security Group already exists (ID: $SG_ID). Reusing." -ForegroundColor Gray
}

# 5. Launch EC2 Instance
Write-Host "`n[Step 5] Launching EC2 Instance ($INSTANCE_TYPE)..." -ForegroundColor Yellow

# Write the block device mappings to a temporary JSON file using ASCII to avoid Unicode UTF-8 BOM byte flags
$TEMP_JSON_PATH = "block_device_mapping_temp.json"
$deviceMappingJson = @"
[
  {
    "DeviceName": "/dev/sda1",
    "Ebs": {
      "VolumeSize": $VOLUME_SIZE,
      "VolumeType": "gp3",
      "DeleteOnTermination": true
    }
  }
]
"@
$deviceMappingJson | Out-File -FilePath $TEMP_JSON_PATH -Encoding ascii -Force

$instanceInfo = aws ec2 run-instances `
    --image-id $AMI_ID `
    --instance-type $INSTANCE_TYPE `
    --key-name $KEY_NAME `
    --security-group-ids $SG_ID `
    --block-device-mappings "file://$TEMP_JSON_PATH" `
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=BMV-Production-Server}]" `
    --region $REGION `
    --query "Instances[0].[InstanceId]" `
    --output text

# Remove temporary file
if (Test-Path $TEMP_JSON_PATH) {
    Remove-Item $TEMP_JSON_PATH -Force
}

$INSTANCE_ID = $instanceInfo.Trim()
if (-not $INSTANCE_ID -or $INSTANCE_ID -eq "None") {
    Write-Error "Failed to launch EC2 instance. Check AWS CLI console error output."
    exit 1
}
Write-Host "Instance launched successfully. ID: $INSTANCE_ID" -ForegroundColor Green

Write-Host "Waiting for instance to start and receive a public IP..." -ForegroundColor Gray
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

$PUBLIC_IP = (aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $REGION --query "Reservations[0].Instances[0].PublicIpAddress" --output text).Trim()

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "AWS PROVISIONING COMPLETED SUCCESSFULLY!  " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "New EC2 Instance IP : $PUBLIC_IP" -ForegroundColor Cyan
Write-Host "New S3 Backup Bucket: s3://$BUCKET_NAME" -ForegroundColor Cyan
Write-Host "ECR Repositories    : bmv-server, bmv-client" -ForegroundColor Cyan
Write-Host "SSH Key File Created: $KEY_FILE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Point your domain (e.g. bookmyveg.co.in) to IP: $PUBLIC_IP" -ForegroundColor Yellow
Write-Host "2. Save the new IP and AWS credentials in GitHub Secrets as described in walkthrough.md" -ForegroundColor Yellow
