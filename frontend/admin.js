// ===================== Auth guard =====================
// No token in this browser session? Bounce straight to the login page —
// nothing below this runs for a logged-out visitor.

const adminToken = sessionStorage.getItem("adminToken");

if (!adminToken) {
    window.location.href = "login.html";
}

function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${adminToken}`, ...extra };
}

function handleAuthError(response) {
    if (response.status === 401) {
        sessionStorage.removeItem("adminToken");
        window.location.href = "login.html";
        throw new Error("Session imeisha, tafadhali login tena.");
    }
    return response;
}

document.getElementById("logoutBtn").addEventListener("click", () => {
    fetch("/api/admin/logout", { method: "POST", headers: authHeaders() }).finally(() => {
        sessionStorage.removeItem("adminToken");
        window.location.href = "login.html";
    });
});

// ===================== Toast helper (same pattern as app.js) =====================

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    toast.textContent = `${icons[type] || ""} ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===================== State =====================

let adminMap;
let markers = [];
let currentFilter = "All";
let knownIds = new Set();
let autoRefreshTimer;

const STATUS_COLORS = {
    Pending: "#f77f00",
    Responding: "#5aa4ff",
    Resolved: "#2ec4b6",
};

const emergencyList = document.getElementById("emergencyList");

// ===================== Map =====================

function initializeMap() {
    adminMap = L.map("adminMap").setView([-6.16, 39.2], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(adminMap);
}

function coloredIcon(color) {
    return L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};
                border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16],
    });
}

function clearMarkers() {
    markers.forEach((m) => adminMap.removeLayer(m));
    markers = [];
}

// ===================== Data loading =====================

function loadEmergencies() {
    const refreshBtn = document.getElementById("refreshBtn");
    refreshBtn.classList.add("spinning");

    Promise.all([
        fetch("/api/emergencies", { headers: authHeaders() })
            .then((r) => handleAuthError(r))
            .then((r) => r.json()),
        fetch("/api/emergencies/stats", { headers: authHeaders() })
            .then((r) => handleAuthError(r))
            .then((r) => r.json()),
    ])
        .then(([emergencies, stats]) => {
            checkForNewEmergencies(emergencies);
            renderStats(stats);
            renderMarkers(emergencies);
            renderList(emergencies);
        })
        .catch((error) => {
            console.error(error);
            emergencyList.innerHTML = '<p class="empty-state">❌ Failed to load emergencies.</p>';
        })
        .finally(() => {
            refreshBtn.classList.remove("spinning");
        });
}

function checkForNewEmergencies(emergencies) {
    if (knownIds.size > 0) {
        const newOnes = emergencies.filter((e) => !knownIds.has(e.id));
        if (newOnes.length > 0) {
            showToast(`Emergency mpya ${newOnes.length} imeingia!`, "info");
        }
    }
    knownIds = new Set(emergencies.map((e) => e.id));
}

function renderStats(stats) {
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statPending").textContent = stats.pending;
    document.getElementById("statResponding").textContent = stats.responding;
    document.getElementById("statResolved").textContent = stats.resolved;
}

function renderMarkers(emergencies) {
    clearMarkers();

    emergencies.forEach((emergency) => {
        const marker = L.marker(
            [emergency.latitude, emergency.longitude],
            { icon: coloredIcon(STATUS_COLORS[emergency.status] || "#999") }
        ).addTo(adminMap);

        marker.bindPopup(
            `<strong>🚨 ${emergency.type}</strong><br>Status: ${emergency.status}<br>ID: ${emergency.id}`
        );

        markers.push(marker);
    });
}

// ===================== List rendering =====================

function renderList(emergencies) {
    const filtered =
        currentFilter === "All"
            ? emergencies
            : emergencies.filter((e) => e.status === currentFilter);

    emergencyList.innerHTML = "";

    if (filtered.length === 0) {
        emergencyList.innerHTML = '<p class="empty-state">Hakuna emergencies za aina hii.</p>';
        return;
    }

    filtered.forEach((emergency) => {
        const card = document.createElement("div");
        card.className = `emergency-card status-${emergency.status}`;

        const badgeClass =
            emergency.status === "Pending"
                ? "badge-pending"
                : emergency.status === "Responding"
                ? "badge-responding"
                : "badge-resolved";

        card.innerHTML = `
            <div class="card-head">
                <h2>🚨 ${emergency.type}</h2>
                <span class="badge ${badgeClass}">${emergency.status}</span>
            </div>

            <p class="card-meta"><strong>ID:</strong> ${emergency.id} &nbsp;|&nbsp;
               <strong>Muda:</strong> ${new Date(emergency.time).toLocaleString()}</p>
            <p class="card-meta"><strong>Location:</strong> ${emergency.latitude.toFixed(5)}, ${emergency.longitude.toFixed(5)}</p>

            <p class="card-desc">${emergency.description || "Hakuna maelezo zaidi."}</p>

            <div class="card-actions">
                <button class="btn-respond" data-action="Responding" data-id="${emergency.id}">🔄 Respond</button>
                <button class="btn-resolve" data-action="Resolved" data-id="${emergency.id}">✅ Resolve</button>
                <button class="btn-delete" data-action="delete" data-id="${emergency.id}">🗑 Delete</button>
            </div>
        `;

        emergencyList.appendChild(card);
    });
}

// ===================== Actions =====================

emergencyList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "delete") {
        deleteEmergency(id);
    } else {
        updateStatus(id, action);
    }
});

function updateStatus(id, status) {
    fetch(`/api/emergencies/${id}/status`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
    })
        .then((response) => handleAuthError(response))
        .then((response) => response.json())
        .then(() => {
            showToast(`Status imebadilishwa kuwa ${status}`, "success");
            loadEmergencies();
        })
        .catch((error) => {
            console.error(error);
            showToast("Failed to update status.", "error");
        });
}

function deleteEmergency(id) {
    if (!confirm("Una uhakika unataka kufuta emergency hii?")) return;

    fetch(`/api/emergencies/${id}`, { method: "DELETE", headers: authHeaders() })
        .then((response) => handleAuthError(response))
        .then((response) => response.json())
        .then(() => {
            showToast("Emergency imefutwa.", "success");
            loadEmergencies();
        })
        .catch((error) => {
            console.error(error);
            showToast("Failed to delete emergency.", "error");
        });
}

// ===================== Filters & refresh =====================

document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        loadEmergencies();
    });
});

document.getElementById("refreshBtn").addEventListener("click", loadEmergencies);

// ===================== Init =====================

initializeMap();
loadEmergencies();

// Auto-refresh every 15 seconds so new emergencies show up without a manual reload
autoRefreshTimer = setInterval(loadEmergencies, 15000);
