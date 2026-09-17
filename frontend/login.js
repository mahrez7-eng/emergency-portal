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

// If already logged in, skip straight to the dashboard
if (sessionStorage.getItem("adminToken")) {
    window.location.href = "admin.html";
}

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    loginError.textContent = "";
    loginBtn.disabled = true;
    loginBtn.textContent = "Inaingia...";

    fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (!ok) {
                throw new Error(data.message || "Login imeshindikana.");
            }

            sessionStorage.setItem("adminToken", data.token);
            showToast("Login imefanikiwa!", "success");
            window.location.href = "admin.html";
        })
        .catch((error) => {
            loginError.textContent = error.message;
            showToast(error.message, "error");
        })
        .finally(() => {
            loginBtn.disabled = false;
            loginBtn.textContent = "Login";
        });
});
