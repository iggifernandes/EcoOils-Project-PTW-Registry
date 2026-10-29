const VERSION = '1.5'; // Code.gs version – bump on every change
/**
 * EcoOils Mentari – PTW Registry · Google Apps Script backend  (v1.0)
 *
 * Paper PTW stays the legal document. This registry only RECORDS it.
 *  - Contractors (via their PTW Receiver) can SUBMIT only – they cannot read anything back.
 *  - Submissions are immutable. Mistakes go through a Correction Request that only Admin can approve.
 *  - Admin (you) sees everything. "Entry" code = assistant team: submit for any contractor, no read access.
 *
 * SETUP: see README.md  (run setup() once, then Deploy > Web app > Execute as: Me, Access: Anyone)
 */
const TZ = 'Asia/Jakarta';
const CONTRACTORS = ['GSB', 'WEN', 'KKS', 'PBS'];
const RAM = ['Low-Low', 'Low', 'Medium', 'High'];
const SEGMENTS = ['Day', 'Extended', 'Night'];
const OUTCOMES = ['Completed', 'Suspended'];
const MAX_ROWS_PER_BATCH = 300;

const WORK_TYPES = [
  ['cold', 'Cold Work', 'Pekerjaan Dingin'],
  ['hot', 'Hot Work*', 'Kerja Panas*'],
  ['lifting', 'Lifting*', 'Pengangkatan*'],
  ['isolation', 'Isolation*', 'Isolasi*'],
  ['electrical', 'Electrical*', 'Kelistrikan*'],
  ['sce', 'Safety Critical Equipment (SCE)', 'Peralatan Kritis Keselamatan (SCE)'],
  ['wah', 'Working at Height (WAH)*', 'Kerja di Ketinggian (WAH)*'],
  ['cse', 'Confined Space*', 'Ruang Terbatas*'],
  ['excavation', 'Excavation', 'Galian'],
  ['hv', 'High Voltage (≥11kV)', 'Tegangan Tinggi (≥11kV)'],
  ['other', 'Other', 'Lainnya']
];
const DOCS = [
  ['sop', 'Work Instruction / SOP', 'Instruksi Kerja / SOP'],
  ['wms', 'Work Method Statement', 'Pernyataan Metode Kerja'],
  ['jha', 'Job Hazard Analysis (JHA)', 'Analisis Bahaya Pekerjaan (JHA)'],
  ['isolation', 'Isolation Plan', 'Rencana Isolasi'],
  ['lifting', 'Lifting Plan', 'Rencana Pengangkatan'],
  ['hotwork', 'Hot Work checklist', 'Daftar Periksa Kerja Panas'],
  ['cse', 'Confined Space checklist', 'Daftar Periksa Ruang Terbatas'],
  ['electrical', 'Electrical checklist', 'Daftar Periksa Kelistrikan'],
  ['hv', 'High Voltage checklist', 'Daftar Periksa Tegangan Tinggi'],
  ['wah', 'Working at Height checklist', 'Daftar Periksa Kerja di Ketinggian'],
  ['excavation', 'Excavation checklist', 'Daftar Periksa Galian'],
  ['other', 'Other document', 'Dokumen lainnya']
];
// work type  ->  supporting document that the procedure says must be attached
const DOC_REQUIRED = { hot: 'hotwork', lifting: 'lifting', isolation: 'isolation', electrical: 'electrical', wah: 'wah', cse: 'cse', excavation: 'excavation', hv: 'hv' };

// Starter dropdown values. Admin edits them in the web app (Settings & log). Anything typed outside the list is also accepted.
const DEFAULT_LISTS = {
  dept: ['HSSE', 'Construction', 'Piping', 'Mechanical', 'Electrical', 'Instrumentation & Control', 'Civil & Structural', 'Scaffolding', 'Welding / Fabrication', 'Painting & Insulation', 'Commissioning', 'QA/QC', 'Logistics & Warehouse', 'Security', 'HR & Admin', 'Operations', 'Maintenance', 'Project Management'],
  location: ['Tank Farm', 'Laboratory', 'Admin Building', 'Warehouse', 'Security Building', 'Extraction Plant', 'FFA Plant', 'SBE', 'DTP', 'DTP Furnace', 'WTP', 'WWTP', 'EPP Pit & Pond', 'Plenum Chamber', 'EM Bunker', 'Fire Pump House', 'Emergency Shower / FFE area', 'Plant Parameter Area', 'Switch Room / Substation', 'Workshop', 'Laydown Area', 'Site-wide']
};
const LIST_KEYS = ['dept', 'location'];
const MANDATORY_DOCS = ['jha', 'wms'];   // must be ticked on every PTW

const FLAGS = {
  VALID_GT7: ['Validity longer than 7 days – new PTW required', 'Masa berlaku lebih dari 7 hari – wajib PTW baru', 'high'],
  DOC_MISSING: ['Supporting document not ticked: {x}', 'Dokumen pendukung belum dicentang: {x}', 'warn'],
  SELF_ISSUE: ['Job Coordinator is also Area Owner / Authoriser', 'Job Coordinator juga sebagai Area Owner / Authoriser', 'high'],
  RAM_HIGH: ['High-risk permit (RAM High)', 'Izin berisiko tinggi (RAM High)', 'info'],
  DAY1_GT8: ['Day 1 shift longer than 8 hrs', 'Shift hari 1 lebih dari 8 jam', 'warn'],
  DAY1_EXT_GT4: ['Day 1 extension longer than 4 hrs', 'Perpanjangan hari 1 lebih dari 4 jam', 'high'],
  DAY1_EXT_NOAPPROVER: ['Day 1 extension has no Area Owner approval', 'Perpanjangan hari 1 tanpa persetujuan Area Owner', 'high'],
  DUP_OTHER_CONTRACTOR: ['Same PTW number also used by another contractor', 'Nomor PTW sama dipakai kontraktor lain', 'warn'],
  DAY_DATE_MISMATCH: ['Date does not match the day number', 'Tanggal tidak sesuai nomor hari', 'warn'],
  OUT_OF_VALIDITY: ['Date is outside PTW validity', 'Tanggal di luar masa berlaku PTW', 'high'],
  SEG_GT8: ['Day shift longer than 8 hrs', 'Shift siang lebih dari 8 jam', 'warn'],
  EXT_GT4: ['Extension longer than 4 hrs', 'Perpanjangan lebih dari 4 jam', 'high'],
  MISSING_SIGN: ['One or more signatories missing', 'Satu atau lebih penandatangan kosong', 'high'],
  AFTER_CLOSE: ['Revalidation dated after closure', 'Revalidasi bertanggal setelah penutupan', 'high'],
  OUTSIDE_SHIFT: ['Outside the configured day-shift window', 'Di luar jendela jam shift yang ditetapkan', 'warn'],
  CLOSE_BEFORE_START: ['Closure dated before PTW start', 'Penutupan bertanggal sebelum PTW mulai', 'high'],
  CLOSED_LATE: ['Closed after validity end', 'Ditutup setelah masa berlaku berakhir', 'warn'],
  REVAL_GAP: ['Revalidation missing for a previous day', 'Revalidasi hari sebelumnya belum ada', 'high'],
  EXPIRED_OPEN: ['Validity ended – permit not closed', 'Masa berlaku habis – izin belum ditutup', 'high'],
  NO_REVAL_TODAY: ['No revalidation recorded for today', 'Belum ada revalidasi hari ini', 'warn'],
  SIMOPS: ['Possible overlap with another live PTW at the same location', 'Kemungkinan tumpang tindih dengan PTW lain di lokasi sama', 'warn']
};

