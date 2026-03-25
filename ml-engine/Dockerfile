FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app/

# Security: non-root user
RUN adduser --disabled-password --uid 1001 nonroot

# Create data directory for trained models — owned by nonroot
RUN mkdir -p /app/models && chown -R nonroot:nonroot /app/models
RUN chown -R nonroot:nonroot /app/app

USER nonroot

EXPOSE 8082

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8082/health'); exit(0 if r.status_code == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082", "--workers", "2"]
