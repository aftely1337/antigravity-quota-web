/**
 * Antigravity 余额查询 Web 服务器
 * 主入口文件
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
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

/**
 * 获取所有账号列表
 */
app.get('/api/accounts', (req, res) => {
  try {
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    const accounts = authFiles.map(({ filePath, authData }) => ({
      email: authData.email || path.basename(filePath, '.json'),
      filePath: path.basename(filePath),
      type: authData.type,
      expired: authData.expired,
      isExpired: auth.isTokenExpired(authData)
    }));
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取指定账号的配额信息
 */
app.get('/api/quota/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    
    const authFile = authFiles.find(f => 
      f.authData.email === email || 
      path.basename(f.filePath, '.json') === email
    );
    
    if (!authFile) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    // 确保token有效
    const validAuth = await auth.ensureValidToken(authFile.authData, authFile.filePath);
    
    // 获取配额信息
    const quotaInfo = await quota.fetchModelsAndQuota(validAuth.access_token);
    
    // 缓存结果
    quotaCache.set(email, {
      timestamp: new Date().toISOString(),
      data: quotaInfo
    });
    
    res.json({
      success: true,
      email: validAuth.email,
      quota: quotaInfo
    });
  } catch (error) {
    console.error('Quota fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有账号的配额信息
 */
app.get('/api/quota', async (req, res) => {
  try {
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    const results = [];
    
    for (const { filePath, authData } of authFiles) {
      try {
        // 确保token有效
        const validAuth = await auth.ensureValidToken(authData, filePath);
        
        // 获取配额信息
        const quotaInfo = await quota.fetchModelsAndQuota(validAuth.access_token);
        
        results.push({
          email: validAuth.email || path.basename(filePath, '.json'),
          success: true,
          quota: quotaInfo
        });
        
        // 缓存结果
        quotaCache.set(validAuth.email, {
          timestamp: new Date().toISOString(),
          data: quotaInfo
        });
      } catch (error) {
        results.push({
          email: authData.email || path.basename(filePath, '.json'),
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 刷新指定账号的token
 */
app.post('/api/refresh/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    
    const authFile = authFiles.find(f => 
      f.authData.email === email || 
      path.basename(f.filePath, '.json') === email
    );
    
    if (!authFile) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    // 强制刷新token
    const updatedAuth = await auth.refreshToken(authFile.authData);
    auth.saveAuthFile(authFile.filePath, updatedAuth);
    
    res.json({
      success: true,
      email: updatedAuth.email,
      expired: updatedAuth.expired
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 上传新的auth文件
 */
app.post('/api/upload', express.text({ type: '*/*' }), (req, res) => {
  try {
    const authData = JSON.parse(req.body);
    
    if (!authData.refresh_token) {
      return res.status(400).json({ success: false, error: 'Invalid auth file: missing refresh_token' });
    }
    
    // 生成文件名
    const email = authData.email || 'unknown';
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
    const fileName = `antigravity-${sanitizedEmail}.json`;
    const filePath = path.join(CONFIG_DIR, fileName);
    
    // 确保配置目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // 保存文件
    auth.saveAuthFile(filePath, authData);
    
    res.json({
      success: true,
      message: 'Auth file uploaded successfully',
      fileName: fileName
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 删除账号
 */
app.delete('/api/accounts/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    
    const authFile = authFiles.find(f =>
      f.authData.email === email ||
      path.basename(f.filePath, '.json') === email
    );
    
    if (!authFile) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    // 删除文件
    fs.unlinkSync(authFile.filePath);
    
    // 清除缓存
    quotaCache.delete(email);
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 下载账号凭证
 */
app.get('/api/accounts/:email/download', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const authFiles = auth.scanAuthFiles(CONFIG_DIR);
    
    const authFile = authFiles.find(f =>
      f.authData.email === email ||
      path.basename(f.filePath, '.json') === email
    );
    
    if (!authFile) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    const fileName = path.basename(authFile.filePath);
    res.download(authFile.filePath, fileName);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 启动OAuth登录流程
 */
app.get('/api/auth/login', (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
    const { url, state } = auth.generateAuthUrl(redirectUri);
    
    // 存储state用于验证
    oauthStates.add(state);
    
    // 5分钟后清除state
    setTimeout(() => oauthStates.delete(state), 5 * 60 * 1000);
    
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * OAuth回调处理
 */
app.get('/api/auth/callback', async (req, res) => {
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
  
  try {
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
    
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    auth.saveAuthFile(filePath, authData);
    
    // 返回HTML，自动关闭窗口并通知父窗口
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
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

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

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Antigravity Quota Web Panel                       ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║  Config directory:  ${CONFIG_DIR}
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // 扫描现有auth文件
  const authFiles = auth.scanAuthFiles(CONFIG_DIR);
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