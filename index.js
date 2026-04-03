const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
// CloudPanel-compatible configuration - Reverting to 3103
const PORT = 3105;

// Ensure directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');

[uploadDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// DB Setup
const db = new Database(path.join(__dirname, 'mcc_incubation.db'));

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
    full_data TEXT,
    financial_proof_path TEXT,
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

// ─── DATABASE MIGRATION (Ensure new columns exist) ───────────────────────────
const columnsToAdd = [
  "financial_proof_path TEXT",
  "pitch_deck_url TEXT",
  "full_data TEXT",
  "declaration_agreed INTEGER DEFAULT 0",
  "file_path TEXT",
  "plan_to_grow TEXT",
  "services_needed TEXT",
  "financial_support TEXT",
  "incubation_support TEXT",
  "incubation_duration TEXT",
  "association_type TEXT",
  "incubation_help TEXT"
];

columnsToAdd.forEach(colData => {
  try {
    db.prepare(`ALTER TABLE applications ADD COLUMN ${colData}`).run();
  } catch (e) { /* Column already exists, ignore */ }
});

// Seed default site settings
const defaultSettings = [
  { key: 'site_title', value: 'MCC - MRF' },
  { key: 'site_subtitle', value: 'INNOVATION PARK' },
  { key: 'site_location', value: 'Madras Christian College' },
  { key: 'form_title', value: 'Application form for Incubation @ MCCMRFIP' },
  { key: 'form_subtitle', value: 'Begin your entrepreneurship journey with us.' },
  { key: 'logo_path', value: '/images/logo.png' },
  { key: 'footer_text', value: '© 2026 Madras Christian College - Innovation Park' }
];
const insertSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed default form fields if table is empty
try {
  const row = db.prepare('SELECT COUNT(*) as c FROM form_fields').get();
  if (!row || row.c === 0) {
    console.log('--- SEEDING DEFAULT FORM FIELDS ---');
    const insertField = db.prepare(`INSERT OR IGNORE INTO form_fields (step, field_type, field_name, label, placeholder, required, options, sort_order, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const defaultFields = [
      [1, 'text', 'applicant_name', 'Full Name of Applicant', 'John Doe', 1, null, 1, 6],
      [1, 'email', 'email', 'Email Address', 'john@example.com', 1, null, 2, 6],
      [1, 'tel', 'whatsapp', 'WhatsApp Number', '+91-0000000000', 1, null, 3, 6],
      [1, 'textarea', 'address', 'Correspondence Address', 'Full postal address', 1, null, 4, 12],
      [1, 'select', 'professional_status', 'Current Professional Status', 'Select your current status', 1, 'Student,Working professional,Entrepreneur,Faculty or Alumni of MCC', 5, 6],
      [2, 'text', 'startup_name', 'Name of Startup / Project Title', 'Entity name', 1, null, 1, 6],
      [2, 'textarea', 'idea_description', 'Brief Description of your Idea', 'What does your startup do?', 1, null, 2, 12],
      [3, 'radio', 'financial_support', 'Has your startup received any financial support?', '', 1, 'Yes; No', 1, 6],
      [3, 'radio', 'incubation_status', 'Have you joined any incubator / accelerator program earlier?', '', 1, 'Yes; No', 2, 6],
      [3, 'checkbox', 'services_needed', 'Please select the incubation services that you need:', '', 1, 'Office Space; Mentor Support; Market Access; Lab Equipment & Technical Access; Professional Business Services (IP, Auditing, etc); Fundraising Assistance', 3, 12],
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
app.post('/api/apply', upload.any(), (req, res) => {
  try {
    console.log('--- POST /api/apply Received ---');
    console.log('Body keys:', Object.keys(req.body));
    console.log('Files:', req.files ? req.files.length : 0);

    const {
      applicant_name, startup_name, address, email, whatsapp,
      professional_status, idea_description, plan_to_grow, financial_support,
      incubation_status, incubation_duration, association_type,
      incubation_help, declaration_agreed
    } = req.body;

    const final_idea_description = plan_to_grow || idea_description || 'N/A';

    const services_needed = Array.isArray(req.body.services_needed)
      ? req.body.services_needed.join(', ')
      : (req.body.services_needed || '');

    // Collect all uploaded file paths and associated URLs
    const fileData = {};
    if (req.files) {
      req.files.forEach(f => {
        fileData[f.fieldname] = '/uploads/' + f.filename;
      });
    }

    // Capture dynamic URL fields (e.g. startup_file_url)
    Object.keys(req.body).forEach(key => {
      if (key.endsWith('_url')) {
        fileData[key] = req.body[key];
      }
    });

    const file_path = fileData['startup_file'] || null;
    const pitch_deck_url = fileData['startup_file_url'] || req.body.pitch_deck_url || null;
    const financial_proof_path = fileData['financial_proof'] || null;
    
    // Merge file paths and URLs into full_data
    const full_data = JSON.stringify({ ...req.body, ...fileData, pitch_deck_url }); 

    // Support either incubation_status or incubation_support depending on form label
    const incubationVar = req.body.incubation_status || req.body.incubation_support || '';
    
    db.prepare(`
      INSERT INTO applications
      (applicant_name, startup_name, address, email, whatsapp, professional_status,
       plan_to_grow, services_needed, financial_support, incubation_support,
       incubation_duration, association_type, incubation_help, file_path, financial_proof_path, pitch_deck_url, declaration_agreed, full_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      applicant_name || 'N/A', startup_name || 'N/A', address || 'N/A', email || 'N/A', whatsapp || 'N/A', professional_status || 'N/A',
      final_idea_description, services_needed || null, financial_support || null, incubationVar || null,
      incubation_duration || null, association_type || null, incubation_help || null, file_path, financial_proof_path, pitch_deck_url,
      declaration_agreed ? 1 : 0, full_data
    );

    res.json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    console.error('CRITICAL SUBMIT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Submission failed: ' + err.message,
      stack: err.stack
    });
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

// Advanced Migration & Sync Logic
try {
  // Ensure pitch_deck_url column exists in applications (now handled in main migration above, but keeping for safety)
  try { db.prepare("ALTER TABLE applications ADD COLUMN pitch_deck_url TEXT").run(); } catch(e){}

  // Sync Validation Rules from current requirements across all form fields
  const fields = db.prepare("SELECT id, label, field_name FROM form_fields").all();
  fields.forEach(f => {
    let rules = {};
    const label = (f.label || "").toUpperCase();
    const name = (f.field_name || "").toLowerCase();
    
    // 100 word limit for Idea/Description/Startup Name (as requested)
    if (label.includes("IDEA") || label.includes("DESCRIPTION") || label.includes("STARTUP NAME")) {
      rules.max_words = 100;
    }
    
    // Pitch Deck special handling: Max size 10MB + Allow URL toggle
    if (label.includes("PITCH DECK")) {
      rules.max_size_mb = 10;
      rules.allow_url = true;
      rules.allowed_ext = 'pdf';
    }

    if (Object.keys(rules).length > 0) {
      db.prepare("UPDATE form_fields SET validation_rules = ? WHERE id = ?").run(JSON.stringify(rules), f.id);
    } else {
      // Clear rules for others or set defaults (Certification remains normal)
      db.prepare("UPDATE form_fields SET validation_rules = NULL WHERE id = ?").run(f.id);
    }
  });

  // Ensure 'startup_name' is required
  db.prepare("UPDATE form_fields SET required = 1 WHERE field_name = 'startup_name'").run();

  console.log("--- DATABASE DYNAMIC VALIDATIONS SYNCED ---");
} catch (err) {
  console.error("Migration error:", err);
}

// Removed duplicated full_data migration since it's handled globally above.

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
  const { step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width, validation_rules } = req.body;
  const defWidth = column_width || (field_type === 'textarea' || field_type === 'checkbox' || field_type === 'radio' ? 12 : 6);
  const stmt = db.prepare('INSERT INTO form_fields (step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width, validation_rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, defWidth, validation_rules);
  res.json({ success: true, id: result.lastInsertRowid });
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
        const result = updateStmt.run(Number(item.sort_order), Number(item.step), Number(item.id));
        if (result.changes > 0) count++;
      }
      return count;
    });

    const updatedCount = transaction(orders);
    console.log(`[Reorder Success] Updated ${updatedCount} fields.`);
    res.json({ success: true, updated: updatedCount });
  } catch (err) {
    console.error('[Reorder DB Error]:', err);
    res.json({ success: false, error: err.message });
  }
});

// Delete field
app.delete('/api/admin/form-fields/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM form_fields WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update field
app.put('/api/admin/form-fields/:id', requireAuth, (req, res) => {
  const { step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width, validation_rules } = req.body;
  const stmt = db.prepare('UPDATE form_fields SET step = ?, field_type = ?, field_name = ?, label = ?, placeholder = ?, options = ?, sort_order = ?, required = ?, is_active = ?, column_width = ?, validation_rules = ? WHERE id = ?');
  stmt.run(step, field_type, field_name, label, placeholder, options, sort_order, required, is_active, column_width || 12, validation_rules, req.params.id);
  res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ GLOBAL APP ERROR:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Server internal error. Please check logs.',
    error: err.message 
  });
});

// CloudPanel-compatible listen logic - Using 3105 consistently
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 MCC-MRF Incubation System Successfully Running on port: ${PORT}`);
    console.log(`📋 Form Link: http://localhost:${PORT}/index.html`);
  });
} catch (error) {
  console.error('FAILED TO START SERVER:', error);
}

