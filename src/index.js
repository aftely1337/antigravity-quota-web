/**
 * Antigravity 余额查询 Web 服务器
 * 主入口文件
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const auth = require('./auth');
const quota = require('./quota');

const app = express();
const PORT = process.env.PORT || 3078;

// 配置目录
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', 'config');

// OAuth State存储 (简单内存存储)
const oauthStates = new Set();

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// 存储账号配额缓存
const quotaCache = new Map();

// 并发限制
const CONCURRENCY_LIMIT = 5;

/**
 * 带限流的并发执行 (改进版)
 */
async function runWithConcurrencyLimit(tasks, limit) {
  const results = [];
  const executing = new Set();
  
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    
    if (limit > 0) {
      const cleanup = p.finally(() => executing.delete(cleanup));
      executing.add(cleanup);
      
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}

/**
 * 统一错误处理中间件
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('Request error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}

/**
 * 获取所有账号列表
 */
app.get('/api/accounts', asyncHandler(async (req, res) => {
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  const accounts = authFiles.map(({ filePath, authData }) => ({
    email: authData.email || path.basename(filePath, '.json'),
    filePath: path.basename(filePath),
    type: authData.type,
    expired: authData.expired,
    isExpired: auth.isTokenExpired(authData)
  }));
  res.json({ success: true, accounts });
}));

/**
 * 获取指定账号的配额信息
 */
app.get('/api/quota/:email', asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  
  const authFile = auth.findAuthFileByEmail(authFiles, email);
  
  if (!authFile) {
    return res.status(404).json({ success: false, error: 'Account not found' });
  }
  
  const validAuth = await auth.ensureValidToken(authFile.authData, authFile.filePath);
  const quotaInfo = await quota.fetchModelsAndQuota(validAuth.access_token);
  
  const cacheKey = validAuth.email || email;
  quotaCache.set(cacheKey, {
    timestamp: new Date().toISOString(),
    data: quotaInfo
  });
  
  res.json({
    success: true,
    email: validAuth.email,
    quota: quotaInfo
  });
}));

/**
 * 获取所有账号的配额信息 (并发)
 */
app.get('/api/quota', asyncHandler(async (req, res) => {
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  
  const tasks = authFiles.map(({ filePath, authData }) => async () => {
    try {
      const validAuth = await auth.ensureValidToken(authData, filePath);
      const quotaInfo = await quota.fetchModelsAndQuota(validAuth.access_token);
      
      const cacheKey = validAuth.email || path.basename(filePath, '.json');
      quotaCache.set(cacheKey, {
        timestamp: new Date().toISOString(),
        data: quotaInfo
      });
      
      return {
        email: validAuth.email || path.basename(filePath, '.json'),
        success: true,
        quota: quotaInfo
      };
    } catch (error) {
      return {
        email: authData.email || path.basename(filePath, '.json'),
        success: false,
        error: error.message
      };
    }
  });
  
  const results = await runWithConcurrencyLimit(tasks, CONCURRENCY_LIMIT);
  res.json({ success: true, results });
}));

/**
 * 刷新指定账号的token
 */
app.post('/api/refresh/:email', asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  
  const authFile = auth.findAuthFileByEmail(authFiles, email);
  
  if (!authFile) {
    return res.status(404).json({ success: false, error: 'Account not found' });
  }
  
  const updatedAuth = await auth.refreshToken(authFile.authData);
  await auth.saveAuthFileAsync(authFile.filePath, updatedAuth);
  auth.invalidateCache();
  
  res.json({
    success: true,
    email: updatedAuth.email,
    expired: updatedAuth.expired
  });
}));

/**
 * 获取代理配置
 */
app.get('/api/proxy', (req, res) => {
  const config = auth.getProxyConfig();
  res.json({ 
    success: true, 
    proxy: config || { enabled: false, type: 'http', url: '' }
  });
});

/**
 * 保存代理配置
 */
app.post('/api/proxy', asyncHandler(async (req, res) => {
  const { enabled, type, url } = req.body;
  
  if (type && !['http', 'socks5', 'socks4'].includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid proxy type' });
  }
  
  if (enabled && url) {
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid proxy URL format' });
    }
  }
  
  const config = {
    enabled: !!enabled,
    type: type || 'http',
    url: url || ''
  };
  
  const result = await auth.saveProxyConfigAsync(config);
  if (result) {
    res.json({ success: true, proxy: config });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save proxy config' });
  }
}));

/**
 * 测试代理连接 (不修改配置文件)
 */
