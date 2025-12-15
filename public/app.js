/**
 * Antigravity Quota Monitor - Frontend Application
 */

// State
let autoRefreshInterval = null;
let quotaData = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuotaData();
  restoreAutoRefreshState();
});

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
        <p>Fetching latest quota data...</p>
      </div>
    `;
  }

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
        <h3>Connection Error</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadQuotaData()">Try Again</button>
      </div>
    `;
  } finally {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      `;
    }
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
        <h3>No Accounts Found</h3>
        <p>Add an auth JSON file to the config directory or upload one to get started.</p>
        <button class="btn btn-primary" onclick="showUploadModal()">Import Auth File</button>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map((account, index) => {
    if (!account.success) {
      return `
        <div class="account-card error-card">
          <div class="account-header">
            <div class="account-info">
              <div class="avatar" style="background: var(--error-color)">!</div>
              <span class="account-email">${escapeHtml(account.email)}</span>
            </div>
            <div class="account-controls">
              <button class="icon-btn" onclick="refreshAccount('${escapeHtml(account.email)}')" title="Retry">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
          </div>
          <div class="error-message">
            Failed to fetch quota: ${escapeHtml(account.error)}
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
            <button class="icon-btn" onclick="refreshAccount('${escapeHtml(account.email)}')" title="Refresh">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button class="icon-btn" onclick="showAccountDetail(${index})" title="Details">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
        <div class="account-models">
          ${models.length > 0 ? models.map(model => renderModelCard(model)).join('') : `
            <div class="empty-state" style="padding: 20px;">
              <p>No model quota information available.</p>
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
      <div class="model-item">
        <div class="model-header">
          <span class="model-name">${escapeHtml(model.name || model.modelId)}</span>
          <span class="model-badge badge-exhausted">Unknown</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar progress-exhausted" style="width: 100%"></div>
        </div>
        <div class="model-meta">
          <span>Quota: Unknown</span>
          <span>Reset: -</span>
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
        <span class="model-badge badge-${status.class}">${status.text}</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar progress-${status.class}" style="width: ${Math.max(0, Math.min(100, percentage))}%"></div>
      </div>
      <div class="model-meta">
        <span>${percentage.toFixed(1)}% Remaining</span>
        <span>Reset: ${resetTimeFormatted}</span>
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
 * Refresh all accounts
 */
async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  // Add spin animation class to the svg inside
  const svg = btn.querySelector('svg');
  if (svg) svg.classList.add('animate-spin'); // We need to add this class in CSS if not present, but for now just visual cue
  
  // Custom spinner for the button
  btn.innerHTML = `<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>`;

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
      showToast('Account refreshed successfully', 'success');
      await loadQuotaData();
    } else {
      showToast(`Refresh failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`Refresh failed: ${error.message}`, 'error');
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
    showToast('Auto refresh enabled (60s)', 'success');
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    localStorage.setItem('autoRefreshEnabled', 'false');
    showToast('Auto refresh disabled', 'info');
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
    showToast('Please enter auth content', 'error');
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
      showToast(`Imported: ${data.fileName}`, 'success');
      hideUploadModal();
      await loadQuotaData();
    } else {
      showToast(`Import failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`Invalid JSON: ${error.message}`, 'error');
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
    content.innerHTML = `<p class="error-message">Failed to fetch quota: ${escapeHtml(account.error)}</p>`;
  } else {
    const models = account.quota?.models || [];
    
    // Sort models by name/ID alphabetically for detail view as well
    models.sort((a, b) => {
        const nameA = (a.name || a.modelId || '').toLowerCase();
        const nameB = (b.name || b.modelId || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const timestamp = account.quota?.timestamp ? new Date(account.quota.timestamp).toLocaleString() : 'Unknown';
    
    content.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500;">Model</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500;">Status</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500; text-align: right;">Quota</th>
              <th style="padding: 12px; color: var(--text-secondary); font-weight: 500; text-align: right;">Reset Time</th>
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
                    <span class="model-badge badge-${status.class}">${status.text}</span>
                  </td>
                  <td style="padding: 16px 12px; text-align: right; font-family: monospace;">${quota ? percentage.toFixed(1) + '%' : 'Unknown'}</td>
                  <td style="padding: 16px 12px; text-align: right; color: var(--text-tertiary);">${resetTime}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); color: var(--text-tertiary); font-size: 0.875rem;">
        Last updated: ${timestamp}
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
