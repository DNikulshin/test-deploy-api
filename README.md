
# NestJS Backend API

This directory contains the source code for the backend of the application, built with [NestJS](https://nestjs.com/), a progressive Node.js framework.

## Key Features

*   **RESTful API:** Provides endpoints for managing products, users, authentication, orders, and more.
*   **Database:** Uses Prisma ORM for database interactions.
*   **Authentication:** Implemented with JWT (JSON Web Tokens), including access and refresh tokens.
*   **Dockerized:** Fully containerized for consistent development and easy production deployment.

---

## Production Deployment Guide (VPS with Docker)

This guide outlines the steps to deploy the backend application to a production environment on a Virtual Private Server (VPS) using Docker and Docker Compose.

The production architecture is designed to be scalable, secure, and easy to manage. It consists of:

*   **Three instances** of the NestJS API for load balancing and high availability.
*   An **Nginx** container acting as a reverse proxy and load balancer.
*   A **Certbot** container for automatically obtaining and renewing SSL certificates from Let's Encrypt, enabling HTTPS.

### Prerequisites

1.  A VPS (e.g., from DigitalOcean, Vultr, AWS).
2.  A registered domain name with its DNS `A` record pointing to your VPS's IP address.
3.  **Docker** and **Docker Compose** installed on the VPS.
4.  **Git** installed on the VPS.

### Configuration Files

The deployment is managed by three key files in the `backend` directory:

*   `docker-compose.prod.yml`: Orchestrates the `api`, `nginx`, and `certbot` services.
*   `nginx.prod.conf`: The Nginx configuration file for reverse proxy, load balancing, and handling SSL.
*   `.env`: A file (which you must create) to store all secret environment variables like database URLs and JWT secrets. **This file must not be committed to Git.**

### Deployment Steps

#### Step 1: Initial Server Setup

1.  Connect to your VPS via SSH.
2.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd <repository-name>/backend
    ```

#### Step 2: Configure the Environment

1.  **Create the environment file.** Copy the contents of `run-dev.js` or create a new `.env` file and fill it with your production values (database connection string, JWT secrets, etc.).

    ```bash
    # Example .env file
    DATABASE_URL="postgresql://user:password@host:port/database?sslmode=prefer"
    JWT_ACCESS_SECRET="your_super_secret_access_key"
    JWT_REFRESH_SECRET="your_super_secret_refresh_key"
    # ... other variables
    ```

2.  **Update the domain name.** You must replace the placeholder `your-domain.com` with your actual domain name in two files:
    *   `nginx.prod.conf`
    *   `docker-compose.prod.yml` (in the `certbot` service command)

#### Step 3: Obtain Initial SSL Certificate

To get an SSL certificate, Nginx must be running to prove to Let's Encrypt that you control the domain.

1.  **Start the Nginx service:**
    ```bash
    docker-compose -f docker-compose.prod.yml up -d nginx
    ```

2.  **Run Certbot.** This command will request the certificate. Replace `your-domain.com` and `your-email@example.com` with your details.
    ```bash
    docker-compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d your-domain.com --email your-email@example.com --agree-tos --no-eff-email
    ```
    If successful, the certificates will be stored in the `backend/certbot/conf` directory, which is mapped into the Nginx container.

#### Step 4: Launch the Full Application

Now that you have the certificates, you can stop the temporary Nginx instance and launch the entire application stack.

1.  **Stop the temporary Nginx container:**
    ```bash
    docker-compose -f docker-compose.prod.yml down
    ```

2.  **Build and start all services:**
    ```bash
    docker-compose -f docker-compose.prod.yml up --build -d
    ```
    This command will:
    *   Build the `api` image from the `Dockerfile`.
    *   Start three containers from that API image.
    *   Start the `nginx` container, which will now use the SSL certificates.
    *   Start the `certbot` container, which will run in the background to automatically renew certificates every 12 hours.

Your application is now live and accessible at `https://your-domain.com`.

### Managing the Application

*   **View Logs:** To see the combined logs for all services in real-time:
    ```bash
    docker-compose -f docker-compose.prod.yml logs -f
    ```
*   **Stop Services:**
    ```bash
    docker-compose -f docker-compose.prod.yml down
    ```
*   **Update Application:** To deploy a new version of the code:
    ```bash
    git pull
    docker-compose -f docker-compose.prod.yml up --build -d
    ```
