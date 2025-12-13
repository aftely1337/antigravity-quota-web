/**
 * Antigravity Quota Monitor - Frontend Application
 */

// State
let autoRefreshInterval = null;
let quotaData = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuotaData();
});

/**
 * Load quota data for all accounts
 */
async function loadQuotaData() {
  const container = document.getElementById('accounts');
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>正在加载配额信息...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/quota');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load quota data');
    }

    quotaData = data.results;
    renderAccounts(data.results);
    updateLastRefreshTime();
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>😕 加载失败</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadQuotaData()">重试</button>
      </div>
    `;
  }
}

/**
 * Render accounts and their quota
 */
function renderAccounts(results) {
  const container = document.getElementById('accounts');

  if (!results || results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>📭 暂无账号</h3>
        <p>请将 auth JSON 文件添加到 config 目录，或点击上传按钮添加</p>
        <button class="btn btn-secondary" onclick="showUploadModal()">📤 上传Auth文件</button>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map((account, index) => {
    if (!account.success) {
      return `
        <div class="account-card error-card">
          <div class="account-header">
            <span class="account-email">📧 ${escapeHtml(account.email)}</span>
            <div class="account-actions">
              <button class="btn btn-secondary" onclick="refreshAccount('${escapeHtml(account.email)}')">🔄 重试</button>
            </div>
          </div>
          <div class="error-message">
            ❌ 获取配额失败: ${escapeHtml(account.error)}
          </div>
        </div>
      `;
    }

    const models = account.quota?.models || [];
    
    return `
      <div class="account-card">
        <div class="account-header">
          <span class="account-email">📧 ${escapeHtml(account.email)}</span>
          <div class="account-actions">
            <button class="btn btn-secondary" onclick="refreshAccount('${escapeHtml(account.email)}')">🔄 刷新</button>
            <button class="btn btn-secondary" onclick="showAccountDetail(${index})">📊 详情</button>
          </div>
        </div>
        <div class="models-grid">
          ${models.length > 0 ? models.map(model => renderModelCard(model)).join('') : `
            <div class="model-card">
              <div class="model-header">
                <span class="model-name">暂无模型配额信息</span>
              </div>
              <p style="color: #888; font-size: 0.85rem;">模型列表已获取，但未返回配额详情</p>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render a single model card
 */
function renderModelCard(model) {
  const quota = model.quotaInfo;
  
  if (!quota) {
    return `
      <div class="model-card">
        <div class="model-header">
          <span class="model-name">${escapeHtml(model.name || model.modelId)}</span>
          <span class="model-status">⚪</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill exhausted" style="width: 100%"></div>
        </div>
        <div class="model-info">
          <span class="percentage exhausted">配额未知</span>
          <span class="reset-time">-</span>
        </div>
      </div>
    `;
  }

  const percentage = quota.remainingPercentage ?? 0;
  const status = getStatus(percentage);
  const resetTimeFormatted = formatTimeUntilReset(quota.resetTime);

  return `
    <div class="model-card">
      <div class="model-header">
        <span class="model-name">${escapeHtml(model.name || model.modelId)}</span>
        <span class="model-status">${status.emoji}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${status.class}" style="width: ${Math.max(0, Math.min(100, percentage))}%"></div>
      </div>
      <div class="model-info">
        <span class="percentage ${status.class}">${percentage.toFixed(1)}%</span>
        <span class="reset-time">⏰ ${resetTimeFormatted}</span>
      </div>
    </div>
  `;
}

/**
 * Get status based on percentage
 */
function getStatus(percentage) {
  if (percentage === undefined || percentage === null) {
    return { emoji: '⚪', class: 'exhausted', text: 'unknown' };
  }
  if (percentage <= 0) {
    return { emoji: '⚫', class: 'exhausted', text: 'exhausted' };
  }
  if (percentage < 30) {
    return { emoji: '🔴', class: 'critical', text: 'critical' };
  }
  if (percentage < 50) {
    return { emoji: '🟡', class: 'warning', text: 'warning' };
  }
  return { emoji: '🟢', class: 'healthy', text: 'healthy' };
}

/**
 * Format time until reset
 */
function formatTimeUntilReset(resetTime) {
  if (!resetTime) return '未知';

  const reset = new Date(resetTime);
  const now = Date.now();
  const ms = reset.getTime() - now;

  if (ms <= 0) return '已过期';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}

/**
 * Refresh all accounts
 */
async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 刷新中...';

  await loadQuotaData();

  btn.disabled = false;
  btn.textContent = '🔄 刷新全部';
}

/**
 * Refresh a single account
 */
async function refreshAccount(email) {
  try {
    showToast('正在刷新...', 'info');
    const response = await fetch(`/api/quota/${encodeURIComponent(email)}`);
    const data = await response.json();

    if (data.success) {
      showToast(`${email} 刷新成功`, 'success');
      await loadQuotaData();
    } else {
      showToast(`刷新失败: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`刷新失败: ${error.message}`, 'error');
  }
}