// ---------------------------------------------------------------- column definitions
function ptwCols_() {
  const c = [
    { k: 'ptwNo', en: 'PTW No', id: 'No. PTW', t: 'text', r: 1 },
    { k: 'contractor', en: 'Applicant company', id: 'Perusahaan pemohon', t: 'list', r: 1 },
    { k: 'applicant', en: 'Applicant name', id: 'Nama pemohon', t: 'text', r: 1 },
    { k: 'dept', en: 'Department', id: 'Departemen', t: 'combo', list: 'dept', r: 0 },
    { k: 'location', en: 'Location', id: 'Lokasi', t: 'combo', list: 'location', r: 1 },
    { k: 'issueDate', en: 'Date (Day 1)', id: 'Tanggal (Hari 1)', t: 'date', r: 0, auto: 1 },
    { k: 'rfmWo', en: 'RFM / WO', id: 'RFM / WO', t: 'text', r: 0 },
    { k: 'ram', en: 'RAM classification', id: 'Klasifikasi RAM', t: 'list', r: 1 },
    { k: 'workDesc', en: 'Work description', id: 'Deskripsi pekerjaan', t: 'text', r: 1 }
  ];
  WORK_TYPES.forEach(w => c.push({ k: 'wt_' + w[0], en: w[1], id: w[2], t: 'bool', r: 0, g: 'wt' }));
  c.push({ k: 'wtOtherText', en: 'Other work type – describe', id: 'Jenis lain – jelaskan', t: 'text', r: 0 });
  DOCS.forEach(d => c.push({ k: 'doc_' + d[0], en: d[1], id: d[2], t: 'bool', r: 0, g: 'doc', lock: MANDATORY_DOCS.indexOf(d[0]) >= 0 ? 1 : 0 }));
  c.push(
    { k: 'validFrom', en: 'PTW valid from', id: 'PTW berlaku dari', t: 'date', r: 1 },
    { k: 'validTo', en: 'PTW valid to', id: 'PTW berlaku sampai', t: 'date', r: 0, auto: 1 },
    { k: 'day1Start', en: 'Day 1 start time', id: 'Jam mulai hari 1', t: 'time', r: 0 },
    { k: 'day1End', en: 'Day 1 end time', id: 'Jam selesai hari 1', t: 'time', r: 0 },
    { k: 'day1ExtEnd', en: 'Day 1 extension until', id: 'Perpanjangan hari 1 sampai', t: 'time', r: 0 },
    { k: 'day1ExtApprover', en: 'Day 1 extension approved by (Area Owner)', id: 'Perpanjangan disetujui oleh (Area Owner)', t: 'text', r: 0 },
    { k: 'jcName', en: 'Job Coordinator (Permit Holder)', id: 'Job Coordinator (Pemegang Izin)', t: 'text', r: 1 },
    { k: 'aoName', en: 'Area Owner (Permit Issuer)', id: 'Area Owner (Penerbit Izin)', t: 'text', r: 1 },
    { k: 'paName', en: 'Permit Authoriser', id: 'Permit Authoriser', t: 'text', r: 1 },
    { k: 'workParty', en: 'Work party (no. of people)', id: 'Jumlah pekerja', t: 'num', r: 0 }
  );
  return c;
}
function revalCols_() {
  return [
    { k: 'ptwNo', en: 'PTW No', id: 'No. PTW', t: 'text', r: 1 },
    { k: 'contractor', en: 'Applicant company', id: 'Perusahaan pemohon', t: 'list', r: 1 },
    { k: 'day', en: 'Day (2-7)', id: 'Hari (2-7)', t: 'day', r: 1 },
    { k: 'segment', en: 'Segment', id: 'Segmen', t: 'list', r: 1 },
    { k: 'date', en: 'Date', id: 'Tanggal', t: 'date', r: 1 },
    { k: 'timeFrom', en: 'From (hh:mm)', id: 'Dari (jj:mm)', t: 'time', r: 0 },
    { k: 'timeTo', en: 'To (hh:mm)', id: 'Sampai (jj:mm)', t: 'time', r: 0 },
    { k: 'jc', en: 'Job Coordinator', id: 'Job Coordinator', t: 'text', r: 0 },
    { k: 'pa', en: 'PTW Authoriser', id: 'PTW Authoriser', t: 'text', r: 0 },
    { k: 'ao', en: 'Area Owner', id: 'Area Owner', t: 'text', r: 0 },
    { k: 'hsse', en: 'EO HSSE Representative', id: 'Perwakilan HSSE EO', t: 'text', r: 0 }
  ];
}
function closeCols_() {
  return [
    { k: 'ptwNo', en: 'PTW No', id: 'No. PTW', t: 'text', r: 1 },
    { k: 'contractor', en: 'Applicant company', id: 'Perusahaan pemohon', t: 'list', r: 1 },
    { k: 'closeDate', en: 'Closure date', id: 'Tanggal penutupan', t: 'date', r: 1 },
    { k: 'closeTime', en: 'Closure time', id: 'Jam penutupan', t: 'time', r: 0 },
    { k: 'closeOutcome', en: 'Outcome', id: 'Hasil', t: 'list', r: 1 },
    { k: 'closeJc', en: 'Job Coordinator (closed)', id: 'Job Coordinator (menutup)', t: 'text', r: 1 },
    { k: 'closeAo', en: 'Area Owner (closed)', id: 'Area Owner (menutup)', t: 'text', r: 1 }
  ];
}
const PTW_HEAD = () => ['submissionId', 'submittedAt', 'submittedBy', 'isTest'].concat(ptwCols_().map(c => c.k),
  ['flags', 'closeDate', 'closeTime', 'closeOutcome', 'closeJc', 'closeAo', 'closeSubmittedAt', 'closeFlags', 'voided']);
