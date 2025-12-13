/**
 * Antigravity 配额查询模块
 */

const https = require('https');

// Antigravity API配置
const ANTIGRAVITY_BASE_URLS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://autopush-cloudcode-pa.sandbox.googleapis.com'
];

const MODELS_PATH = '/v1internal:fetchAvailableModels';
const USER_AGENT = 'antigravity/1.11.5 windows/amd64';

/**
 * 发送HTTPS请求
 * @param {string} url - 完整URL
 * @param {Object} options - 请求选项
 * @param {string} body - 请求体
 * @returns {Promise<Object>} 响应数据
 */
function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: 15000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (error) {
            resolve({ status: res.statusCode, data: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * 获取可用模型列表和配额信息
 * @param {string} accessToken - access token
 * @returns {Promise<Object>} 模型和配额信息
 */
async function fetchModelsAndQuota(accessToken) {
  let lastError = null;
  
  for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
    try {
      const url = baseUrl + MODELS_PATH;
      const response = await httpsRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      }, '{}');
      
      return parseModelsResponse(response.data);
    } catch (error) {
      console.log(`Failed to fetch from ${baseUrl}: ${error.message}`);
      lastError = error;
    }
  }
  
  throw lastError || new Error('All base URLs failed');
}

/**
 * 解析模型响应数据
 * @param {Object} data - API响应数据
 * @returns {Object} 解析后的模型信息
 */
function parseModelsResponse(data) {
  const models = [];
  
  // 解析模型列表
  if (data && typeof data === 'object') {
    for (const [modelId, modelInfo] of Object.entries(data)) {
      if (modelId && modelInfo) {
        const model = {
          modelId: modelId,
          name: modelId,
          quotaInfo: null
        };
        
        // 如果有配额信息
        if (modelInfo.quotaInfo) {
          model.quotaInfo = {
            remainingFraction: modelInfo.quotaInfo.remainingFraction,
            remainingPercentage: modelInfo.quotaInfo.remainingFraction !== undefined 
              ? modelInfo.quotaInfo.remainingFraction * 100 
              : undefined,
            resetTime: modelInfo.quotaInfo.resetTime,
            isExhausted: modelInfo.quotaInfo.remainingFraction === 0 || 
                         modelInfo.quotaInfo.remainingFraction === undefined
          };
        }
        
        models.push(model);
      }
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    models: models
  };
}

/**
 * 使用备用方式获取配额（直接调用模型）
 * 注：Antigravity的配额信息主要在模型调用时返回，而不是单独的API
 * @param {string} accessToken - access token
 * @returns {Promise<Object>} 配额信息
 */
async function fetchQuotaViaGenerate(accessToken) {
  const generatePath = '/v1internal:generateContent';
  
  // 使用一个简单的请求来获取配额信息
  const requestBody = JSON.stringify({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'hi' }]
    }],
    generationConfig: {
      maxOutputTokens: 1
    }
  });
  
  for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
    try {
      const url = baseUrl + generatePath;
      const response = await httpsRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      }, requestBody);
      
      // 从响应中提取使用信息
      if (response.data && response.data.usageMetadata) {
        return {
          timestamp: new Date().toISOString(),
          usageMetadata: response.data.usageMetadata
        };
      }
      
      return { timestamp: new Date().toISOString(), raw: response.data };
    } catch (error) {
      console.log(`Generate request failed on ${baseUrl}: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * 格式化剩余时间
 * @param {string} resetTime - 重置时间ISO字符串
 * @returns {string} 格式化的时间字符串
 */
function formatTimeUntilReset(resetTime) {
  if (!resetTime) return 'Unknown';
  
  const reset = new Date(resetTime);
  const now = Date.now();
  const ms = reset.getTime() - now;
  
  if (ms <= 0) return 'Expired';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * 获取状态指示符
 * @param {number} percentage - 剩余百分比
 * @returns {Object} 状态信息
 */
function getStatusIndicator(percentage) {
  if (percentage === undefined || percentage === null) {
    return { emoji: '⚪', status: 'unknown', color: '#888' };
  }
  if (percentage <= 0) {
    return { emoji: '⚫', status: 'exhausted', color: '#333' };
  }
  if (percentage < 30) {
    return { emoji: '🔴', status: 'critical', color: '#e74c3c' };
  }
  if (percentage < 50) {
    return { emoji: '🟡', status: 'warning', color: '#f39c12' };
  }
  return { emoji: '🟢', status: 'healthy', color: '#2ecc71' };
}

module.exports = {
  fetchModelsAndQuota,
  fetchQuotaViaGenerate,
  formatTimeUntilReset,
  getStatusIndicator,
  ANTIGRAVITY_BASE_URLS
};
