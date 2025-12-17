/**
 * 状态管理模块
 */

export const state = {
  autoRefreshInterval: null,
  refreshIntervalMs: 60000,
  quotaData: [],
  currentPage: 1,
  itemsPerPage: 12,
  searchQuery: '',
  accountToDelete: null,
  expandedAccounts: new Set()
};

export function saveAutoRefreshState(enabled, interval) {
  localStorage.setItem('autoRefreshEnabled', enabled ? 'true' : 'false');
  if (interval) {
    localStorage.setItem('autoRefreshInterval', interval.toString());
  }
}

export function loadAutoRefreshState() {
  const savedInterval = localStorage.getItem('autoRefreshInterval');
  if (savedInterval) {
    state.refreshIntervalMs = parseInt(savedInterval, 10);
  }
  
  const enabled = localStorage.getItem('autoRefreshEnabled') === 'true';
  return { enabled, interval: state.refreshIntervalMs };
}

export function setQuotaData(data) {
  state.quotaData = data;
}

export function setSearchQuery(query) {
  state.searchQuery = query.toLowerCase().trim();
  state.currentPage = 1;
}

export function setCurrentPage(page) {
  state.currentPage = page;
}

export function toggleExpandedAccount(index) {
  if (state.expandedAccounts.has(index)) {
    state.expandedAccounts.delete(index);
    return false;
  } else {
    state.expandedAccounts.add(index);
    return true;
  }
}

export function isAccountExpanded(index) {
  return state.expandedAccounts.has(index);
}
