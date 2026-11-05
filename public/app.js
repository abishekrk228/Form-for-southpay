/**
 * Daily Report Application Logic
 * Handles real-time auto-calculation, formatted text generation,
 * API & LocalStorage synchronization, and export tools.
 */

// State
let reports = [];
let isEditing = false;
let userManuallyEditedTotalProfit = false;
let isServerOnline = false;
let isLoadingForm = false;        // true while we fill the form programmatically (suppress draft save)
let pendingSubmitAction = 'plain'; // 'plain' or 'whatsapp' — which button triggered submit
let pendingWaWindow = null;        // pre-opened window for WhatsApp (avoids popup blocking)

const DRAFT_KEY = 'dailyReportDraft'; // unsaved, in-progress form values

// DOM Elements
const form = document.getElementById('dailyReportForm');
const editReportIdInput = document.getElementById('editReportId');
const reportDateInput = document.getElementById('reportDate');
const formattedDatePreview = document.getElementById('formattedDatePreview');
const todayDateBtn = document.getElementById('todayDateBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitWhatsappBtn = document.getElementById('submitWhatsappBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const pay1Input = document.getElementById('pay1');
const pay1ProfitInput = document.getElementById('pay1Profit');
const pay1ExpenditureInput = document.getElementById('pay1Expenditure');
const southpayBillingInput = document.getElementById('southpayBilling');
const southpayProfitInput = document.getElementById('southpayProfit');
const southpayExpenditureInput = document.getElementById('southpayExpenditure');
const totalProfitInput = document.getElementById('totalProfit');
const yesterdayShortageInput = document.getElementById('yesterdayShortage');
const amountAvailableInput = document.getElementById('amountAvailable');

const pay1Readable = document.getElementById('pay1Readable');
const pay1ProfitReadable = document.getElementById('pay1ProfitReadable');
const pay1ExpenditureReadable = document.getElementById('pay1ExpenditureReadable');
const southpayBillingReadable = document.getElementById('southpayBillingReadable');
const southpayProfitReadable = document.getElementById('southpayProfitReadable');
const southpayExpenditureReadable = document.getElementById('southpayExpenditureReadable');

// Holiday button + note
const markHolidayBtn = document.getElementById('markHolidayBtn');
const holidayNote = document.getElementById('holidayNote');

// Monthly summary
const monthPicker = document.getElementById('monthPicker');
const monthSales = document.getElementById('monthSales');
const monthProfit = document.getElementById('monthProfit');
const monthPay1Exp = document.getElementById('monthPay1Exp');
const monthSpExp = document.getElementById('monthSpExp');
const monthTotalExp = document.getElementById('monthTotalExp');
const monthWorkingDays = document.getElementById('monthWorkingDays');
const monthHolidays = document.getElementById('monthHolidays');
const monthNotMarked = document.getElementById('monthNotMarked');
const monthCaption = document.getElementById('monthCaption');

// True when the currently-loaded date is a saved holiday (so submit flips it).
let currentIsHoliday = false;

const connectionStatus = document.getElementById('connectionStatus');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');

// Recent Bills drawer (hamburger menu)
const menuToggleBtn = document.getElementById('menuToggleBtn');
const billsDrawer = document.getElementById('billsDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');

const billsList = document.getElementById('billsList');
const reportCountBadge = document.getElementById('reportCountBadge');
const searchHistoryInput = document.getElementById('searchHistoryInput');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const printHistoryBtn = document.getElementById('printHistoryBtn');

// Recent Bills range controls
const rangeSelector = document.getElementById('rangeSelector');
const customRange = document.getElementById('customRange');
const rangeFrom = document.getElementById('rangeFrom');
const rangeTo = document.getElementById('rangeTo');
const rangeTotalSales = document.getElementById('rangeTotalSales');
const rangeTotalProfit = document.getElementById('rangeTotalProfit');
const rangeCaption = document.getElementById('rangeCaption');

let currentRange = 'week'; // today | week | month | all | custom

const viewModal = document.getElementById('viewModal');
const modalReportText = document.getElementById('modalReportText');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
const modalCopyBtn = document.getElementById('modalCopyBtn');

// Helper: Format Date to YYYY-MM-DD for HTML input
function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Format Date from YYYY-MM-DD to DD/MM/YY as requested in demo
function formatToDisplayDate(isoDateStr) {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const shortYear = year.slice(-2);
    return `${day}/${month}/${shortYear}`;
  }
  return isoDateStr;
}

