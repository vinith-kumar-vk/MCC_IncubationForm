const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');
db.prepare("UPDATE form_fields SET label = 'Have you joined any incubator / accelerator program earlier?', field_name = 'incubation_support_radio', field_type = 'radio', options = 'Yes; No' WHERE id = 9").run();
console.log('Field 9 update completed');
