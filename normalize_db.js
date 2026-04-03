const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');

// Convert all column_width values to numbers (removing 'col-md-' and 'col-' prefixes if they exist)
const fields = db.prepare("SELECT id, column_width FROM form_fields").all();
const updateStmt = db.prepare("UPDATE form_fields SET column_width = ? WHERE id = ?");

for (const f of fields) {
  let val = f.column_width;
  if (typeof val === 'string') {
    val = val.replace('col-md-', '').replace('col-', '');
    const num = parseInt(val);
    if (!isNaN(num)) {
      updateStmt.run(num, f.id);
    } else {
      updateStmt.run(12, f.id);
    }
  } else if (!val) {
    updateStmt.run(12, f.id);
  }
}

console.log('Normalized all column_width values to numbers in DB.');