app.post('/api/proxy/test', asyncHandler(async (req, res) => {
  const { type, url } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'Proxy URL is required' });
  }
  
  const originalConfig = auth.getProxyConfig();
  
  auth.saveProxyConfig({ enabled: true, type: type || 'http', url });
  
  try {
    const testUrl = 'https://www.google.com';
    const startTime = Date.now();
    
    const response = await auth.httpsRequestWithProxy(testUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const latency = Date.now() - startTime;
    
    // 恢复原配置
    if (originalConfig) {
      auth.saveProxyConfig(originalConfig);
    } else {
      auth.saveProxyConfig({ enabled: false, type: 'http', url: '' });
    }
    
    if (response.statusCode >= 200 && response.statusCode < 400) {
      res.json({ success: true, latency, message: `Connected in ${latency}ms` });
    } else {
      res.json({ success: false, error: `HTTP ${response.statusCode}` });
    }
  } catch (testError) {
    // 恢复原配置
    if (originalConfig) {
      auth.saveProxyConfig(originalConfig);
    } else {
      auth.saveProxyConfig({ enabled: false, type: 'http', url: '' });
    }
    res.json({ success: false, error: testError.message });
  }
}));

/**
 * 上传新的auth文件
 */
app.post('/api/upload', express.text({ type: '*/*' }), asyncHandler(async (req, res) => {
  const authData = JSON.parse(req.body);
  
  if (!authData.refresh_token) {
    return res.status(400).json({ success: false, error: 'Invalid auth file: missing refresh_token' });
  }
  
  const email = authData.email || 'unknown';
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const fileName = `antigravity-${sanitizedEmail}.json`;
  const filePath = path.join(CONFIG_DIR, fileName);
  
  await fsPromises.mkdir(CONFIG_DIR, { recursive: true });
  await auth.saveAuthFileAsync(filePath, authData);
  auth.invalidateCache();
  
  res.json({
    success: true,
    message: 'Auth file uploaded successfully',
    fileName: fileName
  });
}));

/**
 * 删除账号
 */
app.delete('/api/accounts/:email', asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  
  const authFile = auth.findAuthFileByEmail(authFiles, email);
  
  if (!authFile) {
    return res.status(404).json({ success: false, error: 'Account not found' });
  }
  
  await auth.deleteAuthFileAsync(authFile.filePath);
  auth.invalidateCache();
  quotaCache.delete(email);
  
  res.json({ success: true, message: 'Account deleted successfully' });
}));

/**
 * 下载账号凭证
 */
app.get('/api/accounts/:email/download', asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  
  const authFile = auth.findAuthFileByEmail(authFiles, email);
  
  if (!authFile) {
    return res.status(404).json({ success: false, error: 'Account not found' });
  }
  
  const fileName = path.basename(authFile.filePath);
  res.download(authFile.filePath, fileName);
}));

/**
 * 启动OAuth登录流程
 */
app.get('/api/auth/login', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
  const { url, state } = auth.generateAuthUrl(redirectUri);
  
  oauthStates.add(state);
  setTimeout(() => oauthStates.delete(state), 5 * 60 * 1000);
  
  res.json({ success: true, url });
});

/**
 * OAuth回调处理
 */
app.get('/api/auth/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.status(400).send(`Authentication failed: ${error}`);
  }
  
  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }
  
  if (!oauthStates.has(state)) {
    return res.status(400).send('Invalid state');
  }
  
  oauthStates.delete(state);
  
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
  const tokenResp = await auth.exchangeCodeForToken(code, redirectUri);
  const userInfo = await auth.getUserInfo(tokenResp.access_token);
  
  const email = userInfo.email;
  const now = Date.now();
  
  const authData = {
    access_token: tokenResp.access_token,
    refresh_token: tokenResp.refresh_token,
    expires_in: tokenResp.expires_in,
    timestamp: now,
    expired: new Date(now + tokenResp.expires_in * 1000).toISOString(),
    type: 'antigravity',
    email: email
  };
  
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const fileName = `antigravity-${sanitizedEmail}.json`;
  const filePath = path.join(CONFIG_DIR, fileName);
  
  await fsPromises.mkdir(CONFIG_DIR, { recursive: true });
  await auth.saveAuthFileAsync(filePath, authData);
  auth.invalidateCache();
  
  res.send(`
    <html>
      <head>
        <title>Authentication Successful</title>
      </head>
      <body>
        <h1>Authentication Successful!</h1>
        <p>You can close this window now.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_SUCCESS', email: '${email}' }, '*');
            window.close();
          } else {
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
        </script>
      </body>
    </html>
  `);
}));

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 获取缓存的配额信息
 */
app.get('/api/cache', (req, res) => {
  const cache = {};
  for (const [email, data] of quotaCache.entries()) {
    cache[email] = data;
  }
  res.json({ success: true, cache });
});

// 应用全局错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Antigravity Quota Web Panel                       ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║  Config directory:  ${CONFIG_DIR}
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // 扫描现有auth文件 (异步)
  const authFiles = await auth.scanAuthFilesAsync(CONFIG_DIR);
  if (authFiles.length > 0) {
    console.log(`Found ${authFiles.length} auth file(s):`);
    authFiles.forEach(({ authData }) => {
      console.log(`  - ${authData.email || 'Unknown'}`);
    });
  } else {
    console.log('No auth files found. Please add auth JSON files to the config directory.');
    console.log(`Or copy your auth file: cp your-auth.json ${CONFIG_DIR}/antigravity-yourname.json`);
  }
});
