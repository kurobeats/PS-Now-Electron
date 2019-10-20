console.log("inject_ipc loaded");

// In current electron ipc is divided into main and render process channels. We have to use the latter here -- SB 
const ipcRenderer = require('electron').ipcRenderer;
//console.log("ipcRenderer=", ipcRenderer);
window.ipc = ipcRenderer;