// Helper: Parse DD/MM/YY to YYYY-MM-DD
function parseDisplayDateToIso(displayDateStr) {
  if (!displayDateStr) return getTodayIsoDate();
  const parts = displayDateStr.split('/');
  if (parts.length === 3) {
    const [day, month, shortYear] = parts;
    const fullYear = shortYear.length === 2 ? `20${shortYear}` : shortYear;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return getTodayIsoDate();
}

// Format number into Indian commas (e.g. 52865400 -> 5,28,65,400)
function formatIndianCurrencyWords(numStr) {
  if (!numStr) return '';
  const clean = String(numStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return '';

  let word = '';
  if (num >= 10000000) {
    word = ` (~ ${(num / 10000000).toFixed(2)} Cr)`;
  } else if (num >= 100000) {
    word = ` (~ ${(num / 100000).toFixed(2)} Lakh)`;
  } else if (num >= 1000) {
    word = ` (~ ${(num / 1000).toFixed(1)}k)`;
  }

  // Comma separation in Indian numbering
  const parts = clean.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  }

  return `₹ ${integerPart}${decimalPart}${word}`;
}

// Auto Calculate Total Profit
function calculateTotalProfit() {
  const p1 = parseFloat(String(pay1ProfitInput.value).replace(/[^0-9.-]/g, '')) || 0;
  const sp = parseFloat(String(southpayProfitInput.value).replace(/[^0-9.-]/g, '')) || 0;

  if (!userManuallyEditedTotalProfit) {
    if (pay1ProfitInput.value.trim() !== '' || southpayProfitInput.value.trim() !== '') {
      const sum = p1 + sp;
      totalProfitInput.value = sum;
    } else {
      totalProfitInput.value = '';
    }
  }
}

// Generate the exact report text matching the demo specification
function generateReportText() {
  const displayDate = formatToDisplayDate(reportDateInput.value);
  const p1 = pay1Input.value.trim();
  const p1Profit = pay1ProfitInput.value.trim();
  const spBilling = southpayBillingInput.value.trim();
  const spProfit = southpayProfitInput.value.trim();
  const totProfit = totalProfitInput.value.trim();
  const shortage = yesterdayShortageInput.value.trim();
  const amtAvailable = amountAvailableInput.value.trim();

  // Exactly following the demo template:
  // Daily Report:
  // Date:12/10/26
  // Pay1 : 52865400
  // Profit: 14900
  // Southpay Billing: 336000
  // Profit:1300
  // Total  profit:16200
  // Yesterday shortage:
  // Amount Available : 53.5L

  let lines = [
    'Daily Report:',
    `Date:${displayDate}`,
    `Pay1 : ${p1}`,
    `Profit: ${p1Profit}`,
    `Southpay Billing: ${spBilling}`,
    `Profit:${spProfit}`,
    `Total  profit:${totProfit}`,
    `Yesterday shortage:${shortage ? ' ' + shortage : ''}`,
    `Amount Available : ${amtAvailable}`
  ];

  return lines.join('\n');
}

// Update the readable number hints under the inputs + the date annotation.
function updateLivePreview() {
  pay1Readable.textContent = formatIndianCurrencyWords(pay1Input.value);
  pay1ProfitReadable.textContent = formatIndianCurrencyWords(pay1ProfitInput.value);
  pay1ExpenditureReadable.textContent = formatIndianCurrencyWords(pay1ExpenditureInput.value);
  southpayBillingReadable.textContent = formatIndianCurrencyWords(southpayBillingInput.value);
  southpayProfitReadable.textContent = formatIndianCurrencyWords(southpayProfitInput.value);
  southpayExpenditureReadable.textContent = formatIndianCurrencyWords(southpayExpenditureInput.value);

  formattedDatePreview.textContent = `Formatted in report: ${formatToDisplayDate(reportDateInput.value)}`;
}

// Show/hide the "this day is a holiday" note.
function reflectHolidayState(isHol) {
  currentIsHoliday = !!isHol;
  if (holidayNote) holidayNote.style.display = currentIsHoliday ? 'block' : 'none';
}

// Reset Form to Clean State (Date stays today). Also clears any saved draft.
function resetForm() {
  isLoadingForm = true;
  isEditing = false;
  userManuallyEditedTotalProfit = false;
  editReportIdInput.value = '';
  reportDateInput.value = getTodayIsoDate();
  pay1Input.value = '';
  pay1ProfitInput.value = '';
  pay1ExpenditureInput.value = '';
  southpayBillingInput.value = '';
  southpayProfitInput.value = '';
  southpayExpenditureInput.value = '';
  totalProfitInput.value = '';
  yesterdayShortageInput.value = '';
  amountAvailableInput.value = '';
  reflectHolidayState(false);

  submitBtnText.textContent = 'Submit Report';
  cancelEditBtn.style.display = 'none';
  clearDraft();
  updateLivePreview();
  isLoadingForm = false;
}

// ---------- Draft (unsaved in-progress typing) ----------
// The draft is stored on the server (data/draft.json) so an unsubmitted entry
// shows up in any browser or device. localStorage is used as an offline fallback.
let draftSaveTimer = null;

// Save whatever is currently typed so closing/reopening (anywhere) keeps it.
function saveDraft() {
  if (isLoadingForm) return; // don't save while we're filling the form in code
  const draft = {
    date: reportDateInput.value,
    editId: editReportIdInput.value || '',
    isEditing,
    pay1: pay1Input.value,
    pay1Profit: pay1ProfitInput.value,
    pay1Expenditure: pay1ExpenditureInput.value,
    southpayBilling: southpayBillingInput.value,
    southpayProfit: southpayProfitInput.value,
    southpayExpenditure: southpayExpenditureInput.value,
    totalProfit: totalProfitInput.value,
    userManuallyEditedTotalProfit,
    yesterdayShortage: yesterdayShortageInput.value,
    amountAvailable: amountAvailableInput.value
  };

  // If nothing meaningful is filled in, drop the draft instead of storing an empty one.
  const hasContent = [draft.pay1, draft.pay1Profit, draft.pay1Expenditure, draft.southpayBilling,
    draft.southpayProfit, draft.southpayExpenditure, draft.totalProfit, draft.yesterdayShortage, draft.amountAvailable]
    .some(v => String(v).trim() !== '');

  // Always keep a local copy as offline fallback.
  try {
    if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (e) { /* ignore storage errors */ }

  // This tab authored this draft — don't let the poller apply it back to us.
  lastDraftSnapshot = hasContent ? draftSnapshotFrom(draft) : 'null';

  if (!isServerOnline) return;

  // Debounce the network save so we don't hit the server on every keystroke.
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    if (hasContent) {
      fetch('/api/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      }).catch(() => { /* offline; local copy already saved */ });
    } else {
      fetch('/api/draft', { method: 'DELETE' }).catch(() => {});
    }
  }, 400);
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  clearTimeout(draftSaveTimer);
  lastDraftSnapshot = 'null';
  if (isServerOnline) {
    fetch('/api/draft', { method: 'DELETE' }).catch(() => {});
  }
}

// Read the draft: from the server if online (shared across browsers), else local.
async function loadDraftFromStore() {
  if (isServerOnline) {
    try {
      const res = await fetch('/api/draft');
      const json = await res.json();
      if (json.success) return json.data || null;
    } catch (e) { /* fall through to local */ }
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Restore an unsaved draft back into the form (overwrites current values).
function applyDraft(draft) {
  if (!draft) return false;

  isLoadingForm = true;
  if (draft.date) reportDateInput.value = draft.date;
  editReportIdInput.value = draft.editId || '';
  isEditing = !!draft.isEditing && !!draft.editId;
  pay1Input.value = draft.pay1 || '';
  pay1ProfitInput.value = draft.pay1Profit || '';
  pay1ExpenditureInput.value = draft.pay1Expenditure || '';
  southpayBillingInput.value = draft.southpayBilling || '';
  southpayProfitInput.value = draft.southpayProfit || '';
  southpayExpenditureInput.value = draft.southpayExpenditure || '';
  totalProfitInput.value = draft.totalProfit || '';
  userManuallyEditedTotalProfit = !!draft.userManuallyEditedTotalProfit;
  yesterdayShortageInput.value = draft.yesterdayShortage || '';
  amountAvailableInput.value = draft.amountAvailable || '';

  submitBtnText.textContent = isEditing ? 'Update Report' : 'Submit Report';
  cancelEditBtn.style.display = isEditing ? 'inline-flex' : 'none';
  updateLivePreview();
  isLoadingForm = false;
  return true;
}

// True while the user has a form field focused (so we never overwrite typing).
function isFormFocused() {
  const a = document.activeElement;
  return !!(a && form.contains(a));
}

// A comparable snapshot of the fields that make up a draft.
function draftSnapshotFrom(d) {
  if (!d) return 'null';
  return JSON.stringify({
    date: d.date || '', editId: d.editId || '',
    pay1: d.pay1 || '', pay1Profit: d.pay1Profit || '', pay1Expenditure: d.pay1Expenditure || '',
    southpayBilling: d.southpayBilling || '', southpayProfit: d.southpayProfit || '', southpayExpenditure: d.southpayExpenditure || '',
    totalProfit: d.totalProfit || '', yesterdayShortage: d.yesterdayShortage || '',
    amountAvailable: d.amountAvailable || ''
  });
}
function currentFormSnapshot() {
  return draftSnapshotFrom({
    date: reportDateInput.value, editId: editReportIdInput.value,
    pay1: pay1Input.value, pay1Profit: pay1ProfitInput.value, pay1Expenditure: pay1ExpenditureInput.value,
    southpayBilling: southpayBillingInput.value, southpayProfit: southpayProfitInput.value, southpayExpenditure: southpayExpenditureInput.value,
    totalProfit: totalProfitInput.value, yesterdayShortage: yesterdayShortageInput.value,
    amountAvailable: amountAvailableInput.value
  });
}

// Live-sync the shared draft from the server so a value typed on one device
// shows on another without a refresh — but never clobber active typing here.
let lastDraftSnapshot = null;
async function syncRemoteDraft() {
  if (!isServerOnline || isFormFocused()) return;

  let draft;
  try {
    const res = await fetch('/api/draft');
    const json = await res.json();
    if (!json.success) return;
    draft = json.data;
  } catch (e) { return; }

  const remoteSnap = draftSnapshotFrom(draft);
  if (remoteSnap === lastDraftSnapshot) return;     // nothing new
  if (remoteSnap === currentFormSnapshot()) {       // already matches this form
    lastDraftSnapshot = remoteSnap;
    return;
  }
  lastDraftSnapshot = remoteSnap;

  if (draft) {
    applyDraft(draft);
  } else {
    // Draft was cleared elsewhere (submitted/reset) — show today's saved report.
    initFormState();
  }
}

// ---------- Same-day / existing report into the form ----------
// Find a saved report matching a given display date (DD/MM/YY).
function findReportByDisplayDate(displayDate) {
  return reports.find(r => r.date === displayDate);
}

// Load a saved report object into the form. isAuto = true for the silent
// "show today's already-entered values" case (keeps it as an update, no toast).
function loadReportIntoForm(rep, isAuto) {
  if (!rep) return;
  isLoadingForm = true;
  isEditing = true;
  userManuallyEditedTotalProfit = true; // keep the saved total as-is
  editReportIdInput.value = rep.id || '';
  reportDateInput.value = parseDisplayDateToIso(rep.date);
  pay1Input.value = rep.pay1 || '';
  pay1ProfitInput.value = rep.pay1Profit || '';
  pay1ExpenditureInput.value = rep.pay1Expenditure || '';
  southpayBillingInput.value = rep.southpayBilling || '';
  southpayProfitInput.value = rep.southpayProfit || '';
  southpayExpenditureInput.value = rep.southpayExpenditure || '';
  totalProfitInput.value = rep.totalProfit || '';
  yesterdayShortageInput.value = rep.yesterdayShortage || '';
  amountAvailableInput.value = rep.amountAvailable || '';
  reflectHolidayState(rep.isHoliday);

  if (rep.isHoliday) {
    submitBtnText.textContent = 'Save Sales (replace Holiday)';
  } else {
    submitBtnText.textContent = isAuto ? "Update Today's Report" : 'Update Report';
  }
  cancelEditBtn.style.display = 'inline-flex';
  updateLivePreview();
  isLoadingForm = false;
}

// Decide what the form should show on load: today's saved report (if any),
// then an unsaved draft on top (so in-progress typing always wins).
async function initFormState() {
  const todayDisplay = formatToDisplayDate(getTodayIsoDate());
  const todaysReport = findReportByDisplayDate(todayDisplay);
  if (todaysReport) {
    loadReportIntoForm(todaysReport, true);
  }
  // Unsaved typing (shared via the server) takes priority over the saved copy.
  const draft = await loadDraftFromStore();
  applyDraft(draft);
}

// ---------- Holiday ----------
// Mark the currently-selected date as a holiday (no business that day).
async function markHoliday() {
  const isoDate = reportDateInput.value;
  if (!isoDate) { showToast('Please select a valid date.', true); return; }
  if (isoDate > getTodayIsoDate()) { showToast("Date can't be in the future.", true); return; }

  const displayDate = formatToDisplayDate(isoDate);
  const existing = findReportByDisplayDate(displayDate);

  if (existing && !existing.isHoliday) {
    const hasSales = numVal(existing.pay1) || numVal(existing.southpayBilling) || numVal(existing.totalProfit);
    if (hasSales && !confirm(`${displayDate} has sales entered. Mark it as a Holiday and clear those values?`)) return;
  }
  if (existing && existing.isHoliday) { showToast(`${displayDate} is already a Holiday`); return; }

  const payload = {
    id: existing ? existing.id : undefined,
    date: displayDate,
    pay1: '', pay1Profit: '', pay1Expenditure: '',
    southpayBilling: '', southpayProfit: '', southpayExpenditure: '',
    totalProfit: '', yesterdayShortage: '', amountAvailable: '',
    isHoliday: true,
    rawReportText: `Daily Report:\nDate:${displayDate}\nHoliday`
  };

  isEditing = !!existing; // so saveReport does PUT when the day already has an entry
  try {
    const saved = await saveReport(payload);
    clearDraft();
    await loadReports();
    loadReportIntoForm(saved || payload, true); // shows the Holiday note + "Save Sales" button
    showToast(`${displayDate} marked as Holiday`);
  } catch (e) {
    console.error(e);
    showToast('Failed to mark holiday', true);
  }
}

// When the date changes, load that day's saved entry (if any) so the form edits
// it instead of creating a duplicate — this is the "enter yesterday's sales" flow.
function onReportDateChanged() {
  if (isLoadingForm) return;
  const displayDate = formatToDisplayDate(reportDateInput.value);
  const existing = findReportByDisplayDate(displayDate);
  if (existing) {
    loadReportIntoForm(existing, false); // loads values, or an empty Holiday day
    return;
  }
  // Fresh, blank entry for this date.
  isLoadingForm = true;
  isEditing = false;
  userManuallyEditedTotalProfit = false;
  editReportIdInput.value = '';
  pay1Input.value = ''; pay1ProfitInput.value = ''; pay1ExpenditureInput.value = '';
  southpayBillingInput.value = ''; southpayProfitInput.value = ''; southpayExpenditureInput.value = '';
  totalProfitInput.value = ''; yesterdayShortageInput.value = ''; amountAvailableInput.value = '';
  reflectHolidayState(false);
  submitBtnText.textContent = 'Submit Report';
  cancelEditBtn.style.display = 'none';
  updateLivePreview();
  isLoadingForm = false;
  saveDraft(); // nothing filled in -> clears any stale draft
}

// ---------- Monthly summary ----------
function monthKeyToday() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

// Days of the month that have already happened: 1..today for the current month,
// all days for a past month, 0 for a future month. Used to count holidays.
function elapsedDaysInMonth(year, monthIdx) {
  const today = startOfDay(new Date());
  const firstOfMonth = new Date(year, monthIdx, 1);
  const lastOfMonth = new Date(year, monthIdx + 1, 0);
  if (today < firstOfMonth) return 0;
  if (today >= lastOfMonth) return lastOfMonth.getDate();
  return today.getDate();
}

function renderMonthlySummary() {
  const key = (monthPicker && monthPicker.value) || monthKeyToday();
  const [y, m] = key.split('-').map(Number);
  const year = y, monthIdx = (m || 1) - 1;

  let sales = 0, profit = 0, pay1Exp = 0, spExp = 0;
  const workingDates = new Set();
  const holidayDates = new Set();

  reports.forEach(r => {
    const d = reportDateObj(r);
    if (d.getFullYear() !== year || d.getMonth() !== monthIdx) return;
    pay1Exp += numVal(r.pay1Expenditure);
    spExp += numVal(r.southpayExpenditure);
    if (r.isHoliday) {                  // only explicitly-marked holidays
      holidayDates.add(r.date);
      return;
    }
    sales += numVal(r.pay1) + numVal(r.southpayBilling);
    profit += numVal(r.totalProfit);
    workingDates.add(r.date);
  });

  const working = workingDates.size;
  const holidays = holidayDates.size;
  const elapsed = elapsedDaysInMonth(year, monthIdx);
  // Days that have passed but were neither given sales nor marked a holiday.
  const notMarked = Math.max(0, elapsed - working - holidays);

  monthSales.textContent = formatRupees(sales);
  monthProfit.textContent = formatRupees(profit);
  monthPay1Exp.textContent = formatRupees(pay1Exp);
  monthSpExp.textContent = formatRupees(spExp);
  monthTotalExp.textContent = formatRupees(pay1Exp + spExp);
  monthWorkingDays.textContent = String(working);
  monthHolidays.textContent = String(holidays);
  monthNotMarked.textContent = String(notMarked);

  const monthName = new Date(year, monthIdx, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  monthCaption.textContent = `${monthName} · ${elapsed} day${elapsed === 1 ? '' : 's'} so far · holidays are only the days you mark`;
}

// Toast Notification
let toastTimeout;
function showToast(message, isError = false) {
  clearTimeout(toastTimeout);
  toastMessage.textContent = message;
  toastNotification.style.borderLeftColor = isError ? 'var(--danger)' : 'var(--success)';
  toastNotification.classList.add('show');
  toastTimeout = setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3000);
}

// Copy Report Text to Clipboard
async function copyToClipboard(textToCopy) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    showToast('Report copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy text', true);
  }
}


// Check Backend Connection
async function checkBackendConnection() {
  const isHttp = window.location.protocol.startsWith('http');
  if (!isHttp) {
    setOfflineMode();
    return;
  }

  try {
    const res = await fetch('/api/health', { method: 'GET' });
    if (res.ok) {
      isServerOnline = true;
      connectionStatus.className = 'status-badge online';
      connectionStatus.querySelector('.status-text').textContent = 'Server Connected';
    } else {
      setOfflineMode();
    }
  } catch (err) {
    setOfflineMode();
  }
}

function setOfflineMode() {
  isServerOnline = false;
  connectionStatus.className = 'status-badge offline';
  connectionStatus.querySelector('.status-text').textContent = 'Offline (Local Storage)';
}

// Re-render the bills only when the data actually changed (avoids flicker/
// scroll jumps while polling in the background).
let lastReportsSnapshot = null;
function renderIfChanged() {
  const snap = JSON.stringify(reports);
  if (snap === lastReportsSnapshot) return;
  lastReportsSnapshot = snap;
  renderReportsTable();
  renderMonthlySummary();
}

// Fetch Reports (from Server or LocalStorage)
async function loadReports() {
  if (isServerOnline) {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        reports = data.data || [];
        localStorage.setItem('dailyReportsBackup', JSON.stringify(reports));
        renderIfChanged();
        return;
      }
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local storage', e);
    }
  }

  // Local storage fallback
  const saved = localStorage.getItem('dailyReportsBackup');
  reports = saved ? JSON.parse(saved) : [];
  renderIfChanged();
}

