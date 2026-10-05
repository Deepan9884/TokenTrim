/**
 * TokenTrim v1.1 - Popup UI Logic
 * Private, local-first document → AI-ready Markdown.
 */

import { converter } from './lib/converter.js';
import { getPreset, applyPresetToOptions, DOCUMENT_PRESETS } from './lib/presets.js';
import { getErrorInfo } from './lib/errors.js';
import { Telemetry } from './lib/telemetry.js';
import { ChunkStore } from './lib/chunk-store.js';
import { License } from './lib/license.js';
import { FeatureFlags } from './lib/flags.js';
import { buildPromptPack, PROMPT_TASKS } from './lib/prompt-pack.js';
import { parsePageRange } from './lib/page-range.js';
import { AdminAPI } from './lib/admin-api.js';
import { detectSourceType, getSourceType } from './lib/converters/source-types.js';

// Expose AdminAPI for testing (E2E flush hook)
if (typeof window !== 'undefined') {
  window.AdminAPI = AdminAPI;
}

const AppState = { ONBOARDING: 'onboarding', EMPTY: 'empty', LOADED: 'loaded', CONVERTING: 'converting', SUCCESS: 'success', HISTORY: 'history', ERROR: 'error' };

let currentState = AppState.EMPTY;
let currentFile = null;
let convertedMarkdown = null;
let conversionResult = null;
let batchQueue = [];
let currentPreset = 'claude';
let flags = {};
let conversionOptions = { stripHeaders: true, formatTables: true, compressionMode: 'extractive', tokenBudget: 8000, docPreset: 'general', query: '' };

let elements = {};

function $(id) { return document.getElementById(id); }

function initElements() {
  elements = {
    viewOnboarding: $('view-onboarding'), viewEmpty: $('view-empty'), viewLoaded: $('view-loaded'),
    viewConverting: $('view-converting'), viewSuccess: $('view-success'), viewHistory: $('view-history'),
    dropzone: $('dropzone'), fileInput: $('fileInput'), emptyBrowseBtn: $('emptyBrowseBtn'),
    quickPreset: $('quickPreset'), batchBtn: $('batchBtn'), batchInput: $('batchInput'), batchList: $('batchList'),
    sizeHint: $('sizeHint'),
    fileName: $('fileName'), fileStats: $('fileStats'), fileIcon: $('fileIcon'), fileIconSymbol: $('fileIconSymbol'),
    fileBadge: $('fileBadge'), removeFileBtn: $('removeFileBtn'),
    stripHeadersOption: $('stripHeadersOption'), formatTablesOption: $('formatTablesOption'),
    modeSelect: $('modeSelect'), budgetSelect: $('budgetSelect'), docTypeSelect: $('docTypeSelect'),
    pageRangeInput: $('pageRangeInput'), pageRangeError: $('pageRangeError'), queryInput: $('queryInput'),
    convertBtn: $('convertBtn'),
    progressStatus: $('progressStatus'), progressPercentage: $('progressPercentage'), progressBarFill: $('progressBarFill'),
    tokenSavings: $('tokenSavings'), originalTokens: $('originalTokens'), optimizedTokens: $('optimizedTokens'),
    modelBadge: $('modelBadge'), mdFilename: $('mdFilename'), mdSize: $('mdSize'), markdownPreview: $('markdownPreview'),
    qualityReport: $('qualityReport'), qualitySummary: $('qualitySummary'), warningsList: $('warningsList'),
    promptTaskSelect: $('promptTaskSelect'), promptPackBtn: $('promptPackBtn'),
    promptPackText: $('promptPackText'), promptPackIcon: $('promptPackIcon'),
    promptTaskDesc: $('promptTaskDesc'), promptPreviewToggle: $('promptPreviewToggle'),
    promptPreviewBox: $('promptPreviewBox'), promptPreviewCode: $('promptPreviewCode'),
    copyBtn: $('copyBtn'), copyIcon: $('copyIcon'), copyText: $('copyText'),
    downloadBtn: $('downloadBtn'), convertAnotherBtn: $('convertAnotherBtn'),
    fbMissing: $('fbMissing'), fbTable: $('fbTable'), fbOrder: $('fbOrder'),
    historyBtn: $('historyBtn'), historyList: $('historyList'), historyBackBtn: $('historyBackBtn'), historyClearBtn: $('historyClearBtn'),
    settingsBtn: $('settingsBtn'), presetsBtn: $('presetsBtn'),
    settingsModal: $('settingsModal'), closeSettingsBtn: $('closeSettingsBtn'), saveSettingsBtn: $('saveSettingsBtn'),
    presetGrid: $('presetGrid'), presetDesc: $('presetDesc'),
    settingDefaultStrip: $('settingDefaultStrip'), settingDefaultTables: $('settingDefaultTables'),
    telemetryToggle: $('telemetryToggle'), ocrToggle: $('ocrToggle'),
    licenseInput: $('licenseInput'), licenseActivate: $('licenseActivate'), licenseStatus: $('licenseStatus'),
    planName: $('planName'), planSubtitle: $('planSubtitle'), planStatusPill: $('planStatusPill'),
    planLimitText: $('planLimitText'), planModesText: $('planModesText'), planSyncText: $('planSyncText'),
    userAvatarBtn: $('userAvatarBtn'), userAvatarLetter: $('userAvatarLetter'),
    settingsAccountSection: $('settingsAccountSection'),
    accountProfileLetter: $('accountProfileLetter'),
    authUserEmail: $('authUserEmail'), authUserPlan: $('authUserPlan'), btnSignOut: $('btnSignOut'),
    authSignedIn: $('authSignedIn'),
    authSignedOut: $('authSignedOut'),
    btnGoToSignIn: $('btnGoToSignIn'),
    onboardingBtnGuest: $('onboardingBtnGuest'),
    cloudSyncToggle: $('cloudSyncToggle'),
    tabSignIn: $('tabSignIn'), tabSignUp: $('tabSignUp'), authTabBar: $('authTabBar'),
    onboardSignInPane: $('onboardSignInPane'), onboardSignUpPane: $('onboardSignUpPane'),
    onboardingEmail: $('onboardingEmail'), onboardingPassword: $('onboardingPassword'),
    onboardingLinkForgot: $('onboardingLinkForgot'), onboardingBtnSignIn: $('onboardingBtnSignIn'),
    onboardingSuEmail: $('onboardingSuEmail'), onboardingSuPassword: $('onboardingSuPassword'),
    onboardingSuPin: $('onboardingSuPin'), onboardingBtnSignUp: $('onboardingBtnSignUp'),
    onboardForgotPane: $('onboardForgotPane'), onboardFpEmail: $('onboardFpEmail'),
    onboardFpPin: $('onboardFpPin'), onboardFpNewPassword: $('onboardFpNewPassword'),
    onboardBtnResetPassword: $('onboardBtnResetPassword'), onboardBtnBackToSignIn: $('onboardBtnBackToSignIn'),
    onboardingAuthError: $('onboardingAuthError'),
    formatHubPane: $('formatHubPane'),
    formatSectionPane: $('formatSectionPane'),
    bannerPdf: $('bannerPdf'),
    bannerDocx: $('bannerDocx'),
    bannerPpt: $('bannerPpt'),
    bannerImg: $('bannerImg'),
    bannerImgPill: $('bannerImgPill'),
    bannerImgCta: $('bannerImgCta'),
    sectionBackBtn: $('sectionBackBtn'),
    sectionTitle: $('sectionTitle'),
    sectionTierBadge: $('sectionTierBadge'),
    sectionPptLimitNotice: $('sectionPptLimitNotice'),
    sectionImageProNotice: $('sectionImageProNotice'),
    sectionUnlockProBtn: $('sectionUnlockProBtn'),
    sectionDropzone: $('sectionDropzone'),
    sectionDropzoneImg: $('sectionDropzoneImg'),
    sectionDropTitle: $('sectionDropTitle'),
    sectionDropSubtitle: $('sectionDropSubtitle'),
    sectionBrowseBtnText: $('sectionBrowseBtnText'),
    sectionFileInput: $('sectionFileInput'),
    sectionOptionsCard: $('sectionOptionsCard'),
    sectionStripRow: $('sectionStripRow'),
    sectionTablesRow: $('sectionTablesRow'),
    sectionRangeRow: $('sectionRangeRow'),
    sectionRangeLabel: $('sectionRangeLabel'),
    sectionRangeHint: $('sectionRangeHint'),
    sectionRangeInput: $('sectionRangeInput'),
    sectionStripHeaders: $('sectionStripHeaders'),
    sectionFormatTables: $('sectionFormatTables'),
    sectionPrimaryBrowseBtn: $('sectionPrimaryBrowseBtn'),
    sectionPrimaryBrowseText: $('sectionPrimaryBrowseText'),
    proUpgradeModal: $('proUpgradeModal'),
    closeProModalBtn: $('closeProModalBtn'),
    proModalCloseBtn: $('proModalCloseBtn'),
    imageUnlockProBtn: $('imageUnlockProBtn'),
    proModalKeyInput: $('proModalKeyInput'),
    proModalActivateBtn: $('proModalActivateBtn'),
    proModalKeyError: $('proModalKeyError')
  };
}