/**
 * Toggle auto refresh
 */
function toggleAutoRefresh() {
  const checkbox = document.getElementById('autoRefreshCheck');
  
  if (checkbox.checked) {
    autoRefreshInterval = setInterval(() => {
      loadQuotaData();
    }, 60000); // 60 seconds
    showToast('已开启自动刷新 (每60秒)', 'success');
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    showToast('已关闭自动刷新', 'info');
  }
}

/**
 * Update last refresh time display
 */
function updateLastRefreshTime() {
  const element = document.getElementById('lastUpdate');
  const now = new Date();
  element.textContent = `最后更新: ${now.toLocaleTimeString()}`;
}

/**
 * Show upload modal
 */
function showUploadModal() {
  document.getElementById('uploadModal').style.display = 'block';
  document.getElementById('authContent').value = '';
}

/**
 * Hide upload modal
 */
function hideUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
}

/**
 * Handle file selection
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('authContent').value = e.target.result;
  };
  reader.readAsText(file);
}

/**
 * Upload auth file
 */
async function uploadAuth() {
  const content = document.getElementById('authContent').value.trim();
  
  if (!content) {
    showToast('请输入 Auth 内容', 'error');
    return;
  }

  try {
    // Validate JSON
    JSON.parse(content);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: content
    });

    const data = await response.json();

    if (data.success) {
      showToast(`上传成功: ${data.fileName}`, 'success');
      hideUploadModal();
      await loadQuotaData();
    } else {
      showToast(`上传失败: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`JSON 格式错误: ${error.message}`, 'error');
  }
}

/**
 * Show account detail modal
 */
function showAccountDetail(index) {
  const account = quotaData[index];
  if (!account) return;

  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailTitle');
  const content = document.getElementById('detailContent');

  title.textContent = `📊 ${account.email} - 详细配额`;

  if (!account.success) {
    content.innerHTML = `<p class="error-message">获取配额失败: ${escapeHtml(account.error)}</p>`;
  } else {
    const models = account.quota?.models || [];
    content.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="text-align: left; padding: 10px; color: #888;">模型</th>
            <th style="text-align: center; padding: 10px; color: #888;">状态</th>
            <th style="text-align: right; padding: 10px; color: #888;">剩余配额</th>
            <th style="text-align: right; padding: 10px; color: #888;">重置时间</th>
          </tr>
        </thead>
        <tbody>
          ${models.map(model => {
            const quota = model.quotaInfo;
            const percentage = quota?.remainingPercentage ?? 0;
            const status = getStatus(percentage);
            const resetTime = quota?.resetTime ? new Date(quota.resetTime).toLocaleString() : '-';
            
            return `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px 10px;">${escapeHtml(model.name || model.modelId)}</td>
                <td style="text-align: center; padding: 12px 10px;">${status.emoji}</td>
                <td style="text-align: right; padding: 12px 10px;" class="percentage ${status.class}">${quota ? percentage.toFixed(1) + '%' : '未知'}</td>
                <td style="text-align: right; padding: 12px 10px; color: #666;">${resetTime}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p style="margin-top: 20px; color: #666; font-size: 0.85rem;">
        更新时间: ${account.quota?.timestamp ? new Date(account.quota.timestamp).toLocaleString() : '未知'}
      </p>
    `;
  }

  modal.style.display = 'block';
}

/**
 * Hide detail modal
 */
function hideDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modals when clicking outside
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
};
