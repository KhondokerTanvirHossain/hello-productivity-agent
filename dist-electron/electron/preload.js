"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// electron/preload.ts
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getBlocksToday: () => electron_1.ipcRenderer.invoke("get-blocks-today"),
    getBlocksTodayLive: () => electron_1.ipcRenderer.invoke("get-blocks-today-live"),
    getSummaryWeek: (date) => electron_1.ipcRenderer.invoke("get-summary-week", date),
    updateBlock: (id, data) => electron_1.ipcRenderer.invoke("update-block", id, data),
    getTrackerStatus: () => electron_1.ipcRenderer.invoke("get-tracker-status"),
    pauseTracking: () => electron_1.ipcRenderer.invoke("pause-tracking"),
    resumeTracking: () => electron_1.ipcRenderer.invoke("resume-tracking"),
    onNavigate: (callback) => {
        electron_1.ipcRenderer.on("navigate", (_event, route) => callback(route));
    },
});
//# sourceMappingURL=preload.js.map