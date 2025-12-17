/**
 * Antigravity Quota Monitor - Frontend Application (Modular Version)
 */

import { i18n, updateLanguage, toggleLanguage as toggleLangFn, setCurrentLang } from './modules/i18n.js';
import { state, saveAutoRefreshState, loadAutoRefreshState, setQuotaData, setSearchQuery, setCurrentPage, toggleExpandedAccount, isAccountExpanded } from './modules/state.js';
import { fetchQuota, fetchSingleQuota, deleteAccountApi, downloadAccountApi, uploadAuthApi, getProxyConfig, saveProxyConfigApi, testProxyApi } from './modules/api.js';
import { getStatus, formatTimeUntilReset, formatInterval, escapeHtml, getAccountClaudeQuota, getAccountGeminiQuota } from './modules/utils.js';
import { showToast, renderQuotaSummaryItem, renderModelCard, renderPagination, renderGlobalSummaryItem } from './modules/ui.js';

// 挂载到 window 以供 HTML 调用
window.toggleLanguage = () => {
  toggleLangFn();
  renderAccounts();
  renderGlobalSummary();
};

window.handleSearch = (query) => {
  setSearchQuery(query);
  renderAccounts();
};

window.changePage = (page) => {
  setCurrentPage(page);
  renderAccounts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.loadQuotaData = loadQuotaData;
window.refreshAll = refreshAll;
window.refreshAccount = refreshAccount;
window.deleteAccount = deleteAccount;
window.confirmDelete = confirmDelete;
window.hideDeleteModal = hideDeleteModal;
window.downloadAccount = downloadAccount;
window.toggleAutoRefresh = toggleAutoRefresh;
window.changeRefreshInterval = changeRefreshInterval;
window.showUploadModal = showUploadModal;
window.hideUploadModal = hideUploadModal;
window.handleFileSelect = handleFileSelect;
window.uploadAuth = uploadAuth;
window.showAccountDetail = showAccountDetail;
window.hideDetailModal = hideDetailModal;
window.toggleModels = toggleModels;
window.toggleDropdown = toggleDropdown;
window.showProxyModal = showProxyModal;
window.hideProxyModal = hideProxyModal;
window.testProxy = testProxy;
window.saveProxy = saveProxy;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuotaData();
  restoreAutoRefreshState();
  updateLanguage();
});

function restoreAutoRefreshState() {
  const { enabled, interval } = loadAutoRefreshState();
  
  const select = document.getElementById('refreshIntervalSelect');
  if (select) {
    select.value = interval.toString();
  }
  
  if (enabled) {
    const checkbox = document.getElementById('autoRefreshCheck');
    if (checkbox) {
      checkbox.checked = true;
      state.autoRefreshInterval = setInterval(() => loadQuotaData(), interval);
    }
  }
}