const REVAL_HEAD = () => ['submissionId', 'submittedAt', 'submittedBy', 'isTest'].concat(revalCols_().map(c => c.k), ['flags', 'voided']);
const CORR_HEAD = ['id', 'requestedAt', 'requestedBy', 'contractor', 'recordType', 'ptwNo', 'day', 'segment', 'field', 'oldValue', 'newValue', 'reason', 'status', 'resolvedAt', 'resolvedNote'];
const LOG_HEAD = ['time', 'role', 'contractor', 'action', 'detail'];
const SET_HEAD = ['key', 'value'];
const CLOSE_FIELDS = ['closeDate', 'closeTime', 'closeOutcome', 'closeJc', 'closeAo'];
const SETTING_KEYS = ['testMode', 'dayStart', 'dayEnd', 'nightStart', 'nightEnd'];

// ---------------------------------------------------------------- tiny helpers
const str_ = v => (v === null || v === undefined) ? '' : String(v).trim();
const nm_ = v => str_(v).toLowerCase().replace(/\s+/g, ' ');
const nowStr_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
const rid_ = p => p + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.random().toString(36).slice(2, 5).toUpperCase();
const key_ = (c, n) => c + '|' + n;
function isDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function isTime_(s) { const m = /^(\d{2}):(\d{2})$/.exec(s); return !!m && +m[1] < 24 && +m[2] < 60; }
const dayMs_ = s => new Date(s + 'T00:00:00Z').getTime();
const dayDiff_ = (a, b) => Math.round((dayMs_(b) - dayMs_(a)) / 86400000);
const addDays_ = (s, n) => new Date(dayMs_(s) + n * 86400000).toISOString().slice(0, 10);
const toMin_ = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const span_ = (a, b) => { const d = toMin_(b) - toMin_(a); return d >= 0 ? d : d + 1440; };

/** Day 1 extension must end no more than 4 hours after the Day 1 end time. Returns [en, id] or null. */
function day1ExtError_(r) {
  if (!isTime_(r.day1ExtEnd)) return null;
  if (!isTime_(r.day1End)) return ['Enter the Day 1 end time before a Day 1 extension', 'Isi jam selesai hari 1 sebelum perpanjangan hari 1'];
  if (span_(r.day1End, r.day1ExtEnd) > 240) return ['Day 1 extension cannot be more than 4 hours after the Day 1 end time', 'Perpanjangan hari 1 tidak boleh lebih dari 4 jam setelah jam selesai hari 1'];
  return null;
}const uniq_ = a => a.filter((x, i) => a.indexOf(x) === i);

function listOptions_(k) {
  if (k === 'contractor') return CONTRACTORS;
  if (k === 'ram') return RAM;
  if (k === 'segment') return SEGMENTS;
  if (k === 'closeOutcome') return OUTCOMES;
  return null;
}
function normVal_(col, v) {
  if (col.t === 'bool') {
    const s = str_(v).toLowerCase();
    return ['y', 'yes', 'ya', '1', 'true', 'x', 'v', '✓'].indexOf(s) >= 0 ? 'Y' : '';
  }
  return str_(v);
}
/** returns [en,id] message or null */
function checkVal_(col, v) {
  if (v === '') return col.r ? ['Missing: ' + col.en, 'Wajib diisi: ' + col.id] : null;
  if (col.t === 'date' && !isDate_(v)) return [col.en + ': invalid date (use YYYY-MM-DD)', col.id + ': tanggal tidak valid (YYYY-MM-DD)'];
  if (col.t === 'time' && !isTime_(v)) return [col.en + ': invalid time (use HH:MM, 24h)', col.id + ': jam tidak valid (JJ:MM, 24 jam)'];
  if (col.t === 'num' && !/^\d{1,4}$/.test(v)) return [col.en + ': whole number only', col.id + ': harus bilangan bulat'];
  if (col.t === 'day' && !/^[2-7]$/.test(v)) {
    if (/^\d+$/.test(v) && +v >= 8) return ['Day ' + v + ' is not allowed – after 7 days a NEW PTW is required', 'Hari ' + v + ' tidak diizinkan – setelah 7 hari wajib PTW baru'];
    return [col.en + ': must be 2 to 7 (Day 1 is the original PTW)', col.id + ': harus 2 sampai 7 (Hari 1 adalah PTW asli)'];
  }
  const opts = listOptions_(col.k);
  if (col.t === 'list' && opts && opts.indexOf(v) < 0) return [col.en + ': must be one of ' + opts.join(', '), col.id + ': harus salah satu dari ' + opts.join(', ')];
  return null;
}

// ---------------------------------------------------------------- flags (row-level, pure)
function ptwFlags_(r, st, otherContractors) {
  const f = [];
  if (isDate_(r.validFrom) && isDate_(r.validTo) && dayDiff_(r.validFrom, r.validTo) + 1 > 7) f.push('VALID_GT7');
  Object.keys(DOC_REQUIRED).forEach(w => { if (r['wt_' + w] === 'Y' && r['doc_' + DOC_REQUIRED[w]] !== 'Y') f.push('DOC_MISSING:' + DOC_REQUIRED[w]); });
  if (nm_(r.jcName) && (nm_(r.jcName) === nm_(r.aoName) || nm_(r.jcName) === nm_(r.paName))) f.push('SELF_ISSUE');
  if (r.ram === 'High') f.push('RAM_HIGH');
  if (isTime_(r.day1Start) && isTime_(r.day1End) && span_(r.day1Start, r.day1End) > 480) f.push('DAY1_GT8');
  if (isTime_(r.day1ExtEnd)) {
    if (isTime_(r.day1End) && span_(r.day1End, r.day1ExtEnd) > 240) f.push('DAY1_EXT_GT4');
    if (!str_(r.day1ExtApprover)) f.push('DAY1_EXT_NOAPPROVER');
  }
  if (otherContractors && otherContractors.length) f.push('DUP_OTHER_CONTRACTOR');
  return uniq_(f);
}
function revalFlags_(r, ptw, st) {
  const f = [];
  if (ptw) {
    if (isDate_(ptw.issueDate) && isDate_(r.date) && /^[2-7]$/.test(str_(r.day)) && addDays_(ptw.issueDate, +r.day - 1) !== r.date) f.push('DAY_DATE_MISMATCH');
    if (isDate_(r.date) && isDate_(ptw.validFrom) && isDate_(ptw.validTo) && (r.date < ptw.validFrom || r.date > ptw.validTo)) f.push('OUT_OF_VALIDITY');
    if (ptw.closeDate && isDate_(r.date) && r.date > ptw.closeDate) f.push('AFTER_CLOSE');
  }
  if (isTime_(r.timeFrom) && isTime_(r.timeTo)) {
    const s = span_(r.timeFrom, r.timeTo);
    if (r.segment === 'Day' && s > 480) f.push('SEG_GT8');
    if (r.segment === 'Extended' && s > 240) f.push('EXT_GT4');
    if (r.segment === 'Day' && st && isTime_(st.dayStart || '') && isTime_(st.dayEnd || '') && toMin_(st.dayStart) < toMin_(st.dayEnd)) {
      if (toMin_(r.timeFrom) < toMin_(st.dayStart) || toMin_(r.timeTo) > toMin_(st.dayEnd) || toMin_(r.timeTo) < toMin_(r.timeFrom)) f.push('OUTSIDE_SHIFT');
    }
  }
  if (!str_(r.jc) || !str_(r.pa) || !str_(r.ao) || !str_(r.hsse)) f.push('MISSING_SIGN');
  if (nm_(r.jc) && nm_(r.jc) === nm_(r.ao)) f.push('SELF_ISSUE');
  return uniq_(f);
}
function closeFlags_(c, ptw) {
  const f = [];
  if (ptw && isDate_(c.closeDate)) {
    if (isDate_(ptw.validFrom) && c.closeDate < ptw.validFrom) f.push('CLOSE_BEFORE_START');
    if (isDate_(ptw.validTo) && c.closeDate > ptw.validTo) f.push('CLOSED_LATE');
  }
  if (nm_(c.closeJc) && nm_(c.closeJc) === nm_(c.closeAo)) f.push('SELF_ISSUE');
  return uniq_(f);
}

