// electron/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from "electron";
import { isTrackerPaused, setTrackerPaused } from "./ipc";

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);

  tray.setToolTip("Productivity Tracker");

  function buildMenu(): Menu {
    const paused = isTrackerPaused();
    return Menu.buildFromTemplate([
      {
        label: "Open Dashboard",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: "separator" },
      {
        label: paused ? "Resume Tracking" : "Pause Tracking",
        click: () => {
          setTrackerPaused(!paused);
          tray.setContextMenu(buildMenu());
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        },
      },
    ]);
  }

  tray.setContextMenu(buildMenu());

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
