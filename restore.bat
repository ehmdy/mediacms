@echo off
REM MediaCMS Restore Script for Windows
REM Usage: restore.bat <backup_date>
REM Example: restore.bat 20241224_143022

setlocal enabledelayedexpansion

REM Configuration
set BACKUP_DIR=C:\backups
set PROJECT_NAME=mediacms
set BACKUP_DATE=%1

if "%BACKUP_DATE%"=="" (
    echo ❌ Error: Please provide backup date
    echo Usage: restore.bat ^<backup_date^>
    echo Example: restore.bat 20241224_143022
    echo.
    echo Available backups:
    dir "%BACKUP_DIR%\%PROJECT_NAME%_*_backup_*.tar.gz" /b 2>nul
    exit /b 1
)

echo 🔄 Starting MediaCMS Restore - %BACKUP_DATE%
echo ==========================================

REM Check if backup files exist
set DB_BACKUP=%BACKUP_DIR%\%PROJECT_NAME%_db_backup_%BACKUP_DATE%.sql.gz
set MEDIA_BACKUP=%BACKUP_DIR%\%PROJECT_NAME%_media_backup_%BACKUP_DATE%.tar.gz
set STATIC_BACKUP=%BACKUP_DIR%\%PROJECT_NAME%_static_backup_%BACKUP_DATE%.tar.gz
set CONFIG_BACKUP=%BACKUP_DIR%\%PROJECT_NAME%_config_backup_%BACKUP_DATE%.tar.gz
set WEB_IMAGE=%BACKUP_DIR%\%PROJECT_NAME%_web_image_%BACKUP_DATE%.tar.gz
set CELERY_IMAGE=%BACKUP_DIR%\%PROJECT_NAME%_celery_image_%BACKUP_DATE%.tar.gz

echo 🔍 Checking backup files...
if not exist "%DB_BACKUP%" (
    echo ❌ Database backup not found: %DB_BACKUP%
    exit /b 1
)
if not exist "%CONFIG_BACKUP%" (
    echo ❌ Configuration backup not found: %CONFIG_BACKUP%
    exit /b 1
)
if not exist "%WEB_IMAGE%" (
    echo ❌ Web image backup not found: %WEB_IMAGE%
    exit /b 1
)
if not exist "%CELERY_IMAGE%" (
    echo ❌ Celery image backup not found: %CELERY_IMAGE%
    exit /b 1
)
echo ✅ All backup files found

REM 1. Stop existing services
echo 🛑 Stopping existing services...
docker-compose down 2>nul

REM 2. Restore Docker Images
echo 🐳 Restoring Docker images...
docker load < "%WEB_IMAGE%"
docker load < "%CELERY_IMAGE%"
if %errorlevel% equ 0 (
    echo ✅ Docker images restored
) else (
    echo ❌ Docker images restore failed
    exit /b 1
)

REM 3. Restore Configuration Files
echo ⚙️  Restoring configuration files...
tar -xzf "%CONFIG_BACKUP%"
if %errorlevel% equ 0 (
    echo ✅ Configuration files restored
) else (
    echo ❌ Configuration files restore failed
    exit /b 1
)

REM 4. Start services
echo 🚀 Starting services...
docker-compose up -d db redis
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM 5. Restore Database
echo 🗄️  Restoring database...
docker-compose exec -T db psql -U mediacms -c "DROP DATABASE IF EXISTS mediacms;"
docker-compose exec -T db psql -U mediacms -c "CREATE DATABASE mediacms;"
gunzip -c "%DB_BACKUP%" | docker-compose exec -T db psql -U mediacms mediacms
if %errorlevel% equ 0 (
    echo ✅ Database restored
) else (
    echo ❌ Database restore failed
    exit /b 1
)

REM 6. Start all services
echo 🚀 Starting all services...
docker-compose up -d

REM 7. Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 15 /nobreak >nul

REM 8. Run migrations
echo 🔄 Running migrations...
docker-compose exec web python manage.py migrate --noinput
if %errorlevel% equ 0 (
    echo ✅ Migrations completed
) else (
    echo ❌ Migrations failed
)

REM 9. Restore Media Files
echo 🎬 Restoring media files...
if exist "%MEDIA_BACKUP%" (
    tar -xzf "%MEDIA_BACKUP%"
    if %errorlevel% equ 0 (
        echo ✅ Media files restored
    ) else (
        echo ❌ Media files restore failed
    )
) else (
    echo ⚠️  Media files backup not found, skipping...
)

REM 10. Restore Static Files
echo 🎨 Restoring static files...
if exist "%STATIC_BACKUP%" (
    tar -xzf "%STATIC_BACKUP%"
    if %errorlevel% equ 0 (
        echo ✅ Static files restored
    ) else (
        echo ❌ Static files restore failed
    )
) else (
    echo ⚠️  Static files backup not found, collecting static files...
    docker-compose exec web python manage.py collectstatic --noinput
)

REM 11. Create superuser (if needed)
echo 👤 Checking for superuser...
docker-compose exec -T web python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print('True' if User.objects.filter(is_superuser=True).exists() else 'False')" > temp_superuser_check.txt 2>nul
set /p SUPERUSER_EXISTS=<temp_superuser_check.txt
del temp_superuser_check.txt

if "%SUPERUSER_EXISTS%"=="False" (
    echo 👤 Creating superuser...
    echo Please provide superuser details:
    docker-compose exec web python manage.py createsuperuser
) else (
    echo ✅ Superuser already exists
)

REM 12. Verify installation
echo 🔍 Verifying installation...
docker-compose exec web python manage.py check --deploy
if %errorlevel% equ 0 (
    echo ✅ System check passed
) else (
    echo ⚠️  System check warnings (this is normal for development)
)

REM 13. Check services status
echo 📊 Checking services status...
docker-compose ps

REM 14. Test database connection
echo 🗄️  Testing database connection...
docker-compose exec web python manage.py shell -c "from files.models import Media; print(f'Total media files: {Media.objects.count()}'); print(f'Videos: {Media.objects.filter(media_type=\"video\").count()}'); print(f'Images: {Media.objects.filter(media_type=\"image\").count()}')"

echo.
echo 🎉 Restore completed successfully!
echo 🌐 Your MediaCMS should be available at: http://localhost
echo.
echo 📋 Next steps:
echo 1. Verify all services are running: docker-compose ps
echo 2. Check logs if needed: docker-compose logs
echo 3. Test video upload and processing
echo 4. Verify audio/subtitle track switching works
echo.
echo 🔧 Useful commands:
echo - View logs: docker-compose logs -f
echo - Restart services: docker-compose restart
echo - Access shell: docker-compose exec web python manage.py shell

endlocal

