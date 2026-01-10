#!/usr/bin/env bash

# ==============================================================================
# Simplified Production Deployment Script
# ==============================================================================
# This script automates the entire deployment process from a single file.
# It generates Nginx configs on the fly and uses a single Docker Compose file.
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
echo_color "green" "=== Starting Simplified Deployment Script ==="

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

# --- Step 3: Generate Nginx Configs On-the-fly ---
echo_color "yellow" "\n--> Generating Nginx configuration files..."

# Nginx config for Certbot challenge
cat > nginx.certbot.conf <<EOL
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOL

# Nginx config for the main application
cat > nginx.prod.conf <<EOL
upstream nestjs_api {
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

server {
    listen 80;
    server_name $DOMAIN_NAME;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    server_name $DOMAIN_NAME;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;

    # include /etc/letsencrypt/options-ssl-nginx.conf; # Optional: for stronger security
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;   # Optional: for stronger security

    location / {
        proxy_pass http://nestjs_api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

echo_color "green" "Nginx configurations generated."

# --- Step 4: Check for .env file ---
# ... (This part remains the same) ...

# --- Step 5: Clean up previous runs ---
echo_color "yellow" "\n--> Stopping any running services and removing old data volumes..."
docker-compose down -v --remove-orphans || true

# --- Step 6: Obtain SSL Certificate (if needed) ---
echo_color "yellow" "\n--> Checking for existing SSL certificate..."

set +e
docker-compose run --rm --entrypoint "" certbot test -d "/etc/letsencrypt/live/$DOMAIN_NAME"
CERT_EXISTS_CODE=$?
set -e

if [ $CERT_EXISTS_CODE -eq 0 ]; then
    echo_color "green" "An existing SSL certificate was found."
else
    echo_color "yellow" "No certificate found. Attempting to obtain one..."

    echo_color "yellow" "--> Starting temporary Nginx for validation..."
    docker-compose up -d nginx-certbot

    echo_color "yellow" "--> Requesting certificate..."
    docker-compose run --rm certbot certonly \
        --webroot --webroot-path /var/www/certbot -d "$DOMAIN_NAME" \
        --email "$EMAIL_ADDRESS" --agree-tos --no-eff-email --non-interactive

    echo_color "yellow" "--> Shutting down temporary Nginx..."
    docker-compose stop nginx-certbot
    echo_color "green" "Certificate obtained successfully."
fi

# --- Step 7: Launch the Full Application ---
echo_color "yellow" "\n--> Building and launching the final application stack..."
# We specify the services to launch to exclude the certbot-only services
docker-compose up --build -d --remove-orphans api1 api2 api3 database nginx

# --- Final Cleanup and Message ---
rm nginx.certbot.conf nginx.prod.conf

echo_color "green" "\n======================================================="
echo_color "green" "  🚀 DEPLOYMENT COMPLETE! 🚀"
echo_color "green" "Your application is running at: https://$DOMAIN_NAME"
echo_color "green" "======================================================="
