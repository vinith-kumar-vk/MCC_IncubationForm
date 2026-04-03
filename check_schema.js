const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'mcc_incubation.db'));
const schema = db.prepare("PRAGMA table_info(applications)").all();
console.log(JSON.stringify(schema, null, 2));
