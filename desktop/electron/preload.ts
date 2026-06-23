/**
 * Preload — runs with context isolation + sandbox on. Exposes only a tiny,
 * read-only surface to the web app (the trusted SPA loaded from loopback).
 * Privileged actions (e.g. opening the data folder) stay in the main process
 * behind the native menu, never bridged to web content.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('stickerdex', {
  /** Returns the installed app version string. */
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
});
