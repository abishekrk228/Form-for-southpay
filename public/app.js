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

// DOM Elements
const form = document.getElementById('dailyReportForm');
const editReportIdInput = document.getElementById('editReportId');
const reportDateInput = document.getElementById('reportDate');
const formattedDatePreview = document.getElementById('formattedDatePreview');
const todayDateBtn = document.getElementById('todayDateBtn');
const loadDemoBtn = document.getElementById('loadDemoBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const pay1Input = document.getElementById('pay1');
const pay1ProfitInput = document.getElementById('pay1Profit');
const southpayBillingInput = document.getElementById('southpayBilling');
const southpayProfitInput = document.getElementById('southpayProfit');
const totalProfitInput = document.getElementById('totalProfit');
const yesterdayShortageInput = document.getElementById('yesterdayShortage');
const amountAvailableInput = document.getElementById('amountAvailable');

const pay1Readable = document.getElementById('pay1Readable');
const pay1ProfitReadable = document.getElementById('pay1ProfitReadable');
const southpayBillingReadable = document.getElementById('southpayBillingReadable');
const southpayProfitReadable = document.getElementById('southpayProfitReadable');

const reportPreviewText = document.getElementById('reportPreviewText');
const copyReportBtn = document.getElementById('copyReportBtn');
const copiedBadge = document.getElementById('copiedBadge');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');

const summaryTotalBilling = document.getElementById('summaryTotalBilling');
const summaryTotalProfit = document.getElementById('summaryTotalProfit');
const summaryAmountAvailable = document.getElementById('summaryAmountAvailable');

const connectionStatus = document.getElementById('connectionStatus');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');

const reportsTableBody = document.getElementById('reportsTableBody');
const reportCountBadge = document.getElementById('reportCountBadge');
const searchHistoryInput = document.getElementById('searchHistoryInput');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const printHistoryBtn = document.getElementById('printHistoryBtn');

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

// Update live preview & summaries
function updateLivePreview() {
  const formattedText = generateReportText();
  reportPreviewText.textContent = formattedText;

  // Update readable hints
  pay1Readable.textContent = formatIndianCurrencyWords(pay1Input.value);
  pay1ProfitReadable.textContent = formatIndianCurrencyWords(pay1ProfitInput.value);
  southpayBillingReadable.textContent = formatIndianCurrencyWords(southpayBillingInput.value);
  southpayProfitReadable.textContent = formatIndianCurrencyWords(southpayProfitInput.value);

  // Update Summary Tiles
  const p1Val = parseFloat(String(pay1Input.value).replace(/[^0-9.-]/g, '')) || 0;
  const spVal = parseFloat(String(southpayBillingInput.value).replace(/[^0-9.-]/g, '')) || 0;
  const totalBilling = p1Val + spVal;

  summaryTotalBilling.textContent = totalBilling > 0 ? formatIndianCurrencyWords(totalBilling) : '₹ 0';

  const totProfitVal = totalProfitInput.value.trim();
  summaryTotalProfit.textContent = totProfitVal ? formatIndianCurrencyWords(totProfitVal) : '₹ 0';

  summaryAmountAvailable.textContent = amountAvailableInput.value.trim() || '-';

  formattedDatePreview.textContent = `Formatted in report: ${formatToDisplayDate(reportDateInput.value)}`;
}

// Reset Form to Clean State (Date stays today)
function resetForm() {
  isEditing = false;
  userManuallyEditedTotalProfit = false;
  editReportIdInput.value = '';
  reportDateInput.value = getTodayIsoDate();
  pay1Input.value = '';
  pay1ProfitInput.value = '';
  southpayBillingInput.value = '';
  southpayProfitInput.value = '';
  totalProfitInput.value = '';
  yesterdayShortageInput.value = '';
  amountAvailableInput.value = '';

  submitBtnText.textContent = 'Submit Daily Report';
  cancelEditBtn.style.display = 'none';
  updateLivePreview();
}

// Load Demo Sample Data provided by user
function loadDemoData() {
  isEditing = false;
  editReportIdInput.value = '';
  // Demo date: 12/10/26 (2026-10-12)
  reportDateInput.value = '2026-10-12';
  pay1Input.value = '52865400';
  pay1ProfitInput.value = '14900';
  southpayBillingInput.value = '336000';
  southpayProfitInput.value = '1300';
  userManuallyEditedTotalProfit = false;
  totalProfitInput.value = '16200';
  yesterdayShortageInput.value = '';
  amountAvailableInput.value = '53.5L';

  updateLivePreview();
  showToast('Demo data loaded successfully!');
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
    copiedBadge.style.display = 'inline-block';
    setTimeout(() => {
      copiedBadge.style.display = 'none';
    }, 2000);
    showToast('Report copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy text', true);
  }
}