async function init() {
  try {
    initElements();
    flags = await FeatureFlags.load().catch(() => ({}));
    await License.init().catch(() => {});
    await Telemetry.init().catch(() => {});
    await loadPreset();
    await loadDefaults();
    initializeEventListeners();
    updatePlanUI();
    updatePromptPackUI();
    syncOptionsToUI();
    const token = await AdminAPI.getToken();
    const seen = await storageGet('tokentrim_onboarded', false);
    const cachedUser = await storageGet('tokentrim_user', null);
    const savedEmail = (await storageGet('tokentrim_user_email', '')) || cachedUser?.email || '';

    if (token) {
      try {
        const remoteUser = await AdminAPI.me();
        if (remoteUser) {
          adminUser = remoteUser;
          await storageSet({ tokentrim_user: adminUser, tokentrim_user_email: adminUser.email, tokentrim_onboarded: true });
        } else {
          adminUser = null;
          await AdminAPI.setToken(null);
          await storageSet({ tokentrim_onboarded: false, tokentrim_user_email: '', tokentrim_user: null });
        }
      } catch {
        // Offline / server unreachable: restore cached user/email without clearing token
        if (cachedUser) adminUser = cachedUser;
        else if (savedEmail) adminUser = { email: savedEmail, name: '', plan: 'free', is_admin: false };
      }
    } else if (savedEmail) {
      adminUser = cachedUser || { email: savedEmail, name: '', plan: 'free', is_admin: false };
    }

    await refreshAuthUI();

    if (adminUser || seen) {
      switchToState(AppState.EMPTY);
      checkForPendingFile();
    } else {
      switchToState(AppState.ONBOARDING);
    }
  } catch (err) {
    console.error('Init failed:', err);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

function storage() {
  try { if (typeof chrome !== 'undefined' && chrome.storage?.local) return chrome.storage.local; } catch { /* ignore */ }
  return null;
}
async function storageGet(key, fallback) {
  const s = storage(); if (!s) return fallback;
  try { const r = await s.get([key]); return r[key] ?? fallback; } catch { return fallback; }
}
async function storageSet(obj) {
  const s = storage(); if (!s) return;
  try { await s.set(obj); } catch { /* ignore */ }
}

async function loadPreset() {
  const saved = await storageGet('tokentrim_preset', 'claude');
  if (saved) currentPreset = saved;
}

async function savePreset(p) {
  currentPreset = p;
  await storageSet({ tokentrim_preset: p });
}

async function loadDefaults() {
  const saved = await storageGet('tokentrim_defaults', null);
  if (saved && typeof saved === 'object') {
    if (typeof saved.stripHeaders === 'boolean') conversionOptions.stripHeaders = saved.stripHeaders;
    if (typeof saved.formatTables === 'boolean') conversionOptions.formatTables = saved.formatTables;
  }
}

async function saveDefaults() {
  await storageSet({
    tokentrim_defaults: {
      stripHeaders: conversionOptions.stripHeaders,
      formatTables: conversionOptions.formatTables
    }
  });
}

function presetOptions() {
  const docKeep = (DOCUMENT_PRESETS[conversionOptions.docPreset]?.keep) || [];
  const isPro = isProUser();
  return applyPresetToOptions(currentPreset, {
    stripHeaders: conversionOptions.stripHeaders,
    formatTables: conversionOptions.formatTables,
    compressionMode: conversionOptions.compressionMode,
    tokenBudget: conversionOptions.tokenBudget,
    docPreset: conversionOptions.docPreset,
    docKeep,
    query: conversionOptions.query,
    pageRange: conversionOptions.pageRange,
    slideRange: conversionOptions.pageRange,
    includeNotes: true,
    includeHidden: true,
    ocrEnabled: !!(flags && flags.ocrEnabled),
    ocrLang: 'eng',
    attemptOcr: true,
    maxBytes: License.maxBytes(),
    isPro,
    maxPptSlides: isPro ? Infinity : 10
  });
}

function syncOptionsToUI() {
  const p = getPreset(currentPreset);
  if (elements.presetDesc) elements.presetDesc.textContent = p.description;
  if (elements.quickPreset) elements.quickPreset.value = currentPreset;
  if (elements.presetGrid) {
    elements.presetGrid.querySelectorAll('.preset-pill').forEach(el => {
      el.classList.toggle('active', el.dataset.preset === currentPreset);
    });
  }
  if (elements.stripHeadersOption) elements.stripHeadersOption.checked = conversionOptions.stripHeaders;
  if (elements.formatTablesOption) elements.formatTablesOption.checked = conversionOptions.formatTables;
  if (elements.sectionStripHeaders) elements.sectionStripHeaders.checked = conversionOptions.stripHeaders;
  if (elements.sectionFormatTables) elements.sectionFormatTables.checked = conversionOptions.formatTables;
  if (elements.settingDefaultStrip) elements.settingDefaultStrip.checked = conversionOptions.stripHeaders;
  if (elements.settingDefaultTables) elements.settingDefaultTables.checked = conversionOptions.formatTables;
  if (elements.modeSelect) elements.modeSelect.value = conversionOptions.compressionMode;
  if (elements.budgetSelect) elements.budgetSelect.value = String(conversionOptions.tokenBudget);
  if (elements.docTypeSelect) elements.docTypeSelect.value = conversionOptions.docPreset;
  if (elements.telemetryToggle) elements.telemetryToggle.checked = Telemetry.enabled;
  if (elements.ocrToggle) elements.ocrToggle.checked = !!flags.ocrEnabled;
}

function serverPlanActive() {
  if (!adminUser || adminUser.plan !== 'pro') return false;
  const exp = adminUser.plan_expires_at;
  if (!exp) return true; // perpetual Pro
  const t = Date.parse(exp);
  return Number.isFinite(t) && t > Date.now();
}

function getEffectivePlan() {
  if (adminUser?.is_admin) return 'creator';
  if (serverPlanActive() || License.isPro()) return 'pro';
  return 'free';
}

function isProUser() {
  const p = getEffectivePlan();
  return p === 'pro' || p === 'creator';
}

function openProModal() {
  elements.proUpgradeModal?.classList.remove('hidden');
  if (elements.proModalKeyInput) elements.proModalKeyInput.value = '';
  if (elements.proModalKeyError) elements.proModalKeyError.classList.add('hidden');
}

function closeProModal() {
  elements.proUpgradeModal?.classList.add('hidden');
}

const FORMAT_CONFIGS = {
  pdf: {
    id: 'pdf',
    title: 'PDF Converter',
    badge: 'Free',
    badgeClass: '',
    img: 'icons/banner-pdf.svg',
    dropTitle: 'Drop your PDF file here',
    dropSub: 'Accepts .pdf files · Up to 50MB · 100% local',
    browseText: 'Browse PDF',
    primaryBrowse: 'Choose PDF File',
    accept: '.pdf,application/pdf',
    showPptNotice: false,
    showImageNotice: false,
    showRange: true,
    rangeLabel: 'Pages to extract',
    rangeHint: 'e.g. 1-10, 15 (Blank = all pages)',
    showStrip: true,
    showTables: true
  },
  docx: {
    id: 'docx',
    title: 'Word DOCX Converter',
    badge: 'Free',
    badgeClass: '',
    img: 'icons/banner-docx.svg',
    dropTitle: 'Drop your Word document here',
    dropSub: 'Accepts .docx files · Full formatting & tables',
    browseText: 'Browse DOCX',
    primaryBrowse: 'Choose Word File',
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    showPptNotice: false,
    showImageNotice: false,
    showRange: false,
    showStrip: true,
    showTables: true
  },
  pptx: {
    id: 'pptx',
    title: 'PowerPoint Converter',
    badge: 'Limited (Free: 10 slides)',
    badgeClass: 'limited',
    img: 'icons/banner-ppt.svg',
    dropTitle: 'Drop your PowerPoint presentation here',
    dropSub: 'Accepts .pptx and .ppt files · Slides & notes',
    browseText: 'Browse PowerPoint',
    primaryBrowse: 'Choose PowerPoint File',
    accept: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    showPptNotice: true,
    showImageNotice: false,
    showRange: true,
    rangeLabel: 'Slides to extract',
    rangeHint: 'e.g. 1-10 (Free plan extracts max 10 slides)',
    showStrip: true,
    showTables: false
  },
  image: {
    id: 'image',
    title: 'Image Converter (OCR & Vision)',
    badge: '⭐ PRO ONLY',
    badgeClass: 'pro',
    img: 'icons/banner-img.svg',
    dropTitle: 'Drop your image here',
    dropSub: 'PNG, JPG, WebP, GIF, TIFF · Local OCR & Vision',
    browseText: 'Browse Image',
    primaryBrowse: 'Choose Image File',
    accept: '.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,image/*',
    showPptNotice: false,
    showImageNotice: true,
    showRange: false,
    showStrip: true,
    showTables: false
  }
};

let activeFormat = null;
let pendingProFormat = null;

function openFormatSection(formatId) {
  if (formatId === 'image' && !isProUser()) {
    pendingProFormat = 'image';
    openProModal();
    return;
  }
  activeFormat = formatId;
  pendingProFormat = null;
  const cfg = FORMAT_CONFIGS[formatId];
  if (!cfg) return;

  const isPro = isProUser();

  if (elements.sectionTitle) elements.sectionTitle.textContent = cfg.title;
  if (elements.sectionTierBadge) {
    if (formatId === 'pptx') {
      elements.sectionTierBadge.textContent = isPro ? 'Pro Active' : 'Free: 10 slides';
      elements.sectionTierBadge.className = `section-tier-badge ${isPro ? 'pro' : 'limited'}`;
    } else if (formatId === 'image') {
      elements.sectionTierBadge.textContent = isPro ? 'Pro Active' : 'Pro Only';
      elements.sectionTierBadge.className = `section-tier-badge ${isPro ? 'pro' : 'limited'}`;
    } else {
      elements.sectionTierBadge.textContent = 'Free';
      elements.sectionTierBadge.className = 'section-tier-badge';
    }
  }

  if (elements.sectionDropzoneImg) elements.sectionDropzoneImg.src = cfg.img;
  if (elements.sectionDropTitle) elements.sectionDropTitle.textContent = cfg.dropTitle;
  if (elements.sectionDropSubtitle) elements.sectionDropSubtitle.textContent = cfg.dropSub;
  if (elements.sectionBrowseBtnText) elements.sectionBrowseBtnText.textContent = cfg.browseText;
  if (elements.sectionPrimaryBrowseText) elements.sectionPrimaryBrowseText.textContent = cfg.primaryBrowse;
  if (elements.sectionFileInput) {
    elements.sectionFileInput.accept = cfg.accept;
    elements.sectionFileInput.value = '';
  }

  if (elements.sectionPptLimitNotice) {
    elements.sectionPptLimitNotice.classList.toggle('hidden', !(cfg.showPptNotice && !isPro));
  }
  if (elements.sectionImageProNotice) {
    elements.sectionImageProNotice.classList.toggle('hidden', !(cfg.showImageNotice && !isPro));
  }

  if (elements.sectionStripRow) elements.sectionStripRow.classList.toggle('hidden', !cfg.showStrip);
  if (elements.sectionTablesRow) elements.sectionTablesRow.classList.toggle('hidden', !cfg.showTables);
  if (elements.sectionRangeRow) {
    elements.sectionRangeRow.classList.toggle('hidden', !cfg.showRange);
    if (elements.sectionRangeLabel) elements.sectionRangeLabel.textContent = cfg.rangeLabel;
    if (elements.sectionRangeHint) elements.sectionRangeHint.textContent = cfg.rangeHint;
  }

  elements.formatHubPane?.classList.add('hidden');
  elements.formatSectionPane?.classList.remove('hidden');
}

function closeFormatSection() {
  activeFormat = null;
  elements.formatSectionPane?.classList.add('hidden');
  elements.formatHubPane?.classList.remove('hidden');
}

function updatePlanUI() {
  const plan = getEffectivePlan();
  const isPro = plan === 'pro' || plan === 'creator';
  if (elements.sizeHint) elements.sizeHint.textContent = isPro ? 'All formats up to 200MB (Pro) · 100% local' : 'All formats up to 50MB · 100% local';
  if (elements.licenseStatus) elements.licenseStatus.textContent = isPro ? 'Pro active • 200MB • batch • OCR pilot • history' : 'Free plan • 50MB • single-file';
  if (elements.batchBtn) elements.batchBtn.disabled = false;

  if (elements.bannerImgPill) {
    elements.bannerImgPill.textContent = isPro ? 'PRO ACTIVE' : 'PRO';
    elements.bannerImgPill.className = `format-subtle-badge ${isPro ? 'badge-pro-active' : 'badge-pro'}`;
  }
  if (elements.bannerImgCta) {
    elements.bannerImgCta.textContent = isPro ? 'Enter Section →' : 'Pro Feature →';
  }

  if (elements.planName) {
    if (plan === 'creator') elements.planName.textContent = 'Creator Plan';
    else if (plan === 'pro') elements.planName.textContent = 'Pro Plan';
    else elements.planName.textContent = 'Free Plan';
  }
  if (elements.planSubtitle) {
    if (plan === 'creator') elements.planSubtitle.textContent = 'Full Admin & Pro Privileges';
    else if (plan === 'pro') elements.planSubtitle.textContent = 'Advanced Document Optimization';
    else elements.planSubtitle.textContent = 'Standard Document Conversion';
  }
  if (elements.planStatusPill) {
    elements.planStatusPill.textContent = plan === 'creator' ? 'Creator' : (isPro ? 'Pro Active' : 'Active');
    elements.planStatusPill.className = `plan-status-pill ${isPro ? 'pro' : ''}`;
  }
  if (elements.planLimitText) {
    elements.planLimitText.textContent = isPro ? 'Up to 200MB file size limit (Pro)' : 'Up to 50MB file size limit';
  }
  if (elements.planModesText) {
    elements.planModesText.textContent = isPro ? 'Batch mode, OCR pilot & advanced budgets' : 'Standard token compression modes';
  }
  if (elements.planSyncText) {
    elements.planSyncText.textContent = isPro ? 'Full cloud document sync & history' : 'Local & cloud document conversion';
  }
}

// ---------- state ----------
function hideAll() {
  [elements.viewOnboarding, elements.viewEmpty, elements.viewLoaded, elements.viewConverting, elements.viewSuccess, elements.viewHistory]
    .forEach(v => v && v.classList.add('hidden'));
  removeErrorBanner();
}
function switchToState(s, errorData = null) {
  currentState = s;
  hideAll();
  if (s === AppState.ONBOARDING) {
    elements.viewOnboarding?.classList.remove('hidden');
    elements.historyBtn?.classList.add('hidden');
    elements.settingsBtn?.classList.add('hidden');
    elements.userAvatarBtn?.classList.add('hidden');
  } else {
    elements.historyBtn?.classList.remove('hidden');
    elements.settingsBtn?.classList.remove('hidden');
    elements.userAvatarBtn?.classList.remove('hidden');
    if (s === AppState.EMPTY) {
      elements.viewEmpty?.classList.remove('hidden');
      currentFile = null;
      convertedMarkdown = null;
      conversionResult = null;
      closeFormatSection();
    }
    else if (s === AppState.LOADED) { elements.viewLoaded?.classList.remove('hidden'); updateFileDisplay(); }
    else if (s === AppState.CONVERTING) { elements.viewConverting?.classList.remove('hidden'); resetProgress(); }
    else if (s === AppState.SUCCESS) { elements.viewSuccess?.classList.remove('hidden'); updateSuccessDisplay(); }
    else if (s === AppState.HISTORY) { elements.viewHistory?.classList.remove('hidden'); renderHistory(); }
    else if (s === AppState.ERROR) { elements.viewLoaded?.classList.remove('hidden'); showErrorBanner(errorData); }
  }
}

// ---------- events ----------
function initializeEventListeners() {
  elements.dropzone?.addEventListener('dragover', e => { e.preventDefault(); });
  elements.dropzone?.addEventListener('drop', handleDrop);
  elements.dropzone?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elements.fileInput?.click(); }
  });
  elements.emptyBrowseBtn?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elements.fileInput?.click(); }
  });
  elements.fileInput?.addEventListener('change', handleFileSelect);
  elements.removeFileBtn?.addEventListener('click', handleRemoveFile);
  elements.stripHeadersOption?.addEventListener('change', e => { conversionOptions.stripHeaders = e.target.checked; saveDefaults(); });
  elements.formatTablesOption?.addEventListener('change', e => { conversionOptions.formatTables = e.target.checked; saveDefaults(); });
  elements.modeSelect?.addEventListener('change', e => { conversionOptions.compressionMode = e.target.value; });
  elements.budgetSelect?.addEventListener('change', e => { conversionOptions.tokenBudget = parseInt(e.target.value, 10) || 0; });
  elements.docTypeSelect?.addEventListener('change', e => { conversionOptions.docPreset = e.target.value; });
  elements.pageRangeInput?.addEventListener('input', readPageRange);
  elements.pageRangeInput?.addEventListener('change', readPageRange);
  elements.queryInput?.addEventListener('change', e => { conversionOptions.query = e.target.value || ''; });
  elements.quickPreset?.addEventListener('change', async e => { await savePreset(e.target.value); Telemetry.track('preset_changed', { preset: currentPreset }); syncOptionsToUI(); });
  elements.convertBtn?.addEventListener('click', handleConvert);
  elements.copyBtn?.addEventListener('click', handleCopy);
  elements.downloadBtn?.addEventListener('click', handleDownload);
  elements.convertAnotherBtn?.addEventListener('click', handleRemoveFile);
  elements.promptPackBtn?.addEventListener('click', handlePromptPack);
  elements.promptTaskSelect?.addEventListener('change', updatePromptPackUI);
  elements.promptPreviewToggle?.addEventListener('click', togglePromptPreview);
  elements.historyBtn?.addEventListener('click', () => switchToState(AppState.HISTORY));
  elements.historyBackBtn?.addEventListener('click', () => switchToState(currentFile ? AppState.LOADED : AppState.EMPTY));
  elements.historyClearBtn?.addEventListener('click', async () => { try { await ChunkStore.clearAll(); } catch { /* ignore */ } renderHistory(); });
  elements.batchBtn?.addEventListener('click', () => elements.batchInput?.click());
  elements.batchInput?.addEventListener('change', handleBatchSelect);
  elements.fbMissing?.addEventListener('click', () => sendFeedback('missing text'));
  elements.fbTable?.addEventListener('click', () => sendFeedback('broken table'));
  elements.fbOrder?.addEventListener('click', () => sendFeedback('wrong order'));

  // Format banners click handlers
  elements.bannerPdf?.addEventListener('click', () => openFormatSection('pdf'));
  elements.bannerDocx?.addEventListener('click', () => openFormatSection('docx'));
  elements.bannerPpt?.addEventListener('click', () => openFormatSection('pptx'));
  elements.bannerImg?.addEventListener('click', () => openFormatSection('image'));

  // Accessibility keyboard navigation for format banners
  [
    [elements.bannerPdf, 'pdf'],
    [elements.bannerDocx, 'docx'],
    [elements.bannerPpt, 'pptx'],
    [elements.bannerImg, 'image']
  ].forEach(([el, id]) => {
    el?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFormatSection(id);
      }
    });
  });

  // Dedicated section back button
  elements.sectionBackBtn?.addEventListener('click', closeFormatSection);

  // Dedicated format dropzone & file selection
  elements.sectionDropzone?.addEventListener('dragover', e => { e.preventDefault(); });
  elements.sectionDropzone?.addEventListener('drop', handleDrop);
  elements.sectionDropzone?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elements.sectionFileInput?.click(); }
  });
  elements.sectionPrimaryBrowseBtn?.addEventListener('click', () => elements.sectionFileInput?.click());
  elements.sectionFileInput?.addEventListener('change', handleFileSelect);

  // Section specific options sync
  elements.sectionStripHeaders?.addEventListener('change', e => {
    conversionOptions.stripHeaders = e.target.checked;
    if (elements.stripHeadersOption) elements.stripHeadersOption.checked = e.target.checked;
    saveDefaults();
  });
  elements.sectionFormatTables?.addEventListener('change', e => {
    conversionOptions.formatTables = e.target.checked;
    if (elements.formatTablesOption) elements.formatTablesOption.checked = e.target.checked;
    saveDefaults();
  });
  elements.sectionRangeInput?.addEventListener('input', () => {
    if (elements.pageRangeInput) elements.pageRangeInput.value = elements.sectionRangeInput.value;
    readPageRange();
  });
  elements.sectionRangeInput?.addEventListener('change', () => {
    if (elements.pageRangeInput) elements.pageRangeInput.value = elements.sectionRangeInput.value;
    readPageRange();
  });

  // Pro modal handlers
  elements.sectionUnlockProBtn?.addEventListener('click', openProModal);
  elements.imageUnlockProBtn?.addEventListener('click', openProModal);
  elements.closeProModalBtn?.addEventListener('click', closeProModal);
  elements.proModalCloseBtn?.addEventListener('click', closeProModal);
  elements.proUpgradeModal?.addEventListener('click', e => {
    if (e.target === elements.proUpgradeModal) closeProModal();
  });
  elements.proModalActivateBtn?.addEventListener('click', handleProModalActivate);
  elements.proModalKeyInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleProModalActivate();
  });

  setupSettingsHandlers();
  setupAuthHandlers();
}

