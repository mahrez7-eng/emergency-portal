const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "emergency.db"));
db.pragma("journal_mode = WAL");

// Create table if it doesn't exist yet
db.prepare(`
    CREATE TABLE IF NOT EXISTS emergencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`).run();

// Safe migration for older databases that predate the description/created_at columns
const columns = db.prepare(`PRAGMA table_info(emergencies)`).all().map((c) => c.name);

if (!columns.includes("description")) {
    db.prepare(`ALTER TABLE emergencies ADD COLUMN description TEXT`).run();
}

if (!columns.includes("created_at")) {
    db.prepare(`ALTER TABLE emergencies ADD COLUMN created_at TEXT`).run();
}

// Helpful index for the dashboard's status filter and ordering
db.prepare(`CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies(status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_emergencies_id_desc ON emergencies(id DESC)`).run();

console.log("✅ Database ready (emergency.db)");

module.exports = db;
