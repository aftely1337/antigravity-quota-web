/**
 * 国际化模块
 */

let currentLang = 'zh';

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
    download: 'Download',
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
    autoRefreshEnabled: 'Auto refresh enabled ({interval})',
    autoRefreshDisabled: 'Auto refresh disabled',
    intervalChanged: 'Refresh interval changed to {interval}',
    accountRefreshed: 'Account refreshed successfully',
    accountDeleted: 'Account deleted successfully',
    imported: 'Imported',
    importFailed: 'Import failed',
    refreshFailed: 'Refresh failed',
    deleteFailed: 'Delete failed',
    downloadFailed: 'Download failed',
    invalidJson: 'Invalid JSON',
    enterAuthContent: 'Please enter auth content',
    connectionError: 'Connection Error',
    tryAgain: 'Try Again',
    failedToFetch: 'Failed to fetch quota',
    noModelQuota: 'No model quota information available.',
    showModels: 'Show Models',
    hideModels: 'Hide Models',
    totalQuota: 'Total Quota',
    activeAccounts: 'Active Accounts',
    average: 'Avg',
    total: 'Total',
    showing: 'Showing',
    proxySettings: 'Proxy Settings',
    proxyEnabled: 'Enable Proxy',
    proxyType: 'Proxy Type',
    proxyUrl: 'Proxy URL',
    proxyPlaceholder: 'e.g. socks5://127.0.0.1:7890',
    testProxy: 'Test',
    saveProxy: 'Save',
    proxySaved: 'Proxy settings saved',
    proxyTestSuccess: 'Proxy connection successful',
    proxyTestFailed: 'Proxy connection failed'
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
    download: '下载',
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
    autoRefreshEnabled: '自动刷新已启用 ({interval})',
    autoRefreshDisabled: '自动刷新已禁用',
    intervalChanged: '刷新间隔已更改为 {interval}',
    accountRefreshed: '账号刷新成功',
    accountDeleted: '账号删除成功',
    imported: '已导入',
    importFailed: '导入失败',
    refreshFailed: '刷新失败',
    deleteFailed: '删除失败',
    downloadFailed: '下载失败',
    invalidJson: '无效的 JSON',
    enterAuthContent: '请输入 auth 内容',
    connectionError: '连接错误',
    tryAgain: '重试',
    failedToFetch: '获取配额失败',
    noModelQuota: '暂无模型配额信息。',
    showModels: '显示模型',
    hideModels: '隐藏模型',
    totalQuota: '总配额',
    activeAccounts: '活跃账号',
    average: '平均',
    total: '总计',
    showing: '显示',
    proxySettings: '代理设置',
    proxyEnabled: '启用代理',
    proxyType: '代理类型',
    proxyUrl: '代理地址',
    proxyPlaceholder: '例如 socks5://127.0.0.1:7890',
    testProxy: '测试',
    saveProxy: '保存',
    proxySaved: '代理设置已保存',
    proxyTestSuccess: '代理连接成功',
    proxyTestFailed: '代理连接失败'
  }
};

export function getCurrentLang() {
  return currentLang;
}

export function setCurrentLang(lang) {
  currentLang = lang;
}

export function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  updateLanguage();
}

export function i18n(key) {
  return translations[currentLang][key] || key;
}

export function updateLanguage() {
  const t = translations[currentLang];
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
}
