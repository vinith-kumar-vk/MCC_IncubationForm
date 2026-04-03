const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');

const newFields = [
  { label: 'Co-founder/s Name', field_type: 'textarea', field_name: 'co_founder_names', step: 1, sort_order: 7, required: 0, validation_rules: '{"max_words":100}' },
  { label: 'DIN (for Directors)', field_type: 'text', field_name: 'co_founder_din', step: 1, sort_order: 8, required: 0, validation_rules: '{}' },
  { label: 'Co-founder WhatsApp Number', field_type: 'tel', field_name: 'co_founder_whatsapp', step: 1, sort_order: 9, required: 0, validation_rules: '{}' },
  { label: 'Co-founder Address', field_type: 'textarea', field_name: 'co_founder_address', step: 1, sort_order: 10, required: 0, validation_rules: '{}' }
];

const stmt = db.prepare('INSERT INTO form_fields (label, field_type, field_name, step, sort_order, required, validation_rules) VALUES (?, ?, ?, ?, ?, ?, ?)');

for (const f of newFields) {
  stmt.run(f.label, f.field_type, f.field_name, f.step, f.sort_order, f.required, f.validation_rules || '{}');
}

console.log('Successfully added co-founder fields.');