// Live updates: periodically re-sync bills from the server so entries added on
// another device/browser appear here without a manual refresh.
let pollTimer = null;
function startLiveUpdates() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (isServerOnline && document.visibilityState === 'visible') {
      loadReports();
      syncRemoteDraft();
    }
  }, 5000);
}
// Catch up immediately when the tab/app regains focus.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isServerOnline) {
    loadReports();
    syncRemoteDraft();
  }
});

// Save Report (ToServer or LocalStorage)
async function saveReport(reportObj) {
  if (isServerOnline) {
    try {
      const url = reportObj.id && isEditing ? `/api/reports/${reportObj.id}` : '/api/reports';
      const method = reportObj.id && isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportObj)
      });
      const json = await res.json();
      if (json.success) {
        return json.data;
      }
    } catch (e) {
      console.warn('Backend save failed, saving locally', e);
    }
  }

  // Local storage fallback
  if (reportObj.id && isEditing) {
    const idx = reports.findIndex(r => r.id === reportObj.id);
    if (idx !== -1) {
      reports[idx] = { ...reports[idx], ...reportObj, updatedAt: new Date().toISOString() };
    }
  } else {
    reportObj.id = 'rep_' + Date.now();
    reportObj.createdAt = new Date().toISOString();
    reports.unshift(reportObj);
  }
  localStorage.setItem('dailyReportsBackup', JSON.stringify(reports));
  return reportObj;
}