// ---------------------------------------------------------------- sheet layer
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" missing – run setup() first');
  return s;
}
function readAll_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last < 1) return { sh, headers: [], rows: [] };
  const vals = sh.getRange(1, 1, last, cols).getValues();
  const headers = vals[0].map(String);
  const rows = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i].every(v => v === '' || v === null)) continue;
    const o = { _row: i + 1 };
    headers.forEach((h, j) => { o[h] = (vals[i][j] === null || vals[i][j] === undefined) ? '' : String(vals[i][j]); });
    rows.push(o);
  }
  return { sh, headers, rows };
}
function appendObjs_(name, headers, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  const start = sh.getLastRow() + 1;
  const rng = sh.getRange(start, 1, objs.length, headers.length);
  rng.setNumberFormat('@');
  rng.setValues(objs.map(o => headers.map(h => (o[h] === undefined || o[h] === null) ? '' : String(o[h]))));
}
function setCell_(name, row, headers, field, value) {
  const c = headers.indexOf(field) + 1;
  if (c < 1) throw new Error('Unknown column ' + field);
  const rg = sheet_(name).getRange(row, c);
  rg.setNumberFormat('@');
  rg.setValue(String(value));
}
function ensureLists_() {
  let sh = ss_().getSheetByName('Lists');
  if (!sh) {
    sh = ss_().insertSheet('Lists');
    const n = Math.max(DEFAULT_LISTS.dept.length, DEFAULT_LISTS.location.length);
    sh.getRange(1, 1, 1, 2).setValues([LIST_KEYS]).setFontWeight('bold').setBackground('#e8f3e2');
    const rows = []; for (let i = 0; i < n; i++) rows.push([DEFAULT_LISTS.dept[i] || '', DEFAULT_LISTS.location[i] || '']);
    const rg = sh.getRange(2, 1, n, 2); rg.setNumberFormat('@'); rg.setValues(rows);
  }
  return sh;
}
function getLists_() {
  const sh = ensureLists_(); const last = sh.getLastRow();
  const out = { dept: [], location: [] };
  if (last < 2) return out;
  const vals = sh.getRange(2, 1, last - 1, 2).getValues();
  LIST_KEYS.forEach((k, j) => { const seen = {}; vals.forEach(r => { const v = str_(r[j]); if (v && !seen[nm_(v)]) { seen[nm_(v)] = 1; out[k].push(v); } }); });
  return out;
}
function saveLists_(inp) {
  const sh = ensureLists_(); const clean = {};
  LIST_KEYS.forEach(k => {
    const arr = (inp && Array.isArray(inp[k])) ? inp[k] : getLists_()[k]; const seen = {}; clean[k] = [];
    arr.forEach(v => { v = str_(v).slice(0, 80); if (v && !seen[nm_(v)]) { seen[nm_(v)] = 1; clean[k].push(v); } });
    if (clean[k].length > 300) throw new Error('Max 300 entries per list');
  });
  const n = Math.max(clean.dept.length, clean.location.length, sh.getLastRow() - 1, 1);
  const rows = []; for (let i = 0; i < n; i++) rows.push([clean.dept[i] || '', clean.location[i] || '']);
  const rg = sh.getRange(2, 1, n, 2); rg.setNumberFormat('@'); rg.setValues(rows);
  return clean;
}
function getSettings_() {
  const out = { testMode: '', dayStart: '', dayEnd: '', nightStart: '', nightEnd: '' };
  const sh = ss_().getSheetByName('Settings');
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { if (SETTING_KEYS.indexOf(String(r[0])) >= 0) out[r[0]] = str_(r[1]); });
  return out;
}
function saveSettings_(inp) {
  const sh = sheet_('Settings');
  const cur = getSettings_();
  const next = {};
  SETTING_KEYS.forEach(k => {
    let v = (inp && inp[k] !== undefined) ? str_(inp[k]) : cur[k];
    if (k === 'testMode') v = (v === 'Y' || v === 'true' || v === true) ? 'Y' : '';
    else if (v && !isTime_(v)) throw new Error('Invalid time for ' + k);
    next[k] = v;
  });
  const rows = SETTING_KEYS.map(k => [k, next[k]]);
  const rg = sh.getRange(2, 1, rows.length, 2);
  rg.setNumberFormat('@');
  rg.setValues(rows);
  return next;
}
function log_(auth, action, detail) {
  try { appendObjs_('Log', LOG_HEAD, [{ time: nowStr_(), role: auth ? auth.role : '', contractor: auth ? (auth.contractor || '') : '', action: action, detail: detail || '' }]); } catch (e) { /* never block on logging */ }
}

// ---------------------------------------------------------------- auth
function authenticate_(code) {
  code = str_(code);
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fails') || 0);
  if (fails >= 30) throw new Error('LOCKED');
  const p = PropertiesService.getScriptProperties();
  let hit = null;
  if (code) {
    if (code === p.getProperty('CODE_ADMIN')) hit = { role: 'admin', contractor: '' };
    else if (code === p.getProperty('CODE_ENTRY')) hit = { role: 'entry', contractor: '' };
    else CONTRACTORS.forEach(c => { if (code === p.getProperty('CODE_' + c)) hit = { role: 'contractor', contractor: c }; });
  }
  if (!hit) { cache.put('fails', String(fails + 1), 600); return null; }
  return hit;
}

