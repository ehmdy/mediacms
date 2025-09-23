FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create media directories
RUN mkdir -p /app/media /app/staticfiles

# Set permissions
RUN chmod +x deploy/docker/entrypoint.sh deploy/docker/prestart.sh

# Expose port
EXPOSE 8080

# Default command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]