// Share via WhatsApp
function shareViaWhatsApp() {
  const text = generateReportText();
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Download text file
function downloadReportTxt() {
  const text = generateReportText();
  const dateFormatted = formatToDisplayDate(reportDateInput.value).replace(/\//g, '-');
  const filename = `Daily-Report-${dateFormatted || 'entry'}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`);
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

// Fetch Reports (from Server or LocalStorage)
async function loadReports() {
  if (isServerOnline) {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        reports = data.data || [];
        localStorage.setItem('dailyReportsBackup', JSON.stringify(reports));
        renderReportsTable();
        return;
      }
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local storage', e);
    }
  }

  // Local storage fallback
  const saved = localStorage.getItem('dailyReportsBackup');
  reports = saved ? JSON.parse(saved) : [];
  renderReportsTable();
}

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
  southpayBillingInput.value = rep.southpayBilling || '';
  southpayProfitInput.value = rep.southpayProfit || '';
  totalProfitInput.value = rep.totalProfit || '';
  yesterdayShortageInput.value = rep.yesterdayShortage || '';
  amountAvailableInput.value = rep.amountAvailable || '';

  submitBtnText.textContent = 'Update Daily Report';
  cancelEditBtn.style.display = 'inline-flex';
  updateLivePreview();
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

// Render Table
function renderReportsTable() {
  const query = searchHistoryInput.value.toLowerCase().trim();
  const filtered = reports.filter(r => {
    if (!query) return true;
    return (
      (r.date && r.date.toLowerCase().includes(query)) ||
      (r.pay1 && String(r.pay1).includes(query)) ||
      (r.southpayBilling && String(r.southpayBilling).includes(query)) ||
      (r.totalProfit && String(r.totalProfit).includes(query)) ||
      (r.amountAvailable && String(r.amountAvailable).toLowerCase().includes(query))
    );
  });

  reportCountBadge.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    reportsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">No reports found matching your criteria.</td>
      </tr>
    `;
    return;
  }

  reportsTableBody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${r.date || '-'}</strong></td>
      <td>₹ ${r.pay1 ? Number(r.pay1).toLocaleString('en-IN') : '-'}</td>
      <td>₹ ${r.pay1Profit ? Number(r.pay1Profit).toLocaleString('en-IN') : '-'}</td>
      <td>₹ ${r.southpayBilling ? Number(r.southpayBilling).toLocaleString('en-IN') : '-'}</td>
      <td>₹ ${r.southpayProfit ? Number(r.southpayProfit).toLocaleString('en-IN') : '-'}</td>
      <td><span style="color:var(--success); font-weight:700;">₹ ${r.totalProfit ? Number(r.totalProfit).toLocaleString('en-IN') : '-'}</span></td>
      <td>${r.yesterdayShortage || '<span style="color:var(--text-muted)">-</span>'}</td>
      <td><strong>${r.amountAvailable || '-'}</strong></td>
      <td class="text-right">
        <div class="action-btn-group">
          <button class="table-btn" onclick="viewReportModal('${r.id}')" title="View Full Text">View</button>
          <button class="table-btn" onclick="editReport('${r.id}')" title="Edit">Edit</button>
          <button class="table-btn btn-delete" onclick="deleteReport('${r.id}')" title="Delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Export CSV
function exportToCsv() {
  if (reports.length === 0) {
    showToast('No reports to export', true);
    return;
  }

  const headers = ['Date', 'Pay1', 'Pay1 Profit', 'Southpay Billing', 'Southpay Profit', 'Total Profit', 'Yesterday Shortage', 'Amount Available'];
  const rows = reports.map(r => [
    `"${r.date || ''}"`,
    `"${r.pay1 || ''}"`,
    `"${r.pay1Profit || ''}"`,
    `"${r.southpayBilling || ''}"`,
    `"${r.southpayProfit || ''}"`,
    `"${r.totalProfit || ''}"`,
    `"${r.yesterdayShortage || ''}"`,
    `"${r.amountAvailable || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `daily_reports_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported to CSV');
}

// Form Submit Handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!reportDateInput.value) {
    showToast('Please select a valid date.', true);
    reportDateInput.focus();
    return;
  }

  const displayDate = formatToDisplayDate(reportDateInput.value);
  const rawReportText = generateReportText();

  const reportPayload = {
    id: editReportIdInput.value || undefined,
    date: displayDate,
    pay1: pay1Input.value.trim(),
    pay1Profit: pay1ProfitInput.value.trim(),
    southpayBilling: southpayBillingInput.value.trim(),
    southpayProfit: southpayProfitInput.value.trim(),
    totalProfit: totalProfitInput.value.trim(),
    yesterdayShortage: yesterdayShortageInput.value.trim(),
    amountAvailable: amountAvailableInput.value.trim(),
    rawReportText: rawReportText
  };

  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';

  try {
    await saveReport(reportPayload);
    await loadReports();
    showToast(isEditing ? 'Report updated successfully!' : 'Report submitted and saved!');
    resetForm();
  } catch (err) {
    console.error(err);
    showToast('Failed to save report', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
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

reportDateInput.addEventListener('change', updateLivePreview);

todayDateBtn.addEventListener('click', () => {
  reportDateInput.value = getTodayIsoDate();
  updateLivePreview();
});

loadDemoBtn.addEventListener('click', loadDemoData);
resetFormBtn.addEventListener('click', resetForm);
cancelEditBtn.addEventListener('click', resetForm);

copyReportBtn.addEventListener('click', () => copyToClipboard(generateReportText()));
whatsappShareBtn.addEventListener('click', shareViaWhatsApp);
downloadTxtBtn.addEventListener('click', downloadReportTxt);

searchHistoryInput.addEventListener('input', renderReportsTable);
exportCsvBtn.addEventListener('click', exportToCsv);
printHistoryBtn.addEventListener('click', () => window.print());

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
  // Set default date to today's date
  reportDateInput.value = getTodayIsoDate();
  updateLivePreview();

  await checkBackendConnection();
  await loadReports();
});
