# MediaCMS Production Deployment & Backup Guide

## 🚀 Production Preparation Checklist

### 1. Environment Configuration
- [ ] Set `DEBUG = False` in `cms/settings.py` ✅ (Already done)
- [ ] Configure `ALLOWED_HOSTS` for your domain
- [ ] Set up proper database credentials
- [ ] Configure Redis for production
- [ ] Set up SSL certificates
- [ ] Configure static file serving

### 2. Security Settings
- [ ] Generate new `SECRET_KEY`
- [ ] Configure `CSRF_TRUSTED_ORIGINS`
- [ ] Set up proper CORS settings
- [ ] Configure file upload limits
- [ ] Set up proper user permissions

### 3. Performance Optimization
- [ ] Configure Celery workers for production
- [ ] Set up Redis caching
- [ ] Configure static file compression
- [ ] Set up CDN for media files
- [ ] Configure database connection pooling

## 💾 Complete Backup & Restore Strategy

### Backup Components
1. **Database** (PostgreSQL)
2. **Media Files** (videos, images, HLS)
3. **Static Files** (CSS, JS, images)
4. **Configuration Files**
5. **Docker Images**

### Backup Scripts

#### 1. Database Backup
```bash
# Create database backup
docker-compose exec db pg_dump -U mediacms mediacms > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 2. Media Files Backup
```bash
# Create media files backup
tar -czf media_files_backup_$(date +%Y%m%d_%H%M%S).tar.gz media_files/

# Or use rsync for incremental backups
rsync -av --progress media_files/ /backup/location/media_files/
```

#### 3. Complete System Backup
```bash
# Backup entire project directory
tar -czf mediacms_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    .
```

## 🔄 Restore Process

### On New Windows Machine

#### 1. Prerequisites
- Install Docker Desktop
- Install Git
- Install PowerShell (or use Windows Terminal)

#### 2. Restore Steps
```powershell
# 1. Clone or restore project
git clone <your-repo-url> mediacms
cd mediacms

# 2. Restore media files
tar -xzf media_files_backup_YYYYMMDD_HHMMSS.tar.gz

# 3. Start services
docker-compose up -d

# 4. Restore database
docker-compose exec db psql -U mediacms mediacms < backup_YYYYMMDD_HHMMSS.sql

# 5. Run migrations (if needed)
docker-compose exec web python manage.py migrate

# 6. Collect static files
docker-compose exec web python manage.py collectstatic --noinput

# 7. Create superuser (if needed)
docker-compose exec web python manage.py createsuperuser
```

## 🏭 Production Deployment

### Docker Compose Production Configuration

#### 1. Environment Variables (.env)
```env
DEBUG=False
SECRET_KEY=your-production-secret-key
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:password@db:5432/mediacms
REDIS_URL=redis://redis:6379/0

# Media settings
MEDIA_ROOT=/home/mediacms.io/mediacms/media_files
STATIC_ROOT=/home/mediacms.io/mediacms/static_files

# Upload limits
MAX_UPLOAD_SIZE=2147483648  # 2GB
MAX_VIDEO_DURATION=7200     # 2 hours
```

#### 2. Production Docker Compose
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "80:8000"
    environment:
      - DEBUG=False
    volumes:
      - ./media_files:/home/mediacms.io/mediacms/media_files
      - ./static_files:/home/mediacms.io/mediacms/static_files
    depends_on:
      - db
      - redis

  celery_worker:
    build: .
    command: celery -A cms worker -l info
    volumes:
      - ./media_files:/home/mediacms.io/mediacms/media_files
    depends_on:
      - db
      - redis

  celery_beat:
    build: .
    command: celery -A cms beat -l info
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: mediacms
      POSTGRES_USER: mediacms
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 🔧 Maintenance Scripts

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T db pg_dump -U mediacms mediacms | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Media files backup
tar -czf $BACKUP_DIR/media_backup_$DATE.tar.gz media_files/

# Configuration backup
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz docker-compose.yaml .env

echo "Backup completed: $DATE"
```

### Health Check Script
```bash
#!/bin/bash
# health_check.sh

# Check if services are running
docker-compose ps

# Check database connection
docker-compose exec web python manage.py check --database default

# Check Celery workers
docker-compose exec web python manage.py shell -c "
from celery import current_app
print('Active workers:', len(current_app.control.inspect().active()))
"

# Check disk space
df -h

# Check recent uploads
docker-compose exec web python manage.py shell -c "
from files.models import Media
recent = Media.objects.filter(add_date__gte=timezone.now()-timedelta(hours=24))
print(f'Recent uploads: {recent.count()}')
"
```

## 📋 Production Checklist

### Before Going Live
- [ ] Test automatic processing with real videos
- [ ] Verify audio/subtitle track switching works
- [ ] Test user registration and authentication
- [ ] Verify file upload limits
- [ ] Test video playback on different devices
- [ ] Configure monitoring and logging
- [ ] Set up automated backups
- [ ] Test restore process

### Post-Deployment Monitoring
- [ ] Monitor disk space usage
- [ ] Check processing queue status
- [ ] Monitor error logs
- [ ] Track user uploads and processing times
- [ ] Verify backup integrity

## 🚨 Emergency Procedures

### If Processing Stops Working
```bash
# Restart Celery workers
docker-compose restart celery_worker celery_beat

# Check worker status
docker-compose exec web python manage.py shell -c "
from files.models import Media
pending = Media.objects.filter(encoding_status='pending')
print(f'Pending videos: {pending.count()}')
"
```

### If Database Issues
```bash
# Check database connection
docker-compose exec db psql -U mediacms -c "SELECT version();"

# Restore from backup
docker-compose exec -T db psql -U mediacms mediacms < backup_file.sql
```

### If Media Files Corrupted
```bash
# Restore media files
tar -xzf media_files_backup.tar.gz

# Re-generate HLS for affected videos
docker-compose exec web python manage.py shell -c "
from files.models import Media
from files import tasks
for media in Media.objects.filter(encoding_status='success'):
    tasks.create_hls(media.friendly_token)
"
```

This comprehensive guide ensures you can safely deploy to production and restore the system on any Windows machine! 🎯

