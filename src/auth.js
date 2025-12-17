/**
 * Antigravity 认证和Token刷新模块
 * 支持HTTP和SOCKS5代理
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Antigravity OAuth配置 (从CLIProxyAPI提取)
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// 代理配置 - 优先从配置文件读取，fallback到环境变量
let proxyConfig = null;
const PROXY_CONFIG_FILE = path.join(__dirname, '..', 'config', 'proxy.json');

/**
 * 加载代理配置
 */
function loadProxyConfig() {
  try {
    if (fs.existsSync(PROXY_CONFIG_FILE)) {
      const content = fs.readFileSync(PROXY_CONFIG_FILE, 'utf-8');
      proxyConfig = JSON.parse(content);
      if (proxyConfig.enabled && proxyConfig.url) {
        console.log(`Proxy loaded from config: ${proxyConfig.type || 'http'} ${proxyConfig.url}`);
      }
      return proxyConfig;
    }
  } catch (e) {
    console.error('Failed to load proxy config:', e.message);
  }
  return null;
}

/**
 * 保存代理配置
 */
function saveProxyConfig(config) {
  try {
    const configDir = path.dirname(PROXY_CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(PROXY_CONFIG_FILE, JSON.stringify(config, null, 2));
    proxyConfig = config;
    return true;
  } catch (e) {
    console.error('Failed to save proxy config:', e.message);
    return false;
  }
}

/**
 * 获取当前代理配置
 */
function getProxyConfig() {
  if (!proxyConfig) {
    loadProxyConfig();
  }
  return proxyConfig;
}

/**
 * 获取有效的代理URL
 */
function getProxyUrl() {
  const config = getProxyConfig();
  if (config && config.enabled && config.url) {
    return config.url;
  }
  // Fallback to environment variable
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.http_proxy || process.env.https_proxy;
}

/**
 * 获取代理类型
 */
function getProxyType() {
  const config = getProxyConfig();
  if (config && config.enabled && config.type) {
    return config.type;
  }
  const proxyUrl = getProxyUrl();
  if (proxyUrl) {
    if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks://')) {
      return 'socks5';
    }
    if (proxyUrl.startsWith('socks4://')) {
      return 'socks4';
    }
  }
  return 'http';
}

// 初始化加载代理配置
loadProxyConfig();

/**
 * 发起HTTPS请求（支持HTTP和SOCKS5代理）
 */
function httpsRequestWithProxy(targetUrl, options, postData) {
  return new Promise((resolve, reject) => {
    const targetUrlObj = new URL(targetUrl);
    const proxyUrl = getProxyUrl();
    const proxyType = getProxyType();
    
    if (proxyUrl) {
      console.log(`Using ${proxyType} proxy: ${proxyUrl}`);
      
      if (proxyType === 'socks5' || proxyType === 'socks4') {
        // SOCKS代理
        const agent = new SocksProxyAgent(proxyUrl);
        
        const reqOptions = {
          ...options,
          hostname: targetUrlObj.hostname,
          path: targetUrlObj.pathname + targetUrlObj.search,
          agent: agent
        };
        
        const req = https.request(reqOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, data });
          });
        });
        
        req.on('error', reject);
        req.setTimeout(15000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        if (postData) {
          req.write(postData);
        }
        req.end();
      } else {
        // HTTP代理 - 使用CONNECT隧道
        const proxyUrlObj = new URL(proxyUrl);
        
        const connectOptions = {
          hostname: proxyUrlObj.hostname,
          port: proxyUrlObj.port || 7890,
          method: 'CONNECT',
          path: `${targetUrlObj.hostname}:443`,
          headers: {
            Host: `${targetUrlObj.hostname}:443`
          }
        };
        
        const connectReq = http.request(connectOptions);
        
        connectReq.on('connect', (res, socket) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
            return;
          }
          
          const httpsOptions = {
            ...options,
            hostname: targetUrlObj.hostname,
            path: targetUrlObj.pathname + targetUrlObj.search,
            socket: socket,
            agent: false
          };
          
          const req = https.request(httpsOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              resolve({ statusCode: res.statusCode, data });
            });
          });
          
          req.on('error', reject);
          if (postData) {
            req.write(postData);
          }
          req.end();
        });
        
        connectReq.on('error', reject);
        connectReq.setTimeout(15000, () => {
          connectReq.destroy();
          reject(new Error('Proxy connection timeout'));
        });
        connectReq.end();
      }
    } else {
      // 直接发送请求
      const reqOptions = {
        ...options,
        hostname: targetUrlObj.hostname,
        path: targetUrlObj.pathname + targetUrlObj.search
      };
      
      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data });
        });
      });
      
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (postData) {
        req.write(postData);
      }
      req.end();
    }
  });
}

/**
 * 读取auth JSON文件
 * @param {string} filePath - auth文件路径
 * @returns {Object} auth数据
 */
function loadAuthFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存auth JSON文件
 * @param {string} filePath - auth文件路径
 * @param {Object} authData - auth数据
 */
function saveAuthFile(filePath, authData) {
  fs.writeFileSync(filePath, JSON.stringify(authData, null, 2), 'utf-8');
}

