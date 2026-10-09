# 📋 B-Division 5th Sem CR Attendance Register

> Mobile-first, zero-database, zero-cost attendance manager for **Boy CR + Girl CR**, **B-Division, 5th Semester**.

---

## ✅ Features at a Glance

| Feature | Details |
|---|---|
| 👥 Students | **54 students**, Roll 1–54 |
| 🔢 Lab Batches | **Batch 1** (Roll 1–27) and **Batch 2** (Roll 28–54) |
| 📚 Subjects | SE, C#, CS, WCMS, FullStack, Aptitude, R + SE Lab, R Lab, FullStack Lab |
| 🚨 Whole Day Absent | Mark students absent all day — auto-applied to all periods |
| 📖 Class-by-Class Absent | Quick list per period for physical register book entry |
| 📊 Book Register Matrix | Full P/A matrix table for all 54 students × all periods |
| 💾 Data Persistence | Survives app close, page refresh, tab close — NEVER clears mid-day |
| 🧹 Auto-Cleanup | Records older than **7 calendar days** auto-purged at midnight |
| 🔒 Security PIN | 4-digit PIN keypad (default: **5555**) — works for both Boy CR & Girl CR |
| 🔄 Dynamic CR Sync | 1-tap WhatsApp link OR Live P2P WebRTC room — zero database, zero cost |
| 📥 Downloads | Text report, CSV (Excel), JSON backup |
| 💬 WhatsApp Copy | 1-tap formatted attendance report ready to paste |
| 🖨️ Print / PDF | Print-optimized CSS, export as PDF directly from browser |
| 📱 Mobile PWA | Installable on Android and iPhone home screen |
| 🌙 Dark Mode | Toggle between light/dark theme |

---

## 🔐 Security PIN
- **Default PIN: `5555`**
- Change it anytime in **⚙️ Settings & Sync tab**
- Both Boy CR and Girl CR enter the same shared PIN
- Quick **🔒 Lock** button in the header

---

## 📚 How to Take Attendance (Daily Workflow)

### 1. Theory Class (All 54 Students)
1. Open the app and unlock with your PIN.
2. Tap **+ Add Lecture / Lab**.
3. In the modal, tap any theory subject chip: `SE`, `C#`, `CS`, `WCMS`, `FullStack`, `Aptitude`, or `R`.
4. Batch stays at **"Entire Class (54 Students)"** — correct for theory.
5. Tap **Save Class**.
6. All 54 students appear as **PRESENT (P)** by default.
7. Tap any absent student card → it turns red **(A)**.
8. Or use **⚡ Quick Absent Rolls** to type roll numbers (e.g. `4, 18, 35`) and bulk-mark absences instantly.

### 2. Lab Class (27 Students per Batch)
1. Tap **+ Add Lecture / Lab**.
2. Tap a **blue lab chip**: `SE Lab`, `R Lab`, or `FullStack Lab`.
3. The batch auto-suggests based on your CR role (**Boy CR → Batch 1**, **Girl CR → Batch 2**).
4. Change batch if needed and tap **Save Class**.
5. **Only the 27 students in that batch** will appear in the marking grid.

> **Example:** SE Lab — Boy CR takes Batch 1 (Roll 1–27), Girl CR takes Batch 2 (Roll 28–54). Each CR marks only their 27 students.

### 3. Whole Day Absent (Student absent for all classes)
1. In the **🚨 Whole Day Absentees** strip, tap **+ Mark Whole Day Absent**.
2. Enter roll numbers (e.g. `7, 23, 41`).
3. Tap **Apply Whole Day Absent** → Those students are automatically marked **A** in ALL periods today (past and future) and shown with a **WDA** badge.

---

## 📖 End-of-Day Register Book Entry (Under 60 Seconds!)

Click the **📋 Book Report** tab:

1. **🚨 Whole Day Absentees** — Students absent all day, highlighted at the top.
2. **⚡ Class-by-Class Absentee List** — Each period shows absent roll numbers only (since college register books only need 'A' entries, this is all you need!).
3. **📖 Complete Register Sheet Matrix** — Full P/A table for all 54 students across all periods.

### Download / Share Options:
- **💬 WhatsApp Copy** — 1-tap clipboard copy, paste directly into WhatsApp.
- **📄 Download Text** — Saves a `.txt` report to your phone.
- **📊 Excel / CSV** — Opens in Microsoft Excel or Google Sheets.
- **🖨️ Print / PDF** — Browser print dialog, save as PDF.

---

## 🔄 Dynamic CR Sync (Boy CR ↔ Girl CR, Zero Database!)

Since both CRs need to view each other's attendance, here are **2 free methods** — no Firebase, no MongoDB, no monthly charges:

### Method 1: WhatsApp Sync Link (Most Reliable)
1. Boy CR marks his 27 students (Batch 1) for all theory and SE Lab periods.
2. Tap **🔗 Send Live Data to Co-CR** (top header).
3. WhatsApp opens with a pre-formatted link.
4. Girl CR taps the link → All Boy CR's data **merges instantly** into her phone.
5. Girl CR adds her Batch 2 lab periods. She can send back a link too.

**Result:** Both CRs' phones have the complete combined attendance for the day.

### Method 2: Live P2P Room (Real-Time WebRTC)
1. Go to **⚙️ Settings & Sync** tab.
2. Both CRs enter the same Room ID (e.g. `bdiv-sem5-cr`) on their phones.
3. Click **Connect Room**.
4. When Boy CR marks a student, Girl CR's phone **updates live and automatically** (requires internet, no server needed — uses PeerJS WebRTC).

---

## 🚀 Deploy to Vercel (Free, Under 1 Minute)

### Option 1: Vercel CLI (Fastest)
```bash
npx vercel
```
Accept the defaults → get an instant HTTPS link (e.g. `https://bdiv-attendance.vercel.app`).

### Option 2: GitHub + Vercel Dashboard
1. Push this folder to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import repo → **Deploy**.

---

## 📱 Install as Mobile App (PWA)
Once deployed to Vercel:

- **Android (Chrome):** Tap 3-dot menu → **Add to Home screen**
- **iPhone (Safari):** Tap Share icon → **Add to Home Screen**

Opens full-screen like a native app. No Play Store or App Store needed.

---

## 📂 File Structure

```
attendacnce/
├── index.html      → App HTML structure, PIN keypad, modals, tabs
├── style.css       → Clean professional minimal CSS, light+dark theme
├── app.js          → All logic: PIN, attendance, batches, sync, reports
├── manifest.json   → PWA manifest for home screen install
├── icon.svg        → App icon
├── vercel.json     → Vercel deployment config
└── README.md       → This file
```

---

## 💡 Daily Quick Tips

- **No lectures to add again** — The app remembers all past 7 days. Just reopen and select the date.
- **Both CRs same link** — Share the Vercel URL with Girl CR via WhatsApp. She opens it, enters PIN, and it's ready.
- **Mid-class phone hand-off** — Lock the app before passing your phone (🔒 button) so classmates can't edit attendance.
- **Whole class absent (holiday/event)** — Tap **✕ All Absent** button.
