#!/bin/bash
# MediaCMS Restore Script
# Usage: ./restore.sh <backup_date>
# Example: ./restore.sh 20241224_143022

set -e

# Configuration
BACKUP_DIR="/backups"
PROJECT_NAME="mediacms"
BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
    echo "❌ Error: Please provide backup date"
    echo "Usage: ./restore.sh <backup_date>"
    echo "Example: ./restore.sh 20241224_143022"
    echo ""
    echo "Available backups:"
    ls -la $BACKUP_DIR/${PROJECT_NAME}_*_backup_*.tar.gz 2>/dev/null | awk '{print $9}' | sed 's/.*_backup_//' | sed 's/.tar.gz//' | sort -u
    exit 1
fi

echo "🔄 Starting MediaCMS Restore - $BACKUP_DATE"
echo "=========================================="

# Check if backup files exist
DB_BACKUP="$BACKUP_DIR/${PROJECT_NAME}_db_backup_$BACKUP_DATE.sql.gz"
MEDIA_BACKUP="$BACKUP_DIR/${PROJECT_NAME}_media_backup_$BACKUP_DATE.tar.gz"
STATIC_BACKUP="$BACKUP_DIR/${PROJECT_NAME}_static_backup_$BACKUP_DATE.tar.gz"
CONFIG_BACKUP="$BACKUP_DIR/${PROJECT_NAME}_config_backup_$BACKUP_DATE.tar.gz"
WEB_IMAGE="$BACKUP_DIR/${PROJECT_NAME}_web_image_$BACKUP_DATE.tar.gz"
CELERY_IMAGE="$BACKUP_DIR/${PROJECT_NAME}_celery_image_$BACKUP_DATE.tar.gz"

echo "🔍 Checking backup files..."
for file in "$DB_BACKUP" "$MEDIA_BACKUP" "$CONFIG_BACKUP" "$WEB_IMAGE" "$CELERY_IMAGE"; do
    if [ ! -f "$file" ]; then
        echo "❌ Backup file not found: $file"
        exit 1
    fi
done
echo "✅ All backup files found"

# 1. Stop existing services
echo "🛑 Stopping existing services..."
docker-compose down 2>/dev/null || true

# 2. Restore Docker Images
echo "🐳 Restoring Docker images..."
docker load < $WEB_IMAGE
docker load < $CELERY_IMAGE
echo "✅ Docker images restored"

# 3. Restore Configuration Files
echo "⚙️  Restoring configuration files..."
tar -xzf $CONFIG_BACKUP
echo "✅ Configuration files restored"

# 4. Start services
echo "🚀 Starting services..."
docker-compose up -d db redis
echo "⏳ Waiting for database to be ready..."
sleep 10

# 5. Restore Database
echo "🗄️  Restoring database..."
docker-compose exec -T db psql -U mediacms -c "DROP DATABASE IF EXISTS mediacms;"
docker-compose exec -T db psql -U mediacms -c "CREATE DATABASE mediacms;"
gunzip -c $DB_BACKUP | docker-compose exec -T db psql -U mediacms mediacms
echo "✅ Database restored"

# 6. Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# 7. Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# 8. Run migrations
echo "🔄 Running migrations..."
docker-compose exec web python manage.py migrate --noinput
echo "✅ Migrations completed"

# 9. Restore Media Files
echo "🎬 Restoring media files..."
if [ -f "$MEDIA_BACKUP" ]; then
    tar -xzf $MEDIA_BACKUP
    echo "✅ Media files restored"
else
    echo "⚠️  Media files backup not found, skipping..."
fi

# 10. Restore Static Files
echo "🎨 Restoring static files..."
if [ -f "$STATIC_BACKUP" ]; then
    tar -xzf $STATIC_BACKUP
    echo "✅ Static files restored"
else
    echo "⚠️  Static files backup not found, collecting static files..."
    docker-compose exec web python manage.py collectstatic --noinput
fi

# 11. Create superuser (if needed)
echo "👤 Checking for superuser..."
SUPERUSER_EXISTS=$(docker-compose exec -T web python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
print('True' if User.objects.filter(is_superuser=True).exists() else 'False')
" 2>/dev/null | tr -d '\r\n')

if [ "$SUPERUSER_EXISTS" = "False" ]; then
    echo "👤 Creating superuser..."
    echo "Please provide superuser details:"
    docker-compose exec web python manage.py createsuperuser
else
    echo "✅ Superuser already exists"
fi

# 12. Verify installation
echo "🔍 Verifying installation..."
docker-compose exec web python manage.py check --deploy
echo "✅ System check passed"

# 13. Check services status
echo "📊 Checking services status..."
docker-compose ps

# 14. Test database connection
echo "🗄️  Testing database connection..."
docker-compose exec web python manage.py shell -c "
from files.models import Media
print(f'Total media files: {Media.objects.count()}')
print(f'Videos: {Media.objects.filter(media_type=\"video\").count()}')
print(f'Images: {Media.objects.filter(media_type=\"image\").count()}')
"

echo ""
echo "🎉 Restore completed successfully!"
echo "🌐 Your MediaCMS should be available at: http://localhost"
echo ""
echo "📋 Next steps:"
echo "1. Verify all services are running: docker-compose ps"
echo "2. Check logs if needed: docker-compose logs"
echo "3. Test video upload and processing"
echo "4. Verify audio/subtitle track switching works"
echo ""
echo "🔧 Useful commands:"
echo "- View logs: docker-compose logs -f"
echo "- Restart services: docker-compose restart"
echo "- Access shell: docker-compose exec web python manage.py shell"