// Delete Report
async function deleteReport(id) {
  if (!confirm('Are you sure you want to delete this report?')) return;

  if (isServerOnline) {
    try {
      await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend delete failed', e);
    }
  }

  reports = reports.filter(r => r.id !== id);
  localStorage.setItem('dailyReportsBackup', JSON.stringify(reports));
  renderReportsTable();
  showToast('Report deleted');
}

// Edit Report
function editReport(id) {
  const rep = reports.find(r => r.id === id);
  if (!rep) return;

  isEditing = true;
  userManuallyEditedTotalProfit = true; // keep what was saved
  editReportIdInput.value = rep.id;
  reportDateInput.value = parseDisplayDateToIso(rep.date);
  pay1Input.value = rep.pay1 || '';
  pay1ProfitInput.value = rep.pay1Profit || '';
  pay1ExpenditureInput.value = rep.pay1Expenditure || '';
  southpayBillingInput.value = rep.southpayBilling || '';
  southpayProfitInput.value = rep.southpayProfit || '';
  southpayExpenditureInput.value = rep.southpayExpenditure || '';
  totalProfitInput.value = rep.totalProfit || '';
  yesterdayShortageInput.value = rep.yesterdayShortage || '';
  amountAvailableInput.value = rep.amountAvailable || '';
  reflectHolidayState(rep.isHoliday);

  submitBtnText.textContent = rep.isHoliday ? 'Save Sales (replace Holiday)' : 'Update Report';
  cancelEditBtn.style.display = 'inline-flex';
  updateLivePreview();
  if (billsDrawer.classList.contains('open')) closeDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Report loaded for editing');
}

