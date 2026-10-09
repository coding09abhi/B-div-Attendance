/**
 * B-DIV 5TH SEM ATTENDANCE REGISTER
 * 54 Students • Batch 1 (1-27) & Batch 2 (28-54)
 * Theory & Labs • Whole Day Absent • Dynamic CR Sync (Zero Database)
 */

(function () {
  'use strict';

  // --- CONFIG & CONSTANTS ---
  const STORAGE_KEYS = {
    PIN: 'bdiv5_cr_pin',
    ROSTER: 'bdiv5_students_54',
    ATTENDANCE: 'bdiv5_attendance_records',
    LAST_CLEANUP: 'bdiv5_last_cleanup',
    THEME: 'bdiv5_theme',
    CR_ROLE: 'bdiv5_active_cr_role',
    ROOM_ID: 'bdiv5_peer_room_id'
  };

  const DEFAULT_PIN = '5555';
  const RETENTION_DAYS = 7;
  const TOTAL_STUDENTS = 54;
  const BATCH_1_MAX = 27;

  // Exact 5th Sem Subjects specified by user
  const THEORY_SUBJECTS = ['SE', 'C#', 'CS', 'WCMS', 'FullStack', 'Aptitude', 'R'];
  const LAB_SUBJECTS = ['SE Lab', 'R Lab', 'FullStack Lab'];

  // --- STATE ---
  let enteredPin = '';
  let isAuthenticated = false;
  let currentDate = getTodayDateString();
  let currentPeriodId = null;
  let activeFilter = 'all';
  let searchQuery = '';
  let activeCrRole = 'boy'; // 'boy' or 'girl'

  // Data
  let students = [];
  let attendanceRecords = {};

  // PeerJS dynamic sync
  let peerInstance = null;
  let peerConn = null;
  let isPeerConnected = false;

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadRoster();
    loadAttendance();
    runAuto7DayCleanup();
    checkForUrlSyncData();
    initPinLock();
    initDateBar();
    initTabs();
    initSubjectChips();
    setupEventListeners();
    initPeerSync();
    updateStorageMetrics();
  });

  // --- HELPERS: DATES ---
  function getTodayDateString() {
    const today = new Date();
    return formatDateToISO(today);
  }

  function formatDateToISO(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  // --- THEME ---
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }

  // --- CR ROLE (BOY CR / GIRL CR) ---
  window.setCrRole = function (role) {
    activeCrRole = role;
    localStorage.setItem(STORAGE_KEYS.CR_ROLE, role);

    const boyBtn = document.getElementById('boyCrBtn');
    const girlBtn = document.getElementById('girlCrBtn');
    if (boyBtn && girlBtn) {
      boyBtn.classList.toggle('active', role === 'boy');
      girlBtn.classList.toggle('active', role === 'girl');
    }

    // Filter defaults based on CR
    if (role === 'boy') {
      showToast('Switched to Boy CR Mode (Batch 1 focus)');
    } else {
      showToast('Switched to Girl CR Mode (Batch 2 focus)');
    }
  };

  // --- PIN LOCK ---
  function initPinLock() {
    const overlay = document.getElementById('pinOverlay');
    overlay.classList.add('active');
    enteredPin = '';
    renderPinDots();

    window.addEventListener('keydown', (e) => {
      if (!isAuthenticated) {
        if (/^[0-9]$/.test(e.key)) {
          handleKeyInput(e.key);
        } else if (e.key === 'Backspace') {
          deletePin();
        } else if (e.key === 'Escape') {
          clearPin();
        }
      }
    });
  }

  window.handleKeyInput = function (digit) {
    if (enteredPin.length < 4) {
      enteredPin += digit;
      renderPinDots();

      if (enteredPin.length === 4) {
        setTimeout(verifyPin, 100);
      }
    }
  };

  window.deletePin = function () {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      renderPinDots();
      document.getElementById('pinError').textContent = '';
    }
  };

  window.clearPin = function () {
    enteredPin = '';
    renderPinDots();
    document.getElementById('pinError').textContent = '';
  };

  function renderPinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`dot${i}`);
      if (dot) {
        dot.classList.toggle('filled', i < enteredPin.length);
      }
    }
  }

  function verifyPin() {
    const storedPin = localStorage.getItem(STORAGE_KEYS.PIN) || DEFAULT_PIN;
    if (enteredPin === storedPin) {
      isAuthenticated = true;
      document.getElementById('pinOverlay').classList.remove('active');
      showToast('Unlocked! Welcome CR', 'success');
      onAppUnlocked();
    } else {
      document.getElementById('pinError').textContent = 'Incorrect PIN! Try again.';
      enteredPin = '';
      renderPinDots();
    }
  }

  function lockApp() {
    isAuthenticated = false;
    enteredPin = '';
    renderPinDots();
    document.getElementById('pinError').textContent = '';
    document.getElementById('pinOverlay').classList.add('active');
  }

  function onAppUnlocked() {
    updateDateDisplay();
    renderWholeDayAbsentBar();
    renderPeriodChips();
    renderStudentGrid();
    renderMasterReport();
  }

  // --- SAFE 7-DAY CLEANUP (NEVER CLEARS MID-DAY) ---
  function runAuto7DayCleanup() {
    const now = new Date();
    // Safety buffer: only purge dates older than 7 days from start of today
    const cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - RETENTION_DAYS).getTime();
    let purged = 0;

    Object.keys(attendanceRecords).forEach(dateStr => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const recordDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        if (recordDate < cutoffTime) {
          delete attendanceRecords[dateStr];
          purged++;
        }
      }
    });

    if (purged > 0) {
      saveAttendance();
      console.log(`Auto cleanup safely purged ${purged} records older than 7 days.`);
    }

    localStorage.setItem(STORAGE_KEYS.LAST_CLEANUP, String(Date.now()));
  }

  // --- ROSTER (54 STUDENTS: BATCH 1 & BATCH 2) ---
  function loadRoster() {
    const saved = localStorage.getItem(STORAGE_KEYS.ROSTER);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === TOTAL_STUDENTS) {
          students = parsed;
        } else {
          students = createDefault54Students();
          saveRoster();
        }
      } catch (e) {
        students = createDefault54Students();
        saveRoster();
      }
    } else {
      students = createDefault54Students();
      saveRoster();
    }
    renderRosterTable();
  }

  function createDefault54Students() {
    const list = [];
    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const isBatch1 = i <= BATCH_1_MAX;
      list.push({
        roll: i,
        name: `Student ${i}`,
        batch: isBatch1 ? 'batch1' : 'batch2' // Batch 1: 1-27, Batch 2: 28-54
      });
    }
    return list;
  }

  function saveRoster() {
    localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(students));
    renderRosterTable();
  }

  function renderRosterTable() {
    const tbody = document.getElementById('studentsRosterBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    students.forEach(st => {
      const tr = document.createElement('tr');
      const isB1 = st.roll <= BATCH_1_MAX;
      tr.innerHTML = `
        <td><strong>#${st.roll}</strong></td>
        <td>${escapeHtml(st.name)}</td>
        <td>
          <span class="badge ${isB1 ? 'badge-accent' : 'badge-neutral'}">
            ${isB1 ? 'Batch 1 (1-27)' : 'Batch 2 (28-54)'}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="openSingleStudentEdit(${st.roll})">Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- ATTENDANCE STORAGE & DATA LAYER ---
  function loadAttendance() {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (saved) {
      try {
        attendanceRecords = JSON.parse(saved);
      } catch (e) {
        attendanceRecords = {};
      }
    } else {
      attendanceRecords = {};
    }
  }

  function saveAttendance() {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceRecords));
    updateStorageMetrics();
    // If connected via P2P sync, broadcast live change to Co-CR
    broadcastLiveSync();
  }

  function getDayData(dateStr) {
    if (!attendanceRecords[dateStr]) {
      attendanceRecords[dateStr] = {
        wholeDayAbsentRolls: [],
        periods: []
      };
    }
    if (!attendanceRecords[dateStr].wholeDayAbsentRolls) {
      attendanceRecords[dateStr].wholeDayAbsentRolls = [];
    }
    if (!attendanceRecords[dateStr].periods) {
      attendanceRecords[dateStr].periods = [];
    }
    return attendanceRecords[dateStr];
  }

  function getActivePeriod() {
    const day = getDayData(currentDate);
    if (!currentPeriodId && day.periods.length > 0) {
      currentPeriodId = day.periods[0].id;
    }
    return day.periods.find(p => p.id === currentPeriodId) || null;
  }

  // --- WHOLE DAY ABSENT LOGIC ---
  function renderWholeDayAbsentBar() {
    const day = getDayData(currentDate);
    const rolls = day.wholeDayAbsentRolls || [];
    const displayEl = document.getElementById('wholeDayAbsentRollsDisplay');
    const reportBox = document.getElementById('wdaReportBox');
    const badgeEl = document.getElementById('wdaCountBadge');

    const formattedRolls = rolls.length > 0 ? rolls.sort((a, b) => a - b).join(', ') : 'None marked today';

    if (displayEl) {
      displayEl.textContent = formattedRolls;
    }

    if (reportBox) {
      if (rolls.length > 0) {
        reportBox.innerHTML = `🚨 <strong>Roll Numbers:</strong> ${formattedRolls} (${rolls.length} students absent all day)`;
      } else {
        reportBox.textContent = 'None. All students attended at least one class.';
      }
    }

    if (badgeEl) {
      badgeEl.textContent = `${rolls.length} Students`;
    }
  }

  window.openWholeDayAbsentModal = function () {
    const day = getDayData(currentDate);
    const rolls = day.wholeDayAbsentRolls || [];
    document.getElementById('wholeDayRollsInput').value = rolls.join(', ');
    document.getElementById('wholeDayAbsentModal').classList.add('active');
  };

  window.closeWholeDayAbsentModal = function () {
    document.getElementById('wholeDayAbsentModal').classList.remove('active');
  };

  window.applyWholeDayAbsentees = function () {
    const raw = document.getElementById('wholeDayRollsInput').value;
    const matches = raw.match(/\d+/g) || [];
    const rollSet = new Set(matches.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= TOTAL_STUDENTS));
    const rollsArr = Array.from(rollSet).sort((a, b) => a - b);

    const day = getDayData(currentDate);
    day.wholeDayAbsentRolls = rollsArr;

    // Apply to all existing periods of today: mark them 'A'
    day.periods.forEach(p => {
      if (!p.attendance) p.attendance = {};
      rollsArr.forEach(r => {
        // If this period is batch-restricted, only apply if student belongs to batch
        if (isStudentInBatch(r, p.batch)) {
          p.attendance[r] = 'A';
        }
      });
    });

    saveAttendance();
    closeWholeDayAbsentModal();
    renderWholeDayAbsentBar();
    renderStudentGrid();
    renderPeriodChips();
    renderMasterReport();
    showToast(`Marked ${rollsArr.length} students absent for the whole day!`, 'danger');
  };

  function isStudentInBatch(roll, batchType) {
    if (!batchType || batchType === 'all') return true;
    if (batchType === 'batch1') return roll <= BATCH_1_MAX;
    if (batchType === 'batch2') return roll > BATCH_1_MAX;
    return true;
  }

  // --- DATE BAR ---
  function initDateBar() {
    const container = document.getElementById('weekDatesRow');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    const daysToShow = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      daysToShow.push(d);
    }

    daysToShow.forEach(dateObj => {
      const dateStr = formatDateToISO(dateObj);
      const isToday = dateStr === formatDateToISO(today);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = dateObj.getDate();

      const btn = document.createElement('button');
      btn.className = `date-btn ${dateStr === currentDate ? 'active' : ''}`;
      btn.dataset.date = dateStr;
      btn.innerHTML = `
        <span class="d-day">${isToday ? 'Today' : dayName}</span>
        <span class="d-num">${dayNum}</span>
      `;

      btn.addEventListener('click', () => {
        selectDate(dateStr);
      });

      container.appendChild(btn);
    });

    updateDateDisplay();
  }

  function selectDate(dateStr) {
    currentDate = dateStr;
    currentPeriodId = null;

    document.querySelectorAll('.date-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.date === dateStr);
    });

    updateDateDisplay();
    renderWholeDayAbsentBar();
    renderPeriodChips();
    renderStudentGrid();
    renderMasterReport();
  }

  function updateDateDisplay() {
    const el = document.getElementById('currentDateDisplay');
    if (el) el.textContent = `📅 ${formatDisplayDate(currentDate)}`;

    const sub = document.getElementById('reportDateSubtitle');
    if (sub) sub.textContent = `Official Summary for ${formatDisplayDate(currentDate)} (B-Div 5th Sem)`;
  }

  // --- TABS ---
  function initTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');

        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        if (targetId === 'reportTab') renderMasterReport();
        else if (targetId === 'attendanceTab') renderStudentGrid();
      });
    });
  }

  // --- SUBJECT PRESETS ---
  function initSubjectChips() {
    const theoryContainer = document.getElementById('presetSubjectChips');
    const labContainer = document.getElementById('presetLabChips');
    const input = document.getElementById('lectureSubjectInput');
    const batchSelect = document.getElementById('lectureBatchSelect');

    if (theoryContainer) {
      theoryContainer.innerHTML = '';
      THEORY_SUBJECTS.forEach(sub => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sub-chip';
        chip.textContent = sub;
        chip.addEventListener('click', () => {
          input.value = sub;
          batchSelect.value = 'all'; // Theory is usually all 54 students
        });
        theoryContainer.appendChild(chip);
      });
    }

    if (labContainer) {
      labContainer.innerHTML = '';
      LAB_SUBJECTS.forEach(lab => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sub-chip lab-chip';
        chip.textContent = lab;
        chip.addEventListener('click', () => {
          input.value = lab;
          // By default suggest user's current CR role batch for lab!
          batchSelect.value = activeCrRole === 'boy' ? 'batch1' : 'batch2';
        });
        labContainer.appendChild(chip);
      });
    }
  }

  // --- LECTURE MANAGEMENT ---
  function renderPeriodChips() {
    const container = document.getElementById('periodChipsContainer');
    const titleEl = document.getElementById('activePeriodTitle');
    const markingArea = document.getElementById('markingArea');
    const noPeriodsState = document.getElementById('noPeriodsState');
    const batchBanner = document.getElementById('labBatchBanner');

    if (!container) return;
    container.innerHTML = '';

    const day = getDayData(currentDate);
    const periods = day.periods;

    if (periods.length === 0) {
      markingArea.classList.add('hidden');
      noPeriodsState.classList.remove('hidden');
      if (titleEl) titleEl.textContent = 'No Classes Added';
      return;
    }

    markingArea.classList.remove('hidden');
    noPeriodsState.classList.add('hidden');

    if (!currentPeriodId || !periods.find(p => p.id === currentPeriodId)) {
      currentPeriodId = periods[0].id;
    }

    const activePeriod = periods.find(p => p.id === currentPeriodId);
    if (titleEl && activePeriod) {
      const batchLabel = activePeriod.batch === 'batch1' ? ' [Batch 1: 1-27]' :
                         activePeriod.batch === 'batch2' ? ' [Batch 2: 28-54]' : '';
      titleEl.textContent = `${activePeriod.periodNum}: ${activePeriod.name}${batchLabel}`;
    }

    // Lab batch banner update
    if (batchBanner && activePeriod) {
      if (activePeriod.batch && activePeriod.batch !== 'all') {
        batchBanner.classList.remove('hidden');
        const isB1 = activePeriod.batch === 'batch1';
        document.getElementById('labBatchBadge').textContent = isB1 ? 'BATCH 1' : 'BATCH 2';
        document.getElementById('labBatchInfo').textContent = isB1 ? 'Roll 1 to 27 (27 Students)' : 'Roll 28 to 54 (27 Students)';
      } else {
        batchBanner.classList.add('hidden');
      }
    }

    periods.forEach(p => {
      const chip = document.createElement('button');
      chip.className = `period-pill ${p.id === currentPeriodId ? 'active' : ''}`;

      const attendance = p.attendance || {};
      const absentCount = Object.values(attendance).filter(v => v === 'A').length;

      let batchTag = '';
      if (p.batch === 'batch1') batchTag = '<span class="pill-batch-tag">B1</span>';
      else if (p.batch === 'batch2') batchTag = '<span class="pill-batch-tag">B2</span>';

      chip.innerHTML = `
        <span>${escapeHtml(p.periodNum)}: ${escapeHtml(p.name)}</span>
        ${batchTag}
        <small style="opacity: 0.85">${absentCount > 0 ? `${absentCount}A` : 'All P'}</small>
      `;

      chip.addEventListener('click', () => {
        currentPeriodId = p.id;
        renderPeriodChips();
        renderStudentGrid();
      });

      container.appendChild(chip);
    });
  }

  window.openAddLectureModal = function () {
    document.getElementById('lectureModalTitle').textContent = 'Add Class / Lab';
    document.getElementById('editLectureId').value = '';
    document.getElementById('lectureSubjectInput').value = '';
    document.getElementById('lectureFacultyInput').value = '';

    const day = getDayData(currentDate);
    const nextPeriodNum = `Period ${Math.min(day.periods.length + 1, 6)}`;
    document.getElementById('lecturePeriodNumber').value = nextPeriodNum;

    // Default batch
    document.getElementById('lectureBatchSelect').value = 'all';
    document.getElementById('lectureModal').classList.add('active');
  };

  window.closeLectureModal = function () {
    document.getElementById('lectureModal').classList.remove('active');
  };

  window.handleSaveLecture = function (e) {
    e.preventDefault();
    const id = document.getElementById('editLectureId').value;
    const name = document.getElementById('lectureSubjectInput').value.trim();
    const periodNum = document.getElementById('lecturePeriodNumber').value;
    const faculty = document.getElementById('lectureFacultyInput').value.trim();
    const batch = document.getElementById('lectureBatchSelect').value;

    if (!name) return;

    const day = getDayData(currentDate);

    if (id) {
      const p = day.periods.find(item => item.id === id);
      if (p) {
        p.name = name;
        p.periodNum = periodNum;
        p.faculty = faculty;
        p.batch = batch;
      }
    } else {
      const newId = 'period_' + Date.now();
      const initialAttendance = {};

      // Initialize students: All Present by default, EXCEPT if they are marked Whole Day Absent!
      students.forEach(st => {
        if (isStudentInBatch(st.roll, batch)) {
          const isWholeDayAbsent = day.wholeDayAbsentRolls && day.wholeDayAbsentRolls.includes(st.roll);
          initialAttendance[st.roll] = isWholeDayAbsent ? 'A' : 'P';
        }
      });

      day.periods.push({
        id: newId,
        name: name,
        periodNum: periodNum,
        faculty: faculty,
        batch: batch,
        attendance: initialAttendance
      });

      currentPeriodId = newId;
    }

    saveAttendance();
    closeLectureModal();
    renderPeriodChips();
    renderStudentGrid();
    renderMasterReport();
    showToast('Class added & saved!', 'success');
  };

  // --- ATTENDANCE MARKING (FAST FOR PHONES) ---
  function renderStudentGrid() {
    const grid = document.getElementById('studentsAttendanceGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const activePeriod = getActivePeriod();
    if (!activePeriod) return;

    if (!activePeriod.attendance) activePeriod.attendance = {};
    const day = getDayData(currentDate);
    const wholeDayAbsentees = day.wholeDayAbsentRolls || [];

    // Filter students
    let filtered = students.filter(st => {
      // 1. Batch filter: If lecture is batch-specific, hide students not in that batch
      if (!isStudentInBatch(st.roll, activePeriod.batch)) {
        return false;
      }

      // 2. Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchRoll = String(st.roll).includes(query);
        const matchName = st.name.toLowerCase().includes(query);
        if (!matchRoll && !matchName) return false;
      }

      // 3. Toolbar filter chips
      const status = activePeriod.attendance[st.roll] || 'P';
      if (activeFilter === 'batch1') return st.roll <= BATCH_1_MAX;
      if (activeFilter === 'batch2') return st.roll > BATCH_1_MAX;
      if (activeFilter === 'absent') return status === 'A';
      if (activeFilter === 'present') return status === 'P';

      return true;
    });

    const filterInfo = document.getElementById('filteredCountInfo');
    const totalBatchCount = activePeriod.batch === 'all' ? TOTAL_STUDENTS : BATCH_1_MAX;
    if (filterInfo) {
      filterInfo.textContent = `Showing ${filtered.length} of ${totalBatchCount}`;
    }

    filtered.forEach(st => {
      const status = activePeriod.attendance[st.roll] || 'P';
      const isWDA = wholeDayAbsentees.includes(st.roll);
      const isB1 = st.roll <= BATCH_1_MAX;

      const card = document.createElement('div');
      card.className = `student-card ${status === 'P' ? 'present' : 'absent'} ${isWDA ? 'whole-day-absent' : ''}`;
      card.dataset.roll = st.roll;

      card.innerHTML = `
        <div class="card-meta">
          <span class="roll-num">#${st.roll}</span>
          <span class="batch-tag">${isB1 ? 'B1' : 'B2'}</span>
        </div>
        <div class="st-name" title="${escapeHtml(st.name)}">${escapeHtml(st.name)}</div>
        <div class="card-foot">
          ${isWDA ? '<span class="wda-badge-mini" title="Whole Day Absent">WDA</span>' : ''}
          <span class="status-badge">${status === 'P' ? 'P' : 'A'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        toggleStudent(st.roll);
      });

      grid.appendChild(card);
    });

    updateMetrics();
  }

  function toggleStudent(roll) {
    const activePeriod = getActivePeriod();
    if (!activePeriod) return;

    const currentStatus = activePeriod.attendance[roll] || 'P';
    const newStatus = currentStatus === 'P' ? 'A' : 'P';
    activePeriod.attendance[roll] = newStatus;

    saveAttendance();
    renderStudentGrid();
    renderPeriodChips();
  }

  function updateMetrics() {
    const activePeriod = getActivePeriod();
    if (!activePeriod) return;

    let present = 0;
    let absent = 0;
    let totalInBatch = 0;

    students.forEach(st => {
      if (isStudentInBatch(st.roll, activePeriod.batch)) {
        totalInBatch++;
        const status = activePeriod.attendance[st.roll] || 'P';
        if (status === 'P') present++;
        else absent++;
      }
    });

    const pct = totalInBatch > 0 ? Math.round((present / totalInBatch) * 100) : 0;

    document.getElementById('totalCountDisplay').textContent = String(totalInBatch);
    document.getElementById('presentCountDisplay').textContent = String(present);
    document.getElementById('absentCountDisplay').textContent = String(absent);
    document.getElementById('percentageDisplay').textContent = `${pct}%`;
  }

  function markAll(status) {
    const activePeriod = getActivePeriod();
    if (!activePeriod) return;

    students.forEach(st => {
      if (isStudentInBatch(st.roll, activePeriod.batch)) {
        activePeriod.attendance[st.roll] = status;
      }
    });

    saveAttendance();
    renderStudentGrid();
    renderPeriodChips();
    showToast(status === 'P' ? 'Marked All Present' : 'Marked All Absent');
  }

  // --- QUICK ABSENTEE ROLLS (THIS CLASS ONLY) ---
  window.openQuickAbsentModal = function () {
    const activePeriod = getActivePeriod();
    if (!activePeriod) {
      showToast('Select a class first!', 'danger');
      return;
    }

    const currentAbs = [];
    students.forEach(st => {
      if (isStudentInBatch(st.roll, activePeriod.batch)) {
        if (activePeriod.attendance[st.roll] === 'A') {
          currentAbs.push(st.roll);
        }
      }
    });

    document.getElementById('absentRollsInput').value = currentAbs.join(', ');
    document.getElementById('quickAbsentModal').classList.add('active');
  };

  window.closeQuickAbsentModal = function () {
    document.getElementById('quickAbsentModal').classList.remove('active');
  };

  window.applyQuickAbsentees = function () {
    const activePeriod = getActivePeriod();
    if (!activePeriod) return;

    const raw = document.getElementById('absentRollsInput').value;
    const matches = raw.match(/\d+/g) || [];
    const rollSet = new Set(matches.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= TOTAL_STUDENTS));

    students.forEach(st => {
      if (isStudentInBatch(st.roll, activePeriod.batch)) {
        if (rollSet.has(st.roll)) {
          activePeriod.attendance[st.roll] = 'A';
        } else {
          activePeriod.attendance[st.roll] = 'P';
        }
      }
    });

    saveAttendance();
    closeQuickAbsentModal();
    renderStudentGrid();
    renderPeriodChips();
    showToast(`Marked ${rollSet.size} absent in ${activePeriod.name}!`, 'success');
  };

  // --- DAILY BOOK REPORT (WHOLE DAY ABSENT + CLASS WISE + MATRIX) ---
  function renderMasterReport() {
    renderWholeDayAbsentBar();
    renderClassByClassAbsentSummary();
    renderRegisterMatrix();
  }

  function renderClassByClassAbsentSummary() {
    const container = document.getElementById('absenteeSummaryContainer');
    const chipBar = document.getElementById('reportLectureBar');
    if (!container) return;

    container.innerHTML = '';
    if (chipBar) chipBar.innerHTML = '';

    const day = getDayData(currentDate);
    const periods = day.periods;

    if (periods.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; padding: 1.25rem; text-align: center; color: var(--text-muted);">
          No classes marked for ${formatDisplayDate(currentDate)}. Add classes to see report.
        </div>
      `;
      return;
    }

    periods.forEach(p => {
      const attendance = p.attendance || {};
      const absRolls = [];
      let presentCount = 0;
      let totalEnrolled = 0;

      students.forEach(st => {
        if (isStudentInBatch(st.roll, p.batch)) {
          totalEnrolled++;
          const status = attendance[st.roll] || 'P';
          if (status === 'A') absRolls.push(st.roll);
          else presentCount++;
        }
      });

      // Chip
      if (chipBar) {
        const chip = document.createElement('div');
        chip.className = 'lecture-sum-chip';
        chip.innerHTML = `<strong>${p.periodNum}: ${p.name}</strong> • ${presentCount}/${totalEnrolled}P`;
        chipBar.appendChild(chip);
      }

      // Card
      const card = document.createElement('div');
      card.className = 'absent-class-item';

      const batchLabel = p.batch === 'batch1' ? ' (Batch 1: 1-27)' :
                         p.batch === 'batch2' ? ' (Batch 2: 28-54)' : '';

      const rollsText = absRolls.length > 0
        ? absRolls.sort((a, b) => a - b).join(', ')
        : 'All Present (No Absentees)';

      card.innerHTML = `
        <div class="aci-head">
          <span class="aci-title">📖 ${escapeHtml(p.periodNum)}: ${escapeHtml(p.name)}${batchLabel}</span>
          <span class="aci-stats">${absRolls.length} Absent / ${presentCount} Present</span>
        </div>
        <div class="aci-rolls">
          ${absRolls.length > 0 ? `Absent Rolls: <strong>${rollsText}</strong>` : `<span style="color: var(--present-color); font-family: var(--font-sans);">✓ 100% Present</span>`}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function renderRegisterMatrix() {
    const headRow = document.getElementById('matrixTableHead');
    const tbody = document.getElementById('matrixTableBody');
    if (!headRow || !tbody) return;

    const day = getDayData(currentDate);
    const periods = day.periods;

    // Header
    headRow.innerHTML = `
      <th class="sticky-roll">Roll</th>
      <th class="sticky-name">Student Name</th>
    `;

    periods.forEach(p => {
      const th = document.createElement('th');
      const bTag = p.batch === 'batch1' ? '<br><small>(B1)</small>' :
                   p.batch === 'batch2' ? '<br><small>(B2)</small>' : '';
      th.innerHTML = `${escapeHtml(p.periodNum)}${bTag}`;
      headRow.appendChild(th);
    });

    const thP = document.createElement('th');
    thP.textContent = 'P Count';
    const thA = document.createElement('th');
    thA.textContent = 'A Count';
    headRow.appendChild(thP);
    headRow.appendChild(thA);

    // Body
    tbody.innerHTML = '';

    students.forEach(st => {
      const tr = document.createElement('tr');
      let pCount = 0;
      let aCount = 0;
      let periodCells = '';

      periods.forEach(p => {
        if (!isStudentInBatch(st.roll, p.batch)) {
          periodCells += `<td><span class="symbol-na">-</span></td>`;
        } else {
          const status = (p.attendance && p.attendance[st.roll]) || 'P';
          if (status === 'P') {
            pCount++;
            periodCells += `<td><span class="symbol-p">P</span></td>`;
          } else {
            aCount++;
            periodCells += `<td><span class="symbol-a">A</span></td>`;
          }
        }
      });

      tr.innerHTML = `
        <td class="sticky-roll">#${st.roll}</td>
        <td class="sticky-name">${escapeHtml(st.name)}</td>
        ${periodCells}
        <td><strong style="color: var(--present-color);">${pCount}</strong></td>
        <td><strong style="color: var(--absent-color);">${aCount}</strong></td>
      `;

      tbody.appendChild(tr);
    });
  }

  // --- REPORT EXPORTS & DOWNLOADS ---
  function generateReportText() {
    const day = getDayData(currentDate);
    const periods = day.periods;
    const wdaRolls = day.wholeDayAbsentRolls || [];

    let text = `=========================================\n`;
    text += `B-DIV 5TH SEMESTER ATTENDANCE REGISTER\n`;
    text += `Date: ${formatDisplayDate(currentDate)}\n`;
    text += `Total Strength: 54 Students\n`;
    text += `Batch 1: Roll 1 to 27 | Batch 2: Roll 28 to 54\n`;
    text += `=========================================\n\n`;

    text += `[1] WHOLE DAY ABSENTEES (Absent All Day):\n`;
    if (wdaRolls.length > 0) {
      text += `Rolls: ${wdaRolls.sort((a, b) => a - b).join(', ')} (Total: ${wdaRolls.length})\n\n`;
    } else {
      text += `None. All students attended at least one lecture.\n\n`;
    }

    text += `[2] CLASS-BY-CLASS SUMMARY:\n`;
    if (periods.length === 0) {
      text += `No lectures conducted.\n\n`;
    } else {
      periods.forEach((p, idx) => {
        const attendance = p.attendance || {};
        const abs = [];
        let pTotal = 0;
        let enrolled = 0;

        students.forEach(st => {
          if (isStudentInBatch(st.roll, p.batch)) {
            enrolled++;
            const s = attendance[st.roll] || 'P';
            if (s === 'A') abs.push(st.roll);
            else pTotal++;
          }
        });

        const batchStr = p.batch === 'batch1' ? ' [Batch 1 (1-27)]' :
                         p.batch === 'batch2' ? ' [Batch 2 (28-54)]' : ' [Full Class]';

        text += `${idx + 1}. ${p.periodNum}: ${p.name}${batchStr}\n`;
        if (p.faculty) text += `   Faculty: ${p.faculty}\n`;
        text += `   Present: ${pTotal} / ${enrolled}\n`;
        text += `   Absent: ${abs.length}\n`;
        text += `   Absent Rolls: ${abs.length > 0 ? abs.sort((a, b) => a - b).join(', ') : 'Nil (All Present)'}\n\n`;
      });
    }

    text += `Report compiled by Class Representative (CR)\n`;
    return text;
  }

  function downloadTextReport() {
    const text = generateReportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BDiv_Attendance_Report_${currentDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 Text report downloaded!', 'success');
  }

  function copyWhatsAppReport() {
    const text = generateReportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('💬 WhatsApp report copied to clipboard!', 'success');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('💬 WhatsApp report copied!', 'success');
    } catch (e) {
      showToast('Could not copy automatically.', 'danger');
    }
    document.body.removeChild(ta);
  }

  function exportCSV() {
    const day = getDayData(currentDate);
    const periods = day.periods;

    let csv = 'Roll Number,Student Name,Batch,';
    periods.forEach(p => {
      csv += `"${p.periodNum} - ${p.name}",`;
    });
    csv += 'Total Present,Total Absent\r\n';

    students.forEach(st => {
      const isB1 = st.roll <= BATCH_1_MAX;
      let row = `${st.roll},"${st.name}",${isB1 ? 'Batch 1' : 'Batch 2'},`;
      let pCount = 0;
      let aCount = 0;

      periods.forEach(p => {
        if (!isStudentInBatch(st.roll, p.batch)) {
          row += 'N/A,';
        } else {
          const s = (p.attendance && p.attendance[st.roll]) || 'P';
          row += `${s},`;
          if (s === 'P') pCount++;
          else aCount++;
        }
      });

      row += `${pCount},${aCount}\r\n`;
      csv += row;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BDiv_Attendance_${currentDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 CSV file downloaded!', 'success');
  }

  function exportBackupJson() {
    const bundle = {
      app: 'BDiv5_Attendance',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      students: students,
      attendanceRecords: attendanceRecords
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BDiv_Backup_${currentDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup downloaded!', 'success');
  }

  function importBackupJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const bundle = JSON.parse(e.target.result);
        if (bundle.attendanceRecords) {
          Object.assign(attendanceRecords, bundle.attendanceRecords);
          saveAttendance();
          if (bundle.students && Array.isArray(bundle.students) && bundle.students.length === TOTAL_STUDENTS) {
            students = bundle.students;
            saveRoster();
          }
          renderWholeDayAbsentBar();
          renderPeriodChips();
          renderStudentGrid();
          renderMasterReport();
          showToast('✅ Backup imported and merged!', 'success');
        } else {
          showToast('Invalid backup file format.', 'danger');
        }
      } catch (err) {
        showToast('Error parsing file.', 'danger');
      }
    };
    reader.readAsText(file);
  }

  // --- DYNAMIC SYNC: METHOD 1 (1-TAP WHATSAPP SYNC LINK) ---
  window.shareLiveSyncLink = function () {
    // Pack today's data into a compressed base64 URL hash
    const dayData = getDayData(currentDate);
    const syncPayload = {
      date: currentDate,
      fromRole: activeCrRole,
      dayData: dayData,
      ts: Date.now()
    };

    try {
      const jsonStr = JSON.stringify(syncPayload);
      const b64 = btoa(encodeURIComponent(jsonStr));
      const syncUrl = `${window.location.origin}${window.location.pathname}#sync=${b64}`;

      const shareMsg = `📲 *B-Div 5th Sem Attendance Live Sync*\nDate: ${formatDisplayDate(currentDate)}\nSent by: ${activeCrRole === 'boy' ? 'Boy CR' : 'Girl CR'}\n\n👉 Open this link on your phone to instantly sync all classes & attendance:\n${syncUrl}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(syncUrl).then(() => {
          showToast('🔗 Live Sync Link copied to clipboard!', 'success');
        });
      }

      // Try opening WhatsApp Web / App directly
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`;
      window.open(waUrl, '_blank');
    } catch (e) {
      showToast('Could not generate sync link.', 'danger');
    }
  };

  function checkForUrlSyncData() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#sync=')) {
      const b64 = hash.replace('#sync=', '');
      try {
        const jsonStr = decodeURIComponent(atob(b64));
        const syncPayload = JSON.parse(jsonStr);

        if (syncPayload && syncPayload.date && syncPayload.dayData) {
          const syncDate = syncPayload.date;
          // Merge periods
          if (!attendanceRecords[syncDate]) {
            attendanceRecords[syncDate] = syncPayload.dayData;
          } else {
            // Merge whole day absentees
            const existingWda = new Set(attendanceRecords[syncDate].wholeDayAbsentRolls || []);
            (syncPayload.dayData.wholeDayAbsentRolls || []).forEach(r => existingWda.add(r));
            attendanceRecords[syncDate].wholeDayAbsentRolls = Array.from(existingWda);

            // Merge periods by ID or periodNum
            const existingPeriods = attendanceRecords[syncDate].periods || [];
            (syncPayload.dayData.periods || []).forEach(incomingP => {
              const matchIdx = existingPeriods.findIndex(ep => ep.id === incomingP.id || (ep.periodNum === incomingP.periodNum && ep.name === incomingP.name));
              if (matchIdx >= 0) {
                // Merge attendance
                existingPeriods[matchIdx] = incomingP;
              } else {
                existingPeriods.push(incomingP);
              }
            });
            attendanceRecords[syncDate].periods = existingPeriods;
          }

          saveAttendance();
          currentDate = syncDate;
          // Clean hash from URL bar
          history.replaceState(null, null, ' ');
          setTimeout(() => {
            showToast(`✅ Synced ${syncPayload.fromRole === 'boy' ? 'Boy CR' : 'Girl CR'} live data!`, 'success');
          }, 500);
        }
      } catch (e) {
        console.error('Error parsing sync URL hash', e);
      }
    }
  }

  // --- DYNAMIC SYNC: METHOD 2 (FREE P2P WEBRTC ROOM VIA PEERJS) ---
  function initPeerSync() {
    const roomInput = document.getElementById('customRoomInput');
    const savedRoom = localStorage.getItem(STORAGE_KEYS.ROOM_ID) || 'bdiv-sem5-cr';
    if (roomInput) roomInput.value = savedRoom;
  }

  window.connectLiveRoom = function () {
    const roomInput = document.getElementById('customRoomInput');
    const logEl = document.getElementById('p2pStatusLog');
    const indicator = document.getElementById('syncIndicator');
    const syncText = document.getElementById('syncText');
    const roomId = (roomInput.value || 'bdiv-sem5-cr').trim().toLowerCase();

    localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);

    if (typeof Peer === 'undefined') {
      logEl.textContent = 'Status: WebRTC Peer library unavailable offline.';
      return;
    }

    if (peerInstance) {
      peerInstance.destroy();
    }

    // Role-based peer IDs so Boy CR & Girl CR pair together
    const myPeerId = `${roomId}-${activeCrRole}`;
    const targetPeerId = `${roomId}-${activeCrRole === 'boy' ? 'girl' : 'boy'}`;

    logEl.textContent = `Connecting as ${myPeerId}...`;

    try {
      peerInstance = new Peer(myPeerId);

      peerInstance.on('open', (id) => {
        logEl.textContent = `Online: ${id}. Waiting for Co-CR (${targetPeerId})...`;
        indicator.className = 'sync-indicator online';
        syncText.textContent = 'Room Ready';

        // Try connecting to the other CR
        connectToTargetPeer(targetPeerId);
      });

      peerInstance.on('connection', (conn) => {
        setupPeerConnection(conn);
      });

      peerInstance.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // Fallback random ID
          const altId = `${myPeerId}-${Math.floor(Math.random() * 1000)}`;
          peerInstance = new Peer(altId);
          logEl.textContent = `Joined room as ${altId}.`;
        } else {
          logEl.textContent = `Info: ${err.type}`;
        }
      });
    } catch (e) {
      logEl.textContent = 'Could not initialize Peer sync.';
    }
  };

  function connectToTargetPeer(targetId) {
    if (!peerInstance) return;
    try {
      const conn = peerInstance.connect(targetId);
      setupPeerConnection(conn);
    } catch (e) {
      console.log('Target peer not yet online');
    }
  }

  function setupPeerConnection(conn) {
    peerConn = conn;

    conn.on('open', () => {
      isPeerConnected = true;
      document.getElementById('syncIndicator').className = 'sync-indicator online';
      document.getElementById('syncText').textContent = 'CRs Connected';
      document.getElementById('p2pStatusLog').textContent = `✓ Linked with Co-CR (${conn.peer})! Live Sync active.`;
      showToast('✓ Live Connected with Co-CR!', 'success');

      // Send my latest state
      broadcastLiveSync();
    });

    conn.on('data', (data) => {
      handleIncomingPeerData(data);
    });

    conn.on('close', () => {
      isPeerConnected = false;
      document.getElementById('syncIndicator').className = 'sync-indicator offline';
      document.getElementById('syncText').textContent = 'CR Sync';
      document.getElementById('p2pStatusLog').textContent = 'Co-CR disconnected.';
    });
  }

  function broadcastLiveSync() {
    if (isPeerConnected && peerConn && peerConn.open) {
      peerConn.send({
        type: 'ATTENDANCE_UPDATE',
        date: currentDate,
        records: attendanceRecords[currentDate]
      });
    }
  }

  function handleIncomingPeerData(data) {
    if (data && data.type === 'ATTENDANCE_UPDATE' && data.date) {
      if (!attendanceRecords[data.date]) {
        attendanceRecords[data.date] = data.records;
      } else {
        // Merge
        Object.assign(attendanceRecords[data.date], data.records);
      }
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceRecords));
      renderWholeDayAbsentBar();
      renderPeriodChips();
      renderStudentGrid();
      renderMasterReport();
      showToast('⚡ Dynamic attendance update received from Co-CR!', 'success');
    }
  }

  // --- EDIT STUDENTS MODAL ---
  window.openEditStudentsModal = function () {
    const container = document.getElementById('editStudentsFormContainer');
    if (!container) return;
    container.innerHTML = '';

    students.forEach(st => {
      const row = document.createElement('div');
      row.className = 'st-edit-row';
      const isB1 = st.roll <= BATCH_1_MAX;
      row.innerHTML = `
        <span class="st-edit-roll">#${st.roll}</span>
        <input type="text" class="form-input" id="editName_${st.roll}" value="${escapeHtml(st.name)}" placeholder="Name for #${st.roll}">
        <span class="badge ${isB1 ? 'badge-accent' : 'badge-neutral'}">${isB1 ? 'B1' : 'B2'}</span>
      `;
      container.appendChild(row);
    });

    document.getElementById('editStudentsModal').classList.add('active');
  };

  window.closeEditStudentsModal = function () {
    document.getElementById('editStudentsModal').classList.remove('active');
  };

  window.saveCustomStudents = function () {
    students.forEach(st => {
      const nameInput = document.getElementById(`editName_${st.roll}`);
      if (nameInput) st.name = nameInput.value.trim() || `Student ${st.roll}`;
    });

    saveRoster();
    closeEditStudentsModal();
    renderStudentGrid();
    renderMasterReport();
    showToast('Student names saved!', 'success');
  };

  window.openSingleStudentEdit = function (roll) {
    const student = students.find(s => s.roll === roll);
    if (!student) return;
    const newName = prompt(`Enter Name for Roll #${roll}:`, student.name);
    if (newName !== null) {
      student.name = newName.trim() || `Student ${roll}`;
      saveRoster();
      renderStudentGrid();
      renderMasterReport();
      showToast(`Updated Roll #${roll}`, 'success');
    }
  };

  // --- STORAGE STATS & RESET ---
  function updateStorageMetrics() {
    const el = document.getElementById('storageUsageDisplay');
    if (el) {
      const raw = JSON.stringify(attendanceRecords);
      const kb = (raw.length / 1024).toFixed(1);
      const daysCount = Object.keys(attendanceRecords).length;
      el.textContent = `${kb} KB used • ${daysCount} days preserved`;
    }
  }

  function clearTodayData() {
    if (confirm(`Clear all attendance for today (${formatDisplayDate(currentDate)})?`)) {
      delete attendanceRecords[currentDate];
      saveAttendance();
      currentPeriodId = null;
      renderWholeDayAbsentBar();
      renderPeriodChips();
      renderStudentGrid();
      renderMasterReport();
      showToast("Today's data cleared.", 'success');
    }
  }

  function resetAllData() {
    if (confirm('Clear all stored weekly attendance?')) {
      attendanceRecords = {};
      saveAttendance();
      currentPeriodId = null;
      renderWholeDayAbsentBar();
      renderPeriodChips();
      renderStudentGrid();
      renderMasterReport();
      showToast('All weekly attendance reset.', 'success');
    }
  }

  function saveNewPin() {
    const input = document.getElementById('newPinInput');
    const val = input.value.trim();
    if (!/^\d{4}$/.test(val)) {
      showToast('PIN must be 4 digits!', 'danger');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.PIN, val);
    input.value = '';
    showToast('New PIN saved successfully!', 'success');
  }

  // --- TOASTS ---
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('lockAppBtn').addEventListener('click', lockApp);

    document.getElementById('addPeriodBtn').addEventListener('click', openAddLectureModal);
    document.getElementById('addFirstPeriodBtn').addEventListener('click', openAddLectureModal);
    document.getElementById('todayBtn').addEventListener('click', () => selectDate(getTodayDateString()));

    document.getElementById('markAllPresentBtn').addEventListener('click', () => markAll('P'));
    document.getElementById('markAllAbsentBtn').addEventListener('click', () => markAll('A'));
    document.getElementById('quickAbsentModalBtn').addEventListener('click', openQuickAbsentModal);

    // Search
    const searchInput = document.getElementById('studentSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      clearBtn.classList.toggle('hidden', searchQuery.length === 0);
      renderStudentGrid();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.add('hidden');
      renderStudentGrid();
    });

    // Filter Chips
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.dataset.filter;
        renderStudentGrid();
      });
    });

    // Report Actions
    document.getElementById('copyWhatsAppBtn').addEventListener('click', copyWhatsAppReport);
    document.getElementById('downloadTextReportBtn').addEventListener('click', downloadTextReport);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    document.getElementById('printReportBtn').addEventListener('click', () => window.print());

    // Student Roster
    document.getElementById('quickEditStudentsBtn').addEventListener('click', openEditStudentsModal);

    // Settings
    document.getElementById('savePinBtn').addEventListener('click', saveNewPin);
    document.getElementById('clearTodayDataBtn').addEventListener('click', clearTodayData);
    document.getElementById('resetAllDataBtn').addEventListener('click', resetAllData);
    document.getElementById('exportDataBtn').addEventListener('click', exportBackupJson);

    const importInput = document.getElementById('importFileInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) importBackupJson(e.target.files[0]);
      });
    }

    // Restore CR Role
    const savedRole = localStorage.getItem(STORAGE_KEYS.CR_ROLE) || 'boy';
    window.setCrRole(savedRole);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
