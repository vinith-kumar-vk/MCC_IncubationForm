const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');

// Add column_width column if it doesn't exist (safety)
try {
  db.prepare("ALTER TABLE form_fields ADD COLUMN column_width TEXT DEFAULT 'col-12'").run();
} catch(e) {
  // Column already exists
}

const newFields = [
  { label: 'Co-founder/s Name', field_type: 'textarea', field_name: 'co_founder_names', step: 1, sort_order: 11, required: 0, column_width: 'col-12', validation_rules: '{"max_words":100}' },
  { label: 'DIN (for Directors)', field_type: 'text', field_name: 'co_founder_din', step: 1, sort_order: 12, required: 0, column_width: 'col-md-6', validation_rules: '{}' },
  { label: 'Co-founder WhatsApp Number', field_type: 'tel', field_name: 'co_founder_whatsapp', step: 1, sort_order: 13, required: 0, column_width: 'col-md-6', validation_rules: '{}' },
  { label: 'Co-founder Address', field_type: 'textarea', field_name: 'co_founder_address', step: 1, sort_order: 14, required: 0, column_width: 'col-12', validation_rules: '{}' }
];

const stmt = db.prepare('INSERT INTO form_fields (label, field_type, field_name, step, sort_order, required, column_width, validation_rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

for (const f of newFields) {
  // Check if field already exists to avoid duplicates if rerun
  const existing = db.prepare('SELECT id FROM form_fields WHERE field_name = ?').get(f.field_name);
  if (!existing) {
    stmt.run(f.label, f.field_type, f.field_name, f.step, f.sort_order, f.required, f.column_width, f.validation_rules || '{}');
  }
}

console.log('Successfully added co-founder fields with column widths.');