// View in Modal
function viewReportModal(id) {
  const rep = reports.find(r => r.id === id);
  if (!rep) return;
  modalReportText.textContent = rep.rawReportText || '';
  viewModal.style.display = 'flex';
}

// ---------- Recent Bills: date range filtering + totals ----------

// Plain ₹ with Indian commas (no "~ Cr" suffix), for totals/lists.
function formatRupees(num) {
  const n = Number(num) || 0;
  return '₹ ' + n.toLocaleString('en-IN');
}

// Numeric value of a field (strips ₹, commas, etc.)
function numVal(v) {
  return parseFloat(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')) || 0;
}

// A report's Date object (midnight) from its DD/MM/YY date string.
function reportDateObj(r) {
  const iso = parseDisplayDateToIso(r.date); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(dt) { const d = new Date(dt); d.setHours(0, 0, 0, 0); return d; }

// Returns {start, end} Date bounds (inclusive) for the active range, or null = all.
function getRangeBounds() {
  const today = startOfDay(new Date());

  if (currentRange === 'all') return null;

  if (currentRange === 'today') {
    return { start: today, end: today, label: 'Today' };
  }

  if (currentRange === 'week') {
    // Current calendar week, Monday–Sunday.
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(today); start.setDate(today.getDate() - dow);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start, end, label: 'This week' };
  }

  if (currentRange === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end, label: 'This month' };
  }

  if (currentRange === 'custom') {
    const from = rangeFrom.value ? startOfDay(new Date(rangeFrom.value + 'T00:00:00')) : null;
    const to = rangeTo.value ? startOfDay(new Date(rangeTo.value + 'T00:00:00')) : null;
    const label = (rangeFrom.value || '…') + ' to ' + (rangeTo.value || '…');
    return { start: from, end: to, label };
  }

  return null;
}