// ---------------------------------------------------------------- batch processing (submit)
function er_(sheet, row, en, id) { return { sheet: sheet, row: row, en: en, id: id }; }

function resolveContractor_(auth, raw, sheetName, row, errors) {
  const given = str_(raw.contractor).toUpperCase();
  if (auth.role === 'contractor') {
    if (given && given !== auth.contractor) { errors.push(er_(sheetName, row, 'This file/row belongs to ' + given + ' but you are logged in as ' + auth.contractor, 'File/baris ini milik ' + given + ' tetapi Anda masuk sebagai ' + auth.contractor)); return ''; }
    return auth.contractor;
  }
  if (CONTRACTORS.indexOf(given) < 0) { errors.push(er_(sheetName, row, 'Applicant company must be one of ' + CONTRACTORS.join(', '), 'Perusahaan pemohon harus salah satu dari ' + CONTRACTORS.join(', '))); return ''; }
  return given;
}

function processBatch_(auth, batch, dryRun) {
  const lock = LockService.getScriptLock();
  if (!dryRun) lock.waitLock(25000);
  try {
    batch = batch || {};
    const nPtw = (batch.ptw || []).length, nRev = (batch.reval || []).length, nClose = (batch.close || []).length;
    if (nPtw + nRev + nClose === 0) return { ok: false, errors: [er_('', 0, 'Nothing to submit', 'Tidak ada data untuk dikirim')] };
    if (nPtw > MAX_ROWS_PER_BATCH || nRev > MAX_ROWS_PER_BATCH || nClose > MAX_ROWS_PER_BATCH) return { ok: false, errors: [er_('', 0, 'Too many rows (max ' + MAX_ROWS_PER_BATCH + ' per sheet)', 'Terlalu banyak baris (maks ' + MAX_ROWS_PER_BATCH + ' per lembar)')] };

    const st = getSettings_();
    const test = st.testMode === 'Y' ? 'Y' : '';
    const ptwAll = readAll_('PTW').rows.filter(r => r.voided !== 'Y');
    const revAll = readAll_('Revalidation').rows.filter(r => r.voided !== 'Y');
    const ptwMap = {}, byNo = {}, revSet = {};
    ptwAll.forEach(r => { ptwMap[key_(r.contractor, r.ptwNo)] = r; (byNo[r.ptwNo] = byNo[r.ptwNo] || []).push(r.contractor); });
    revAll.forEach(r => { revSet[key_(r.contractor, r.ptwNo) + '|' + r.day + '|' + r.segment] = 1; });

    const errors = [], preview = [], newPtw = [], newRev = [], closeUpd = [];
    const stamp = nowStr_();
    const pc = ptwCols_(), rc = revalCols_(), cc = closeCols_();

    // ---- PTW rows
    (batch.ptw || []).forEach((raw, i) => {
      const row = raw._row || (i + 1), before = errors.length;
      const o = {};
      pc.forEach(c => { o[c.k] = normVal_(c, raw[c.k]); });
      o.ptwNo = o.ptwNo.toUpperCase();
      if (!o.issueDate && isDate_(o.validFrom)) o.issueDate = o.validFrom;                    // Day 1 = valid-from
      if (!o.validTo && isDate_(o.validFrom)) o.validTo = addDays_(o.validFrom, 6);            // 7 calendar days = Day 1 + 6
      o.contractor = resolveContractor_(auth, raw, 'PTW', row, errors);
      pc.forEach(c => { if (c.k === 'contractor') return; const m = checkVal_(c, o[c.k]); if (m) errors.push(er_('PTW', row, m[0], m[1])); });
      if (isDate_(o.validFrom) && isDate_(o.validTo) && o.validTo < o.validFrom) errors.push(er_('PTW', row, 'Valid-to is before valid-from', 'Berlaku-sampai sebelum berlaku-dari'));
      { const xe = day1ExtError_(o); if (xe) errors.push(er_('PTW', row, xe[0], xe[1])); }
      if (o.doc_jha !== 'Y' || o.doc_wms !== 'Y') errors.push(er_('PTW', row, 'JHA and Work Method Statement are mandatory – both must be ticked on every PTW', 'JHA dan Pernyataan Metode Kerja wajib – keduanya harus dicentang pada setiap PTW'));
      if (!WORK_TYPES.some(w => o['wt_' + w[0]] === 'Y')) errors.push(er_('PTW', row, 'Tick at least one type of work', 'Centang minimal satu jenis pekerjaan'));
      if (o.wt_other === 'Y' && !o.wtOtherText) errors.push(er_('PTW', row, '"Other" work type needs a description', 'Jenis pekerjaan "Lainnya" perlu dijelaskan'));
      if (o.ptwNo && o.contractor && ptwMap[key_(o.contractor, o.ptwNo)]) errors.push(er_('PTW', row, 'PTW ' + o.ptwNo + ' is already registered for ' + o.contractor + '. To change it use "Request correction".', 'PTW ' + o.ptwNo + ' sudah terdaftar untuk ' + o.contractor + '. Untuk mengubah gunakan "Ajukan koreksi".'));
      if (errors.length === before) {
        const others = (byNo[o.ptwNo] || []).filter(c => c !== o.contractor);
        o.flags = ptwFlags_(o, st, others).join(';');
        o.submissionId = rid_('P'); o.submittedAt = stamp; o.submittedBy = auth.role; o.isTest = test; o.voided = '';
        newPtw.push(o); ptwMap[key_(o.contractor, o.ptwNo)] = o; (byNo[o.ptwNo] = byNo[o.ptwNo] || []).push(o.contractor);
        preview.push({ sheet: 'PTW', row: row, ref: o.contractor + ' ' + o.ptwNo, flags: o.flags ? o.flags.split(';') : [] });
      }
    });

    // ---- Revalidation rows
    (batch.reval || []).forEach((raw, i) => {
      const row = raw._row || (i + 1), before = errors.length;
      const o = {};
      rc.forEach(c => { o[c.k] = normVal_(c, raw[c.k]); });
      o.ptwNo = o.ptwNo.toUpperCase();
      if (/^\d+\.0+$/.test(o.day)) o.day = o.day.replace(/\.0+$/, '');
      if (o.segment) o.segment = o.segment.charAt(0).toUpperCase() + o.segment.slice(1).toLowerCase();
      o.contractor = resolveContractor_(auth, raw, 'Revalidation', row, errors);
      rc.forEach(c => { if (c.k === 'contractor') return; const m = checkVal_(c, o[c.k]); if (m) errors.push(er_('Revalidation', row, m[0], m[1])); });
      if ((o.segment === 'Day' || o.segment === 'Extended') && (!o.timeFrom || !o.timeTo)) errors.push(er_('Revalidation', row, o.segment + ' segment needs From and To times', 'Segmen ' + o.segment + ' memerlukan jam Dari dan Sampai'));
      const ptw = (o.contractor && o.ptwNo) ? ptwMap[key_(o.contractor, o.ptwNo)] : null;
      if (o.contractor && o.ptwNo && !ptw) errors.push(er_('Revalidation', row, 'PTW ' + o.ptwNo + ' (Day 1) is not registered yet – submit the original PTW first', 'PTW ' + o.ptwNo + ' (Hari 1) belum terdaftar – kirim PTW asli terlebih dahulu'));
      const rk = key_(o.contractor, o.ptwNo) + '|' + o.day + '|' + o.segment;
      if (o.contractor && o.ptwNo && o.day && o.segment && revSet[rk]) errors.push(er_('Revalidation', row, 'Day ' + o.day + ' ' + o.segment + ' for PTW ' + o.ptwNo + ' is already recorded. Use "Request correction" to change it.', 'Hari ' + o.day + ' ' + o.segment + ' untuk PTW ' + o.ptwNo + ' sudah tercatat. Gunakan "Ajukan koreksi" untuk mengubah.'));
      if (errors.length === before) {
        o.flags = revalFlags_(o, ptw, st).join(';');
        o.submissionId = rid_('R'); o.submittedAt = stamp; o.submittedBy = auth.role; o.isTest = test; o.voided = '';
        newRev.push(o); revSet[rk] = 1;
        preview.push({ sheet: 'Revalidation', row: row, ref: o.contractor + ' ' + o.ptwNo + ' D' + o.day + ' ' + o.segment, flags: o.flags ? o.flags.split(';') : [] });
      }
    });

    // ---- Closure rows
    (batch.close || []).forEach((raw, i) => {
      const row = raw._row || (i + 1), before = errors.length;
      const o = {};
      cc.forEach(c => { o[c.k] = normVal_(c, raw[c.k]); });
      o.ptwNo = o.ptwNo.toUpperCase();
      if (o.closeOutcome) o.closeOutcome = o.closeOutcome.charAt(0).toUpperCase() + o.closeOutcome.slice(1).toLowerCase();
      o.contractor = resolveContractor_(auth, raw, 'Closure', row, errors);
      cc.forEach(c => { if (c.k === 'contractor') return; const m = checkVal_(c, o[c.k]); if (m) errors.push(er_('Closure', row, m[0], m[1])); });
      const ptw = (o.contractor && o.ptwNo) ? ptwMap[key_(o.contractor, o.ptwNo)] : null;
      if (o.contractor && o.ptwNo && !ptw) errors.push(er_('Closure', row, 'PTW ' + o.ptwNo + ' is not registered yet', 'PTW ' + o.ptwNo + ' belum terdaftar'));
      else if (ptw && ptw.closeDate) errors.push(er_('Closure', row, 'PTW ' + o.ptwNo + ' is already closed. Use "Request correction" to change it.', 'PTW ' + o.ptwNo + ' sudah ditutup. Gunakan "Ajukan koreksi" untuk mengubah.'));
      if (errors.length === before) {
        const fl = closeFlags_(o, ptw).join(';');
        const vals = { closeDate: o.closeDate, closeTime: o.closeTime, closeOutcome: o.closeOutcome, closeJc: o.closeJc, closeAo: o.closeAo, closeSubmittedAt: stamp, closeFlags: fl };
        Object.keys(vals).forEach(k => { ptw[k] = vals[k]; });   // in-batch objects get written on append; sheet rows are collected below
        if (ptw._row) closeUpd.push({ row: ptw._row, vals: vals });
        preview.push({ sheet: 'Closure', row: row, ref: o.contractor + ' ' + o.ptwNo, flags: fl ? fl.split(';') : [] });
      }
    });

    if (errors.length) return { ok: false, errors: errors };
    const counts = { ptw: newPtw.length, reval: newRev.length, close: (batch.close || []).length };
    if (dryRun) return { ok: true, dryRun: true, counts: counts, preview: preview };

    appendObjs_('PTW', PTW_HEAD(), newPtw);
    appendObjs_('Revalidation', REVAL_HEAD(), newRev);
    if (closeUpd.length) {
      const head = PTW_HEAD();
      const c0 = head.indexOf('closeDate') + 1, n = 7; // closeDate..closeFlags are contiguous
      const sh = sheet_('PTW');
      closeUpd.forEach(u => {
        const rg = sh.getRange(u.row, c0, 1, n);
        rg.setNumberFormat('@');
        rg.setValues([['closeDate', 'closeTime', 'closeOutcome', 'closeJc', 'closeAo', 'closeSubmittedAt', 'closeFlags'].map(k => u.vals[k])]);
      });
    }
    const receipt = 'RCPT-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    log_(auth, 'submit', receipt + ' ptw=' + counts.ptw + ' reval=' + counts.reval + ' close=' + counts.close + (test ? ' [TEST]' : ''));
    return { ok: true, receipt: receipt, at: stamp, counts: counts, preview: preview, testMode: !!test };
  } finally {
    if (!dryRun) lock.releaseLock();
  }
}

