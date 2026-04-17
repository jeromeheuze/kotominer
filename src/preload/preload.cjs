const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kotominer', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

  getCpuInfo: () => ipcRenderer.invoke('hardware:cpu'),
  getCpuTemp: () => ipcRenderer.invoke('hardware:temp'),

  getMinerPaths: () => ipcRenderer.invoke('miner:paths'),
  restoreMiner: () => ipcRenderer.invoke('miner:restore'),
  minerStart: (cfg) => ipcRenderer.invoke('miner:start', cfg),
  minerStop: () => ipcRenderer.invoke('miner:stop'),
  getMinerStatus: () => ipcRenderer.invoke('miner:status'),
  minerKillAll: () => ipcRenderer.invoke('miner:killAll'),

  minerBenchmarkRun: (payload) => ipcRenderer.invoke('miner:benchmarkRun', payload),
  minerBenchmarkCancel: () => ipcRenderer.invoke('miner:benchmarkCancel'),
  onBenchmarkProgress: (cb) => {
    const fn = (_e, msg) => cb(msg);
    ipcRenderer.on('miner:benchmark-progress', fn);
    return () => ipcRenderer.removeListener('miner:benchmark-progress', fn);
  },
  applyBenchmarkWinner: (basename) => ipcRenderer.invoke('miner:setBenchmarkWinner', { basename }),

  onMinerStats: (cb) => {
    const fn = (_e, s) => cb(s);
    ipcRenderer.on('miner:stats', fn);
    return () => ipcRenderer.removeListener('miner:stats', fn);
  },
  onMinerLog: (cb) => {
    const fn = (_e, line) => cb(line);
    ipcRenderer.on('miner:log', fn);
    return () => ipcRenderer.removeListener('miner:log', fn);
  },
  onMinerError: (cb) => {
    const fn = (_e, msg) => cb(msg);
    ipcRenderer.on('miner:error', fn);
    return () => ipcRenderer.removeListener('miner:error', fn);
  },
  onMinerStarted: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('miner:started', fn);
    return () => ipcRenderer.removeListener('miner:started', fn);
  },
  onMinerStopped: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('miner:stopped', fn);
    return () => ipcRenderer.removeListener('miner:stopped', fn);
  },
  onMinerClose: (cb) => {
    const fn = (_e, code) => cb(code);
    ipcRenderer.on('miner:close', fn);
    return () => ipcRenderer.removeListener('miner:close', fn);
  },

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