/**
 * 检查token是否过期
 * @param {Object} authData - auth数据
 * @returns {boolean} 是否过期
 */
function isTokenExpired(authData) {
  if (!authData.expired) {
    // 使用timestamp + expires_in计算
    if (authData.timestamp && authData.expires_in) {
      const expiryTime = authData.timestamp + (authData.expires_in * 1000);
      return Date.now() >= expiryTime - 60000; // 提前1分钟刷新
    }
    return true;
  }
  
  const expiryDate = new Date(authData.expired);
  return Date.now() >= expiryDate.getTime() - 60000; // 提前1分钟刷新
}

/**
 * 刷新access_token
 * @param {Object} authData - auth数据
 * @returns {Promise<Object>} 更新后的auth数据
 */
async function refreshToken(authData) {
  const postData = new URLSearchParams({
    client_id: ANTIGRAVITY_CLIENT_ID,
    client_secret: ANTIGRAVITY_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: authData.refresh_token
  }).toString();

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'antigravity/1.11.5 windows/amd64'
    }
  };

  const response = await httpsRequestWithProxy(OAUTH_TOKEN_URL, options, postData);
  
  if (response.statusCode !== 200) {
    throw new Error(`Token refresh failed: ${response.statusCode} - ${response.data}`);
  }
  
  const tokenResp = JSON.parse(response.data);
  const now = Date.now();
  
  // 更新auth数据
  const updatedAuth = {
    ...authData,
    access_token: tokenResp.access_token,
    expires_in: tokenResp.expires_in,
    timestamp: now,
    expired: new Date(now + tokenResp.expires_in * 1000).toISOString()
  };
  
  // 如果返回了新的refresh_token，也更新它
  if (tokenResp.refresh_token) {
    updatedAuth.refresh_token = tokenResp.refresh_token;
  }
  
  return updatedAuth;
}

/**
 * 确保有有效的access_token
 * @param {Object} authData - auth数据
 * @param {string} filePath - auth文件路径（用于保存刷新后的token）
 * @returns {Promise<Object>} 有效的auth数据
 */
async function ensureValidToken(authData, filePath) {
  if (!isTokenExpired(authData)) {
    return authData;
  }
  
  console.log(`Token expired for ${authData.email}, refreshing...`);
  const updatedAuth = await refreshToken(authData);
  
  // 保存刷新后的token
  if (filePath) {
    saveAuthFile(filePath, updatedAuth);
    console.log(`Token refreshed and saved for ${authData.email}`);
  }
  
  return updatedAuth;
}

/**
 * 扫描config目录获取所有auth文件
 * @param {string} configDir - config目录路径
 * @returns {Array<{filePath: string, authData: Object}>} auth文件列表
 */
function scanAuthFiles(configDir) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(configDir);
  const authFiles = [];
  
  for (const file of files) {
    if (file.endsWith('.json') && file.startsWith('antigravity-')) {
      const filePath = path.join(configDir, file);
      try {
        const authData = loadAuthFile(filePath);
        if (authData.type === 'antigravity' && authData.refresh_token) {
          authFiles.push({ filePath, authData });
        }
      } catch (error) {
        console.error(`Failed to load auth file ${file}:`, error.message);
      }
    }
  }
  
  return authFiles;
}

/**
 * 生成OAuth登录URL
 * @param {string} redirectUri - 回调URL
 * @returns {Object} { url, state }
 */
function generateAuthUrl(redirectUri) {
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs"
  ];

  const params = new URLSearchParams({
    client_id: ANTIGRAVITY_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    state: state,
    prompt: 'consent'
  });

  return {
    url: `${OAUTH_AUTH_URL}?${params.toString()}`,
    state: state
  };
}

/**
 * 使用Authorization Code换取Token
 * @param {string} code - Authorization Code
 * @param {string} redirectUri - 回调URL
 * @returns {Promise<Object>} Token响应
 */
async function exchangeCodeForToken(code, redirectUri) {
  const postData = new URLSearchParams({
    code: code,
    client_id: ANTIGRAVITY_CLIENT_ID,
    client_secret: ANTIGRAVITY_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  }).toString();

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const response = await httpsRequestWithProxy(OAUTH_TOKEN_URL, options, postData);
  
  if (response.statusCode !== 200) {
    throw new Error(`Token exchange failed: ${response.statusCode} - ${response.data}`);
  }
  
  return JSON.parse(response.data);
}

/**
 * 获取用户信息
 * @param {string} accessToken - Access Token
 * @returns {Promise<Object>} 用户信息
 */
async function getUserInfo(accessToken) {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  const response = await httpsRequestWithProxy(USER_INFO_URL, options);
  
  if (response.statusCode !== 200) {
    throw new Error(`Failed to get user info: ${response.statusCode} - ${response.data}`);
  }
  
  return JSON.parse(response.data);
}

module.exports = {
  loadAuthFile,
  saveAuthFile,
  isTokenExpired,
  refreshToken,
  ensureValidToken,
  scanAuthFiles,
  httpsRequestWithProxy,
  generateAuthUrl,
  exchangeCodeForToken,
  getUserInfo,
  getProxyConfig,
  saveProxyConfig,
  getProxyUrl,
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET
};