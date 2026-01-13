FROM python:3.10-slim

# ---------------------------------------------------
# 1. Install System Dependencies + Build Tools
# ---------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    wget \
    curl \
    unzip \
    ca-certificates \
    coreutils \
    procps \
    gnupg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*


# Install JDK 17 (Temurin – Stable & Permanent URL)

# ---------------------------------------------------
# Install JDK 17 (Temurin – WORKING 2026 URL)
# ---------------------------------------------------
RUN wget -q https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13+11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz && \
    mkdir -p /usr/lib/jvm && \
    tar -xzf OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz -C /usr/lib/jvm && \
    rm OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz && \
    mv /usr/lib/jvm/jdk-17.0.13+11 /usr/lib/jvm/jdk-17

ENV JAVA_HOME=/usr/lib/jvm/jdk-17
ENV PATH="$JAVA_HOME/bin:$PATH"




# Install Node.js (LTS) - Required for JS/TS build
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

RUN npm install -g yarn pnpm

# Install Go (optional but good coverage)
RUN wget -q https://go.dev/dl/go1.21.6.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz && \
    rm go1.21.6.linux-amd64.tar.gz

ENV PATH=$PATH:/usr/local/go/bin:/root/go/bin

# Install Semgrep
ENV SEMGREP_SEND_METRICS=off
ENV SEMGREP_SKIP_VERSION_CHECK=1
ENV SEMGREP_OFFLINE=1

RUN pip install --upgrade pip && pip install semgrep

# Install CodeQL (LATEST stable supports overlays)
RUN mkdir -p /opt/tools && \
    wget -q https://github.com/github/codeql-cli-binaries/releases/download/v2.23.9/codeql-linux64.zip -O codeql.zip && \
    unzip -q codeql.zip -d /opt/tools && \
    rm codeql.zip

ENV PATH="/opt/tools/codeql:/usr/local/go/bin:/root/go/bin:/usr/local/bin:${PATH}"

RUN codeql version

# Clean old packs
RUN rm -rf /root/.codeql/packages

# Install main packs (auto-resolves correct versions)
RUN codeql pack download codeql/javascript-queries && \
    codeql pack download codeql/python-queries && \
    codeql pack download codeql/java-queries && \
    codeql pack download codeql/go-queries

RUN codeql resolve qlpacks

# Application Setup
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "saas_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