// ---------------------------------------------------------------- corrections & admin edits
function colsFor_(type) { return type === 'PTW' ? ptwCols_() : type === 'REVAL' ? revalCols_() : closeCols_(); }
function editable_(type) {
  if (type === 'PTW') return ptwCols_().map(c => c.k).filter(k => k !== 'contractor');
  if (type === 'REVAL') return revalCols_().map(c => c.k).filter(k => k !== 'contractor' && k !== 'ptwNo');
  return CLOSE_FIELDS;
}
function findRecord_(type, contractor, ptwNo, day, segment) {
  ptwNo = str_(ptwNo).toUpperCase();
  const ptwD = readAll_('PTW');
  const ptw = ptwD.rows.filter(r => r.voided !== 'Y' && r.contractor === contractor && r.ptwNo === ptwNo)[0];
  if (!ptw) return null;
  if (type === 'PTW') return { sheetName: 'PTW', headers: ptwD.headers, rec: ptw, ptw: ptw };
  if (type === 'CLOSE') return ptw.closeDate ? { sheetName: 'PTW', headers: ptwD.headers, rec: ptw, ptw: ptw } : null;
  const rD = readAll_('Revalidation');
  const rec = rD.rows.filter(r => r.voided !== 'Y' && r.contractor === contractor && r.ptwNo === ptwNo && r.day === str_(day) && r.segment === str_(segment))[0];
  return rec ? { sheetName: 'Revalidation', headers: rD.headers, rec: rec, ptw: ptw } : null;
}
function validateEdit_(type, field, value) {
  if (editable_(type).indexOf(field) < 0) return ['Field "' + field + '" cannot be corrected', 'Kolom "' + field + '" tidak dapat dikoreksi'];
  const col = colsFor_(type).filter(c => c.k === field)[0];
  if (type === 'PTW' && MANDATORY_DOCS.some(d => 'doc_' + d === field) && normVal_(col, value) !== 'Y') return ['JHA and Work Method Statement must stay ticked', 'JHA dan Pernyataan Metode Kerja harus tetap dicentang'];
  return checkVal_(col, normVal_(col, value));   // optional fields may be cleared; required fields may not
}
function applyEdit_(auth, type, contractor, ptwNo, day, segment, field, newValue) {
  const err = validateEdit_(type, field, newValue);
  if (err) throw new Error(err[0]);
  const f = findRecord_(type, contractor, ptwNo, day, segment);
  if (!f) throw new Error('Record not found (or already voided)');
  const col = colsFor_(type).filter(c => c.k === field)[0];
  const v = normVal_(col, newValue);
  const nv = field === 'ptwNo' ? v.toUpperCase() : v;
  const old = f.rec[field];
  if (type === 'PTW' && (field === 'day1ExtEnd' || field === 'day1End')) {
    const xe = day1ExtError_(Object.assign({}, f.rec, { [field]: nv }));
    if (xe) throw new Error(xe[0]);
  }
  const st = getSettings_();
  if (type === 'PTW' && field === 'ptwNo') {
    const dup = readAll_('PTW').rows.filter(r => r.voided !== 'Y' && r.contractor === contractor && r.ptwNo === nv)[0];
    if (dup) throw new Error('PTW ' + nv + ' already exists for ' + contractor);
    const rD = readAll_('Revalidation');
    rD.rows.filter(r => r.contractor === contractor && r.ptwNo === f.rec.ptwNo).forEach(r => setCell_('Revalidation', r._row, rD.headers, 'ptwNo', nv));
  }
  setCell_(f.sheetName, f.rec._row, f.headers, field, nv);
  // recompute row flags from the fresh state
  const upd = {}; Object.keys(f.rec).forEach(k => { upd[k] = f.rec[k]; }); upd[field] = nv;
  if (type === 'PTW') {
    const others = readAll_('PTW').rows.filter(r => r.voided !== 'Y' && r.ptwNo === upd.ptwNo && r.contractor !== contractor).map(r => r.contractor);
    setCell_('PTW', f.rec._row, f.headers, 'flags', ptwFlags_(upd, st, others).join(';'));
  } else if (type === 'REVAL') {
    setCell_('Revalidation', f.rec._row, f.headers, 'flags', revalFlags_(upd, f.ptw, st).join(';'));
  } else {
    setCell_('PTW', f.rec._row, f.headers, 'closeFlags', closeFlags_(upd, f.ptw).join(';'));
  }
  return { old: old, now: nv };
}