async function handleProModalActivate() {
  const key = (elements.proModalKeyInput?.value || '').trim();
  if (!key) {
    if (elements.proModalKeyError) {
      elements.proModalKeyError.textContent = 'Please enter a license key.';
      elements.proModalKeyError.classList.remove('hidden');
    }
    return;
  }
  try {
    await License.activate(key);
    updatePlanUI();
    closeProModal();
    const target = pendingProFormat || 'image';
    openFormatSection(target);
    pendingProFormat = null;
  } catch {
    if (elements.proModalKeyError) {
      elements.proModalKeyError.textContent = 'Invalid key. Format: TT-PRO-XXXX…';
      elements.proModalKeyError.classList.remove('hidden');
    }
  }
}

function readPageRange() {
  const raw = (elements.pageRangeInput?.value || '').trim();
  hideRangeError();
  if (!raw) {
    conversionOptions.pageRange = null;
    conversionOptions.pageRangeError = null;
    return;
  }
  const parsed = parsePageRange(raw);
  if (parsed.error) {
    conversionOptions.pageRange = null;
    conversionOptions.pageRangeError = parsed.error;
    showRangeError(parsed.error);
  } else {
    conversionOptions.pageRange = parsed.pages ? { pages: parsed.pages } : null;
    conversionOptions.pageRangeError = null;
  }
}