function inRange(r, bounds) {
  if (!bounds) return true;
  const d = startOfDay(reportDateObj(r));
  if (bounds.start && d < bounds.start) return false;
  if (bounds.end && d > bounds.end) return false;
  return true;
}

// The reports currently in view (selected range + search box).
function getFilteredReports() {
  const query = searchHistoryInput.value.toLowerCase().trim();
  const bounds = getRangeBounds();
  return reports.filter(r => {
    if (!inRange(r, bounds)) return false;
    if (!query) return true;
    return (
      (r.date && r.date.toLowerCase().includes(query)) ||
      (r.pay1 && String(r.pay1).includes(query)) ||
      (r.southpayBilling && String(r.southpayBilling).includes(query)) ||
      (r.totalProfit && String(r.totalProfit).includes(query)) ||
      (r.amountAvailable && String(r.amountAvailable).toLowerCase().includes(query))
    );
  });
}

// Render the Recent Bills list + range totals.
function renderReportsTable() {
  const bounds = getRangeBounds();
  const filtered = getFilteredReports();

  // Overall sales + profit summed across the selected days.
  let totalSales = 0, totalProfit = 0;
  filtered.forEach(r => {
    totalSales += numVal(r.pay1) + numVal(r.southpayBilling);
    totalProfit += numVal(r.totalProfit);
  });
  rangeTotalSales.textContent = formatRupees(totalSales);
  rangeTotalProfit.textContent = formatRupees(totalProfit);
  if (rangeCaption) rangeCaption.textContent = bounds ? bounds.label : 'All time';

  reportCountBadge.textContent = `${filtered.length} bill${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    billsList.innerHTML = `<div class="bills-empty">No bills in this range.</div>`;
    return;
  }

  billsList.innerHTML = filtered.map(r => {
    const sales = numVal(r.pay1) + numVal(r.southpayBilling);
    return `
    <div class="bill-item">
      <div class="bill-row1">
        <span class="bill-date">${r.date || '-'}</span>
        ${r.isHoliday
          ? `<span class="bill-profit" style="color: var(--text-muted)">🏖️ Holiday</span>`
          : `<span class="bill-profit">${formatRupees(numVal(r.totalProfit))}</span>`}
      </div>
      <div class="bill-row2">
        ${r.isHoliday
          ? `<span class="bill-sales">No business</span>`
          : `<span class="bill-sales">Sales ${formatRupees(sales)}</span>`}
        ${r.amountAvailable ? `<span class="bill-avail">Avail ${r.amountAvailable}</span>` : ''}
      </div>
      <div class="bill-actions">
        <button class="table-btn" onclick="viewReportModal('${r.id}')" title="View Full Text">View</button>
        <button class="table-btn" onclick="editReport('${r.id}')" title="Edit">Edit</button>
        <button class="table-btn btn-delete" onclick="deleteReport('${r.id}')" title="Delete">Delete</button>
      </div>
    </div>`;
  }).join('');
}

// Stored date "DD/MM/YY" -> "DD/MM/YYYY" (4-digit year, unambiguous for Excel).
function toFullDate(ddmmyy) {
  const iso = parseDisplayDateToIso(ddmmyy); // YYYY-MM-DD
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Escape a value for CSV (quote if it contains comma, quote or newline).
function csvCell(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Numeric value for CSV, or blank if the field was empty (so Excel can sum them).
function numCell(v) {
  if (v === null || v === undefined || String(v).trim() === '') return '';
  return numVal(v);
}

// Export the currently shown bills (selected range + search) to a clean CSV.
function exportToCsv() {
  const list = getFilteredReports();
  if (list.length === 0) {
    showToast('No bills to export in this range', true);
    return;
  }

  // Chronological order (oldest first) reads better in a spreadsheet.
  const rows = [...list].sort((a, b) => reportDateObj(a) - reportDateObj(b));

  const headers = [
    'Date', 'Status', 'Pay1 Billing', 'Pay1 Profit', 'Pay1 Expenditure',
    'Southpay Billing', 'Southpay Profit', 'Southpay Expenditure',
    'Total Sales', 'Total Profit', 'Total Expenditure', 'Yesterday Shortage', 'Amount Available'
  ];

  const sum = { pay1: 0, pay1Profit: 0, pay1Exp: 0, spBill: 0, spProfit: 0, spExp: 0, sales: 0, profit: 0, exp: 0 };

  const lines = rows.map(r => {
    const pay1 = numVal(r.pay1);
    const spBill = numVal(r.southpayBilling);
    const pay1Exp = numVal(r.pay1Expenditure);
    const spExp = numVal(r.southpayExpenditure);
    const sales = pay1 + spBill;
    const exp = pay1Exp + spExp;
    sum.pay1 += pay1;
    sum.pay1Profit += numVal(r.pay1Profit);
    sum.pay1Exp += pay1Exp;
    sum.spBill += spBill;
    sum.spProfit += numVal(r.southpayProfit);
    sum.spExp += spExp;
    sum.sales += sales;
    sum.profit += numVal(r.totalProfit);
    sum.exp += exp;
    return [
      // Force the date to import as TEXT so Excel shows it in full (no ###)
      // and never reinterprets DD/MM as MM/DD.
      `="${toFullDate(r.date)}"`,
      r.isHoliday ? 'Holiday' : 'Working',
      numCell(r.pay1),
      numCell(r.pay1Profit),
      numCell(r.pay1Expenditure),
      numCell(r.southpayBilling),
      numCell(r.southpayProfit),
      numCell(r.southpayExpenditure),
      sales || '',
      numCell(r.totalProfit),
      exp || '',
      r.yesterdayShortage || '',
      r.amountAvailable || ''
    ].map(csvCell).join(',');
  });

  // Totals row at the bottom.
  const totalsRow = [
    'TOTAL', '', sum.pay1, sum.pay1Profit, sum.pay1Exp, sum.spBill, sum.spProfit, sum.spExp,
    sum.sales, sum.profit, sum.exp, '', ''
  ].map(csvCell).join(',');

  // '﻿' BOM makes Excel open UTF-8 correctly.
  const csv = '﻿' + [headers.join(','), ...lines, totalsRow].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `daily_reports_${getTodayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} bill${rows.length === 1 ? '' : 's'} to CSV`);
}

// Remember which button started the submit, and (for WhatsApp) pre-open a tab
// synchronously inside the click so the browser doesn't block it as a popup.
submitBtn.addEventListener('click', () => { pendingSubmitAction = 'plain'; });
submitWhatsappBtn.addEventListener('click', () => {
  pendingSubmitAction = 'whatsapp';
  try { pendingWaWindow = window.open('', '_blank'); } catch (e) { pendingWaWindow = null; }
});

// Form Submit Handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const action = pendingSubmitAction;
  pendingSubmitAction = 'plain'; // reset for next time

  if (!reportDateInput.value) {
    showToast('Please select a valid date.', true);
    reportDateInput.focus();
    if (pendingWaWindow) { pendingWaWindow.close(); pendingWaWindow = null; }
    return;
  }

  // Reports can't be for a future day.
  if (reportDateInput.value > getTodayIsoDate()) {
    showToast("Date can't be in the future.", true);
    reportDateInput.focus();
    if (pendingWaWindow) { pendingWaWindow.close(); pendingWaWindow = null; }
    return;
  }

  const wasEditing = isEditing;
  const displayDate = formatToDisplayDate(reportDateInput.value);
  const rawReportText = generateReportText();

  const reportPayload = {
    id: editReportIdInput.value || undefined,
    date: displayDate,
    pay1: pay1Input.value.trim(),
    pay1Profit: pay1ProfitInput.value.trim(),
    pay1Expenditure: pay1ExpenditureInput.value.trim(),
    southpayBilling: southpayBillingInput.value.trim(),
    southpayProfit: southpayProfitInput.value.trim(),
    southpayExpenditure: southpayExpenditureInput.value.trim(),
    totalProfit: totalProfitInput.value.trim(),
    yesterdayShortage: yesterdayShortageInput.value.trim(),
    amountAvailable: amountAvailableInput.value.trim(),
    isHoliday: false, // entering sales turns a day into a working day
    rawReportText: rawReportText
  };

  submitBtn.disabled = true;
  submitWhatsappBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  submitWhatsappBtn.style.opacity = '0.7';

  try {
    const saved = await saveReport(reportPayload);
    clearDraft();          // typed values are now committed
    await loadReports();

    // Keep the just-saved values on screen (so reopening the same day shows them
    // and submitting again updates this record instead of making a duplicate).
    loadReportIntoForm(saved || reportPayload, true);

    showToast(wasEditing ? 'Report updated successfully!' : 'Report submitted and saved!');

    // WhatsApp: send the pre-opened tab to WhatsApp with the report text.
    if (action === 'whatsapp') {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(rawReportText)}`;
      if (pendingWaWindow && !pendingWaWindow.closed) {
        pendingWaWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to save report', true);
    if (pendingWaWindow) { pendingWaWindow.close(); }
  } finally {
    pendingWaWindow = null;
    submitBtn.disabled = false;
    submitWhatsappBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitWhatsappBtn.style.opacity = '1';
  }
});

