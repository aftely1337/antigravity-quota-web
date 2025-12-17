/**
 * Antigravity 配额查询模块
 * 支持HTTP和SOCKS5代理
 */

const { httpsRequestWithProxy, getProxyUrl } = require('./auth');

// Antigravity API配置
const ANTIGRAVITY_BASE_URLS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://autopush-cloudcode-pa.sandbox.googleapis.com'
];

const MODELS_PATH = '/v1internal:fetchAvailableModels';
const USER_AGENT = 'antigravity/1.11.5 windows/amd64';

// 模型ID到显示名称的映射
const MODEL_NAME_MAPPING = {
  'models/rev19-uic3-1p': 'Gemini 2.5 Computer Use', // Mapping for Rev19 Uic3 1p
  'rev19-uic3-1p': 'Gemini 2.5 Computer Use', // Add mapping without prefix just in case
  // Add other known mappings here
};

// 需要忽略的模型ID模式或特定ID（支持连字符和下划线）
const IGNORED_MODELS = [
  'chat-20706',
  'chat-23310',
  'chat_20706',
  'chat_23310'
];

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
      console.log(`Fetching models from: ${url}`);
      if (getProxyUrl()) {
        console.log(`Using proxy: ${getProxyUrl()}`);
      }
      
      const response = await httpsRequestWithProxy(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      }, '{}');
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const data = JSON.parse(response.data);
        console.log('Raw API response keys:', Object.keys(data));
        return parseModelsResponse(data);
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.data}`);
      }
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
  
  // Helper function to check if model should be ignored
  const shouldIgnore = (modelId) => {
    if (!modelId) return true;
    // Normalize: lowercase, remove 'models/' prefix, replace both - and _ for comparison
    const normalizedId = modelId.toLowerCase().replace('models/', '');
    const normalizeForCompare = (s) => s.toLowerCase().replace(/[-_]/g, '');
    
    const isIgnored = IGNORED_MODELS.some(ignored => {
      const normalizedIgnored = normalizeForCompare(ignored);
      return normalizeForCompare(normalizedId) === normalizedIgnored;
    });
    if (isIgnored) {
      console.log(`Ignoring model: ${modelId}`);
    }
    return isIgnored;
  };

  // 解析models数组（如果存在）
  if (data.models && typeof data.models === 'object') {
    for (const [modelId, modelInfo] of Object.entries(data.models)) {
      if (modelId && modelInfo) {
        if (shouldIgnore(modelId)) continue;

        const model = parseModelEntry(modelId, modelInfo);
        if (model) {
          models.push(model);
        }
      }
    }
  }
  
  // 解析agentModelSorts（包含常用模型）
  if (data.agentModelSorts && Array.isArray(data.agentModelSorts)) {
    for (const modelId of data.agentModelSorts) {
      if (typeof modelId === 'string' && !models.find(m => m.modelId === modelId)) {
        if (shouldIgnore(modelId)) continue;

        models.push({
          modelId: modelId,
          name: formatModelName(modelId),
          category: 'agent',
          quotaInfo: null
        });
      }
    }
  }
  
  // 解析commandModelIds
  if (data.commandModelIds && Array.isArray(data.commandModelIds)) {
    for (const modelId of data.commandModelIds) {
      if (typeof modelId === 'string' && !models.find(m => m.modelId === modelId)) {
        if (shouldIgnore(modelId)) continue;

        models.push({
          modelId: modelId,
          name: formatModelName(modelId),
          category: 'command',
          quotaInfo: null
        });
      }
    }
  }
  
  // 解析tabModelIds
  if (data.tabModelIds && Array.isArray(data.tabModelIds)) {
    for (const modelId of data.tabModelIds) {
      if (typeof modelId === 'string' && !models.find(m => m.modelId === modelId)) {
        if (shouldIgnore(modelId)) continue;

        models.push({
          modelId: modelId,
          name: formatModelName(modelId),
          category: 'tab',
          quotaInfo: null
        });
      }
    }
  }
  
  // Last resort filtering: filter the final array
  // This handles cases where models might be added via other paths or logic I missed
  const filteredModels = models.filter(m => !shouldIgnore(m.modelId) && !shouldIgnore(m.name));

  return {
    timestamp: new Date().toISOString(),
    models: filteredModels,
    raw: {
      defaultAgentModelId: data.defaultAgentModelId,
      modelCount: filteredModels.length
    }
  };
}

/**
 * 解析单个模型条目
 */
function parseModelEntry(modelId, modelInfo) {
  if (!modelInfo || typeof modelInfo !== 'object') {
    return null;
  }
  
  const model = {
    modelId: modelId,
    name: MODEL_NAME_MAPPING[modelId] || MODEL_NAME_MAPPING[modelId.replace('models/', '')] || modelInfo.displayName || formatModelName(modelId),
    displayName: modelInfo.displayName,
    category: modelInfo.category || 'unknown',
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
  
  return model;
}

/**
 * 格式化模型名称
 */
function formatModelName(modelId) {
  if (!modelId) return 'Unknown';
  
  // Check mapping first
  if (MODEL_NAME_MAPPING[modelId]) {
    return MODEL_NAME_MAPPING[modelId];
  }
  if (MODEL_NAME_MAPPING[modelId.replace('models/', '')]) {
    return MODEL_NAME_MAPPING[modelId.replace('models/', '')];
  }

  // 移除前缀并格式化
  let name = modelId
    .replace('models/', '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ');
  
  // 首字母大写
  name = name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  return name;
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
      const response = await httpsRequestWithProxy(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      }, requestBody);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const data = JSON.parse(response.data);
        // 从响应中提取使用信息
        if (data && data.usageMetadata) {
          return {
            timestamp: new Date().toISOString(),
            usageMetadata: data.usageMetadata
          };
        }
        return { timestamp: new Date().toISOString(), raw: data };
      }
    } catch (error) {
      console.log(`Generate request failed on ${baseUrl}: ${error.message}`);
    }
  }
  
  return null;
}

module.exports = {
  fetchModelsAndQuota,
  fetchQuotaViaGenerate,
  ANTIGRAVITY_BASE_URLS
};