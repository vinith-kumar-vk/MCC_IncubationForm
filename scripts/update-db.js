const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');

try {
  // Add validation_rules column if not exists
  const info = db.prepare("PRAGMA table_info(form_fields)").all();
  if (!info.some(c => c.name === 'validation_rules')) {
    db.prepare("ALTER TABLE form_fields ADD COLUMN validation_rules TEXT").run();
    console.log('Column validation_rules added.');
  } else {
    console.log('Column validation_rules already exists.');
  }

  // Set default validation for existing fields
  // 1. Startup Idea (Textarea) -> 100 words
  db.prepare("UPDATE form_fields SET validation_rules = ? WHERE field_name = 'idea_description'").run(JSON.stringify({ max_words: 100 }));
  
  // 2. Company Certificate (File) -> PDF, 10MB
  db.prepare("UPDATE form_fields SET validation_rules = ? WHERE field_name = 'upload_certificate' OR label LIKE '%Certificate%'").run(JSON.stringify({ allowed_ext: 'pdf', max_size_mb: 10 }));

  console.log('Database updated successfully.');
} catch (err) {
  console.error('Update error:', err);
} finally {
  db.close();
}
