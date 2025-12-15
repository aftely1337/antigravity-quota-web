/**
 * Antigravity Quota Monitor - Frontend Application
 */

// State
let autoRefreshInterval = null;
let quotaData = [];
let currentPage = 1;
let itemsPerPage = 12;
let searchQuery = '';
let accountToDelete = null;
let currentLang = 'zh'; // Default to Chinese

const translations = {
  en: {
    updating: 'Updating...',
    autoRefresh: 'Auto Refresh',
    refreshAll: 'Refresh All',
    uploadAuth: 'Upload Auth',
    searchPlaceholder: 'Search accounts...',
    loading: 'Loading quota data...',
    importTitle: 'Import Auth Configuration',
    importDesc: 'Paste the content of your auth JSON file or upload it directly.',
    selectFile: 'Select JSON file',
    cancel: 'Cancel',
    import: 'Import',
    accountDetails: 'Account Details',
    deleteTitle: 'Delete Account',
    deleteConfirm: 'Are you sure you want to delete account',
    deleteWarning: 'This action cannot be undone. The auth file will be permanently removed.',
    delete: 'Delete',
    retry: 'Retry',
    view: 'View',
    refresh: 'Refresh',
    noResultsTitle: 'No Results Found',
    noResultsDesc: 'No accounts match your search query',
    noAccountsTitle: 'No Accounts Found',
    noAccountsDesc: 'Add an auth JSON file to the config directory or upload one to get started.',
    importAuthFile: 'Import Auth File',
    model: 'Model',
    status: 'Status',
    quota: 'Quota',
    resetTime: 'Reset Time',
    lastUpdated: 'Last updated',
    remaining: 'Remaining',
    unknown: 'Unknown',
    expired: 'Expired',
    exhausted: 'Exhausted',
    critical: 'Critical',
    warning: 'Warning',
    healthy: 'Healthy',
    deleting: 'Deleting...',
    refreshing: 'Refreshing...',
    autoRefreshEnabled: 'Auto refresh enabled (60s)',
    autoRefreshDisabled: 'Auto refresh disabled',
    accountRefreshed: 'Account refreshed successfully',
    accountDeleted: 'Account deleted successfully',
    imported: 'Imported',
    importFailed: 'Import failed',
    refreshFailed: 'Refresh failed',
    deleteFailed: 'Delete failed',
    invalidJson: 'Invalid JSON',
    enterAuthContent: 'Please enter auth content',
    connectionError: 'Connection Error',
    tryAgain: 'Try Again',
    failedToFetch: 'Failed to fetch quota',
    noModelQuota: 'No model quota information available.'
  },
  zh: {
    updating: '更新中...',
    autoRefresh: '自动刷新',
    refreshAll: '刷新全部',
    uploadAuth: '上传 Auth',
    searchPlaceholder: '搜索账号...',
    loading: '正在加载配额数据...',
    importTitle: '导入 Auth 配置',
    importDesc: '粘贴您的 auth JSON 文件内容或直接上传文件。',
    selectFile: '选择 JSON 文件',
    cancel: '取消',
    import: '导入',
    accountDetails: '账号详情',
    deleteTitle: '删除账号',
    deleteConfirm: '您确定要删除账号',
    deleteWarning: '此操作无法撤销。Auth 文件将被永久删除。',
    delete: '删除',
    retry: '重试',
    view: '查看',
    refresh: '刷新',
    noResultsTitle: '未找到结果',
    noResultsDesc: '没有账号匹配您的搜索查询',
    noAccountsTitle: '未找到账号',
    noAccountsDesc: '请添加 auth JSON 文件到配置目录或上传一个以开始使用。',
    importAuthFile: '导入 Auth 文件',
    model: '模型',
    status: '状态',
    quota: '配额',
    resetTime: '重置时间',
    lastUpdated: '最后更新',
    remaining: '剩余',
    unknown: '未知',
    expired: '已过期',
    exhausted: '耗尽',
    critical: '严重',
    warning: '警告',
    healthy: '健康',
    deleting: '删除中...',
    refreshing: '刷新中...',
    autoRefreshEnabled: '自动刷新已启用 (60秒)',
    autoRefreshDisabled: '自动刷新已禁用',
    accountRefreshed: '账号刷新成功',
    accountDeleted: '账号删除成功',
    imported: '已导入',
    importFailed: '导入失败',
    refreshFailed: '刷新失败',
    deleteFailed: '删除失败',
    invalidJson: '无效的 JSON',
    enterAuthContent: '请输入 auth 内容',
    connectionError: '连接错误',
    tryAgain: '重试',
    failedToFetch: '获取配额失败',
    noModelQuota: '暂无模型配额信息。'
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuotaData();
  restoreAutoRefreshState();
  updateLanguage();
});

