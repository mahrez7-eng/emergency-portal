require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_TYPES = [
    "Medical Emergency",
    "Police Emergency",
    "Fire Emergency",
    "Accident",
];

const ALLOWED_STATUSES = ["Pending", "Responding", "Resolved"];

// ---------- Admin auth ----------
// Simple token-based auth: good enough to gate the dashboard for a small
// project like this. Tokens live in memory, so they reset when the server
// restarts (admins just log in again).
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const validTokens = new Set();

function requireAdminAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token || !validTokens.has(token)) {
        return res.status(401).json({ message: "Unauthorized. Tafadhali login kwanza." });
    }

    next();
}

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// Serve the frontend (index.html, admin.html, css, js) from the same server
// so the app works with simple relative fetch("/api/...") calls, both
// locally and once deployed anywhere.
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ---------- Helpers ----------
function isValidCoordinate(lat, lng) {
    return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

// ---------- Routes ----------

// Health check
app.get("/api/health", (req, res) => {
    res.json({ message: "Emergency Response API is running!", status: "ok" });
});

// Admin login — returns a token to use as: Authorization: Bearer <token>
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: "Username au password si sahihi." });
    }

    const token = crypto.randomBytes(24).toString("hex");
    validTokens.add(token);

    res.json({ message: "Login imefanikiwa", token });
});

// Admin logout — invalidates the token so it can't be reused
app.post("/api/admin/logout", requireAdminAuth, (req, res) => {
    const token = req.headers.authorization.slice(7);
    validTokens.delete(token);
    res.json({ message: "Logout imefanikiwa" });
});

// Create a new emergency
app.post("/api/emergencies", (req, res) => {
    try {
        const { type, latitude, longitude, description } = req.body;
        const time = req.body.time || new Date().toISOString();

        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).json({ message: "Invalid emergency type." });
        }

        if (!isValidCoordinate(latitude, longitude)) {
            return res.status(400).json({ message: "Invalid or missing coordinates." });
        }

        const insert = db.prepare(`
            INSERT INTO emergencies (type, latitude, longitude, time, status, description)
            VALUES (?, ?, ?, ?, 'Pending', ?)
        `);

        const result = insert.run(type, latitude, longitude, time, description || null);

        console.log(`🚨 New emergency #${result.lastInsertRowid} — ${type}`);

        res.status(201).json({
            message: "Emergency saved successfully",
            emergencyId: result.lastInsertRowid,
        });
    } catch (error) {
        console.error("Error saving emergency:", error);
        res.status(500).json({ message: "Server error while saving emergency." });
    }
});

// List emergencies, optionally filtered by status: /api/emergencies?status=Pending
// (Admin only — this is the full feed of everyone's reports.)
app.get("/api/emergencies", requireAdminAuth, (req, res) => {
    try {
        const { status } = req.query;

        let emergencies;
        if (status && ALLOWED_STATUSES.includes(status)) {
            emergencies = db
                .prepare(`SELECT * FROM emergencies WHERE status = ? ORDER BY id DESC`)
                .all(status);
        } else {
            emergencies = db.prepare(`SELECT * FROM emergencies ORDER BY id DESC`).all();
        }

        res.json(emergencies);
    } catch (error) {
        console.error("Error fetching emergencies:", error);
        res.status(500).json({ message: "Server error while fetching emergencies." });
    }
});

// Quick counts for the dashboard's stat cards (admin only)
app.get("/api/emergencies/stats", requireAdminAuth, (req, res) => {
    try {
        const total = db.prepare(`SELECT COUNT(*) AS c FROM emergencies`).get().c;
        const pending = db
            .prepare(`SELECT COUNT(*) AS c FROM emergencies WHERE status = 'Pending'`)
            .get().c;
        const responding = db
            .prepare(`SELECT COUNT(*) AS c FROM emergencies WHERE status = 'Responding'`)
            .get().c;
        const resolved = db
            .prepare(`SELECT COUNT(*) AS c FROM emergencies WHERE status = 'Resolved'`)
            .get().c;

        res.json({ total, pending, responding, resolved });
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: "Server error while fetching stats." });
    }
});

// Update an emergency's status (admin only)
app.put("/api/emergencies/:id/status", requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid status." });
        }

        const update = db.prepare(`UPDATE emergencies SET status = ? WHERE id = ?`);
        const result = update.run(status, id);

        if (result.changes === 0) {
            return res.status(404).json({ message: "Emergency not found." });
        }

        res.json({ message: "Status updated successfully", status });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ message: "Server error while updating status." });
    }
});

// Delete an emergency (used by the admin dashboard's cleanup action, admin only)
app.delete("/api/emergencies/:id", requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const result = db.prepare(`DELETE FROM emergencies WHERE id = ?`).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ message: "Emergency not found." });
        }

        res.json({ message: "Emergency deleted successfully" });
    } catch (error) {
        console.error("Error deleting emergency:", error);
        res.status(500).json({ message: "Server error while deleting emergency." });
    }
});

// Fallback 404 for unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({ message: "Route not found." });
});

app.listen(PORT, () => {
    console.log(`🚑 Server running on http://localhost:${PORT}`);
});
