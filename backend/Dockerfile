FROM python:3.10-slim

# 1. Install System Dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    wget \
    curl \
    unzip \
    ca-certificates \
    coreutils \
    procps \
    gnupg \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*
    
# Disabling Semgrep metrics to prevent network crashes in minimal environments
ENV SEMGREP_SEND_METRICS=off
ENV SEMGREP_SKIP_VERSION_CHECK=1
ENV SEMGREP_METRICS=off
# Force offline scan to avoid auth checks
ENV SEMGREP_OFFLINE=1

# 2. Install Go (Required for tools)
RUN wget -q https://go.dev/dl/go1.21.6.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz && \
    rm go1.21.6.linux-amd64.tar.gz
ENV PATH=$PATH:/usr/local/go/bin:/root/go/bin

# Install Semgrep specifically via pip and ensure it's in PATH
RUN pip install --upgrade pip && \
    pip install semgrep

# 3. Install Security Tools



# Install Gospider (Go Install)
RUN go install github.com/jaeles-project/gospider@latest

# Install CodeQL (v2.23.9 — FULL JS overlay support)
RUN mkdir -p /opt/tools && \
    wget -q https://github.com/github/codeql-cli-binaries/releases/download/v2.23.9/codeql-linux64.zip -O codeql.zip && \
    unzip -q codeql.zip -d /opt/tools && \
    rm codeql.zip

ENV PATH="/opt/tools/codeql:/usr/local/go/bin:/root/go/bin:/usr/local/bin:${PATH}"

RUN codeql version

# Remove any old packs (critical)
RUN rm -rf /root/.codeql/packages

# Install latest compatible packs
RUN codeql pack download codeql/javascript-queries && \
    codeql pack download codeql/python-queries

# Rebuild pack registry
RUN codeql resolve qlpacks


# 5. Application Setup
WORKDIR /app

# Install dependencies first (caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Expose Service
EXPOSE 8000

# Run Application
CMD ["uvicorn", "saas_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
