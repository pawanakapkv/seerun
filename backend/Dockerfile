FROM ubuntu:22.04

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install g++, gdb, python3, curl
RUN apt-get update && apt-get install -y \
    g++ \
    gdb \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Setup working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY server.js .
COPY tracer.py .

# Expose port
EXPOSE 8080

# Run the server
CMD ["node", "server.js"]
