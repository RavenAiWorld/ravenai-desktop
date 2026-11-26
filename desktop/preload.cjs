'use strict'

const { contextBridge, ipcRenderer } = require('electron')

if (process.isMainFrame && location.origin === 'https://ravenaiworld.org') {
  contextBridge.exposeInMainWorld('ravenDesktop', Object.freeze({
    readStorage: () => ipcRenderer.invoke('raven:storage:read'),
    writeStorage: (data) => ipcRenderer.invoke('raven:storage:write', data),
    getInfo: () => ipcRenderer.invoke('raven:info'),
    navigation: (action) => ipcRenderer.invoke('raven:navigate', action),
    setTheme: (dark) => ipcRenderer.invoke('raven:theme', !!dark),
    onNavigation: (callback) => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('raven:navigation', listener)
      return () => ipcRenderer.removeListener('raven:navigation', listener)
    },
  }))
}
