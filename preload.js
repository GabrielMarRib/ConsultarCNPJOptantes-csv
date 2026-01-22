const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  
    iniciar: (nomeArquivo) => ipcRenderer.send('bot-iniciar', nomeArquivo),
    parar: () => ipcRenderer.send('bot-parar'),
    aoReceberLog: (callback) => ipcRenderer.on('log-atualizacao', (event, texto) => callback(texto)),
    aoFinalizar: (callback) => ipcRenderer.on('bot-status-finalizado', () => callback())
});