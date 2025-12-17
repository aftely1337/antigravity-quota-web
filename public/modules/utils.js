/**
 * 工具函数模块 - 统一前后端逻辑
 */

import { i18n } from './i18n.js';

/**
 * 获取状态信息
 */
export function getStatus(percentage) {
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
 * 格式化重置时间
 */
export function formatTimeUntilReset(resetTime) {
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
 * 格式化时间间隔
 */
export function formatInterval(ms) {
  if (ms < 60000) return `${ms / 1000}s`;
  return `${ms / 60000}m`;
}

/**
 * HTML 转义
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 获取账号 Claude 配额
 */
export function getAccountClaudeQuota(models) {
  const claudeModel = models.find(m => m.modelId.toLowerCase().includes('claude') && m.quotaInfo);
  return claudeModel?.quotaInfo || null;
}

/**
 * 获取账号 Gemini 配额
 */
export function getAccountGeminiQuota(models) {
  const geminiModel = models.find(m => {
    const name = m.name?.toLowerCase() || '';
    return name.includes('gemini 3 pro') && name.includes('high') && m.quotaInfo;
  }) || models.find(m => {
    const name = m.name?.toLowerCase() || '';
    return name.includes('gemini 3 pro') && name.includes('low') && m.quotaInfo;
  }) || models.find(m => {
    const name = m.name?.toLowerCase() || '';
    const modelId = m.modelId?.toLowerCase() || '';
    const isGemini3Pro = name.includes('gemini 3 pro') || modelId.includes('gemini-3-pro') || modelId.includes('gemini_3_pro');
    const isImage = name.includes('image') || modelId.includes('image');
    return isGemini3Pro && !isImage && m.quotaInfo;
  });
  return geminiModel?.quotaInfo || null;
}
