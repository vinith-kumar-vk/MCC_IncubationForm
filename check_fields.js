const Database = require('better-sqlite3');
const db = new Database('mcc_incubation.db');
const fields = db.prepare('SELECT * FROM form_fields').all();
console.log(JSON.stringify(fields, null, 2));
