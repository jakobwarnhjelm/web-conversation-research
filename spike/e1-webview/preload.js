const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spike", {
  sync: (payload) => ipcRenderer.invoke("view:sync", payload),
  metrics: () => ipcRenderer.invoke("view:metrics"),
});
