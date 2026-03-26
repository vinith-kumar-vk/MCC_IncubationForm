const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
// CloudPanel-compatible configuration - Reverting to 3103
const PORT = 3103; 

// Ensure directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');
/* Temporarily commented for debugging permissions
[uploadDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
*/

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// DB Setup
const db = new Database(path.join(__dirname, 'mcc_incubation.db'));
console.log('--- DB PATH INFO ---');
console.log('__dirname:', __dirname);
console.log('cwd:', process.cwd());
console.log('db path:', path.join(__dirname, 'mcc_incubation.db'));
console.log('--------------------');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_name TEXT NOT NULL,
    startup_name TEXT NOT NULL,
    address TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    professional_status TEXT,
    file_path TEXT,
    plan_to_grow TEXT,
    services_needed TEXT,
    financial_support TEXT,
    incubation_support TEXT,
    incubation_duration TEXT,
    association_type TEXT,
    incubation_help TEXT,
    status TEXT DEFAULT 'Pending',
    declaration_agreed INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS form_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step INTEGER NOT NULL DEFAULT 1,
    field_type TEXT NOT NULL,
    field_name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    placeholder TEXT,
    required INTEGER DEFAULT 1,
    options TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default site settings
const defaultSettings = [
  { key: 'site_title', value: 'MCC-MRF' },
  { key: 'site_subtitle', value: 'INNOVATION PARK' },
  { key: 'site_location', value: 'Madras Christian College' },
  { key: 'form_title', value: 'Application Form for Incubation @ MCCMRFIP' },
  { key: 'form_subtitle', value: 'Begin your entrepreneurship journey with us. Fill in your personal details below.' },
  { key: 'logo_path', value: '/images/logo.png' },
  { key: 'footer_text', value: '© 2026 Madras Christian College' }
];
const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed default form fields if table is empty
try {
  const row = db.prepare('SELECT COUNT(*) as c FROM form_fields').get();
  if (!row || row.c === 0) {
    console.log('--- SEEDING DEFAULT FORM FIELDS ---');
    const insertField = db.prepare(`INSERT OR IGNORE INTO form_fields (step, field_type, field_name, label, placeholder, required, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const defaultFields = [
      [1, 'text', 'applicant_name', 'Full Name of Applicant', 'John Doe', 1, null, 1],
      [1, 'email', 'email', 'Email Address', 'john@example.com', 1, null, 2],
      [1, 'tel', 'whatsapp', 'WhatsApp Number', '+91-0000000000', 1, null, 3],
      [1, 'textarea', 'address', 'Correspondence Address', 'Full postal address', 1, null, 4],
      [1, 'select', 'professional_status', 'Current Professional Status', 'Select your current status', 1, 'Student,Working professional,Entrepreneur,Faculty or Alumni of MCC', 5],
      [2, 'text', 'startup_name', 'Name of Startup / Idea', 'Name of your venture', 1, null, 1],
      [2, 'text', 'plan_to_grow', 'Future Growth Strategy', 'Your scale-up plan', 1, null, 2],
      [3, 'text', 'financial_support', 'Has your startup received any financial support?', '', 1, null, 1],
      [3, 'text', 'incubation_support', 'Has your startup received any incubation support earlier?', '', 1, null, 2],
      [3, 'text', 'incubation_duration', 'Expected Incubation Duration', '', 1, null, 3],
      [3, 'text', 'association_type', 'How would you like to associate with MCC MRF Innovation Park?', '', 1, null, 4],
      [3, 'textarea', 'incubation_help', 'Brief on how incubation would help you', '', 1, null, 5],
    ];
    defaultFields.forEach(f => insertField.run(...f));
    console.log('--- SEEDING COMPLETED ---');
  }
} catch (e) {
  console.error('Seeding error:', e);
}

// Seed default admin
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('mccmrfadmin');
if (!adminExists) {
  const hashed = bcrypt.hashSync('admin1234', 10);
  db.prepare('INSERT INTO admins (username, password, name) VALUES (?, ?, ?)').run('mccmrfadmin', hashed, 'MCC MRF Admin');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mcc-mrf-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.adminId) return next();
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Submit application form
app.post('/api/apply', upload.single('startup_file'), (req, res) => {
  try {
    const {
      applicant_name, startup_name, address, email, whatsapp,
      professional_status, plan_to_grow, financial_support,
      incubation_support, incubation_duration, association_type,
      incubation_help, declaration_agreed
    } = req.body;

    const services_needed = Array.isArray(req.body.services_needed)
      ? req.body.services_needed.join(', ')
      : (req.body.services_needed || '');

    const file_path = req.file ? '/uploads/' + req.file.filename : null;

    db.prepare(`
      INSERT INTO applications
      (applicant_name, startup_name, address, email, whatsapp, professional_status,
       plan_to_grow, services_needed, financial_support, incubation_support,
       incubation_duration, association_type, incubation_help, file_path, declaration_agreed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      applicant_name, startup_name, address, email, whatsapp, professional_status,
      plan_to_grow, services_needed, financial_support, incubation_support,
      incubation_duration, association_type, incubation_help, file_path,
      declaration_agreed ? 1 : 0
    );

    res.json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// Admin login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }
  req.session.adminId = admin.id;
  req.session.adminName = admin.name;
  req.session.adminUsername = admin.username;
  res.json({ success: true, name: admin.name, username: admin.username });
});

// Admin logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth status
app.get('/api/auth-check', (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({ authenticated: true, name: req.session.adminName, username: req.session.adminUsername });
  } else {
    res.json({ authenticated: false });
  }
});

