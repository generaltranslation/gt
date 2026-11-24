import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { getLocale, getLocales } from 'gt-i18n';
import { onLocaleChange, setLocale } from 'gt-i18n/standalone';
import { menuTemplate, startI18n } from './i18n.js';

const savedLocaleFile = path.join(app.getPath('userData'), 'locale.txt');

// setLocale() rejects when a locale's translations cannot be loaded, and the locale stays as it was.
function changeLocale(locale: string) {
  return setLocale(locale).catch((error) => {
    console.error(error);
    // Electron has already checked the menu item that was clicked.
    showMenu();
  });
}

function showMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(changeLocale)));
}

await app.whenReady();

// The main process owns the locale: it starts GT, and every window follows it.
const savedLocale = await readFile(savedLocaleFile, 'utf8').catch(() => '');
await startI18n(app.getAppPath(), [
  savedLocale,
  ...app.getPreferredSystemLanguages(),
]);
showMenu();

// One write at a time, so the file ends on the locale chosen last.
let saving = Promise.resolve();
onLocaleChange((locale) => {
  showMenu();
  saving = saving
    .then(() => writeFile(savedLocaleFile, locale))
    .catch(console.error);
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    browserWindow.webContents.send('gt:locale-changed', locale);
  }
});

ipcMain.on('gt:get-locale', (event) => {
  event.returnValue = getLocale();
});
// The page is another process: an unsupported locale would resolve to the default one.
ipcMain.handle('gt:set-locale', (_event, locale: unknown) => {
  if (typeof locale === 'string' && getLocales().includes(locale)) {
    return changeLocale(locale);
  }
});

const mainWindow = new BrowserWindow({
  width: 720,
  height: 480,
  webPreferences: {
    preload: path.join(import.meta.dirname, 'preload.cjs'),
  },
});
await mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));

app.on('window-all-closed', () => app.quit());
