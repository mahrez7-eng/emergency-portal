// ===================== Toast helper =====================

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

// ===================== Elements =====================

const sosButton = document.getElementById("sosButton");
const latitudeElement = document.getElementById("latitude");
const longitudeElement = document.getElementById("longitude");
const timeElement = document.getElementById("emergencyTime");
const statusElement = document.getElementById("status");
const typeSummaryElement = document.getElementById("typeSummary");
const emergencyInfoCard = document.getElementById("emergencyInfo");

let map;
let userMarker;

// ===================== Main flow =====================

sosButton.addEventListener("click", () => {

    if (!navigator.geolocation) {
        showToast("Browser yako haisupport location.", "error");
        return;
    }

    sosButton.disabled = true;
    sosButton.querySelector("span:last-child").textContent = "Inatuma...";
    showToast("Tunatafuta location yako...", "info");

    navigator.geolocation.getCurrentPosition(
        (position) => handleLocationSuccess(position),
        (error) => {
            console.error(error);
            showToast("Imeshindikana kupata location. Ruhusu location kwenye browser.", "error");
            resetButton();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

function resetButton() {
    sosButton.disabled = false;
    sosButton.querySelector("span:last-child").textContent = "EMERGENCY";
}

function handleLocationSuccess(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    renderMap(latitude, longitude);

    const emergencyType = document.getElementById("emergencyType").value;
    const emergencyDescription = document.getElementById("emergencyDescription").value.trim();
    const now = new Date();

    // Update summary card
    typeSummaryElement.textContent = emergencyType;
    latitudeElement.textContent = latitude.toFixed(6);
    longitudeElement.textContent = longitude.toFixed(6);
    timeElement.textContent = now.toLocaleString();
    setStatusBadge("Pending");
    emergencyInfoCard.classList.add("visible");

    const emergencyRequest = {
        type: emergencyType,
        description: emergencyDescription || null,
        latitude,
        longitude,
        time: now.toISOString(),
        status: "Pending",
    };

    sendEmergency(emergencyRequest);
}

function renderMap(latitude, longitude) {
    if (map) {
        map.remove();
    }

    map = L.map("map").setView([latitude, longitude], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    userMarker = L.marker([latitude, longitude]).addTo(map);
    userMarker.bindPopup("📍 Upo hapa").openPopup();
}

function setStatusBadge(status) {
    const classes = {
        Pending: "badge badge-pending",
        Responding: "badge badge-responding",
        Resolved: "badge badge-resolved",
    };
    statusElement.className = classes[status] || "badge";
    statusElement.textContent = status;
}

function sendEmergency(emergencyRequest) {
    fetch("/api/emergencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emergencyRequest),
    })
        .then((response) => {
            if (!response.ok) {
                return response.json().then((err) => Promise.reject(err));
            }
            return response.json();
        })
        .then((data) => {
            console.log("Backend response:", data);
            showToast("Emergency imetumwa! Msaada unakuja.", "success");
        })
        .catch((error) => {
            console.error("Error sending emergency:", error);
            showToast(error.message || "Imeshindikana kutuma emergency.", "error");
        })
        .finally(() => {
            resetButton();
        });
}
