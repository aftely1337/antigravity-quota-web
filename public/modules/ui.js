/**
 * UI 组件模块
 */

import { i18n } from './i18n.js';
import { getStatus, formatTimeUntilReset, escapeHtml } from './utils.js';

/**
 * 显示 Toast 通知
 */
export function showToast(message, type = 'info') {
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
 * 渲染配额概览项
 */
export function renderQuotaSummaryItem(name, quota) {
  const percentage = quota.remainingPercentage ?? 0;
  const status = getStatus(percentage);
  const resetTimeFormatted = formatTimeUntilReset(quota.resetTime);
  
  return `
    <div class="model-item summary-item-card">
      <div class="model-header">
        <span class="model-name">${name}</span>
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
 * 渲染模型卡片
 */
export function renderModelCard(model) {
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
 * 渲染分页控件
 */
export function renderPagination(current, total, onPageChange) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (total < 1) {
    container.innerHTML = '';
    return;
  }

  let buttons = '';
  
  buttons += `
    <button class="page-btn" ${current === 1 ? 'disabled' : ''} data-page="${current - 1}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      buttons += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
  } else {
    const showPages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = Array.from(showPages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
    
    let prev = 0;
    for (const p of sorted) {
      if (prev > 0 && p - prev > 1) {
        buttons += `<span style="color: var(--text-tertiary);">...</span>`;
      }
      buttons += `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
      prev = p;
    }
  }

  buttons += `
    <button class="page-btn" ${current === total ? 'disabled' : ''} data-page="${current + 1}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  container.innerHTML = buttons;
  
  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (!btn.disabled) {
        onPageChange(page);
      }
    });
  });
}

/**
 * 渲染全局概览项
 */
export function renderGlobalSummaryItem(name, totalPercentage, count) {
  if (count === 0) return '';
  
  const avgPercentage = totalPercentage / count;
  const status = getStatus(avgPercentage);
  
  return `
    <div class="shared-quota-item">
      <div class="shared-quota-header">
        <span class="shared-quota-name">${name}</span>
        <span class="model-badge badge-${status.class}">${i18n(status.text.toLowerCase())}</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar progress-${status.class}" style="width: ${Math.max(0, Math.min(100, avgPercentage))}%"></div>
      </div>
      <div class="model-meta">
        <span>${i18n('activeAccounts')}: ${count}</span>
        <span>${i18n('average')}: ${avgPercentage.toFixed(1)}%</span>
      </div>
    </div>
  `;
}
