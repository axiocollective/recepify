FROM python:3.11-slim-bookworm

# Install ffmpeg for TikTok imports and cleanup apt artifacts
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl bash ca-certificates tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m playwright install --with-deps chromium

COPY backend/ ./
RUN find /app -name "__pycache__" -type d -exec rm -rf {} + \
    && find /app -name "*.pyc" -delete
ENV PYTHONDONTWRITEBYTECODE=1

ENV PORT=8080
CMD ["bash", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
