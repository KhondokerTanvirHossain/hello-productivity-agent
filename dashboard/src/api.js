// dashboard/src/api.js
export const api = {
  getBlocksToday: () => window.electronAPI.getBlocksToday(),
  getBlocksTodayLive: () => window.electronAPI.getBlocksTodayLive(),
  getSummaryWeek: (date) => window.electronAPI.getSummaryWeek(date),
  updateBlock: (id, data) => window.electronAPI.updateBlock(id, data),
};