function showRangeError(msg) {
  if (elements.pageRangeError) {
    elements.pageRangeError.textContent = msg;
    elements.pageRangeError.classList.remove('hidden');
  }
}

function hideRangeError() {
  if (elements.pageRangeError) {
    elements.pageRangeError.textContent = '';
    elements.pageRangeError.classList.add('hidden');
  }
}

function setupSettingsHandlers() {
  const descs = {
    claude: getPreset('claude').description, chatgpt: getPreset('chatgpt').description,
    gemini: getPreset('gemini').description, local: getPreset('local').description
  };
  elements.settingsBtn?.addEventListener('click', openSettings);
  elements.presetsBtn?.addEventListener('click', openSettings);
  elements.closeSettingsBtn?.addEventListener('click', closeSettings);
  elements.saveSettingsBtn?.addEventListener('click', closeSettings);
  elements.settingsModal?.addEventListener('click', e => { if (e.target === elements.settingsModal) closeSettings(); });
  elements.presetGrid?.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      elements.presetGrid.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      await savePreset(pill.dataset.preset);
      if (elements.presetDesc) elements.presetDesc.textContent = descs[currentPreset] || '';
      if (elements.quickPreset) elements.quickPreset.value = currentPreset;
      Telemetry.track('preset_changed', { preset: currentPreset });
    });
  });
  elements.settingDefaultStrip?.addEventListener('change', e => {
    conversionOptions.stripHeaders = e.target.checked;
    if (elements.stripHeadersOption) elements.stripHeadersOption.checked = e.target.checked;
    saveDefaults();
  });
  elements.settingDefaultTables?.addEventListener('change', e => {
    conversionOptions.formatTables = e.target.checked;
    if (elements.formatTablesOption) elements.formatTablesOption.checked = e.target.checked;
    saveDefaults();
  });
  elements.telemetryToggle?.addEventListener('change', async e => { await Telemetry.setEnabled(e.target.checked); });
  elements.ocrToggle?.addEventListener('change', async e => {
    flags = await FeatureFlags.save({ ...flags, ocrEnabled: e.target.checked });
  });
  elements.licenseActivate?.addEventListener('click', async () => {
    try {
      await License.activate(elements.licenseInput?.value || '');
      updatePlanUI();
      if (elements.licenseStatus) elements.licenseStatus.textContent = 'Pro active • 200MB • batch • OCR pilot • history';
    } catch { if (elements.licenseStatus) elements.licenseStatus.textContent = 'Invalid key. Format: TT-PRO-XXXX…'; }
  });
}
function openSettings() {
  elements.settingsModal?.classList.remove('hidden');
  refreshAuthUI().catch(() => {});
}

// ---------- creator panel account (Supabase-backed via admin API) ----------
let adminUser = null;
let forgotEmail = '';
// Presence guard: a late async refresh must never yank the user out of the
// signup/forgot forms. Only follow session flips, or explicit navigation.
let lastPresence = null; // null | 'in' | 'out'

function showAuthPane(name) {
  for (const [key, id] of [['signedout', 'authSignedOut'], ['signup', 'authSignup'], ['forgot', 'authForgot'], ['signedin', 'authSignedIn']]) {
    elements[id]?.classList.toggle('hidden', key !== name);
  }
  if (name === 'forgot') {
    elements.forgotStep1?.classList.remove('hidden');
    elements.forgotStep2?.classList.add('hidden');
  }
  hideAuthError();
}

