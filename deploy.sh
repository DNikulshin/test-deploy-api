#!/usr/bin/env bash

# ==============================================================================
# Production Deployment Script for NestJS Backend with PostgreSQL
# ==============================================================================
# This script automates the configuration and launch of the production
# application stack as defined in docker-compose.prod.yml.
#
# It will:
# 1. Ask for your domain and email.
# 2. Update the Nginx configuration file.
# 3. Guide you to create/check the .env file with DB and JWT secrets.
# 4. Obtain an SSL certificate using Certbot.
# 5. Start the database service.
# 6. Apply Prisma database migrations.
# 7. Launch the full application stack (APIs, Nginx).
#
# Prerequisites:
# - Docker and Docker Compose must be installed.
# - You must be in the `backend` directory of the project.
# - Your domain's DNS A record must point to this server's IP.
# ==============================================================================

# Stop script on any command that fails
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

# --- Step 1: Sanity Checks ---
echo_color "yellow" "--> Performing system checks..."

if ! [ -x "$(command -v docker)" ] || ! docker compose version &>/dev/null; then
    echo_color "red" "Error: Docker and/or Docker Compose V2 are not installed."
    exit 1
fi

if [ ! -f "docker-compose.prod.yml" ] || [ ! -f "nginx.prod.conf" ]; then
    echo_color "red" "Error: Critical files not found. Run from the 'backend' directory."
    exit 1
fi

echo_color "green" "System checks passed."

# --- Step 2: Gather User Input ---
echo_color "yellow" "\n--> Please provide your deployment details:"

read -p "Enter your full domain name (e.g., api.example.com): " RAW_DOMAIN_NAME
read -p "Enter your email address (for Let's Encrypt SSL): " EMAIL_ADDRESS

# Clean the domain name
DOMAIN_NAME=$(echo "$RAW_DOMAIN_NAME" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

if [ -z "$DOMAIN_NAME" ] || [ -z "$EMAIL_ADDRESS" ]; then
    echo_color "red" "Domain name and email cannot be empty. Aborting."
    exit 1
fi

echo_color "green" "Configuration received. Using clean domain: $DOMAIN_NAME"

# --- Step 3: Configure Files ---
echo_color "yellow" "\n--> Updating configuration files with your domain..."

# Create a backup on first run
if [ ! -f "nginx.prod.conf.bak" ]; then
    cp nginx.prod.conf nginx.prod.conf.bak
fi

# Restore from backup to ensure we have a clean template
cp nginx.prod.conf.bak nginx.prod.conf

sed -i "s|your-domain.com|$DOMAIN_NAME|g" nginx.prod.conf
echo_color "green" "Nginx configuration updated."

# --- Step 4: Check for .env file ---
if [ ! -f ".env" ]; then
    echo_color "red" "\n[ACTION REQUIRED] '.env' file not found!"
    echo_color "yellow" "I will create a template .env file. You MUST edit it and add your secret values."
    
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
    echo_color "green" "'.env' file created with default values and random JWT secrets."
    echo_color "yellow" "It is highly recommended to change POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB."
fi

read -p "Please check your .env file. Press [Enter] to continue..."


# --- Step 5: Clean up previous runs ---
echo_color "yellow" "\n--> Stopping any running services and removing old data volumes..."
docker-compose -f docker-compose.prod.yml down -v --remove-orphans

# --- Step 6: Obtain SSL Certificate ---
echo_color "yellow" "\n--> Preparing to obtain SSL certificate..."
docker-compose -f docker-compose.prod.yml up -d nginx

echo_color "yellow" "--> Requesting certificate for $DOMAIN_NAME..."

# Temporarily disable exit-on-error to handle Certbot's exit codes
set +e
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot --webroot-path /var/www/certbot/ \
    -d "$DOMAIN_NAME" --email "$EMAIL_ADDRESS" \
    --agree-tos --no-eff-email --force-renewal
CERTBOT_EXIT_CODE=$?
set -e # Re-enable exit-on-error

if [ $CERTBOT_EXIT_CODE -ne 0 ]; then
    echo_color "yellow" "Certbot command finished with a non-zero exit code: $CERTBOT_EXIT_CODE."
    echo_color "yellow" "This is often okay if a certificate already exists. Checking..."
    
    set +e
    # Hide noisy output from this check
    docker-compose -f docker-compose.prod.yml run --rm --entrypoint "" certbot test -d "/etc/letsencrypt/live/$DOMAIN_NAME" > /dev/null 2>&1
    CHECK_EXIT_CODE=$?
    set -e

    if [ $CHECK_EXIT_CODE -ne 0 ]; then
        echo_color "red" "CRITICAL: Certbot failed and no existing certificate was found."
        echo_color "red" "Please check the logs above for the exact error from Certbot."
        echo_color "red" "Most common reason: Your domain's DNS record is not yet pointing to this server."
        echo_color "red" "Aborting script."
        docker-compose -f docker-compose.prod.yml down # Clean up
        exit 1
    fi
    echo_color "green" "An existing certificate was found. Proceeding with deployment."
fi

echo_color "green" "SSL certificate is in place."
docker-compose -f docker-compose.prod.yml down

# --- Step 7: Apply Database Migrations ---
echo_color "yellow" "\n--> Starting database service to apply migrations..."
docker-compose -f docker-compose.prod.yml up -d database

echo_color "yellow" "--> Waiting for the database to initialize... (10 seconds)"
sleep 10

echo_color "yellow" "--> Applying Prisma migrations..."
docker-compose -f docker-compose.prod.yml run --rm api1 npx prisma migrate deploy

echo_color "green" "Database migrations applied successfully."


# --- Step 8: Launch the Full Application ---
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
