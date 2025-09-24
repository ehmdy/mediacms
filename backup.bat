@echo off
REM MediaCMS Backup Script for Windows
REM Usage: backup.bat

setlocal enabledelayedexpansion

REM Configuration
set BACKUP_DIR=C:\backups
set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE=%DATE: =0%
set PROJECT_NAME=mediacms

echo 🚀 Starting MediaCMS Backup - %DATE%
echo ==================================

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
echo 📁 Creating backup directory: %BACKUP_DIR%

REM 1. Database Backup
echo 🗄️  Backing up database...
docker-compose exec -T db pg_dump -U mediacms mediacms | gzip > "%BACKUP_DIR%\%PROJECT_NAME%_db_backup_%DATE%.sql.gz"
if %errorlevel% equ 0 (
    echo ✅ Database backup completed: %PROJECT_NAME%_db_backup_%DATE%.sql.gz
) else (
    echo ❌ Database backup failed
    exit /b 1
)

REM 2. Media Files Backup
echo 🎬 Backing up media files...
if exist "media_files" (
    tar -czf "%BACKUP_DIR%\%PROJECT_NAME%_media_backup_%DATE%.tar.gz" media_files/
    if %errorlevel% equ 0 (
        echo ✅ Media files backup completed: %PROJECT_NAME%_media_backup_%DATE%.tar.gz
    ) else (
        echo ❌ Media files backup failed
    )
) else (
    echo ⚠️  Media files directory not found
)

REM 3. Static Files Backup
echo 🎨 Backing up static files...
if exist "static_files" (
    tar -czf "%BACKUP_DIR%\%PROJECT_NAME%_static_backup_%DATE%.tar.gz" static_files/
    if %errorlevel% equ 0 (
        echo ✅ Static files backup completed: %PROJECT_NAME%_static_backup_%DATE%.tar.gz
    ) else (
        echo ❌ Static files backup failed
    )
) else (
    echo ⚠️  Static files directory not found
)

REM 4. Configuration Files Backup
echo ⚙️  Backing up configuration files...
tar -czf "%BACKUP_DIR%\%PROJECT_NAME%_config_backup_%DATE%.tar.gz" docker-compose.yaml .env requirements.txt Dockerfile
if %errorlevel% equ 0 (
    echo ✅ Configuration backup completed: %PROJECT_NAME%_config_backup_%DATE%.tar.gz
) else (
    echo ❌ Configuration backup failed
)

REM 5. Docker Images Backup
echo 🐳 Backing up Docker images...
docker save mediacms_web:latest | gzip > "%BACKUP_DIR%\%PROJECT_NAME%_web_image_%DATE%.tar.gz"
docker save mediacms_celery_worker:latest | gzip > "%BACKUP_DIR%\%PROJECT_NAME%_celery_image_%DATE%.tar.gz"
if %errorlevel% equ 0 (
    echo ✅ Docker images backup completed
) else (
    echo ❌ Docker images backup failed
)

REM 6. Create backup manifest
echo 📋 Creating backup manifest...
(
echo MediaCMS Backup Manifest
echo =======================
echo Date: %DATE%
echo Backup Directory: %BACKUP_DIR%
echo.
echo Files Created:
echo - %PROJECT_NAME%_db_backup_%DATE%.sql.gz ^(Database^)
echo - %PROJECT_NAME%_media_backup_%DATE%.tar.gz ^(Media Files^)
echo - %PROJECT_NAME%_static_backup_%DATE%.tar.gz ^(Static Files^)
echo - %PROJECT_NAME%_config_backup_%DATE%.tar.gz ^(Configuration^)
echo - %PROJECT_NAME%_web_image_%DATE%.tar.gz ^(Web Docker Image^)
echo - %PROJECT_NAME%_celery_image_%DATE%.tar.gz ^(Celery Docker Image^)
echo.
echo System Information:
echo - OS: %OS%
echo - Docker Version: 
docker --version
echo.
echo Backup Size:
dir "%BACKUP_DIR%\%PROJECT_NAME%_*_%DATE%.*" /s
) > "%BACKUP_DIR%\%PROJECT_NAME%_backup_manifest_%DATE%.txt"

echo ✅ Backup manifest created: %PROJECT_NAME%_backup_manifest_%DATE%.txt

echo.
echo 🎉 Backup completed successfully!
echo 📁 Backup location: %BACKUP_DIR%
echo.
echo 📋 Backup files:
dir "%BACKUP_DIR%\%PROJECT_NAME%_*_%DATE%.*" /b

echo.
echo 💡 To restore this backup, use: restore.bat %DATE%

endlocal

