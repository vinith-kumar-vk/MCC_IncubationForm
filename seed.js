const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'mcc_incubation.db'));

try {
  // Clear first if needed
  db.prepare('DELETE FROM applications').run();

  const insert = db.prepare(`
    INSERT INTO applications (applicant_name, startup_name, address, email, whatsapp, professional_status, status, startup_description, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    'Charles Abraham', 'MCC Smart Certify', 'MMC Main Office, Madras Christian College, Chennai - 600059',
    'charlesabrahamr@mcc.edu.in', '98765 43210', 'STAFF Member', 'Approved',
    'AI based certificate generation and verification system for academic institutions.',
    new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
  );

  insert.run(
    'Test Student', 'EcoCycle Campus', 'Selaiyur Hall, MCC Campus',
    'test.student@mcc.edu.in', '91234 56789', 'STUDENT (Final Year)', 'Pending',
    'Smart waste management solution for the college campus using IoT devices.',
    new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
  );

  insert.run(
    'Test Staff Member', 'Innovate MCC', 'Physics Dept, MCC',
    'test.staff@mcc.edu.in', '90000 11111', 'STAFF', 'Approved',
    'A platform for inter-departmental collaboration on innovation projects.',
    new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 minutes ago
  );

  console.log('✅ Seed data inserted successfully!');
} catch (err) {
  console.error('❌ Error seeding data:', err);
} finally {
  db.close();
}
