# VPS Deployment Guide (Ubuntu 22.04)

This guide explains how to deploy the Security Scanning SaaS on a fresh VPS.

## 1. Initial VPS Setup
Login to your VPS via SSH and run these commands to install Docker and Docker-compose:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo apt install docker-compose -y

# CRITICAL: Fix Docker Socket Permissions for the Scanner
sudo chmod 666 /var/run/docker.sock
```

## 2. Clone the Project
```bash
# Clone your repository
git clone https://github.com/Sameer-Malik20/SecurityModel.git
cd SecurityModel
```

## 3. Configure Environment Variables
Since `.env` files are ignored by Git for security, you must create them manually on the VPS.

```bash
# Go to backend folder
cd backend

# Create .env file
nano .env
```

Paste your actual keys in the file:
```env
SECRET_KEY=your_secure_secret_key
OPENROUTER_API_KEY=your_openrouter_key
GITHUB_TOKEN=your_github_personal_access_token
MONGODB_URL=mongodb://mongodb:27017/security_db
```
*(Press Ctrl+O, then Enter to save. Press Ctrl+X to exit.)*

**Go back to the root folder:**
```bash
cd ..
```

## 4. One-Time Setup for Frontend API URL
The Frontend needs to know where the Backend is. If you are using a VPS IP, you need to update the `docker-compose.yml` file.

```bash
nano docker-compose.yml
```
Find the line: `- NEXT_PUBLIC_API_URL=http://localhost:8000`
Change `localhost` to your **VPS Public IP Address**.
Example: `- NEXT_PUBLIC_API_URL=http://123.45.67.89:8000`

## 5. Launch the Application
Run this command from the root directory (where `docker-compose.yml` is located):

```bash
docker-compose up --build -d
```

## 6. Verification
- **Frontend:** Accessible at `http://your-vps-ip:3000`
- **Backend API:** Accessible at `http://your-vps-ip:8000`
- **MongoDB:** Running internally, data persisted in VPS storage.

## Troubleshooting
- If ZAP scans fail, double check `sudo chmod 666 /var/run/docker.sock`.
- To check logs: `docker-compose logs -f`
- To stop everything: `docker-compose down`