// Dashboard stats
app.get('/api/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  const students = db.prepare("SELECT COUNT(*) as count FROM applications WHERE LOWER(professional_status) LIKE '%student%'").get().count;
  const staff = total - students;
  res.json({ total, students, staff, certs: 0 });
});

// Get all applications
app.get('/api/applications', requireAuth, (req, res) => {
  const { search, status, page = 1, limit = 10, startDate, endDate } = req.query;
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];
  
  if (search) {
    query += ' AND (applicant_name LIKE ? OR startup_name LIKE ? OR email LIKE ? OR professional_status LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (startDate) {
    query += ' AND date(submitted_at) >= date(?)';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date(submitted_at) <= date(?)';
    params.push(endDate);
  }

  // Count before limiting
  let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countParams = [...params];
  const totalCount = db.prepare(countQuery).get(...countParams).count;

  query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const apps = db.prepare(query).all(...params);

  res.json({ applications: apps, total: totalCount, page: parseInt(page), limit: parseInt(limit) });
});

// Get single application
app.get('/api/applications/:id', requireAuth, (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: 'Not found' });
  res.json(app);
});

// Update application status
app.patch('/api/applications/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Delete application
app.delete('/api/applications/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Reorder fields logic is consolidated below.

// ─── CMS: SITE SETTINGS ──────────────────────────────────────────────────────

// Add column_width if it doesn't exist (Simple Migration)
try {
  db.prepare('ALTER TABLE form_fields ADD COLUMN column_width INTEGER DEFAULT 12').run();
  console.log('Database migrated: added column_width');
} catch (e) { /* already exists */ }

// Get all settings (public — used by form page)
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// Update settings (admin only)
app.put('/api/settings', requireAuth, (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const updates = req.body; // { key: value, ... }
  for (const [k, v] of Object.entries(updates)) {
    update.run(k, v);
  }
  res.json({ success: true });
});

// Logo upload (admin only)
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'images')),
  filename: (req, file, cb) => cb(null, 'logo' + path.extname(file.originalname))
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/settings/logo', requireAuth, logoUpload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const logoPath = '/images/' + req.file.filename;
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('logo_path', logoPath);
  res.json({ success: true, logo_path: logoPath });
});

// ─── CMS: FORM FIELDS ────────────────────────────────────────────────────────

// Get all form fields (public — used by form page)
app.get('/api/form-fields', (req, res) => {
  const fields = db.prepare('SELECT * FROM form_fields WHERE is_active = 1 ORDER BY step ASC, sort_order ASC').all();
  res.json(fields);
});

// Get all form fields including inactive (admin only)
app.get('/api/admin/form-fields', (req, res) => {
  const fields = db.prepare('SELECT * FROM form_fields ORDER BY step ASC, sort_order ASC').all();
  res.json(fields);
});

// Create new field
app.post('/api/admin/form-fields', (req, res) => {
  const { step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width } = req.body;
  const stmt = db.prepare('INSERT INTO form_fields (step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width || 12);
  res.json({ success: true, id: result.lastInsertRowid });
});

// Update field
app.put('/api/admin/form-fields/:id', (req, res) => {
  const { step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width } = req.body;
  const stmt = db.prepare('UPDATE form_fields SET step = ?, field_type = ?, field_name = ?, label = ?, placeholder = ?, options = ?, sort_order = ?, required = ?, is_active = ?, column_width = ? WHERE id = ?');
  stmt.run(step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width || 12, req.params.id);
  res.json({ success: true });
});

// Delete field
app.delete('/api/admin/form-fields/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM form_fields WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Bulk Reorder Fields - Stable Consolidated Version (Applied and Persisted)
app.put('/api/admin/form-fields/reorder', requireAuth, (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders)) return res.json({ success: false });

  try {
    const updateStmt = db.prepare('UPDATE form_fields SET sort_order = ?, step = ? WHERE id = ?');
    const transaction = db.transaction((items) => {
      let count = 0;
      for (const item of items) {
        const result = updateStmt.run(item.sort_order, item.step, item.id);
        if (result.changes > 0) count++;
      }
      return count;
    });

    const updatedCount = transaction(orders);
    console.log(`[Reorder Success] Updated ${updatedCount} fields in the database.`);
    res.json({ success: true, updated: updatedCount });
  } catch (err) {
    console.error('[Reorder DB Error]:', err);
    res.json({ success: false, error: err.message });
  }
});

// CloudPanel-compatible listen logic - Using 3103 consistently
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 MCC-MRF Incubation System Successfully Running on port: ${PORT}`);
    console.log(`📋 Form Link: http://applyincubation.mccmrfip.in/index.html`);
  });
} catch (error) {
  console.error('FAILED TO START SERVER:', error);
}