function showAuthError(msg) {
  if (!elements.authError) return;
  elements.authError.textContent = msg;
  elements.authError.classList.remove('hidden');
}

function hideAuthError() {
  if (!elements.authError) return;
  elements.authError.textContent = '';
  elements.authError.classList.add('hidden');
}

function showOnboardAuthError(msg) {
  if (!elements.onboardingAuthError) return;
  elements.onboardingAuthError.textContent = msg;
  elements.onboardingAuthError.classList.remove('hidden');
}

function hideOnboardAuthError() {
  if (!elements.onboardingAuthError) return;
  elements.onboardingAuthError.textContent = '';
  elements.onboardingAuthError.classList.add('hidden');
}

function friendlyAdminError(err) {
  if (!err) return 'Something went wrong.';
  if (err.code === 'NO_ADMIN_URL') return 'Set the panel URL above first.';
  if (err.code === 'ADMIN_UNREACHABLE') return 'Panel unreachable. Check the URL and that the panel is running.';
  return err.message || 'Something went wrong.';
}

async function refreshAuthUI() {
  hideOnboardAuthError();
  const token = await AdminAPI.getToken();
  if (token) {
    try {
      const me = await AdminAPI.me();
      if (me && me.email) {
        adminUser = me;
        await storageSet({ tokentrim_user: adminUser, tokentrim_user_email: adminUser.email });
      } else if (me === null) {
        adminUser = null;
        await AdminAPI.setToken(null);
        await storageSet({ tokentrim_user: null, tokentrim_user_email: '' });
      }
    } catch {
      // Offline / server unreachable: keep cached session
    }
  }

  if (!adminUser || !adminUser.email) {
    const cachedUser = await storageGet('tokentrim_user', null);
    const cachedEmail = (await storageGet('tokentrim_user_email', '')) || cachedUser?.email || '';
    if (cachedUser && cachedUser.email) {
      adminUser = cachedUser;
    } else if (cachedEmail) {
      adminUser = { email: cachedEmail, name: '', plan: 'free', is_admin: false };
    }
  }

  const isSignedIn = !!(adminUser && adminUser.email);

  if (isSignedIn) {
    const email = adminUser.email.trim();
    const initial = email[0]?.toUpperCase() || 'U';

    if (elements.userAvatarLetter) elements.userAvatarLetter.textContent = initial;
    if (elements.accountProfileLetter) elements.accountProfileLetter.textContent = initial;

    if (elements.userAvatarBtn) {
      elements.userAvatarBtn.title = email;
      elements.userAvatarBtn.classList.remove('is-guest');
      if (currentState !== AppState.ONBOARDING) {
        elements.userAvatarBtn.classList.remove('hidden');
      }
    }

    if (elements.authUserEmail) elements.authUserEmail.textContent = email;

    if (elements.authUserPlan) {
      const proActive = serverPlanActive();
      let suffix = '';
      if (proActive && adminUser.plan_expires_at) {
        const d = new Date(adminUser.plan_expires_at);
        if (!Number.isNaN(d.getTime())) {
          suffix = ` · until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      } else if (adminUser.plan === 'pro' && !proActive) {
        suffix = ' · expired';
      }
      elements.authUserPlan.textContent = `${proActive ? 'Pro' : 'Free'} plan${adminUser.is_admin ? ' • creator' : ''}${suffix}`;
    }

    if (elements.cloudSyncToggle) {
      elements.cloudSyncToggle.checked = await AdminAPI.isCloudSyncEnabled();
    }

    elements.authSignedIn?.classList.remove('hidden');
    elements.authSignedOut?.classList.add('hidden');
    elements.settingsAccountSection?.classList.remove('hidden');
  } else {
    if (elements.userAvatarBtn) {
      elements.userAvatarBtn.title = 'Guest Mode (Local conversion) — Click to Sign In';
      elements.userAvatarBtn.classList.add('is-guest');
      if (elements.userAvatarLetter) elements.userAvatarLetter.textContent = '';
      if (currentState !== AppState.ONBOARDING) {
        elements.userAvatarBtn.classList.remove('hidden');
      }
    }

    elements.authSignedIn?.classList.add('hidden');
    elements.authSignedOut?.classList.remove('hidden');
    elements.settingsAccountSection?.classList.remove('hidden');
  }

  updatePlanUI();
}

function setupAuthHandlers() {
  window.addEventListener('focus', () => { refreshAuthUI().catch(() => {}); });
  elements.userAvatarBtn?.addEventListener('click', openSettings);

  elements.btnGoToSignIn?.addEventListener('click', () => {
    closeSettings();
    switchToState(AppState.ONBOARDING);
    elements.tabSignIn?.click();
    elements.onboardingEmail?.focus();
  });

  elements.onboardingBtnGuest?.addEventListener('click', async () => {
    adminUser = null;
    await AdminAPI.setToken(null);
    await storageSet({ tokentrim_onboarded: true, tokentrim_guest: true, tokentrim_user_email: '', tokentrim_user: null });
    await refreshAuthUI();
    switchToState(AppState.EMPTY);
    checkForPendingFile();
  });

  elements.cloudSyncToggle?.addEventListener('change', async (e) => {
    await AdminAPI.setCloudSyncEnabled(e.target.checked);
  });

  // Onboarding auth tabs
  elements.tabSignIn?.addEventListener('click', () => {
    elements.tabSignIn?.classList.add('active');
    elements.tabSignIn?.setAttribute('aria-selected', 'true');
    elements.tabSignUp?.classList.remove('active');
    elements.tabSignUp?.setAttribute('aria-selected', 'false');
    elements.authTabBar?.classList.remove('hidden');
    elements.onboardSignInPane?.classList.remove('hidden');
    elements.onboardSignUpPane?.classList.add('hidden');
    elements.onboardForgotPane?.classList.add('hidden');
    hideOnboardAuthError();
  });

  elements.tabSignUp?.addEventListener('click', () => {
    elements.tabSignUp?.classList.add('active');
    elements.tabSignUp?.setAttribute('aria-selected', 'true');
    elements.tabSignIn?.classList.remove('active');
    elements.tabSignIn?.setAttribute('aria-selected', 'false');
    elements.authTabBar?.classList.remove('hidden');
    elements.onboardSignUpPane?.classList.remove('hidden');
    elements.onboardSignInPane?.classList.add('hidden');
    elements.onboardForgotPane?.classList.add('hidden');
    hideOnboardAuthError();
  });

  elements.onboardingEmail?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardingPassword?.focus();
  });
  elements.onboardingPassword?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardingBtnSignIn?.click();
  });
  elements.onboardingSuEmail?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardingSuPassword?.focus();
  });
  elements.onboardingSuPassword?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardingSuPin?.focus();
  });
  function fixEmailTypo(email) {
    const parts = String(email || '').split('@');
    if (parts.length !== 2) return email;
    const [local, domain] = parts;
    const typos = {
      'gamil.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gmaill.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gamil.co': 'gmail.com',
      'hotmial.com': 'hotmail.com',
      'hotmaill.com': 'hotmail.com',
      'yaho.com': 'yahoo.com',
      'yahooo.com': 'yahoo.com',
      'outlok.com': 'outlook.com',
      'outloo.com': 'outlook.com'
    };
    const corrected = typos[domain.toLowerCase()];
    return corrected ? `${local}@${corrected}` : email;
  }

  elements.onboardingEmail?.addEventListener('blur', () => {
    const raw = (elements.onboardingEmail.value || '').trim();
    const fixed = fixEmailTypo(raw);
    if (fixed !== raw) {
      elements.onboardingEmail.value = fixed;
    }
  });

  elements.onboardingSuEmail?.addEventListener('blur', () => {
    const raw = (elements.onboardingSuEmail.value || '').trim();
    const fixed = fixEmailTypo(raw);
    if (fixed !== raw) {
      elements.onboardingSuEmail.value = fixed;
    }
  });

  elements.onboardFpEmail?.addEventListener('blur', () => {
    const raw = (elements.onboardFpEmail.value || '').trim();
    const fixed = fixEmailTypo(raw);
    if (fixed !== raw) {
      elements.onboardFpEmail.value = fixed;
    }
  });

  // Password visibility toggle handler
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const showIcon = btn.querySelector('.icon-show');
      const hideIcon = btn.querySelector('.icon-hide');
      if (showIcon && hideIcon) {
        showIcon.classList.toggle('hidden', isPassword);
        hideIcon.classList.toggle('hidden', !isPassword);
      }
      const label = isPassword ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      input.focus();
    });
  });

  elements.onboardingSuPin?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardingBtnSignUp?.click();
  });

  // Onboarding Sign In
  elements.onboardingBtnSignIn?.addEventListener('click', async () => {
    hideOnboardAuthError();
    const rawEmail = (elements.onboardingEmail?.value || '').trim();
    const email = fixEmailTypo(rawEmail);
    if (email !== rawEmail && elements.onboardingEmail) {
      elements.onboardingEmail.value = email;
    }
    const password = elements.onboardingPassword?.value || '';
    if (!email || !password) {
      showOnboardAuthError('Email and password are required.');
      return;
    }
    const btn = elements.onboardingBtnSignIn;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Signing in...</span>';
    }
    try {
      adminUser = await AdminAPI.signin({ email, password });
      if (elements.onboardingPassword) elements.onboardingPassword.value = '';
      await storageSet({ tokentrim_onboarded: true, tokentrim_user_email: adminUser.email, tokentrim_user: adminUser, tokentrim_guest: false });
      await refreshAuthUI();
      switchToState(AppState.EMPTY);
      checkForPendingFile();
    } catch (e) {
      showOnboardAuthError(friendlyAdminError(e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  // Onboarding Sign Up
  elements.onboardingBtnSignUp?.addEventListener('click', async () => {
    hideOnboardAuthError();
    const rawEmail = (elements.onboardingSuEmail?.value || '').trim();
    const email = fixEmailTypo(rawEmail);
    if (email !== rawEmail && elements.onboardingSuEmail) {
      elements.onboardingSuEmail.value = email;
    }
    const password = elements.onboardingSuPassword?.value || '';
    const pin = (elements.onboardingSuPin?.value || '').trim();
    if (!email || !password) {
      showOnboardAuthError('Email and password are required.');
      return;
    }
    if (password.length < 8) {
      showOnboardAuthError('Password must be at least 8 characters.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showOnboardAuthError('Security PIN must be exactly 4 digits.');
      return;
    }
    const btn = elements.onboardingBtnSignUp;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Creating account...</span>';
    }
    try {
      adminUser = await AdminAPI.signup({ email, password, pin, name: '' });
      if (elements.onboardingSuPassword) elements.onboardingSuPassword.value = '';
      if (elements.onboardingSuPin) elements.onboardingSuPin.value = '';
      await storageSet({ tokentrim_onboarded: true, tokentrim_user_email: adminUser.email, tokentrim_user: adminUser, tokentrim_guest: false });
      await refreshAuthUI();
      switchToState(AppState.EMPTY);
      checkForPendingFile();
    } catch (e) {
      showOnboardAuthError(friendlyAdminError(e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  // Onboarding Forgot Password handlers
  elements.onboardingLinkForgot?.addEventListener('click', () => {
    hideOnboardAuthError();
    elements.authTabBar?.classList.add('hidden');
    elements.onboardSignInPane?.classList.add('hidden');
    elements.onboardSignUpPane?.classList.add('hidden');
    elements.onboardForgotPane?.classList.remove('hidden');
    if (elements.onboardFpEmail) {
      if (!elements.onboardFpEmail.value && elements.onboardingEmail?.value) {
        elements.onboardFpEmail.value = fixEmailTypo(elements.onboardingEmail.value.trim());
      }
      if (elements.onboardFpEmail.value) {
        elements.onboardFpPin?.focus();
      } else {
        elements.onboardFpEmail.focus();
      }
    }
  });

  elements.onboardBtnBackToSignIn?.addEventListener('click', () => {
    hideOnboardAuthError();
    elements.authTabBar?.classList.remove('hidden');
    elements.onboardForgotPane?.classList.add('hidden');
    elements.onboardSignUpPane?.classList.add('hidden');
    elements.onboardSignInPane?.classList.remove('hidden');
    elements.tabSignIn?.classList.add('active');
    elements.tabSignIn?.setAttribute('aria-selected', 'true');
    elements.tabSignUp?.classList.remove('active');
    elements.tabSignUp?.setAttribute('aria-selected', 'false');
  });

  elements.onboardFpEmail?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardFpPin?.focus();
  });
  elements.onboardFpPin?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardFpNewPassword?.focus();
  });
  elements.onboardFpNewPassword?.addEventListener('keydown', e => {
    if (e.key === 'Enter') elements.onboardBtnResetPassword?.click();
  });

  elements.onboardBtnResetPassword?.addEventListener('click', async () => {
    hideOnboardAuthError();
    const rawEmail = (elements.onboardFpEmail?.value || '').trim();
    const email = fixEmailTypo(rawEmail);
    if (email !== rawEmail && elements.onboardFpEmail) {
      elements.onboardFpEmail.value = email;
    }
    const pin = (elements.onboardFpPin?.value || '').trim();
    const newPassword = elements.onboardFpNewPassword?.value || '';

    if (!email || !pin || !newPassword) {
      showOnboardAuthError('Email, 4-digit PIN, and new password are required.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showOnboardAuthError('Security PIN must be exactly 4 digits.');
      return;
    }
    if (newPassword.length < 8) {
      showOnboardAuthError('Password must be at least 8 characters.');
      return;
    }

    const btn = elements.onboardBtnResetPassword;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Resetting...</span>';
    }
    try {
      adminUser = await AdminAPI.reset({ email, pin, newPassword });
      if (elements.onboardFpNewPassword) elements.onboardFpNewPassword.value = '';
      if (elements.onboardFpPin) elements.onboardFpPin.value = '';
      await storageSet({ tokentrim_onboarded: true, tokentrim_user_email: adminUser.email, tokentrim_user: adminUser, tokentrim_guest: false });
      await refreshAuthUI();
      switchToState(AppState.EMPTY);
      checkForPendingFile();
    } catch (e) {
      showOnboardAuthError(friendlyAdminError(e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  elements.btnSignOut?.addEventListener('click', async () => {
    await AdminAPI.signout().catch(() => {});
    adminUser = null;
    await storageSet({ tokentrim_onboarded: false, tokentrim_user_email: '', tokentrim_user: null, tokentrim_guest: false });
    await refreshAuthUI();
    closeSettings();
    switchToState(AppState.ONBOARDING);
  });
}
function closeSettings() { elements.settingsModal?.classList.add('hidden'); }

// ---------- files ----------
function handleDrop(e) {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length) loadFile(files[0]);
}
function handleFileSelect(e) {
  const files = e.target.files;
  if (files?.length) loadFile(files[0]);
}
function loadFile(file) {
  const sourceType = detectSourceType(file);
  if (sourceType === 'image' && !isProUser()) {
    openProModal();
    showErrorMessage('PRO_REQUIRED_IMAGE');
    Telemetry.track('convert_error', { errorCode: 'PRO_REQUIRED_IMAGE' });
    return;
  }
  const validation = converter.validateFile(file, License.maxBytes());
  if (!validation.valid) { showErrorMessage(validation.error); Telemetry.track('convert_error', { errorCode: validation.error }); return; }
  currentFile = file;
  const detectedType = detectSourceType(file) || 'pdf';
  Telemetry.track('file_select', {});
  void AdminAPI.track('file_select', { source_type: detectedType });
  readPageRange();
  conversionOptions.query = elements.queryInput?.value || '';
  switchToState(AppState.LOADED);
  // E2E hook: tests set window.__TT_MANUAL = true to click Convert themselves
  // after tuning options (avoids racing the 100ms auto-start). Default off.
  if (typeof window !== 'undefined' && window.__TT_MANUAL === true) return;
  setTimeout(() => handleConvert(), 100);
}
/** Swap an inline SVG icon (see icons-sprite.svg in popup.html). */
function setIcon(el, name) {
  if (!el) return;
  const use = el.tagName === 'USE' ? el : el.querySelector('use');
  if (use) use.setAttribute('href', `#tt-i-${name}`);
  else el.textContent = name; // fallback if sprite is missing
}

function updateFileDisplay() {
  if (!currentFile) return;
  const sourceId = detectSourceType(currentFile) || 'pdf';
  const meta = getSourceType(sourceId) || { badge: 'FILE', icon: 'description', label: 'File' };
  elements.fileName.textContent = currentFile.name;
  const sizeInMB = (currentFile.size / (1024 * 1024)).toFixed(1);
  setIcon(elements.fileIconSymbol, meta.icon === 'slideshow' ? 'description' : meta.icon === 'image' ? 'description' : meta.icon === 'table_chart' ? 'description' : meta.icon === 'notes' ? 'description' : meta.icon === 'language' ? 'description' : meta.icon === 'menu_book' ? 'description' : meta.icon);
  elements.fileBadge.textContent = meta.badge;
  if (sourceId === 'docx') {
    const words = Math.max(10, Math.round(currentFile.size / 6));
    elements.fileStats.textContent = `~${formatNumber(words)} words • ${sizeInMB} MB`;
  } else if (sourceId === 'pptx') {
    elements.fileStats.textContent = `Presentation • ${sizeInMB} MB`;
  } else if (sourceId === 'image') {
    elements.fileStats.textContent = `Image • ${sizeInMB} MB • OCR/vision ready`;
  } else if (sourceId === 'xlsx' || sourceId === 'csv') {
    elements.fileStats.textContent = `Spreadsheet • ${sizeInMB} MB`;
  } else if (sourceId === 'epub') {
    elements.fileStats.textContent = `eBook • ${sizeInMB} MB`;
  } else if (sourceId === 'html') {
    elements.fileStats.textContent = `Web page • ${sizeInMB} MB`;
  } else if (sourceId === 'text') {
    const words = Math.max(10, Math.round(currentFile.size / 6));
    elements.fileStats.textContent = `~${formatNumber(words)} words • ${sizeInMB} MB`;
  } else {
    const pages = Math.max(1, Math.ceil(currentFile.size / 100000));
    elements.fileStats.textContent = `~${pages} pages • ${sizeInMB} MB`;
  }
  // Dynamic range label: slides for pptx, pages otherwise
  const rangeLabel = document.getElementById('pageRangeLabel');
  if (rangeLabel) rangeLabel.textContent = sourceId === 'pptx' ? 'Slides to extract' : 'Pages / slides to extract';
  // Smart doc-type default per format
  if (sourceId === 'pptx' && elements.docTypeSelect && conversionOptions.docPreset === 'general') {
    conversionOptions.docPreset = 'presentation';
    elements.docTypeSelect.value = 'presentation';
  } else if ((sourceId === 'xlsx' || sourceId === 'csv') && elements.docTypeSelect && conversionOptions.docPreset === 'general') {
    conversionOptions.docPreset = 'spreadsheet';
    elements.docTypeSelect.value = 'spreadsheet';
  }
}
function handleRemoveFile() {
  currentFile = null;
  if (elements.fileInput) elements.fileInput.value = '';
  if (elements.sectionFileInput) elements.sectionFileInput.value = '';
  if (elements.batchInput) elements.batchInput.value = '';
  batchQueue = []; renderBatch();
  closeFormatSection();
  switchToState(AppState.EMPTY);
}

// ---------- convert ----------
async function handleConvert() {
  if (!currentFile) { showErrorMessage('NO_FILE'); return; }
  readPageRange();
  if (conversionOptions.pageRangeError) {
    switchToState(AppState.ERROR, { icon: 'error', title: 'Invalid page selection', message: conversionOptions.pageRangeError });
    return;
  }
  conversionOptions.query = elements.queryInput?.value || '';
  switchToState(AppState.CONVERTING);
  const t0 = Date.now();
  try {
    const srcType = detectSourceType(currentFile) || 'pdf';
    Telemetry.track('convert_start', { preset: currentPreset });
    void AdminAPI.track('convert_start', { preset: currentPreset, source_type: srcType, mode: conversionOptions.compressionMode });
    conversionResult = await converter.convert(currentFile, presetOptions(), (pct, status) => updateProgress(pct, status));
    convertedMarkdown = conversionResult.markdown;
    await new Promise(r => setTimeout(r, 250));
    // Save to local history
    try {
      if (flags.historyEnabled !== false) {
        await ChunkStore.saveDocument({
          title: currentFile.name, markdown: convertedMarkdown,
          preset: currentPreset, meta: { pages: conversionResult.stats?.pages || 0, tokens: conversionResult.stats?.optimizedTokens || 0, sourceType: conversionResult.metadata?.type || detectSourceType(currentFile) || 'pdf' }
        });
      }
    } catch { /* history optional */ }
    Telemetry.track('convert_success', { preset: currentPreset, pages: conversionResult.stats?.pages || 0, tokens: conversionResult.stats?.optimizedTokens || 0, ms: Date.now() - t0 });
    // Creator-panel bridge (no-op unless a panel URL is connected).
    void AdminAPI.track('convert_success', {
      tokens_saved: conversionResult.stats?.savedTokens || 0,
      pages: conversionResult.stats?.pages || 0,
      preset: currentPreset,
      mode: String(conversionResult.report?.compressionMode || ''),
      source_type: conversionResult.metadata?.type || detectSourceType(currentFile) || 'pdf',
      ocr_used: !!conversionResult.report?.ocrUsed,
      ms: Date.now() - t0
    });
    switchToState(AppState.SUCCESS);
  } catch (error) {
    Telemetry.track('convert_error', { errorCode: String(error.message || 'UNKNOWN_ERROR').slice(0, 32) });
    void AdminAPI.track('convert_error', {
      errorCode: String(error.message || 'UNKNOWN_ERROR').slice(0, 32),
      preset: currentPreset
    });
    handleConversionError(error);
  }
}

async function handleConversionError(error) {
  const code = error.message || 'UNKNOWN_ERROR';
  const info = getErrorInfo(code);
  const details = error && typeof error.detail === 'string' ? error.detail : null;
  switchToState(AppState.ERROR, { icon: 'error', title: info.title, message: info.message + ' ' + (info.hint || ''), details });
}

function updateProgress(pct, status) {
  elements.progressPercentage.textContent = pct + '%';
  elements.progressBarFill.style.width = pct + '%';
  elements.progressStatus.textContent = status;
}
function resetProgress() { updateProgress(0, 'Initializing...'); }

function updateSuccessDisplay() {
  if (!conversionResult || !currentFile) return;
  const { markdown, stats, report } = conversionResult;
  const body = (markdown || '').trim();
  if (!body || body.length < 20) { handleConversionError(new Error('EMPTY_FILE')); return; }
  if (conversionResult.fallback) {
    showErrorBanner({ icon: 'warning', title: 'Limited extraction', message: 'Full parsing unavailable; basic fallback used. Tables may be imperfect.' }, elements.viewSuccess);
  }
  elements.originalTokens.textContent = formatNumber(stats.originalTokens) + ' tokens';
  elements.optimizedTokens.textContent = formatNumber(stats.optimizedTokens) + ' tokens';
  elements.tokenSavings.textContent = stats.savingsPercent > 0 ? `-${stats.savingsPercent}% tokens saved` : `${Math.abs(stats.savingsPercent)}% increase`;
  const baseName = currentFile.name.replace(/\.(pdf|docx|pptx?|png|jpe?g|webp|gif|bmp|tiff?|xlsx?|csv|tsv|txt|md|markdown|html?|epub)$/i, '');
  elements.mdFilename.textContent = baseName + '.md';
  elements.mdSize.textContent = ((stats.markdownSize || 0) / 1024).toFixed(1) + ' KB';
  elements.markdownPreview.textContent = markdown.substring(0, 600) + (markdown.length > 600 ? '\n\n…' : '');
  if (elements.modelBadge) elements.modelBadge.textContent = `Model: ${getPreset(currentPreset).label} • Mode: ${report?.compressionMode || 'lossless'}${report?.tokenBudget ? ` • Budget: ${report.tokenBudget}` : ''}`;
  if (elements.qualityReport) {
    const show = report && (report.warnings?.length || report.truncated || (report.tablesOptimized || 0) > 0);
    elements.qualityReport.classList.toggle('hidden', !show);
    if (show) {
      elements.qualitySummary.textContent = `Removed ${report.removedLines || 0} boilerplate line(s) • ${report.tablesOptimized || 0} table(s) optimized${report.truncated ? ' • truncated to budget' : ''} • ${report.querySections?.length ? report.querySections.length + ' section(s) kept' : 'full document'}`;
      elements.warningsList.innerHTML = '';
      (report.warnings || []).forEach(w => {
        const li = document.createElement('li');
        li.textContent = w;
        elements.warningsList.appendChild(li);
      });
    }
  }
  updatePromptPackUI();
}
function formatNumber(n) { return Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

async function copyToClipboard(text) {
  if (!text) return false;
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    // navigator.clipboard can fail in extensions without document focus
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch {
      ok = false;
    }
  }
  return ok;
}

async function handleCopy() {
  if (!convertedMarkdown) return;
  const ok = await copyToClipboard(convertedMarkdown);
  if (ok) {
    elements.copyText.textContent = 'Copied!';
    Telemetry.track('copy', { tokens: convertedMarkdown.length });
    void AdminAPI.track('copy', { preset: currentPreset, source_type: detectSourceType(currentFile) || 'pdf' });
    setTimeout(() => { elements.copyText.textContent = 'Copy Markdown'; }, 2000);
  } else showErrorMessage('UNKNOWN_ERROR');
}

function handleDownload() {
  if (!convertedMarkdown || !currentFile) return;
  const baseName = currentFile.name.replace(/\.(pdf|docx|pptx?|png|jpe?g|webp|gif|bmp|tiff?|xlsx?|csv|tsv|txt|md|markdown|html?|epub)$/i, '');
  const filename = baseName + '.md';
  if (typeof chrome !== 'undefined' && chrome.downloads) {
    const blob = new Blob([convertedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.downloads.download({ url: reader.result, filename, saveAs: true }, () => {
        if (chrome.runtime?.lastError) showErrorMessage('UNKNOWN_ERROR');
        else {
          Telemetry.track('download', {});
          void AdminAPI.track('download', { preset: currentPreset, source_type: detectSourceType(currentFile) || 'pdf' });
        }
      });
    };
    reader.readAsDataURL(blob);
  } else {
    const blob = new Blob([convertedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function getActivePromptTask() {
  const selected = elements.promptTaskSelect?.value;
  return PROMPT_TASKS.find(t => t.id === selected) || PROMPT_TASKS[0];
}

function getActivePromptPack() {
  const task = getActivePromptTask();
  return buildPromptPack({
    markdown: convertedMarkdown || '',
    task: task.prompt,
    preset: currentPreset,
    sourceName: currentFile?.name || 'document'
  });
}

function updatePromptPackUI() {
  const task = getActivePromptTask();
  if (elements.promptTaskDesc) {
    elements.promptTaskDesc.textContent = task.prompt;
  }
  if (elements.promptPreviewCode) {
    elements.promptPreviewCode.textContent = convertedMarkdown
      ? getActivePromptPack()
      : `# Task\n${task.prompt}\n\n[Convert a document to see complete prompt pack with source context]`;
  }
}

function togglePromptPreview() {
  if (!elements.promptPreviewBox) return;
  const isHidden = elements.promptPreviewBox.classList.contains('hidden');
  elements.promptPreviewBox.classList.toggle('hidden', !isHidden);
  if (elements.promptPreviewToggle) {
    elements.promptPreviewToggle.textContent = isHidden ? 'Hide preview' : 'Preview prompt';
  }
  if (isHidden) {
    updatePromptPackUI();
  }
}

async function handlePromptPack() {
  if (!convertedMarkdown) {
    showErrorMessage('NO_FILE');
    return;
  }
  const task = getActivePromptTask();
  const pack = getActivePromptPack();
  const ok = await copyToClipboard(pack);
  if (ok) {
    Telemetry.track('prompt_pack_copy', { task: task.id });
    if (elements.promptPackBtn) elements.promptPackBtn.classList.add('copied');
    if (elements.promptPackText) {
      elements.promptPackText.textContent = 'Copied!';
    } else if (elements.promptPackBtn) {
      elements.promptPackBtn.textContent = 'Copied!';
    }
    if (elements.promptPackIcon) {
      elements.promptPackIcon.innerHTML = '<use href="#tt-i-done"/>';
    }
    setTimeout(() => {
      if (elements.promptPackBtn) elements.promptPackBtn.classList.remove('copied');
      if (elements.promptPackText) {
        elements.promptPackText.textContent = 'Copy prompt';
      } else if (elements.promptPackBtn) {
        elements.promptPackBtn.textContent = 'Copy prompt';
      }
      if (elements.promptPackIcon) {
        elements.promptPackIcon.innerHTML = '<use href="#tt-i-content_copy"/>';
      }
    }, 2000);
  } else {
    showErrorMessage('UNKNOWN_ERROR');
  }
}

// ---------- batch ----------
async function handleBatchSelect(e) {
  const files = [...(e.target.files || [])].slice(0, 10);
  if (!files.length) return;
  Telemetry.track('batch_start', {});
  batchQueue = files.map(f => ({ file: f, status: 'queued', result: null }));
  renderBatch();
  for (const item of batchQueue) {
    item.status = 'working'; renderBatch();
    try {
      const res = await converter.convert(item.file, presetOptions(), () => {});
      item.status = 'done'; item.result = res;
    } catch (err) { item.status = 'error'; item.error = err.message; }
    renderBatch();
  }
  Telemetry.track('batch_complete', {});
}
function renderBatch() {
  if (!elements.batchList) return;
  if (!batchQueue.length) { elements.batchList.classList.add('hidden'); elements.batchList.innerHTML = ''; return; }
  elements.batchList.classList.remove('hidden');
  elements.batchList.innerHTML = '';
  batchQueue.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'body-sm';
    row.textContent = `${i + 1}. ${item.file.name} — ${item.status}${item.result ? ` • ${formatNumber(item.result.stats.optimizedTokens)} tokens` : ''}${item.error ? ` • ${item.error}` : ''}`;
    if (item.status === 'done' && item.result) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary'; btn.textContent = 'Use this file';
      btn.addEventListener('click', () => { currentFile = item.file; convertedMarkdown = item.result.markdown; conversionResult = item.result; switchToState(AppState.SUCCESS); });
      row.appendChild(document.createTextNode(' '));
      row.appendChild(btn);
    }
    elements.batchList.appendChild(row);
  });
}

// ---------- history ----------
async function renderHistory() {
  if (!elements.historyList) return;
  let docs = [];
  try { docs = await ChunkStore.listDocuments(20); } catch { docs = []; }
  elements.historyList.innerHTML = '';
  if (!docs.length) { elements.historyList.textContent = 'No history yet.'; return; }
  docs.forEach(d => {
    const row = document.createElement('div');
    const cloudBadge = d.isCloud ? '☁️ ' : '';
    row.textContent = `${cloudBadge}${d.title} • ${d.pages || '?'}p • ${formatNumber(d.tokens || 0)}tok • ${new Date(d.createdAt).toLocaleDateString()} `;
    const open = document.createElement('button');
    open.className = 'btn btn-secondary'; open.textContent = 'Open';
    open.addEventListener('click', async () => {
      const full = await ChunkStore.getDocument(d.id);
      if (full) { convertedMarkdown = full.markdown; conversionResult = { markdown: full.markdown, stats: { originalTokens: full.tokens, optimizedTokens: full.tokens, savedTokens: 0, savingsPercent: 0, pages: full.pages || 0, markdownSize: full.markdown.length }, report: { compressionMode: 'history' } }; currentFile = new File([full.markdown], full.title.replace(/\.md$/i, '') + '.md', { type: 'text/markdown' }); switchToState(AppState.SUCCESS); }
    });
    const del = document.createElement('button');
    del.className = 'footer-link label-sm'; del.textContent = 'Delete';
    del.addEventListener('click', async () => { await ChunkStore.deleteDocument(d.id); renderHistory(); });
    row.appendChild(open); row.appendChild(document.createTextNode(' ')); row.appendChild(del);
    elements.historyList.appendChild(row);
  });
}

// ---------- errors / feedback ----------
function showErrorBanner(errorData, targetContainer = null) {
  if (!errorData) return;
  removeErrorBanner();
  const banner = document.createElement('div');
  banner.id = 'error-banner'; banner.className = 'error-banner';
  const iconName = ['error', 'warning', 'feedback'].includes(errorData.icon) ? errorData.icon : 'error';
  banner.innerHTML = `<div class="error-banner-content"><svg class="material-symbols-outlined error-icon" aria-hidden="true"><use href="#tt-i-${iconName}"/></svg><div class="error-text"><span class="headline-sm error-title"></span><span class="body-sm error-message"></span></div></div>`;
  banner.querySelector('.error-title').textContent = errorData.title || 'Conversion Issue';
  banner.querySelector('.error-message').textContent = errorData.message || '';
  if (errorData.details) {
    const d = document.createElement('div');
    d.className = 'body-sm error-details'; d.textContent = errorData.details;
    banner.querySelector('.error-text').appendChild(d);
  }
  const container = targetContainer || elements.viewLoaded || elements.viewEmpty;
  container?.insertBefore(banner, container.firstChild);
}
function removeErrorBanner() { document.getElementById('error-banner')?.remove(); }
function showErrorMessage(code) {
  const info = getErrorInfo(code);
  showErrorBanner({ title: info.title, message: info.message + ' ' + (info.hint || '') }, currentState === AppState.EMPTY ? elements.viewEmpty : elements.viewLoaded);
}
async function sendFeedback(label) {
  await Telemetry.track('feedback_sent', {});
  showErrorBanner({ icon: 'feedback', title: 'Thanks', message: `Feedback noted: ${label}. No file content was sent.` }, elements.viewSuccess);
  setTimeout(removeErrorBanner, 3000);
}

async function checkForPendingFile() {
  try {
    const result = await chrome.storage.local.get(['pendingPdfUrl', 'pendingPdfName']);
    if (result.pendingPdfUrl) {
      const response = await fetch(result.pendingPdfUrl);
      const blob = await response.blob();
      const file = new File([blob], result.pendingPdfName || 'document.pdf', { type: 'application/pdf' });
      loadFile(file);
      await chrome.storage.local.remove(['pendingPdfUrl', 'pendingPdfName']);
    }
  } catch (error) { console.error('Error checking for pending file:', error); }
}

window.TokenTrim = { switchToState, loadFile, handleConvert, removeErrorBanner, currentState: () => currentState, currentFile: () => currentFile, convertedMarkdown: () => convertedMarkdown, activePromptPack: () => getActivePromptPack() };
window.removeErrorBanner = removeErrorBanner;
