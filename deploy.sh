#!/usr/bin/env bash

# ==============================================================================
# Production Deployment Script for NestJS Backend with PostgreSQL
# ==============================================================================
# This script automates the configuration and launch of the production
# application stack as defined in docker-compose.prod.yml.
#
# It will:
# 1. Ask for your domain and email.
# 2. Generate configuration files from templates.
# 3. Guide you to create/check the .env file.
# 4. Obtain an SSL certificate using a secure, temporary Nginx instance.
# 5. Launch the full application stack (APIs, Nginx, Database).
# ==============================================================================

set -e

# --- Helper function for colored output ---
echo_color() {
    case "$1" in
        "green") echo -e "\033[32m$2\033[0m" ;;
        "red") echo -e "\033[31m$2\033[0m" ;;
        "yellow") echo -e "\033[33m$2\033[0m" ;;
        *) echo "$2" ;;
    esac
}

# --- Start of Script ---
echo_color "green" "=== Starting Production Deployment Script ==="

# --- Step 1: System Checks ---
echo_color "yellow" "--> Performing system checks..."
if ! [ -x "$(command -v docker)" ] || ! [ -x "$(command -v docker-compose)" ]; then
    echo_color "red" "Error: Docker and/or Docker Compose are not installed." >&2
    exit 1
fi
echo_color "green" "System checks passed."

# --- Step 2: Gather User Input ---
echo_color "yellow" "\n--> Please provide your deployment details:"
read -p "Enter your full domain name (e.g., api.example.com): " RAW_DOMAIN_NAME
read -p "Enter your email address (for Let's Encrypt SSL): " EMAIL_ADDRESS

DOMAIN_NAME=$(echo "$RAW_DOMAIN_NAME" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

if [ -z "$DOMAIN_NAME" ] || [ -z "$EMAIL_ADDRESS" ]; then
    echo_color "red" "Domain name and email cannot be empty. Aborting." >&2
    exit 1
fi
echo_color "green" "Configuration received. Using clean domain: $DOMAIN_NAME"

# --- Step 3: Configure Files from Templates ---
echo_color "yellow" "\n--> Generating configuration files from templates..."

cp nginx.prod.template nginx.prod.conf
cp nginx.certbot.template nginx.certbot.conf

# Using a different delimiter for sed to avoid issues with file paths
sed -i "s|your-domain.com|$DOMAIN_NAME|g" nginx.prod.conf
sed -i "s|your-domain.com|$DOMAIN_NAME|g" nginx.certbot.conf

echo_color "green" "Nginx configurations generated."

# --- Step 4: Check for .env file ---
if [ ! -f ".env" ]; then
    echo_color "red" "\n[ACTION REQUIRED] '.env' file not found!"
    echo_color "yellow" "Creating a template .env file. You MUST edit it and add your secret values."

    JWT_ACCESS_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)

    cat > .env << EOL
# --- Production Environment Variables ---
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mystrongpassword
POSTGRES_DB=mydb
DATABASE_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@database:5432/\${POSTGRES_DB}?sslmode=prefer"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
PORT=3000
EOL
    echo_color "green" "'.env' file created with default values."
    echo_color "yellow" "It is highly recommended to change POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB."
fi

read -p "Please check your .env file and press [Enter] to continue..."

# --- Step 5: Clean up previous runs ---
echo_color "yellow" "\n--> Stopping any running services and removing old data volumes..."
docker-compose -f docker-compose.prod.yml down -v --remove-orphans || true
docker-compose -f docker-compose.certbot.yml down -v --remove-orphans || true

# --- Step 6: Obtain SSL Certificate (if needed) ---
echo_color "yellow" "\n--> Checking for existing SSL certificate..."

# We check by looking for the directory inside the certbot volume via a temporary container
set +e
docker-compose -f docker-compose.prod.yml run --rm --entrypoint "" certbot test -d "/etc/letsencrypt/live/$DOMAIN_NAME"
CERT_EXISTS_CODE=$?
set -e

if [ $CERT_EXISTS_CODE -eq 0 ]; then
    echo_color "green" "An existing SSL certificate was found. Skipping acquisition step."
else
    echo_color "yellow" "No certificate found. Attempting to obtain one from Let's Encrypt..."

    echo_color "yellow" "--> Starting temporary Nginx and Certbot services..."
    docker-compose -f docker-compose.certbot.yml up -d

    echo_color "yellow" "--> Requesting certificate for $DOMAIN_NAME..."
    docker-compose -f docker-compose.certbot.yml run --rm certbot certonly \
        --webroot --webroot-path /var/www/certbot \
        -d "$DOMAIN_NAME" --email "$EMAIL_ADDRESS" \
        --agree-tos --no-eff-email --non-interactive

    echo_color "yellow" "--> Shutting down temporary services (keeping volumes)..."
    docker-compose -f docker-compose.certbot.yml down

    # Check again to ensure the certificate was created successfully
    set +e
    docker-compose -f docker-compose.prod.yml run --rm --entrypoint "" certbot test -d "/etc/letsencrypt/live/$DOMAIN_NAME"
    CERT_CHECK_CODE=$?
    set -e

    if [ $CERT_CHECK_CODE -ne 0 ]; then
        echo_color "red" "CRITICAL: Certbot ran, but the certificate directory could not be found." >&2
        exit 1
    fi

    echo_color "green" "Successfully obtained and configured SSL certificate."
fi

# --- Step 7: Launch the Full Application ---
echo_color "yellow" "\n--> Building and launching the final application stack..."
docker-compose -f docker-compose.prod.yml up --build -d --remove-orphans

# --- Final Message ---
echo_color "green" "\n======================================================="
echo_color "green" "  🚀 DEPLOYMENT COMPLETE! 🚀"
echo_color "green" "Your application stack is now running."
echo_color "green" "Access your API at: https://$DOMAIN_NAME"
echo_color "green" "\nTo see logs, run: docker-compose -f docker-compose.prod.yml logs -f"
echo_color "green" "To stop, run: docker-compose -f docker-compose.prod.yml down"
echo_color "green" "======================================================="