function requestCorrection_(auth, p) {
  const type = str_(p.recordType).toUpperCase();
  if (['PTW', 'REVAL', 'CLOSE'].indexOf(type) < 0) throw new Error('Choose what you want to correct');
  const contractor = auth.role === 'contractor' ? auth.contractor : str_(p.contractor).toUpperCase();
  if (CONTRACTORS.indexOf(contractor) < 0) throw new Error('Contractor missing');
  if (str_(p.reason).length < 5) throw new Error('Please give a reason (at least 5 characters)');
  const f = findRecord_(type, contractor, p.ptwNo, p.day, p.segment);
  if (!f) throw new Error('No matching record found for ' + contractor + ' ' + str_(p.ptwNo).toUpperCase() + (type === 'REVAL' ? ' Day ' + p.day + ' ' + p.segment : '') + (type === 'CLOSE' ? ' (closure)' : ''));
  const err = validateEdit_(type, str_(p.field), p.newValue);
  if (err) throw new Error(err[0]);
  const col = colsFor_(type).filter(c => c.k === str_(p.field))[0];
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const id = rid_('C');
    appendObjs_('Corrections', CORR_HEAD, [{ id: id, requestedAt: nowStr_(), requestedBy: auth.role, contractor: contractor, recordType: type, ptwNo: str_(p.ptwNo).toUpperCase(), day: str_(p.day), segment: str_(p.segment), field: str_(p.field), oldValue: f.rec[p.field], newValue: normVal_(col, p.newValue), reason: str_(p.reason), status: 'Pending', resolvedAt: '', resolvedNote: '' }]);
    log_(auth, 'correction-request', id + ' ' + contractor + ' ' + str_(p.ptwNo));
    return { id: id };
  } finally { lock.releaseLock(); }
}

function resolveCorrection_(auth, p) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const d = readAll_('Corrections');
    const c = d.rows.filter(r => r.id === p.id)[0];
    if (!c) throw new Error('Correction not found');
    if (c.status !== 'Pending') throw new Error('Already ' + c.status);
    let note = str_(p.note);
    if (p.decision === 'approve') {
      const r = applyEdit_(auth, c.recordType, c.contractor, c.ptwNo, c.day, c.segment, c.field, c.newValue);
      c.status = 'Approved'; note = note || ('Changed "' + r.old + '" to "' + r.now + '"');
      log_(auth, 'correction-approved', c.id + ' ' + c.field + ': ' + r.old + ' -> ' + r.now);
    } else { c.status = 'Rejected'; log_(auth, 'correction-rejected', c.id); }
    setCell_('Corrections', c._row, d.headers, 'status', c.status);
    setCell_('Corrections', c._row, d.headers, 'resolvedAt', nowStr_());
    setCell_('Corrections', c._row, d.headers, 'resolvedNote', note);
    return { status: c.status };
  } finally { lock.releaseLock(); }
}

function voidRecord_(auth, p) {
  if (str_(p.reason).length < 5) throw new Error('Reason required (min 5 characters)');
  const type = str_(p.recordType).toUpperCase();
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const f = findRecord_(type === 'REVAL' ? 'REVAL' : 'PTW', str_(p.contractor).toUpperCase(), p.ptwNo, p.day, p.segment);
    if (!f) throw new Error('Record not found');
    setCell_(f.sheetName, f.rec._row, f.headers, 'voided', 'Y');
    log_(auth, 'void', type + ' ' + p.contractor + ' ' + str_(p.ptwNo).toUpperCase() + (type === 'REVAL' ? ' D' + p.day + ' ' + p.segment : '') + ' – ' + str_(p.reason));
    return { voided: true };
  } finally { lock.releaseLock(); }
}

function purgeTest_(auth, p) {
  if (p.confirm !== 'PURGE') throw new Error('Type PURGE to confirm');
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    let n = 0;
    ['PTW', 'Revalidation'].forEach(name => {
      const d = readAll_(name);
      d.rows.filter(r => r.isTest === 'Y').map(r => r._row).sort((a, b) => b - a).forEach(rw => { d.sh.deleteRow(rw); n++; });
    });
    log_(auth, 'purge-test', n + ' rows removed');
    return { removed: n };
  } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- web app entry
