#!/bin/bash
# Complete MediaCMS Backup Script
# Usage: ./backup.sh

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_NAME="mediacms"

echo "🚀 Starting MediaCMS Backup - $DATE"
echo "=================================="

# Create backup directory
mkdir -p $BACKUP_DIR

echo "📁 Creating backup directory: $BACKUP_DIR"

# 1. Database Backup
echo "🗄️  Backing up database..."
docker-compose exec -T db pg_dump -U mediacms mediacms | gzip > $BACKUP_DIR/${PROJECT_NAME}_db_backup_$DATE.sql.gz
echo "✅ Database backup completed: ${PROJECT_NAME}_db_backup_$DATE.sql.gz"

# 2. Media Files Backup
echo "🎬 Backing up media files..."
if [ -d "media_files" ]; then
    tar -czf $BACKUP_DIR/${PROJECT_NAME}_media_backup_$DATE.tar.gz media_files/
    echo "✅ Media files backup completed: ${PROJECT_NAME}_media_backup_$DATE.tar.gz"
else
    echo "⚠️  Media files directory not found"
fi

# 3. Static Files Backup
echo "🎨 Backing up static files..."
if [ -d "static_files" ]; then
    tar -czf $BACKUP_DIR/${PROJECT_NAME}_static_backup_$DATE.tar.gz static_files/
    echo "✅ Static files backup completed: ${PROJECT_NAME}_static_backup_$DATE.tar.gz"
else
    echo "⚠️  Static files directory not found"
fi

# 4. Configuration Files Backup
echo "⚙️  Backing up configuration files..."
tar -czf $BACKUP_DIR/${PROJECT_NAME}_config_backup_$DATE.tar.gz \
    docker-compose.yaml \
    .env \
    requirements.txt \
    Dockerfile \
    --exclude='*.pyc' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='node_modules' \
    .
echo "✅ Configuration backup completed: ${PROJECT_NAME}_config_backup_$DATE.tar.gz"

# 5. Docker Images Backup
echo "🐳 Backing up Docker images..."
docker save mediacms_web:latest | gzip > $BACKUP_DIR/${PROJECT_NAME}_web_image_$DATE.tar.gz
docker save mediacms_celery_worker:latest | gzip > $BACKUP_DIR/${PROJECT_NAME}_celery_image_$DATE.tar.gz
echo "✅ Docker images backup completed"

# 6. Create backup manifest
echo "📋 Creating backup manifest..."
cat > $BACKUP_DIR/${PROJECT_NAME}_backup_manifest_$DATE.txt << EOF
MediaCMS Backup Manifest
=======================
Date: $DATE
Backup Directory: $BACKUP_DIR

Files Created:
- ${PROJECT_NAME}_db_backup_$DATE.sql.gz (Database)
- ${PROJECT_NAME}_media_backup_$DATE.tar.gz (Media Files)
- ${PROJECT_NAME}_static_backup_$DATE.tar.gz (Static Files)
- ${PROJECT_NAME}_config_backup_$DATE.tar.gz (Configuration)
- ${PROJECT_NAME}_web_image_$DATE.tar.gz (Web Docker Image)
- ${PROJECT_NAME}_celery_image_$DATE.tar.gz (Celery Docker Image)

System Information:
- OS: $(uname -a)
- Docker Version: $(docker --version)
- Disk Usage: $(df -h | grep -E '^/dev/')

Database Information:
- PostgreSQL Version: $(docker-compose exec -T db psql -U mediacms -c "SELECT version();" | head -1)

Media Files Information:
- Total Videos: $(find media_files -name "*.mp4" -o -name "*.mkv" | wc -l)
- Total Size: $(du -sh media_files 2>/dev/null || echo "N/A")

Backup Size:
$(du -sh $BACKUP_DIR/${PROJECT_NAME}_*_$DATE.*)
EOF

echo "✅ Backup manifest created: ${PROJECT_NAME}_backup_manifest_$DATE.txt"

# 7. Calculate total backup size
TOTAL_SIZE=$(du -sh $BACKUP_DIR/${PROJECT_NAME}_*_$DATE.* | awk '{sum+=$1} END {print sum}')
echo ""
echo "🎉 Backup completed successfully!"
echo "📊 Total backup size: $TOTAL_SIZE"
echo "📁 Backup location: $BACKUP_DIR"
echo ""
echo "📋 Backup files:"
ls -lh $BACKUP_DIR/${PROJECT_NAME}_*_$DATE.*

echo ""
echo "💡 To restore this backup, use: ./restore.sh $DATE"

