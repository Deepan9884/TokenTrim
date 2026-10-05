/**
 * TokenTrim v1.1 - Background Service Worker
 * Context menus + side panel + pending-file handoff. No document bytes here.
 */

chrome.runtime.onInstalled.addListener(async () => {
  console.log('TokenTrim extension installed');
  createContextMenus();
  try { await chrome.storage.local.set({ tokentrim_onboarded_v11: false }); } catch { /* ignore */ }
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    }
  } catch { /* sidePanel optional */ }
});

function createContextMenus() {
  try { chrome.contextMenus.removeAll(() => registerMenus()); }
  catch { registerMenus(); }
}
function registerMenus() {
  try {
    chrome.contextMenus.create({
      id: 'convert-pdf-link', title: 'Convert PDF for AI chat',
      contexts: ['link'], targetUrlPatterns: ['*://*/*.pdf', '*://*/*.pdf?*', '*://*/*.PDF', '*://*/*.PDF?*']
    });
    chrome.contextMenus.create({
      id: 'convert-pdf-page', title: 'Convert this PDF for AI chat',
      contexts: ['page'], documentUrlPatterns: ['*://*/*.pdf', '*://*/*.pdf?*', '*://*/*.PDF', '*://*/*.PDF?*']
    });
    chrome.contextMenus.create({
      id: 'convert-doc-link', title: 'Convert document for AI chat',
      contexts: ['link'],
      targetUrlPatterns: ['*://*/*.docx', '*://*/*.docx?*', '*://*/*.pptx', '*://*/*.pptx?*', '*://*/*.xlsx', '*://*/*.xlsx?*', '*://*/*.epub', '*://*/*.epub?*']
    });
    chrome.contextMenus.create({
      id: 'open-side-panel', title: 'Open TokenTrim panel', contexts: ['page', 'link']
    });
  } catch (e) { console.warn('Menu registration:', e); }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-side-panel') {
    try {
      if (chrome.sidePanel && tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) { console.warn('Side panel open failed:', e); }
    return;
  }
  let pdfUrl = null;
  let pdfName = 'document.pdf';
  if (info.menuItemId === 'convert-pdf-link') { pdfUrl = info.linkUrl; pdfName = extractFilenameFromUrl(pdfUrl); }
  else if (info.menuItemId === 'convert-pdf-page') { pdfUrl = info.pageUrl; pdfName = extractFilenameFromUrl(pdfUrl); }
  else if (info.menuItemId === 'convert-doc-link') { pdfUrl = info.linkUrl; pdfName = extractAnyFilenameFromUrl(pdfUrl); }
  if (pdfUrl) {
    try {
      await chrome.storage.local.set({ pendingPdfUrl: pdfUrl, pendingPdfName: pdfName, pendingAt: Date.now() });
      // Prefer side panel (direct), fall back to notification-less badge hint
      try {
        const win = tab?.windowId;
        if (win && chrome.sidePanel) await chrome.sidePanel.open({ windowId: win });
        else await showConversionNotification(pdfName);
      } catch { await showConversionNotification(pdfName); }
    } catch (error) { console.error('Error handling context menu click:', error); }
  }
});

async function showConversionNotification(filename) {
  try {
    if (!chrome.notifications) return;
    await chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon128.png', title: 'TokenTrim - PDF Ready',
      message: `Click the extension icon to convert "${filename}" to Markdown.`, priority: 1
    });
  } catch (error) { console.warn('Notification skipped:', error); }
}

if (chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener(() => {
    console.log('Notification clicked - user should click extension icon');
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Extension-only channel (web pages cannot spoof chrome.runtime without
  // externally_connectable), but still verify the sender when present.
  if (sender && sender.id && sender.id !== chrome.runtime.id) return false;
  if (message.action === 'getPdfUrl') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url;
        if (isPdfUrl(url)) sendResponse({ url, filename: extractFilenameFromUrl(url) });
        else sendResponse({ url: null, filename: null });
      }
    });
    return true;
  }
  if (message.action === 'convertPdf') {
    handlePdfConversion(message.url, message.filename).then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.action === 'openPanel') {
    (async () => {
      try { if (sender.tab?.windowId && chrome.sidePanel) await chrome.sidePanel.open({ windowId: sender.tab.windowId }); } catch { /* ignore */ }
      sendResponse({ ok: true });
    })();
    return true;
  }
  return false;
});

async function handlePdfConversion(pdfUrl, filename) {
  try {
    await chrome.storage.local.set({ pendingPdfUrl: pdfUrl, pendingPdfName: filename || 'document.pdf', pendingAt: Date.now() });
    await showConversionNotification(filename || 'document.pdf');
  } catch (error) { console.error('Error in handlePdfConversion:', error); }
}

function isPdfUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('.pdf') || u.includes('application/pdf');
}
function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const filename = (urlObj.pathname.split('/').pop() || '').split('?')[0];
    if (!filename.toLowerCase().endsWith('.pdf')) return (filename || 'document') + '.pdf';
    return filename || 'document.pdf';
  } catch { return 'document.pdf'; }
}
function extractAnyFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const raw = decodeURIComponent((urlObj.pathname.split('/').pop() || '').split('?')[0] || '');
    if (!raw) return 'document.pdf';
    if (/\.(pdf|docx|pptx?|xlsx?|csv|epub|html?|txt|md)$/i.test(raw)) return raw;
    return raw + '.pdf';
  } catch { return 'document.pdf'; }
}

chrome.action.onClicked.addListener((tab) => { console.log('Extension icon clicked on tab:', tab.id); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isPdfUrl(tab.url)) console.log('PDF page detected:', tab.url);
});

self.addEventListener('error', (event) => console.error('Service worker error:', event.error));
self.addEventListener('unhandledrejection', (event) => console.error('Unhandled promise rejection:', event.reason));
console.log('TokenTrim background service worker loaded (v1.1)');
