/**
 * API Wrapper — Skin AI (Microservices Version)
 */

const AUTH_BASE       = "http://localhost/api/auth";
const PREDICTION_BASE = "http://localhost/api/predictions";
const HISTORY_BASE    = "http://localhost/api/history";

/* ── Auth State ── */
const auth = {
    token: localStorage.getItem("api_token") || "",
    user: JSON.parse(localStorage.getItem("api_user") || "null"),

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        if (token) {
            localStorage.setItem("api_token", token);
            localStorage.setItem("api_user", JSON.stringify(user));
        } else {
            localStorage.removeItem("api_token");
            localStorage.removeItem("api_user");
        }
        window.dispatchEvent(new CustomEvent("authStateChanged", {
            detail: { isAuthenticated: !!token }
        }));
    },

    logout() { this.setAuth("", null); },

    headers() {
        const h = { "Accept": "application/json" };
        if (this.token) h["Authorization"] = `Bearer ${this.token}`;
        return h;
    },

    isAuthenticated() { return !!this.token; }
};

/* ── Generic fetch wrapper ── */
async function apiCall(baseUrl, endpoint, options = {}) {
    try {
        const url = `${baseUrl}${endpoint}`;
        const res = await fetch(url, {
            ...options,
            headers: { ...auth.headers(), ...(options.headers || {}) }
        });

        if (!res.ok) {
            let msg = `Erreur HTTP ${res.status}`;
            try {
                const json = await res.json();
                if (json.detail) msg = json.detail;
                else if (json.error) msg = json.error;
                else if (typeof json === "object") {
                    msg = Object.entries(json)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                        .join(" | ");
                }
            } catch (_) {}
            throw new Error(msg);
        }

        const text = await res.text();
        return text ? JSON.parse(text) : null;

    } catch (err) {
        if (err.message.includes("Failed to fetch")) {
            throw new Error("Impossible de contacter le serveur. Vérifiez que les microservices sont lancés.");
        }
        throw err;
    }
}

/* ── Auth endpoints ── */
async function login(username, password) {
    const data = await apiCall(AUTH_BASE, "/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    if (data?.access) {
        auth.setAuth(data.access, data.user);
    }
    return data;
}

async function register(username, password, email = "") {
    return await apiCall(AUTH_BASE, "/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email })
    });
}

/* ── Prediction endpoint ── */
async function predictImage(imageFile) {
    const form = new FormData();
    form.append("image", imageFile);
    return await apiCall(PREDICTION_BASE, "/predict/", {
        method: "POST",
        body: form
    });
}

/* ── History endpoint ── */
async function getHistory() {
    if (!auth.user) throw new Error("Non connecté");
    return await apiCall(HISTORY_BASE, `/history/?user_id=${auth.user.id}`);
}

async function saveHistory(imageFile, dlResult) {
    if (!auth.user) throw new Error("Non connecté");
    const form = new FormData();
    form.append("user_id", auth.user.id);
    form.append("image", imageFile);
    form.append("result", JSON.stringify(dlResult));
    
    return await apiCall(HISTORY_BASE, "/history/", {
        method: "POST",
        body: form
    });
}

async function deleteHistory(historyId) {
    if (!auth.user) throw new Error("Non connecté");
    return await apiCall(HISTORY_BASE, `/history/${historyId}/`, {
        method: "DELETE"
    });
}

async function updateHistoryTitle(historyId, customTitle) {
    if (!auth.user) throw new Error("Non connecté");
    return await apiCall(HISTORY_BASE, `/history/${historyId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_title: customTitle })
    });
}

/* ── Chat endpoint ── */
async function sendChatMessage(message, history = []) {
    if (!auth.user) throw new Error("Non connecté");
    // DL Service is exposed on port 8000. Traefik maps it to /predict or directly.
    // Wait, Traefik maps dl-service to /predict. So it might be http://localhost/predict/api/chat/ if using traefik, 
    // or directly via port 8000: http://localhost:8000/api/chat/
    const url = "http://localhost:8000/api/chat/";
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })
    });
    if (!res.ok) throw new Error("Erreur chat");
    return await res.json();
}

async function saveChatToHistory(chatMessages, customTitle) {
    if (!auth.user) throw new Error("Non connecté");
    
    // We send a JSON payload instead of FormData because there is no image
    return await apiCall(HISTORY_BASE, "/history/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: auth.user.id,
            result: {
                type: "chat",
                custom_title: customTitle,
                messages: chatMessages,
                top3: [{label: "Conversation IA", confidence: 100}] // Stub for the UI to not break
            }
        })
    });
}

/* ── Global export ── */
window.api = {
    auth,
    login,
    register,
    predictImage,
    getHistory,
    saveHistory,
    saveChatToHistory,
    deleteHistory,
    updateHistoryTitle,
    sendChatMessage
};