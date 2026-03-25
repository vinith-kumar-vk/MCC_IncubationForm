const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
    status TEXT DEFAULT 'Pending',
    declaration_agreed INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

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

app.listen(PORT, () => {
  console.log(`\n🚀 MCC-MRF Incubation System running at http://localhost:${PORT}`);
  console.log(`📋 Form: http://localhost:${PORT}/index.html`);
  console.log(`🔐 Login: http://localhost:${PORT}/login.html`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`\n🔑 Admin credentials: mccmrfadmin / admin1234\n`);
});
