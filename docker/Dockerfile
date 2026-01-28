# Multi-stage Dockerfile for uncensored model runner
# Hosts DavidAU/OpenAi-GPT-oss-20b-abliterated-uncensored-NEO-Imatrix-gguf:Q5_1

# Stage 1: Builder
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install llama-cpp-python for GGUF model inference
RUN pip install --no-cache-dir llama-cpp-python

# Create directories
RUN mkdir -p /app/models /app/cache

# Set environment variables
ENV MODEL_PATH=/app/models
ENV MODEL_NAME=DavidAU/OpenAi-GPT-oss-20b-abliterated-uncensored-NEO-Imatrix-gguf
ENV MODEL_QUANTIZATION=Q5_1
ENV HOST=0.0.0.0
ENV PORT=8000

# Copy application code
COPY app.py .
COPY model_downloader.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "app.py"]
