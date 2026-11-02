# Daily Report Billing & Profit Application

A fast, responsive web application for entering, calculating, and dispatching daily billing and profit figures.

---

## 🌟 Features

- **Default Today's Date**: Automatically pre-fills the current date (`DD/MM/YY`) as requested.
- **Auto Total Profit Calculation**: Instantly computes `Pay1 Profit + Southpay Profit` while still permitting manual overrides.
- **Real-Time Preview**: Displays the exact formatted report text as you type.
- **Exact Format Output**:
  ```text
  Daily Report:
  Date:12/10/26
  Pay1 : 52865400
  Profit: 14900
  Southpay Billing: 336000
  Profit:1300
  Total  profit:16200
  Yesterday shortage:
  Amount Available : 53.5L
  ```
- **Instant Actions**:
  - 📋 **Copy Text**: Copy the formatted report text to clipboard for WhatsApp, Telegram, or email.
  - 📲 **Share on WhatsApp**: One-click to open WhatsApp with the formatted report ready to send.
  - 📥 **Save .txt**: Download report as a text file.
- **Smart Indian Currency Format Preview**: Displays visual comma grouping (`₹ 5,28,65,400`) and verbal approximations (`~ 5.28 Cr`) under inputs to avoid digit typing mistakes.
- **Report History & Persistence**:
  - Saved to `data/reports.json` when running via Node.js server.
  - Automatically syncs with browser `localStorage` as offline backup.
  - View, edit, or delete previous entries.
  - 📊 **Export to CSV / Excel** and 🖨️ **Print** report records.
- **Dark & Light Mode**: Toggle theme matching your operating system or preference.

---

## 🚀 How to Run

### Option 1: Double-Click Launcher (Windows)
Double-click `start.bat` in the project root folder. It will start the server and open `http://localhost:3000` in your default browser.

### Option 2: Run via Terminal / Command Prompt
```bash
npm start
```
Then visit [http://localhost:3000](http://localhost:3000) in your browser.

### Option 3: Offline Standalone (No Node.js required)
Double-click `open-offline.bat` or open `public/index.html` directly in any web browser (Chrome, Edge, Firefox, Safari). All features, calculation, local storage saving, and copying work 100% offline.

---

## 📁 Project Structure

```
E:\Form\
├── data\
│   └── reports.json       # Persistent report storage
├── public\
│   ├── index.html         # Application UI
│   ├── style.css          # Modern styling with Dark/Light mode
│   └── app.js             # Form logic, auto-calculation, copy & API sync
├── server.js              # Express REST API & static file server
├── package.json           # Dependencies and scripts
├── start.bat              # One-click Windows launcher (Server + Browser)
├── open-offline.bat       # One-click Offline browser launcher
└── README.md              # Documentation
```