/**
 * Toggle language
 */
function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  updateLanguage();
  renderAccounts(); // Re-render to update dynamic content
}

/**
 * Update UI language
 */
function updateLanguage() {
  const t = translations[currentLang];
  
  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
}

/**
 * Get translation
 */
function i18n(key) {
  return translations[currentLang][key] || key;
}

/**
 * Restore auto refresh state from localStorage
 */
function restoreAutoRefreshState() {
  const saved = localStorage.getItem('autoRefreshEnabled');
  if (saved === 'true') {
    const checkbox = document.getElementById('autoRefreshCheck');
    if (checkbox) {
      checkbox.checked = true;
      // Start the auto refresh interval
      autoRefreshInterval = setInterval(() => {
        loadQuotaData();
      }, 60000); // 60 seconds
    }
  }
}

/**
 * Load quota data for all accounts
 */
async function loadQuotaData() {
  const container = document.getElementById('accounts');
  
  // Only show full loading state if container is empty
  if (!container.children.length || container.querySelector('.loading-state')) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${i18n('loading')}</p>
      </div>
    `;
  }

  try {
    const response = await fetch('/api/quota');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || i18n('failedToFetch'));
    }

    quotaData = data.results;
    renderAccounts();
    updateLastRefreshTime();
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>${i18n('connectionError')}</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadQuotaData()">${i18n('tryAgain')}</button>
      </div>
    `;
  } finally {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = i18n('refreshAll');
    }
  }
}

/**
 * Handle search input
 */
function handleSearch(query) {
  searchQuery = query.toLowerCase().trim();
  currentPage = 1; // Reset to first page
  renderAccounts();
}

/**
 * Change page
 */