async function loadQuotaData() {
  const container = document.getElementById('accounts');
  
  if (!container.children.length || container.querySelector('.loading-state')) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${i18n('loading')}</p>
      </div>
    `;
  }

  try {
    const data = await fetchQuota();

    if (!data.success) {
      throw new Error(data.error || i18n('failedToFetch'));
    }

    setQuotaData(data.results);
    renderGlobalSummary();
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

function renderGlobalSummary() {
  let container = document.querySelector('.shared-quota-card');
  
  let claudeTotal = 0, claudeCount = 0, geminiTotal = 0, geminiCount = 0;
  
  state.quotaData.forEach(account => {
    if (!account.success || !account.quota?.models) return;
    
    const models = account.quota.models;
    
    const claudeQuota = getAccountClaudeQuota(models);
    if (claudeQuota) {
      claudeTotal += claudeQuota.remainingPercentage || 0;
      claudeCount++;
    }
    
    const geminiQuota = getAccountGeminiQuota(models);
    if (geminiQuota) {
      geminiTotal += geminiQuota.remainingPercentage || 0;
      geminiCount++;
    }
  });

  if (!container) {
    const main = document.getElementById('accounts');
    const summarySection = document.createElement('div');
    summarySection.className = 'shared-quota-card';
    main.parentNode.insertBefore(summarySection, main);
    container = summarySection;
  }
  
  if (claudeCount === 0 && geminiCount === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  container.innerHTML = `
    <div class="shared-quota-title">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
      ${i18n('totalQuota')}
    </div>
    <div class="shared-quota-grid">
      ${renderGlobalSummaryItem('Claude', claudeTotal, claudeCount)}
      ${renderGlobalSummaryItem('Gemini', geminiTotal, geminiCount)}
    </div>
  `;
}

function renderAccounts() {
  const container = document.getElementById('accounts');
  const statsContainer = document.getElementById('accountStats');
  
  let filteredData = state.quotaData;
  if (state.searchQuery) {
    filteredData = state.quotaData.filter(account =>
      account.email.toLowerCase().includes(state.searchQuery)
    );
  }

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / state.itemsPerPage);
  
  if (statsContainer) {
    statsContainer.textContent = `${i18n('total')}: ${state.quotaData.length} | ${i18n('showing')}: ${totalItems}`;
  }

  if (totalItems === 0) {
    if (state.searchQuery) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>${i18n('noResultsTitle')}</h3>
          <p>${i18n('noResultsDesc')} "${escapeHtml(state.searchQuery)}"</p>
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
    renderPagination(0, 0, window.changePage);
    return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const end = start + state.itemsPerPage;
  const pageData = filteredData.slice(start, end);

  container.innerHTML = pageData.map((account) => {
    const originalIndex = state.quotaData.findIndex(a => a.email === account.email);

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
    models.sort((a, b) => {
      const nameA = (a.name || a.modelId || '').toLowerCase();
      const nameB = (b.name || b.modelId || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const initials = account.email.substring(0, 2).toUpperCase();
    const isExpanded = isAccountExpanded(originalIndex);
    const claudeQuota = getAccountClaudeQuota(models);
    const geminiQuota = getAccountGeminiQuota(models);
    
    return `
      <div class="account-card">
        <div class="account-header">
          <div class="account-info">
            <div class="avatar">${initials}</div>
            <span class="account-email">${escapeHtml(account.email)}</span>
          </div>
          <div class="account-controls">
            <button class="btn btn-secondary btn-sm" onclick="toggleDropdown(event, '${originalIndex}')">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </button>
            <div id="dropdown-${originalIndex}" class="dropdown-menu">
              <button class="dropdown-item" onclick="refreshAccount('${escapeHtml(account.email)}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                ${i18n('refresh')}
              </button>
              <button class="dropdown-item" onclick="showAccountDetail(${originalIndex})">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ${i18n('view')}
              </button>
              <button class="dropdown-item" onclick="downloadAccount('${escapeHtml(account.email)}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3-3m0 0l3-3m-3 3h7.5" />
                </svg>
                ${i18n('download')}
              </button>
              <button class="dropdown-item danger" onclick="deleteAccount('${escapeHtml(account.email)}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                ${i18n('delete')}
              </button>
            </div>
          </div>
        </div>
        <div class="quota-summary">
          ${claudeQuota ? renderQuotaSummaryItem('Claude', claudeQuota) : ''}
          ${geminiQuota ? renderQuotaSummaryItem('Gemini', geminiQuota) : ''}
        </div>

        <div id="models-${originalIndex}" class="account-models ${isExpanded ? '' : 'collapsed'}">
          ${models.length > 0 ? models.map(model => renderModelCard(model)).join('') : `
            <div class="empty-state" style="padding: 20px;">
              <p>${i18n('noModelQuota')}</p>
            </div>
          `}
        </div>
        <button class="toggle-models-btn ${isExpanded ? 'active' : ''}" onclick="toggleModels(${originalIndex})">
          <span id="toggle-text-${originalIndex}">${isExpanded ? i18n('hideModels') : i18n('showModels')} (${models.length})</span>
          <svg id="toggle-icon-${originalIndex}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
    `;
  }).join('');

  renderPagination(state.currentPage, totalPages, window.changePage);
}

async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = i18n('refreshing');
  await loadQuotaData();
}

async function refreshAccount(email) {
  try {
    showToast(`Refreshing ${email}...`, 'info');
    const data = await fetchSingleQuota(email);

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

function deleteAccount(email) {
  state.accountToDelete = email;
  document.getElementById('deleteAccountEmail').textContent = email;
  document.getElementById('deleteModal').style.display = 'block';
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.onclick = confirmDelete;
}

function hideDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  state.accountToDelete = null;
}

async function confirmDelete() {
  if (!state.accountToDelete) return;

  const email = state.accountToDelete;
  const btn = document.getElementById('confirmDeleteBtn');
  const originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = i18n('deleting');

  try {
    const data = await deleteAccountApi(email);

    if (data.success) {
      showToast(i18n('accountDeleted'), 'success');
      setQuotaData(state.quotaData.filter(a => a.email !== email));
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

async function downloadAccount(email) {
  try {
    const response = await downloadAccountApi(email);
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `antigravity-${email.replace(/[^a-zA-Z0-9@._-]/g, '_')}.json`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      const data = await response.json();
      showToast(`${i18n('downloadFailed')}: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`${i18n('downloadFailed')}: ${error.message}`, 'error');
  }
}

function toggleAutoRefresh() {
  const checkbox = document.getElementById('autoRefreshCheck');
  
  if (checkbox.checked) {
    state.autoRefreshInterval = setInterval(() => loadQuotaData(), state.refreshIntervalMs);
    saveAutoRefreshState(true, state.refreshIntervalMs);
    showToast(i18n('autoRefreshEnabled').replace('{interval}', formatInterval(state.refreshIntervalMs)), 'success');
  } else {
    if (state.autoRefreshInterval) {
      clearInterval(state.autoRefreshInterval);
      state.autoRefreshInterval = null;
    }
    saveAutoRefreshState(false);
    showToast(i18n('autoRefreshDisabled'), 'info');
  }
}

