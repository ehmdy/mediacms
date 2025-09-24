#!/bin/bash
# MediaCMS Health Check Script
# Usage: ./health_check.sh

echo "🏥 MediaCMS Health Check"
echo "========================"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

echo "✅ Docker is running"

# Check if services are running
echo ""
echo "🐳 Checking Docker services..."
docker-compose ps

# Check database connection
echo ""
echo "🗄️  Checking database connection..."
if docker-compose exec -T web python manage.py check --database default >/dev/null 2>&1; then
    echo "✅ Database connection OK"
else
    echo "❌ Database connection failed"
fi

# Check Redis connection
echo ""
echo "🔴 Checking Redis connection..."
if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis connection OK"
else
    echo "❌ Redis connection failed"
fi

# Check Celery workers
echo ""
echo "🔄 Checking Celery workers..."
WORKER_COUNT=$(docker-compose exec -T web python manage.py shell -c "
from celery import current_app
try:
    inspect = current_app.control.inspect()
    active_workers = inspect.active()
    print(len(active_workers) if active_workers else 0)
except:
    print(0)
" 2>/dev/null | tr -d '\r\n')

if [ "$WORKER_COUNT" -gt 0 ]; then
    echo "✅ Celery workers active: $WORKER_COUNT"
else
    echo "❌ No active Celery workers"
fi

# Check pending videos
echo ""
echo "📹 Checking video processing status..."
docker-compose exec -T web python manage.py shell -c "
from files.models import Media
from django.utils import timezone
from datetime import timedelta

total_videos = Media.objects.filter(media_type='video').count()
pending_videos = Media.objects.filter(encoding_status='pending').count()
running_videos = Media.objects.filter(encoding_status='running').count()
success_videos = Media.objects.filter(encoding_status='success').count()
failed_videos = Media.objects.filter(encoding_status='fail').count()

print(f'Total videos: {total_videos}')
print(f'Pending: {pending_videos}')
print(f'Running: {running_videos}')
print(f'Success: {success_videos}')
print(f'Failed: {failed_videos}')

# Check recent uploads
recent_uploads = Media.objects.filter(add_date__gte=timezone.now()-timedelta(hours=24)).count()
print(f'Recent uploads (24h): {recent_uploads}')
"

# Check disk space
echo ""
echo "💾 Checking disk space..."
df -h | grep -E '^/dev/'

# Check media files directory
echo ""
echo "📁 Checking media files..."
if [ -d "media_files" ]; then
    MEDIA_SIZE=$(du -sh media_files 2>/dev/null | cut -f1)
    MEDIA_COUNT=$(find media_files -type f | wc -l)
    echo "✅ Media files directory exists"
    echo "   Size: $MEDIA_SIZE"
    echo "   Files: $MEDIA_COUNT"
else
    echo "❌ Media files directory not found"
fi

# Check HLS files
echo ""
echo "🎬 Checking HLS files..."
HLS_COUNT=$(find media_files/hls -name "master.m3u8" 2>/dev/null | wc -l)
if [ "$HLS_COUNT" -gt 0 ]; then
    echo "✅ HLS files found: $HLS_COUNT master playlists"
else
    echo "⚠️  No HLS master playlists found"
fi

# Check recent logs for errors
echo ""
echo "📋 Checking recent logs for errors..."
ERROR_COUNT=$(docker-compose logs --tail=100 2>&1 | grep -i error | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠️  Found $ERROR_COUNT errors in recent logs"
    echo "Recent errors:"
    docker-compose logs --tail=100 2>&1 | grep -i error | tail -5
else
    echo "✅ No recent errors found"
fi

# Check web server response
echo ""
echo "🌐 Checking web server response..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Web server responding (HTTP $HTTP_CODE)"
    else
        echo "⚠️  Web server responding with HTTP $HTTP_CODE"
    fi
else
    echo "❌ Web server not responding"
fi

echo ""
echo "🏥 Health check completed!"
echo ""
echo "💡 If you see any issues:"
echo "- Check logs: docker-compose logs -f"
echo "- Restart services: docker-compose restart"
echo "- Check disk space and clean up if needed"
echo "- Verify all environment variables are set correctly"

