const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reports.json');
const DRAFT_FILE = path.join(DATA_DIR, 'draft.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read data
function readReports() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading reports file:', err);
    return [];
  }
}

// Helper to write data
function writeReports(reports) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing reports file:', err);
    return false;
  }
}

// GET all reports
app.get('/api/reports', (req, res) => {
  const reports = readReports();
  res.json({ success: true, data: reports });
});

// POST new report
app.post('/api/reports', (req, res) => {
  const { date, pay1, pay1Profit, pay1Expenditure, southpayBilling, southpayProfit, southpayExpenditure, totalProfit, yesterdayShortage, amountAvailable, isHoliday, rawReportText } = req.body;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Date is required.' });
  }

  const newReport = {
    id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    createdAt: new Date().toISOString(),
    date: date || '',
    pay1: pay1 ?? '',
    pay1Profit: pay1Profit ?? '',
    pay1Expenditure: pay1Expenditure ?? '',
    southpayBilling: southpayBilling ?? '',
    southpayProfit: southpayProfit ?? '',
    southpayExpenditure: southpayExpenditure ?? '',
    totalProfit: totalProfit ?? '',
    yesterdayShortage: yesterdayShortage ?? '',
    amountAvailable: amountAvailable ?? '',
    isHoliday: !!isHoliday,
    rawReportText: rawReportText || ''
  };

  const reports = readReports();
  reports.unshift(newReport); // newest first
  writeReports(reports);

  res.status(201).json({ success: true, message: 'Report saved successfully!', data: newReport });
});

// PUT update report
app.put('/api/reports/:id', (req, res) => {
  const id = req.params.id;
  const reports = readReports();
  const index = reports.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Report not found' });
  }

  reports[index] = {
    ...reports[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeReports(reports);
  res.json({ success: true, message: 'Report updated successfully', data: reports[index] });
});

// DELETE report
app.delete('/api/reports/:id', (req, res) => {
  const id = req.params.id;
  let reports = readReports();
  const initialLength = reports.length;
  reports = reports.filter(r => r.id !== id);

  if (reports.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Report not found' });
  }

  writeReports(reports);
  res.json({ success: true, message: 'Report deleted successfully' });
});

// ---------- Shared draft (unsaved, in-progress entry) ----------
// Stored on the server so an unsubmitted entry shows up in any browser/device.

// GET current draft (null if none)
app.get('/api/draft', (req, res) => {
  try {
    if (!fs.existsSync(DRAFT_FILE)) {
      return res.json({ success: true, data: null });
    }
    const raw = fs.readFileSync(DRAFT_FILE, 'utf-8');
    const draft = raw.trim() ? JSON.parse(raw) : null;
    res.json({ success: true, data: draft });
  } catch (err) {
    console.error('Error reading draft file:', err);
    res.json({ success: true, data: null });
  }
});

// PUT/save draft
app.put('/api/draft', (req, res) => {
  try {
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(req.body || {}, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing draft file:', err);
    res.status(500).json({ success: false, message: 'Failed to save draft' });
  }
});

// DELETE draft (after submit or reset)
app.delete('/api/draft', (req, res) => {
  try {
    if (fs.existsSync(DRAFT_FILE)) fs.unlinkSync(DRAFT_FILE);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting draft file:', err);
    res.status(500).json({ success: false, message: 'Failed to clear draft' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Daily Report App running at http://localhost:${PORT}`);
  console.log(` Open your browser to access the application.`);
  console.log(`===============================================`);
});
