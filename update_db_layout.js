const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');

// Update existing fields with exact Bootstrap classes
db.prepare("UPDATE form_fields SET column_width = 'col-md-6' WHERE field_name IN ('applicant_name', 'email', 'whatsapp', 'professional_status') AND step = 1").run();
db.prepare("UPDATE form_fields SET column_width = 'col-12' WHERE field_name = 'address' AND step = 1").run();

const newFields = [
  { label: 'Co-founder/s Name', field_type: 'textarea', field_name: 'co_founder_names', step: 1, sort_order: 11, required: 0, column_width: 'col-12', validation_rules: '{"max_words":100}' },
  { label: 'DIN (for Directors)', field_type: 'text', field_name: 'co_founder_din', step: 1, sort_order: 12, required: 0, column_width: 'col-md-6', validation_rules: '{}' },
  { label: 'Co-founder WhatsApp Number', field_type: 'tel', field_name: 'co_founder_whatsapp', step: 1, sort_order: 13, required: 0, column_width: 'col-md-6', validation_rules: '{}' },
  { label: 'Co-founder Address', field_type: 'textarea', field_name: 'co_founder_address', step: 1, sort_order: 14, required: 0, column_width: 'col-12', validation_rules: '{}' }
];

const stmtInsert = db.prepare('INSERT INTO form_fields (label, field_type, field_name, step, sort_order, required, column_width, validation_rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const stmtUpdate = db.prepare('UPDATE form_fields SET label=?, field_type=?, step=?, sort_order=?, required=?, column_width=?, validation_rules=? WHERE field_name=?');

for (const f of newFields) {
  const existing = db.prepare('SELECT id FROM form_fields WHERE field_name = ?').get(f.field_name);
  if (existing) {
    stmtUpdate.run(f.label, f.field_type, f.step, f.sort_order, f.required, f.column_width, f.validation_rules, f.field_name);
  } else {
    stmtInsert.run(f.label, f.field_type, f.field_name, f.step, f.sort_order, f.required, f.column_width, f.validation_rules);
  }
}

console.log('Successfully updated Step 1 fields with correct Bootstrap classes.');