function schema_() {
  const flags = {}; Object.keys(FLAGS).forEach(k => { flags[k] = { en: FLAGS[k][0], id: FLAGS[k][1], sev: FLAGS[k][2] }; });
  return {
    version: VERSION, contractors: CONTRACTORS, ram: RAM, segments: SEGMENTS, outcomes: OUTCOMES, workTypes: WORK_TYPES, docs: DOCS, docRequired: DOC_REQUIRED,
    ptw: ptwCols_(), reval: revalCols_(), close: closeCols_(), flags: flags,
    editable: { PTW: editable_('PTW'), REVAL: editable_('REVAL'), CLOSE: editable_('CLOSE') }, maxRows: MAX_ROWS_PER_BATCH
  };
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, app: 'EcoOils Mentari PTW Registry', version: VERSION }); }

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action === 'forgotCode') { forgotCode_(); return json_({ ok: true }); }
    const auth = authenticate_(p.code);
    if (!auth) return json_({ ok: false, error: 'BAD_CODE' });
    switch (p.action) {
      case 'login':
        return json_({ ok: true, role: auth.role, contractor: auth.contractor, schema: schema_(), lists: getLists_(), settings: { testMode: getSettings_().testMode === 'Y' } });
      case 'submit':
        return json_(processBatch_(auth, p.batch, !!p.dryRun));
      case 'requestCorrection':
        return json_({ ok: true, result: requestCorrection_(auth, p) });
    }
    if (auth.role !== 'admin') return json_({ ok: false, error: 'FORBIDDEN' });
    switch (p.action) {
      case 'list': {
        const log = readAll_('Log').rows.slice(-200).reverse();
        const clean = rows => rows.map(r => { const o = {}; Object.keys(r).forEach(k => { if (k !== '_row') o[k] = r[k]; }); return o; });
        return json_({ ok: true, ptw: clean(readAll_('PTW').rows), reval: clean(readAll_('Revalidation').rows), corrections: clean(readAll_('Corrections').rows).reverse(), log: clean(log), settings: getSettings_(), serverTime: nowStr_() });
      }
      case 'resolveCorrection': return json_({ ok: true, result: resolveCorrection_(auth, p) });
      case 'directEdit': {
        const type = str_(p.recordType).toUpperCase();
        if (str_(p.reason).length < 5) throw new Error('Reason required (min 5 characters)');
        const lock = LockService.getScriptLock(); lock.waitLock(25000);
        try {
          const r = applyEdit_(auth, type, str_(p.contractor).toUpperCase(), p.ptwNo, p.day, p.segment, str_(p.field), p.newValue);
          log_(auth, 'admin-edit', type + ' ' + p.contractor + ' ' + str_(p.ptwNo).toUpperCase() + ' ' + p.field + ': ' + r.old + ' -> ' + r.now + ' – ' + str_(p.reason));
          return json_({ ok: true, result: r });
        } finally { lock.releaseLock(); }
      }
      case 'void': return json_({ ok: true, result: voidRecord_(auth, p) });
      case 'saveSettings': { const s = saveSettings_(p.settings); log_(auth, 'settings', JSON.stringify(s)); return json_({ ok: true, settings: s }); }
      case 'saveLists': { const l = saveLists_(p.lists); log_(auth, 'lists', 'dept=' + l.dept.length + ' location=' + l.location.length); return json_({ ok: true, lists: l }); }
      case 'purgeTest': return json_({ ok: true, result: purgeTest_(auth, p) });
    }
    return json_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    const m = String(err && err.message || err);
    return json_({ ok: false, error: m === 'LOCKED' ? 'LOCKED' : 'SERVER', message: m });
  }
}

// ---------------------------------------------------------------- one-time setup (run from the editor)
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const defs = [['PTW', PTW_HEAD()], ['Revalidation', REVAL_HEAD()], ['Corrections', CORR_HEAD], ['Log', LOG_HEAD], ['Settings', SET_HEAD]];
  ensureLists_();
  defs.forEach(d => {
    let sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]).setFontWeight('bold').setBackground('#e8f3e2');
      sh.setFrozenRows(1);
      sh.getRange(1, 1, sh.getMaxRows(), d[1].length).setNumberFormat('@');   // text format: keeps 00001 and 2026-10-07 exactly as typed
    }
  });
  const def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  const s = ss.getSheetByName('Settings');
  if (s.getLastRow() < 2) { s.getRange(2, 1, SETTING_KEYS.length, 2).setNumberFormat('@').setValues(SETTING_KEYS.map(k => [k, k === 'testMode' ? 'Y' : ''])); }
  newCodes_(false);
  showCodes();
}
function newCodes_(force) {
  const p = PropertiesService.getScriptProperties();
  ['ADMIN', 'ENTRY'].concat(CONTRACTORS).forEach(r => {
    if (force || !p.getProperty('CODE_' + r)) p.setProperty('CODE_' + r, Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase());
  });
}
/** Emails the current access codes to the project owner (the account that owns this script). Codes are never written to the log. */
function emailCodes_(subject) {
  const p = PropertiesService.getScriptProperties();
  let to = p.getProperty('OWNER_EMAIL');
  if (!to) { to = Session.getEffectiveUser().getEmail(); if (to) p.setProperty('OWNER_EMAIL', to); }
  if (!to) throw new Error('No owner email available');
  const lines = ['ADMIN (you only): ' + p.getProperty('CODE_ADMIN'), 'ENTRY (assistants): ' + p.getProperty('CODE_ENTRY')]
    .concat(CONTRACTORS.map(c => c + ': ' + p.getProperty('CODE_' + c)));
  MailApp.sendEmail(to, subject, lines.join('\n') + '\n\nShare ONLY each contractor\'s own code with them. Do not forward the ADMIN code.');
  return to;
}
/** Run to email the current access codes to yourself. Share ONLY each contractor's own code with them. */
function showCodes() { Logger.log('Access codes emailed to ' + emailCodes_('PTW Registry – access codes')); }
/** Run if a code leaks – every code is replaced, the old ones stop working immediately, and the new list is emailed to you. */
function rotateAllCodes() { newCodes_(true); showCodes(); }
/** "Forgot access code?" on the login page: emails the current codes to the owner. Nothing is returned to the caller; max 5 per hour. */
function forgotCode_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('forgot') || 0);
  if (n >= 5) return;
  cache.put('forgot', String(n + 1), 3600);
  try { emailCodes_('PTW Registry – access codes (forgot code request)'); } catch (e) { /* stay silent to the caller */ }
}