function changeRefreshInterval() {
  const select = document.getElementById('refreshIntervalSelect');
  state.refreshIntervalMs = parseInt(select.value, 10);
  saveAutoRefreshState(document.getElementById('autoRefreshCheck').checked, state.refreshIntervalMs);
  
  const checkbox = document.getElementById('autoRefreshCheck');
  if (checkbox.checked && state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = setInterval(() => loadQuotaData(), state.refreshIntervalMs);
    showToast(i18n('intervalChanged').replace('{interval}', formatInterval(state.refreshIntervalMs)), 'success');
  }
}

function updateLastRefreshTime() {
  const element = document.getElementById('lastUpdate');
  const now = new Date();
  element.textContent = `Updated: ${now.toLocaleTimeString()}`;
}

function showUploadModal() {
  document.getElementById('uploadModal').style.display = 'block';
  document.getElementById('authContent').value = '';
}

function hideUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('authContent').value = e.target.result;
  };
  reader.readAsText(file);
}

async function uploadAuth() {
  const content = document.getElementById('authContent').value.trim();
  
  if (!content) {
    showToast(i18n('enterAuthContent'), 'error');
    return;
  }

  try {
    JSON.parse(content);

    const data = await uploadAuthApi(content);

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

function showAccountDetail(index) {
  const account = state.quotaData[index];
  if (!account) return;

  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailTitle');
  const content = document.getElementById('detailContent');

  title.textContent = account.email;

  if (!account.success) {
    content.innerHTML = `<p class="error-message">${i18n('failedToFetch')}: ${escapeHtml(account.error)}</p>`;
  } else {
    const models = account.quota?.models || [];
    
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

function hideDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
}

function toggleModels(index) {
  const modelsDiv = document.getElementById(`models-${index}`);
  const toggleText = document.getElementById(`toggle-text-${index}`);
  const toggleBtn = document.querySelector(`button[onclick="toggleModels(${index})"]`);
  
  const countMatch = toggleText.textContent.match(/\((\d+)\)/);
  const count = countMatch ? countMatch[1] : '';

  const isNowExpanded = toggleExpandedAccount(index);
  
  if (isNowExpanded) {
    modelsDiv.classList.remove('collapsed');
    toggleBtn.classList.add('active');
    toggleText.textContent = `${i18n('hideModels')} (${count})`;
  } else {
    modelsDiv.classList.add('collapsed');
    toggleBtn.classList.remove('active');
    toggleText.textContent = `${i18n('showModels')} (${count})`;
  }
}

function toggleDropdown(event, index) {
  event.stopPropagation();
  
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    if (el.id !== `dropdown-${index}`) {
      el.classList.remove('show');
    }
  });
  
  const dropdown = document.getElementById(`dropdown-${index}`);
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal-backdrop')) {
    event.target.style.display = 'none';
  }
  
  if (!event.target.closest('.account-controls')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => {
      el.classList.remove('show');
    });
  }
};

async function showProxyModal() {
  const modal = document.getElementById('proxyModal');
  modal.style.display = 'block';
  
  try {
    const data = await getProxyConfig();
    
    if (data.success && data.proxy) {
      document.getElementById('proxyEnabled').checked = data.proxy.enabled;
      document.getElementById('proxyType').value = data.proxy.type || 'http';
      document.getElementById('proxyUrl').value = data.proxy.url || '';
    }
  } catch (error) {
    console.error('Failed to load proxy settings:', error);
  }
}

function hideProxyModal() {
  document.getElementById('proxyModal').style.display = 'none';
}

async function testProxy() {
  const type = document.getElementById('proxyType').value;
  const url = document.getElementById('proxyUrl').value.trim();
  
  if (!url) {
    showToast(i18n('proxyPlaceholder'), 'warning');
    return;
  }
  
  const testBtn = document.querySelector('#proxyModal .btn-secondary');
  const originalText = testBtn.textContent;
  testBtn.textContent = '...';
  testBtn.disabled = true;
  
  try {
    const data = await testProxyApi(type, url);
    
    if (data.success) {
      showToast(`${i18n('proxyTestSuccess')} (${data.latency}ms)`, 'success');
    } else {
      showToast(`${i18n('proxyTestFailed')}: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`${i18n('proxyTestFailed')}: ${error.message}`, 'error');
  } finally {
    testBtn.textContent = originalText;
    testBtn.disabled = false;
  }
}

async function saveProxy() {
  const enabled = document.getElementById('proxyEnabled').checked;
  const type = document.getElementById('proxyType').value;
  const url = document.getElementById('proxyUrl').value.trim();
  
  try {
    const data = await saveProxyConfigApi({ enabled, type, url });
    
    if (data.success) {
      showToast(i18n('proxySaved'), 'success');
      hideProxyModal();
    } else {
      showToast(data.error, 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}