// Event Listeners for dynamic inputs
[pay1ProfitInput, southpayProfitInput].forEach(inp => {
  inp.addEventListener('input', () => {
    userManuallyEditedTotalProfit = false;
    calculateTotalProfit();
    updateLivePreview();
  });
});

totalProfitInput.addEventListener('input', () => {
  userManuallyEditedTotalProfit = true;
  updateLivePreview();
});

[pay1Input, southpayBillingInput, yesterdayShortageInput, amountAvailableInput].forEach(inp => {
  inp.addEventListener('input', updateLivePreview);
});

// Changing the date loads that day's saved entry (or a blank one) — the
// "enter yesterday's sales" / view-a-holiday flow.
reportDateInput.addEventListener('change', onReportDateChanged);

// Auto-save a draft of whatever is typed, so closing/reopening keeps it.
form.addEventListener('input', saveDraft);

todayDateBtn.addEventListener('click', () => {
  reportDateInput.value = getTodayIsoDate();
  onReportDateChanged();
});

resetFormBtn.addEventListener('click', resetForm);
cancelEditBtn.addEventListener('click', resetForm);
markHolidayBtn.addEventListener('click', markHoliday);

// Monthly summary month selector
monthPicker.addEventListener('change', renderMonthlySummary);

// Recent Bills drawer open/close (hamburger menu)
function openDrawer() {
  renderReportsTable(); // refresh totals/list each time it opens
  billsDrawer.classList.add('open');
  drawerBackdrop.classList.add('show');
  billsDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-locked');
}
function closeDrawer() {
  billsDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('show');
  billsDrawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-locked');
}
menuToggleBtn.addEventListener('click', openDrawer);
drawerCloseBtn.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && billsDrawer.classList.contains('open')) closeDrawer();
});

