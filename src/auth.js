/**
 * Antigravity 认证和Token刷新模块
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Antigravity OAuth配置 (从CLIProxyAPI提取)
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: authData.refresh_token
    }).toString();

    const url = new URL(OAUTH_TOKEN_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'antigravity/1.11.5 windows/amd64'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Token refresh failed: ${res.statusCode} - ${data}`));
          return;
        }
        
        try {
          const tokenResp = JSON.parse(data);
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
          
          resolve(updatedAuth);
        } catch (error) {
          reject(new Error(`Failed to parse token response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.write(postData);
    req.end();
  });
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

module.exports = {
  loadAuthFile,
  saveAuthFile,
  isTokenExpired,
  refreshToken,
  ensureValidToken,
  scanAuthFiles,
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET
};
