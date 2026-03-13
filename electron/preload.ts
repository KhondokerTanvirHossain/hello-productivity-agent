// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getBlocksToday: () => ipcRenderer.invoke("get-blocks-today"),
  getBlocksTodayLive: () => ipcRenderer.invoke("get-blocks-today-live"),
  getSummaryWeek: (date?: string) => ipcRenderer.invoke("get-summary-week", date),
  updateBlock: (id: number, data: object) => ipcRenderer.invoke("update-block", id, data),
  getTrackerStatus: () => ipcRenderer.invoke("get-tracker-status"),
  pauseTracking: () => ipcRenderer.invoke("pause-tracking"),
  resumeTracking: () => ipcRenderer.invoke("resume-tracking"),
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.removeAllListeners("navigate");
    ipcRenderer.on("navigate", (_event, route: string) => callback(route));
  },
});
