# Antigravity Quota Web Panel

English | [中文](README.md)

A web panel for real-time monitoring of Antigravity model usage quotas.

## Preview

![Preview](images/preview.png)

## Features

- 📊 **Real-time Monitoring** - View remaining quota percentages for all models
- ⏰ **Reset Timer** - Display countdown to quota reset
- 🔄 **Auto Refresh** - Configurable refresh intervals (30s/1m/2m/5m/10m)
- 👥 **Multi-account Support** - Monitor multiple Antigravity accounts simultaneously
- 🔐 **Auto Token Refresh** - Automatically refresh expired access_token using refresh_token
- 📤 **Easy Upload** - Upload auth JSON files directly through the web interface
- 🔗 **CLIProxyAPI Compatible** - Directly use auth files from CLIProxyAPI without conversion
- 🌐 **Proxy Support** - HTTP/SOCKS5/SOCKS4 proxy support with UI configuration
- 🌍 **Bilingual** - English and Chinese interface switching
- 🐳 **Docker Support** - Docker containerized deployment

## Installation

### Option 1: Local Installation

```bash
# Navigate to project directory
cd antigravity-quota-web

# Install dependencies
npm install

# Start the server
npm start
```

### Option 2: Docker Deployment (Recommended)

```bash
# Navigate to project directory
cd antigravity-quota-web

# Build and start container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down

# Rebuild (after code updates)
docker-compose up -d --build
```

Or run directly with Docker command:

```bash
# Build image
docker build -t antigravity-quota-web .

# Run container
docker run -d \
  --name antigravity-quota-web \
  -p 3078:3078 \
  -v $(pwd)/config:/app/config \
  --restart unless-stopped \
  antigravity-quota-web
```

## Usage

### 1. Add Auth Files

Copy your Antigravity auth JSON files to the `config` directory:

```bash
# Create config directory
mkdir -p config

# Copy auth file
cp /path/to/antigravity-yourname.json config/
```

Auth file format example:
```json
{
  "access_token": "ya29.xxx...",
  "refresh_token": "1//xxx...",
  "email": "user@gmail.com",
  "expires_in": 3599,
  "timestamp": 1702500000000,
  "type": "antigravity"
}
```

### 2. Start the Server

```bash
# Local run
npm start

# Or Docker run
docker-compose up -d
```

The server runs at http://localhost:3078 by default.

### 3. Access Web Panel

Open your browser and navigate to http://localhost:3078

### 4. Configure Proxy (Optional)

If you need to access Google API through a proxy:

1. Click the ⚙️ gear icon in the top right corner
2. Enable proxy and select proxy type (HTTP/SOCKS5/SOCKS4)
3. Enter proxy address, for example:
   - HTTP proxy: `127.0.0.1:7890`
   - SOCKS5 proxy: `127.0.0.1:7891`
4. Click "Test" to verify connection
5. Click "Save" to apply settings

Proxy configuration is saved to `config/proxy.json` and automatically loaded on restart.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/accounts` | GET | Get all account list |
| `/api/quota` | GET | Get quota info for all accounts |
| `/api/quota/:email` | GET | Get quota info for specific account |
| `/api/refresh/:email` | POST | Refresh token for specific account |
| `/api/upload` | POST | Upload new auth file |
| `/api/proxy` | GET | Get proxy configuration |
| `/api/proxy` | POST | Save proxy configuration |
| `/api/proxy/test` | POST | Test proxy connection |
| `/api/health` | GET | Health check |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3078 | Server port |
| `CONFIG_DIR` | ./config | Auth files directory |
| `HTTPS_PROXY` | - | HTTP(S) proxy URL (fallback, UI config takes priority) |

Example:
```bash
# Local run
PORT=8080 CONFIG_DIR=/data/auth npm start

# Docker run (modify environment variables in docker-compose.yml)
```

## Docker Configuration

`docker-compose.yml` options:

| Option | Description |
|--------|-------------|
| `ports: "3078:3078"` | Port mapping, can be changed to other ports like `"8080:3078"` |
| `volumes: ./config:/app/config` | Config directory mount for persistent auth files and proxy config |
| `restart: unless-stopped` | Auto restart on container crash |
| `healthcheck` | Health check to ensure service is running |

## Project Structure

```
antigravity-quota-web/
├── package.json          # Project configuration
├── README.md             # English documentation
├── README_CN.md          # Chinese documentation
├── Dockerfile            # Docker image build file
├── docker-compose.yml    # Docker Compose configuration
├── .dockerignore         # Docker build ignore file
├── src/
│   ├── index.js          # Main entry / Web server
│   ├── auth.js           # Token refresh and proxy logic
│   └── quota.js          # Quota query logic
├── public/
│   ├── index.html        # Web interface
│   ├── style.css         # Styles
│   └── app.js            # Frontend script
└── config/               # Configuration files directory
    ├── antigravity-*.json  # Auth files
    └── proxy.json          # Proxy config (auto-generated)
```

## Status Indicators

| Icon | Status | Description |
|------|--------|-------------|
| 🟢 | Healthy | Remaining quota ≥ 50% |
| 🟡 | Warning | Remaining quota 30%-50% |
| 🔴 | Critical | Remaining quota < 30% |
| ⚫ | Exhausted | Quota depleted |
| ⚪ | Unknown | Unable to get quota info |

## Notes

1. **Security**: This tool is intended for local or intranet use only. Do not expose to public network.
2. **Token Security**: Auth files contain sensitive credentials. Keep them secure.
3. **API Limits**: Avoid frequent refreshing to prevent triggering Google API rate limits.
4. **Docker Permissions**: Ensure the config directory has read/write permissions for the container.
5. **Proxy Config**: Proxy settings are saved in config/proxy.json and auto-loaded on service restart.

## License

MIT License
