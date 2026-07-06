#!/bin/bash
# BookMyVeg Database S3 Backup Script
# Running on Host (Ubuntu 24.04 LTS)

# Load configuration / environments
S3_BUCKET="${S3_BACKUP_BUCKET:-bmv-database-backups}"
DB_CONTAINER_NAME="bmv-db"
DB_USER="postgres"
DB_NAME="bookmyveg"
BACKUP_DIR="/tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

echo "=== [$(date)] Starting Database Backup to S3 ==="

# 1. Ensure the PostgreSQL docker container is running
if ! docker ps --format '{{.Names}}' | grep -Eq "^${DB_CONTAINER_NAME}$"; then
    echo "ERROR: Docker container ${DB_CONTAINER_NAME} is not running!" >&2
    exit 1
fi

# 2. Execute pg_dump inside docker container, compress, and output locally
echo "Dumping database '${DB_NAME}' from container '${DB_CONTAINER_NAME}'..."
if docker exec -t "${DB_CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"; then
    echo "Database dump successfully created at ${BACKUP_FILE}."
else
    echo "ERROR: pg_dump execution failed!" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# 3. Upload backup file to S3
echo "Uploading backup to Amazon S3 (bucket: s3://${S3_BUCKET})..."
if aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/db-backups/$(basename ${BACKUP_FILE})"; then
    echo "Backup uploaded successfully."
else
    echo "ERROR: S3 upload failed!" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# 4. Remove temporary local file
rm -f "${BACKUP_FILE}"
echo "Temporary local backup file cleaned up."

# 5. Prune backups older than 7 days on S3
echo "Pruning database backups older than 7 days on S3..."
SEVEN_DAYS_AGO=$(date -d '7 days ago' -u +%Y-%m-%dT%H:%M:%SZ)

# List and delete older objects
aws s3api list-objects-v2 --bucket "${S3_BUCKET}" --prefix "db-backups/" --query "Contents[?LastModified<=\`${SEVEN_DAYS_AGO}\`].Key" --output text | xargs -r -n1 -I {} sh -c '
    if [ ! -z "{}" ] && [ "{}" != "None" ]; then
        echo "Deleting old backup from S3: {}"
        aws s3 rm "s3://'"${S3_BUCKET}"'/{}"
    fi
'

echo "=== Backup completed successfully ==="