searchHistoryInput.addEventListener('input', renderReportsTable);
exportCsvBtn.addEventListener('click', exportToCsv);
printHistoryBtn.addEventListener('click', () => window.print());

// Range selector (Today / This Week / This Month / All / Custom)
rangeSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('.range-btn');
  if (!btn) return;
  currentRange = btn.dataset.range;
  rangeSelector.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b === btn));
  customRange.style.display = currentRange === 'custom' ? 'flex' : 'none';
  renderReportsTable();
});

[rangeFrom, rangeTo].forEach(inp => inp.addEventListener('change', () => {
  if (currentRange !== 'custom') return;
  renderReportsTable();
}));

modalCloseBtn.addEventListener('click', () => viewModal.style.display = 'none');
modalCloseBtn2.addEventListener('click', () => viewModal.style.display = 'none');
modalCopyBtn.addEventListener('click', () => copyToClipboard(modalReportText.textContent));
viewModal.addEventListener('click', (e) => {
  if (e.target === viewModal) viewModal.style.display = 'none';
});

// Dark/Light Theme Switcher
function initTheme() {
  const saved = localStorage.getItem('appTheme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', saved);
  themeToggleBtn.querySelector('.theme-icon').textContent = saved === 'dark' ? '☀️' : '🌙';
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('appTheme', next);
  themeToggleBtn.querySelector('.theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
});

// Global functions for inline table onclick
window.editReport = editReport;
window.deleteReport = deleteReport;
window.viewReportModal = viewReportModal;

// Initialize on Load
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  // Default to today, and don't allow picking a future day.
  reportDateInput.max = getTodayIsoDate();
  reportDateInput.value = getTodayIsoDate();
  // Monthly summary defaults to the current month; can't pick a future month.
  monthPicker.max = monthKeyToday();
  monthPicker.value = monthKeyToday();
  updateLivePreview();

  await checkBackendConnection();
  await loadReports();
  renderMonthlySummary();

  // Show today's already-saved report (if any), then restore unsaved typing on top.
  await initFormState();

  // Keep bills in sync across devices without a manual refresh.
  startLiveUpdates();
});
