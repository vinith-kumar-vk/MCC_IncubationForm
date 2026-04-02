const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');
db.prepare("UPDATE form_fields SET field_type = 'radio', options = 'Yes; No' WHERE field_name = 'financial_support'").run();
console.log('Update completed');