function changePage(page) {
  currentPage = page;
  renderAccounts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Render accounts and their quota
 */
function renderAccounts() {
  const container = document.getElementById('accounts');
  const statsContainer = document.getElementById('accountStats');
  
  // Filter data based on search query
  let filteredData = quotaData;
  if (searchQuery) {
    filteredData = quotaData.filter(account =>
      account.email.toLowerCase().includes(searchQuery)
    );
  }

  // Calculate pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Update stats
  if (statsContainer) {
    statsContainer.textContent = `Total: ${quotaData.length} | Showing: ${totalItems}`;
  }

  // Handle empty state
  if (totalItems === 0) {
    if (searchQuery) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>${i18n('noResultsTitle')}</h3>
          <p>${i18n('noResultsDesc')} "${escapeHtml(searchQuery)}"</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <h3>${i18n('noAccountsTitle')}</h3>
          <p>${i18n('noAccountsDesc')}</p>
          <button class="btn btn-primary" onclick="showUploadModal()">${i18n('importAuthFile')}</button>
        </div>
      `;
    }
    renderPagination(0, 0);
    return;
  }

  // Slice data for current page
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageData = filteredData.slice(start, end);

  // Render cards
  container.innerHTML = pageData.map((account) => {
    // Find original index in quotaData for detail view reference
    const originalIndex = quotaData.findIndex(a => a.email === account.email);

    if (!account.success) {
      return `
        <div class="account-card error-card">
          <div class="account-header">
            <div class="account-info">
              <div class="avatar" style="background: var(--error-color)">!</div>
              <span class="account-email">${escapeHtml(account.email)}</span>
            </div>
            <div class="account-controls">
              <button class="btn btn-secondary btn-sm" onclick="refreshAccount('${escapeHtml(account.email)}')">${i18n('retry')}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteAccount('${escapeHtml(account.email)}')">${i18n('delete')}</button>
            </div>
          </div>
          <div class="error-message">
            ${i18n('failedToFetch')}: ${escapeHtml(account.error)}
          </div>
        </div>
      `;
    }

    const models = account.quota?.models || [];
    
    // Sort models by name/ID alphabetically
    models.sort((a, b) => {
        const nameA = (a.name || a.modelId || '').toLowerCase();
        const nameB = (b.name || b.modelId || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const initials = account.email.substring(0, 2).toUpperCase();
    
    return `
      <div class="account-card">
        <div class="account-header">
          <div class="account-info">
            <div class="avatar">${initials}</div>
            <span class="account-email">${escapeHtml(account.email)}</span>
          </div>
          <div class="account-controls">
            <button class="btn btn-secondary btn-sm" onclick="refreshAccount('${escapeHtml(account.email)}')">${i18n('refresh')}</button>
            <button class="btn btn-secondary btn-sm" onclick="showAccountDetail(${originalIndex})">${i18n('view')}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAccount('${escapeHtml(account.email)}')" title="${i18n('deleteTitle')}">${i18n('delete')}</button>
          </div>
        </div>
        <div class="account-models">
          ${models.length > 0 ? models.map(model => renderModelCard(model)).join('') : `
            <div class="empty-state" style="padding: 20px;">
              <p>${i18n('noModelQuota')}</p>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  renderPagination(currentPage, totalPages);
}

/**
 * Render pagination controls
 */
function renderPagination(current, total) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (total <= 1) {
    container.innerHTML = '';
    return;
  }

  let buttons = '';
  
  // Previous button
  buttons += `
    <button class="page-btn" onclick="changePage(${current - 1})" ${current === 1 ? 'disabled' : ''}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  // Page numbers
  // Simple logic: show all if <= 7, otherwise show start, end, and around current
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      buttons += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
  } else {
    // Logic for many pages can be added here if needed, keeping it simple for now
    // Showing current, +/- 1, first, last
    const showPages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = Array.from(showPages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
    
    let prev = 0;
    for (const p of sorted) {
      if (prev > 0 && p - prev > 1) {
        buttons += `<span style="color: var(--text-tertiary);">...</span>`;
      }
      buttons += `<button class="page-btn ${p === current ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
      prev = p;
    }
  }

  // Next button
  buttons += `
    <button class="page-btn" onclick="changePage(${current + 1})" ${current === total ? 'disabled' : ''}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  container.innerHTML = buttons;
}

/**
 * Render a single model card
 */
function renderModelCard(model) {
  const quota = model.quotaInfo;
  
  if (!quota) {
    return `
      <div class="model-item">
        <div class="model-header">
          <span class="model-name">${escapeHtml(model.name || model.modelId)}</span>
          <span class="model-badge badge-exhausted">${i18n('unknown')}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar progress-exhausted" style="width: 100%"></div>
        </div>
        <div class="model-meta">
          <span>${i18n('quota')}: ${i18n('unknown')}</span>
          <span>${i18n('resetTime')}: -</span>
        </div>
      </div>
    `;
  }

  const percentage = quota.remainingPercentage ?? 0;
  const status = getStatus(percentage);
  const resetTimeFormatted = formatTimeUntilReset(quota.resetTime);

  return `
    <div class="model-item">
      <div class="model-header">
        <span class="model-name">${escapeHtml(model.name || model.modelId)}</span>
        <span class="model-badge badge-${status.class}">${i18n(status.text.toLowerCase())}</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar progress-${status.class}" style="width: ${Math.max(0, Math.min(100, percentage))}%"></div>
      </div>
      <div class="model-meta">
        <span>${percentage.toFixed(1)}% ${i18n('remaining')}</span>
        <span>${i18n('resetTime')}: ${resetTimeFormatted}</span>
      </div>
    </div>
  `;
}

/**
 * Get status based on percentage
 */
function getStatus(percentage) {
  if (percentage === undefined || percentage === null) {
    return { class: 'exhausted', text: 'Unknown' };
  }
  if (percentage <= 0) {
    return { class: 'exhausted', text: 'Exhausted' };
  }
  if (percentage < 30) {
    return { class: 'critical', text: 'Critical' };
  }
  if (percentage < 50) {
    return { class: 'warning', text: 'Warning' };
  }
  return { class: 'healthy', text: 'Healthy' };
}

/**
 * Format time until reset
 */
function formatTimeUntilReset(resetTime) {
  if (!resetTime) return i18n('unknown');

  const reset = new Date(resetTime);
  const now = Date.now();
  const ms = reset.getTime() - now;

  if (ms <= 0) return i18n('expired');

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
 * Refresh all accounts
 */
async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = i18n('refreshing');

  await loadQuotaData();
}

/**
 * Refresh a single account
 */
async function refreshAccount(email) {
  try {
    showToast(`Refreshing ${email}...`, 'info');
    const response = await fetch(`/api/quota/${encodeURIComponent(email)}`);
    const data = await response.json();

    if (data.success) {
      showToast(i18n('accountRefreshed'), 'success');
      await loadQuotaData();
    } else {
      showToast(`${i18n('refreshFailed')}: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`${i18n('refreshFailed')}: ${error.message}`, 'error');
  }
}

/**
 * Show delete confirmation modal
 */
function deleteAccount(email) {
  accountToDelete = email;
  document.getElementById('deleteAccountEmail').textContent = email;
  document.getElementById('deleteModal').style.display = 'block';
  
  // Set up confirm button
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.onclick = confirmDelete;
}

/**
 * Hide delete modal
 */
function hideDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  accountToDelete = null;
}

/**
 * Execute account deletion
 */
async function confirmDelete() {
  if (!accountToDelete) return;

  const email = accountToDelete;
  const btn = document.getElementById('confirmDeleteBtn');
  const originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = i18n('deleting');

  try {
    const response = await fetch(`/api/accounts/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (data.success) {
      showToast(i18n('accountDeleted'), 'success');
      // Remove from local data and re-render
      quotaData = quotaData.filter(a => a.email !== email);
      renderAccounts();
      hideDeleteModal();
    } else {
      showToast(`${i18n('deleteFailed')}: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`${i18n('deleteFailed')}: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
    localStorage.setItem('autoRefreshEnabled', 'true');
    showToast(i18n('autoRefreshEnabled'), 'success');
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    localStorage.setItem('autoRefreshEnabled', 'false');
    showToast(i18n('autoRefreshDisabled'), 'info');
  }
}

/**
 * Update last refresh time display
 */
function updateLastRefreshTime() {
  const element = document.getElementById('lastUpdate');
  const now = new Date();
  element.textContent = `Updated: ${now.toLocaleTimeString()}`;
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
    showToast(i18n('enterAuthContent'), 'error');
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
      showToast(`${i18n('imported')}: ${data.fileName}`, 'success');
      hideUploadModal();
      await loadQuotaData();
    } else {
      showToast(`${i18n('importFailed')}: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`${i18n('invalidJson')}: ${error.message}`, 'error');
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

  title.textContent = account.email;

  if (!account.success) {
    content.innerHTML = `<p class="error-message">${i18n('failedToFetch')}: ${escapeHtml(account.error)}</p>`;
  } else {
    const models = account.quota?.models || [];
    
    // Sort models by name/ID alphabetically for detail view as well
    models.sort((a, b) => {
        const nameA = (a.name || a.modelId || '').toLowerCase();
        const nameB = (b.name || b.modelId || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const timestamp = account.quota?.timestamp ? new Date(account.quota.timestamp).toLocaleString() : i18n('unknown');
    
    content.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500;">${i18n('model')}</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500;">${i18n('status')}</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500; text-align: right;">${i18n('quota')}</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500; text-align: right;">${i18n('resetTime')}</th>
            </tr>
          </thead>
          <tbody>
            ${models.map(model => {
              const quota = model.quotaInfo;
              const percentage = quota?.remainingPercentage ?? 0;
              const status = getStatus(percentage);
              const resetTime = quota?.resetTime ? new Date(quota.resetTime).toLocaleString() : '-';
              
              return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 16px 12px; font-weight: 500;">${escapeHtml(model.name || model.modelId)}</td>
                  <td style="padding: 16px 12px;">
                    <span class="model-badge badge-${status.class}">${i18n(status.text.toLowerCase())}</span>
                  </td>
                  <td style="padding: 16px 12px; text-align: right; font-family: monospace;">${quota ? percentage.toFixed(1) + '%' : i18n('unknown')}</td>
                  <td style="padding: 16px 12px; text-align: right; color: var(--text-tertiary);">${resetTime}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); color: var(--text-tertiary); font-size: 0.875rem;">
        ${i18n('lastUpdated')}: ${timestamp}
      </div>
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
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else if (type === 'error') {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  } else {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
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
  if (event.target.classList.contains('modal-backdrop')) {
    event.target.style.display = 'none';
  }
};