/**
 * app.js — Skin AI (Microservices Version)
 * Redesigned Medical UI Logic
 */

const app = (() => {

  let _lastHistory = [];
  let _currentTab = 'analyze-section';

  const ui = {
    toggleModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle("active");
        if (id === "upload-modal" && typeof window.resetUploadForm === "function") {
            window.resetUploadForm();
        }
      }
    },

    async customPrompt(message, defaultValue = "") {
      return new Promise((resolve) => {
        const modal = document.getElementById("prompt-modal");
        const titleEl = document.getElementById("prompt-modal-title");
        const inputEl = document.getElementById("prompt-modal-input");
        const btnCancel = document.getElementById("prompt-modal-cancel");
        const btnConfirm = document.getElementById("prompt-modal-confirm");

        if (!modal) {
            resolve(prompt(message, defaultValue));
            return;
        }

        titleEl.textContent = message;
        inputEl.value = defaultValue;
        modal.classList.add("active");
        inputEl.focus();

        const cleanup = () => {
            modal.classList.remove("active");
            btnCancel.removeEventListener("click", onCancel);
            btnConfirm.removeEventListener("click", onConfirm);
            inputEl.removeEventListener("keydown", onKey);
        };

        const onCancel = () => { cleanup(); resolve(null); };
        const onConfirm = () => { cleanup(); resolve(inputEl.value); };
        const onKey = (e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
        };

        btnCancel.addEventListener("click", onCancel);
        btnConfirm.addEventListener("click", onConfirm);
        inputEl.addEventListener("keydown", onKey);
      });
    },

    async customAlert(message, title="Message") {
      return new Promise((resolve) => {
        const modal = document.getElementById("alert-modal");
        const titleEl = document.getElementById("alert-modal-title");
        const msgEl = document.getElementById("alert-modal-message");
        const btnOk = document.getElementById("alert-modal-ok");

        if (!modal) {
            alert(message);
            resolve();
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.classList.add("active");
        btnOk.focus();

        const cleanup = () => {
            modal.classList.remove("active");
            btnOk.removeEventListener("click", onOk);
            window.removeEventListener("keydown", onKey);
        };

        const onOk = () => { cleanup(); resolve(); };
        const onKey = (e) => {
            if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); onOk(); }
        };

        btnOk.addEventListener("click", onOk);
        window.addEventListener("keydown", onKey);
      });
    },

    async customConfirm(message, title="Confirmation") {
      return new Promise((resolve) => {
        const modal = document.getElementById("confirm-modal");
        const titleEl = document.getElementById("confirm-modal-title");
        const msgEl = document.getElementById("confirm-modal-message");
        const btnCancel = document.getElementById("confirm-modal-cancel");
        const btnOk = document.getElementById("confirm-modal-ok");

        if (!modal) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.classList.add("active");

        const cleanup = () => {
            modal.classList.remove("active");
            btnCancel.removeEventListener("click", onCancel);
            btnOk.removeEventListener("click", onOk);
            window.removeEventListener("keydown", onKey);
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onOk = () => { cleanup(); resolve(true); };
        const onKey = (e) => {
            if (e.key === "Enter") { e.preventDefault(); onOk(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        };

        btnCancel.addEventListener("click", onCancel);
        btnOk.addEventListener("click", onOk);
        window.addEventListener("keydown", onKey);
      });
    },

    formatDate(dateStr) {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleString("fr-FR", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    },

    formatMessage(text) {
      if (!text) return "";
      let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); // Bold
      html = html.replace(/\*(.*?)\*/g, "<em>$1</em>"); // Italic
      html = html.replace(/\n/g, "<br>"); // Line breaks
      // Simple lists
      html = html.replace(/(?:^|<br>)[-•*]\s+(.+?)(?=<br>|$)/g, "<br><span style='margin-left:1rem; display:block;'>• $1</span>");
      return html;
    },

    downloadChat() {
      const messagesContainer = document.getElementById("chat-messages");
      if (!messagesContainer) return;
      
      let textContent = "Skin AI - Historique de la conversation\n";
      textContent += "=========================================\n\n";
      
      const messages = messagesContainer.querySelectorAll(".chat-bubble");
      
      messages.forEach(msg => {
        if (msg.id && msg.id.startsWith("loading-")) return;
        const isUser = msg.classList.contains("user");
        const sender = isUser ? "Vous" : "SkinBot";
        const text = msg.innerText || msg.textContent;
        textContent += `[${sender}]: ${text}\n\n`;
      });
      
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Conversation_SkinBot_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async saveChat() {
      const messagesContainer = document.getElementById("chat-messages");
      if (!messagesContainer) return;
      
      const titleInput = await ui.customPrompt("Donnez un titre à cette conversation (optionnel) :", "Discussion avec SkinBot");
      if (titleInput === null) return;
      
      const messagesNodes = messagesContainer.querySelectorAll(".chat-bubble");
      const chatMessages = [];
      
      messagesNodes.forEach(msg => {
        if (msg.id && msg.id.startsWith("loading-")) return;
        const isUser = msg.classList.contains("user");
        chatMessages.push({
            sender: isUser ? "user" : "bot",
            text: msg.innerText || msg.textContent
        });
      });
      
      try {
          await window.api.saveChatToHistory(chatMessages, titleInput);
          await ui.customAlert("Conversation sauvegardée dans l'historique avec succès !", "Succès");
          loadHistory();
      } catch (e) {
          await ui.customAlert("Erreur lors de la sauvegarde: " + e.message, "Erreur");
      }
    }
  };

  /* ══════════════════════════════════════════
     THEME & LAYOUT NAVIGATION
  ══════════════════════════════════════════ */
  function initLayout() {
    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = themeToggleBtn?.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn?.querySelector('.moon-icon');

    const updateThemeIcons = (theme) => {
      if(theme === 'dark') {
        sunIcon?.classList.remove('hidden');
        moonIcon?.classList.add('hidden');
      } else {
        sunIcon?.classList.add('hidden');
        moonIcon?.classList.remove('hidden');
      }
    };

    updateThemeIcons(document.documentElement.getAttribute('data-theme'));

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('skin_theme', newTheme);
        updateThemeIcons(newTheme);
      });
    }

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const body = document.body;
    const toggleBtn = document.getElementById('toggle-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      body.classList.toggle('sidebar-open');
    };

    toggleBtn?.addEventListener('click', toggleSidebar);
    closeBtn?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      body.classList.remove('sidebar-open');
    });

    // Tab Navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.section-container');

    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        navTabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId)?.classList.add('active');
        
        _currentTab = targetId;
        renderHistory(_lastHistory);
      });
    });
  }

  /* ══════════════════════════════════════════
     HISTORY SIDEBAR
  ══════════════════════════════════════════ */
  function renderHistory(history) {
    const container = document.getElementById("history-sidebar-content");
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted text-sm mt-8">
          <div style="font-size:2rem; margin-bottom:1rem; opacity:0.5;">📂</div>
          Aucun historique pour le moment
        </div>`;
      return;
    }

    const filteredHistory = history.map((entry, index) => ({ entry, originalIndex: index }))
       .filter(item => {
          const isChat = item.entry.result?.type === "chat";
          if (_currentTab === "analyze-section") return !isChat;
          if (_currentTab === "chat-section") return isChat;
          return true;
       });

    if (filteredHistory.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted text-sm mt-8">
          <div style="font-size:2rem; margin-bottom:1rem; opacity:0.5;">📂</div>
          Aucun historique dans cette catégorie
        </div>`;
      return;
    }

    container.innerHTML = filteredHistory.map(item => {
      const entry = item.entry;
      const i = item.originalIndex;
      const result = entry.result || {};
      const isChat = result.type === "chat";
      
      const defaultChatTitle = "Conversation IA";
      const topLabel = result.custom_title ? result.custom_title : (isChat ? defaultChatTitle : (result.top3?.[0]?.label || "—"));
      const dateStr = ui.formatDate(entry.created_at);
      const imgSrc = isChat ? "💬" : (entry.image ? (entry.image.startsWith('http') ? entry.image : `http://localhost:8003${entry.image}`) : "📸");

      let iconHtml = isChat ? `<div class="history-icon">💬</div>` : `<img src="${imgSrc}" class="history-icon" alt="thumbnail">`;

      return `
        <div class="history-item" onclick="app.showDetail(${i})">
          ${iconHtml}
          <div class="history-info">
            <div class="history-title">${topLabel}</div>
            <div class="history-date">${dateStr}</div>
          </div>
        </div>`;
    }).join("");
  }

  async function loadHistory() {
    try {
      const history = await window.api.getHistory();
      _lastHistory = history;
      renderHistory(history);
    } catch (err) {
      console.error("History load error", err);
      const container = document.getElementById("history-sidebar-content");
      if(container) container.innerHTML = `<div class="text-center text-sm" style="color:var(--danger); padding:1rem;">Erreur de chargement.</div>`;
    }
  }

  function showDetail(index) {
    const entry = _lastHistory[index];
    if (!entry) return;

    const result = entry.result || {};
    const isChat = result.type === "chat";
    const defaultChatTitle = isChat ? "Conversation IA" : (result.top3?.[0]?.label || "—");
    const topLabel = result.custom_title ? result.custom_title : defaultChatTitle;
    const topConf = isChat ? "100" : (result.top3?.[0]?.confidence || 0);
    const dateStr = entry.created_at;
    const imgSrc = isChat ? "" : (entry.image ? (entry.image.startsWith('http') ? entry.image : `http://localhost:8003${entry.image}`) : "");

    const detail = document.getElementById("detail-content");
    if (!detail) return;

    if (isChat) {
      let chatHtml = `<div class="chat-messages" style="height:250px; background:var(--bg-base); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:1.5rem; padding:1rem;">`;
      (result.messages || []).forEach(m => {
        const isUser = m.sender === 'user';
        chatHtml += `<div class="chat-bubble ${isUser ? 'user' : 'bot'}" style="padding:0.5rem 0.75rem; margin-bottom:0.5rem; font-size:0.85rem;">
          <strong>${isUser ? 'Vous' : 'SkinBot'}:</strong><br>${ui.formatMessage(m.text)}
        </div>`;
      });
      chatHtml += `</div>`;
      
      detail.innerHTML = `
        <h3 class="mb-2 flex items-center gap-2">💬 ${topLabel}</h3>
        <p class="text-xs text-muted mb-4">${ui.formatDate(dateStr)}</p>
        ${chatHtml}
        <div class="flex gap-2 w-full">
          <button class="btn btn-secondary flex-1" onclick="app.editHistoryEntry(${entry.id}, '${topLabel.replace(/'/g, "\\'")}')">✏️ Titre</button>
          <button class="btn btn-secondary flex-1" style="color:var(--accent-primary); border-color:var(--accent-primary);" onclick="app.continueChat(${index})">▶️ Continuer</button>
          <button class="btn btn-secondary flex-1 text-center" style="color:var(--danger); border-color:var(--danger);" onclick="app.deleteHistoryEntry(${entry.id})">🗑️</button>
        </div>`;
    } else {
      let severityBadge = "";
      if (topConf > 80 && topLabel.toLowerCase().includes("cancer")) severityBadge = `<span class="confidence-badge" style="background:var(--danger-bg);color:var(--danger);">Élevée</span>`;
      else severityBadge = `<span class="confidence-badge">Normale</span>`;

      detail.innerHTML = `
        <img src="${imgSrc}" alt="Analyse" class="w-full mb-4" style="border-radius:var(--radius-md); max-height:280px; object-fit:contain; background:var(--bg-base); border:1px solid var(--border-subtle);">
        <div class="result-header mb-2">
           <div class="disease-name">${topLabel}</div>
           ${severityBadge}
        </div>
        <p class="text-xs text-muted mb-4">${ui.formatDate(dateStr)} • Confiance: ${topConf}%</p>
        
        <div class="mb-6 p-4 text-sm" style="background:var(--bg-hover); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          ⚠️ <strong>Avertissement :</strong> Ce résultat est généré par IA et nécessite une validation médicale professionnelle.
        </div>
        
        <div class="flex gap-2 w-full">
          <button class="btn btn-secondary flex-1" onclick="app.editHistoryEntry(${entry.id}, '${topLabel.replace(/'/g, "\\'")}')">✏️ Titre</button>
          <button class="btn btn-secondary flex-1 text-center" style="color:var(--danger); border-color:var(--danger);" onclick="app.deleteHistoryEntry(${entry.id})">🗑️ Supprimer</button>
        </div>`;
    }

    ui.toggleModal("detail-modal");
  }

  const deleteHistoryEntry = async (id) => {
      if(!(await ui.customConfirm("Voulez-vous vraiment supprimer cet historique ?", "Suppression"))) return;
      try {
          await window.api.deleteHistory(id);
          ui.toggleModal("detail-modal");
          loadHistory();
      } catch(e) {
          await ui.customAlert("Erreur lors de la suppression: " + e.message, "Erreur");
      }
  };

  const editHistoryEntry = async (id, currentTitle) => {
      const newTitle = await ui.customPrompt("Modifier le titre :", currentTitle);
      if (newTitle === null || newTitle.trim() === "") return;
      try {
          await window.api.updateHistoryTitle(id, newTitle.trim());
          ui.toggleModal("detail-modal");
          loadHistory();
      } catch(e) {
          await ui.customAlert("Erreur lors de la modification: " + e.message, "Erreur");
      }
  };

  const continueChat = (historyIndex) => {
      const entry = _lastHistory[historyIndex];
      if (!entry) return;
      const result = entry.result || {};
      
      const chatMessages = document.getElementById("chat-messages");
      if (!chatMessages) return;
      
      chatMessages.innerHTML = '';
      
      (result.messages || []).forEach(m => {
          const isUser = m.sender === 'user';
          const msgDiv = document.createElement("div");
          msgDiv.className = `chat-bubble ${isUser ? 'user' : 'bot'}`;
          msgDiv.innerHTML = `<strong>${isUser ? 'Vous' : 'SkinBot'}:</strong><br>${ui.formatMessage(m.text)}`;
          chatMessages.appendChild(msgDiv);
      });
      
      ui.toggleModal("detail-modal");
      
      // Switch to chat tab
      const chatTab = document.querySelector('.nav-tab[data-target="chat-section"]');
      if (chatTab) chatTab.click();
      
      setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
  };

  /* ══════════════════════════════════════════
     IMAGE UPLOAD & ANALYSIS
  ══════════════════════════════════════════ */
  function initPrediction() {
    const fileInput = document.getElementById("modal-file-input");
    const btn       = document.getElementById("modal-submit-btn");
    const resultDiv = document.getElementById("modal-result");
    const dropZone  = document.getElementById("modal-drop-zone");
    const preview   = document.getElementById("modal-preview");
    const form      = document.getElementById("upload-form");

    if (!fileInput || !form) return;

    let selectedFile = null;

    window.resetUploadForm = () => {
        fileInput.value = "";
        selectedFile = null;
        if (preview) { preview.src = ""; preview.classList.add("hidden"); }
        if (dropZone) { dropZone.classList.remove("hidden"); dropZone.classList.add("idle"); }
        if (resultDiv) { resultDiv.innerHTML = ""; resultDiv.classList.add("hidden"); }
        if (btn) { btn.disabled = true; btn.innerHTML = "Analyser l'image"; }
    };

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add('dragover'); dropZone.classList.remove('idle'); });
    dropZone.addEventListener("dragleave", e => { e.preventDefault(); dropZone.classList.remove('dragover'); dropZone.classList.add('idle'); });
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event("change"));
        }
    });

    fileInput.addEventListener("change", () => {
        selectedFile = fileInput.files[0];
        if (selectedFile) {
            btn.disabled = false;
            dropZone.classList.remove('idle');
            const reader = new FileReader();
            reader.onload = e => {
                preview.src = e.target.result;
                preview.classList.remove("hidden");
                dropZone.classList.add("hidden");
            };
            reader.readAsDataURL(selectedFile);
        }
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!selectedFile) return;

        btn.disabled = true;
        btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;"></div> Analyse...`;
        
        try {
            const dlResult = await window.api.predictImage(selectedFile);
            const top = dlResult.top3?.[0] || {};
            
            const predictionsHtml = dlResult.top3.map((item, idx) => `
                <div class="prediction-item mb-3" style="background: var(--bg-hover); border: 1px solid ${idx === 0 ? 'var(--accent-primary)' : 'var(--border-subtle)'}; padding: 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 600; color: ${idx === 0 ? 'var(--accent-primary)' : 'var(--text-primary)'}">${item.label}</span>
                        ${idx === 0 ? '<span style="font-size: 0.7rem; background: var(--accent-primary); color: #000; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">Meilleur Match</span>' : ''}
                    </div>
                    <span style="font-family: monospace; font-weight: 700; color: var(--accent-primary);">${item.confidence}%</span>
                </div>
            `).join('');

            resultDiv.innerHTML = `
                <div class="mb-4">
                    ${predictionsHtml}
                </div>
                <div class="mb-4 w-full">
                    <input type="text" id="history-title-input" placeholder="Titre personnalisé (optionnel)" class="input-field mb-4">
                    <div class="flex gap-2">
                        <button id="save-history-btn" class="btn btn-primary flex-1">Sauvegarder</button>
                        <button id="cancel-history-btn" class="btn btn-secondary flex-1">Nouvelle</button>
                    </div>
                </div>
            `;
            resultDiv.classList.remove("hidden");
            
            document.getElementById('save-history-btn').onclick = async () => {
                const btnSave = document.getElementById('save-history-btn');
                const titleInput = document.getElementById('history-title-input').value.trim();
                btnSave.disabled = true;
                btnSave.textContent = "Enregistrement...";
                if (titleInput) dlResult.custom_title = titleInput;
                
                try {
                    await window.api.saveHistory(selectedFile, dlResult);
                    btnSave.textContent = "Sauvegardé";
                    btnSave.classList.replace("btn-primary", "btn-secondary");
                    loadHistory();
                    setTimeout(() => window.resetUploadForm(), 1500);
                } catch(err) {
                    await ui.customAlert("Erreur de sauvegarde: " + err.message, "Erreur");
                    btnSave.disabled = false;
                    btnSave.textContent = "Sauvegarder";
                }
            };
            
            document.getElementById('cancel-history-btn').onclick = () => window.resetUploadForm();
            
        } catch (err) {
            await ui.customAlert("Erreur: " + err.message, "Erreur");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Analyser l'image";
        }
    });
  }

  /* ══════════════════════════════════════════
     CHATBOT
  ══════════════════════════════════════════ */
  function initChatbot() {
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");
    
    if (!chatForm || !chatMessages || !chatInput) return;
    
    function addMessage(text, isUser) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-bubble ${isUser ? 'user' : 'bot'}`;
        
        let content = `<strong>${isUser ? 'Vous' : 'SkinBot'}:</strong><br><div style="margin-top:0.4rem;">${ui.formatMessage(text)}</div>`;
        if(!isUser && text === "...") {
           content = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:var(--accent-primary);"></div>`;
           msgDiv.id = "loading-" + Date.now();
        }
        
        msgDiv.innerHTML = content;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv.id;
    }

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        const historyNodes = chatMessages.querySelectorAll(".chat-bubble");
        const historyData = [];
        historyNodes.forEach(msg => {
            if (msg.id && msg.id.startsWith("loading-")) return;
            const isUser = msg.classList.contains("user");
            let cleanText = msg.innerHTML.replace(/<strong>.*?:<\/strong><br>/g, "");
            historyData.push({
                sender: isUser ? "user" : "bot",
                text: cleanText
            });
        });
        
        addMessage(text, true);
        chatInput.value = "";
        
        const loadingId = addMessage("...", false);
        
        try {
            const response = await window.api.sendChatMessage(text, historyData);
            document.getElementById(loadingId).remove();
            addMessage(response.reply, false);
        } catch (err) {
            document.getElementById(loadingId).remove();
            addMessage("Désolé, je rencontre des problèmes de connexion.", false);
        }
    });
  }

  /* ══════════════════════════════════════════
     AUTH FORMS
  ══════════════════════════════════════════ */
  function initAuth() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const btn = loginForm.querySelector("button[type=submit]");
        const username = document.getElementById("login-email").value; 
        const pwd = document.getElementById("login-password").value;
        btn.disabled = true; btn.textContent = "Chargement...";
        try {
          await window.api.login(username, pwd);
          window.location.href = "dashboard.html";
        } catch (err) {
          const errEl = document.getElementById("login-error");
          if(errEl) { errEl.textContent = err.message; setTimeout(() => errEl.textContent = "", 5000); }
        } finally {
          btn.disabled = false; btn.textContent = "Se connecter";
        }
      });
    }

    const regForm = document.getElementById("register-form");
    if (regForm) {
      regForm.addEventListener("submit", async e => {
        e.preventDefault();
        const btn = regForm.querySelector("button[type=submit]");
        const username = document.getElementById("reg-email").value;
        const pwd = document.getElementById("reg-password").value;
        btn.disabled = true; btn.textContent = "Chargement...";
        try {
          await window.api.register(username, pwd);
          ui.toggleModal("register-modal");
          ui.toggleModal("login-modal");
          await ui.customAlert("Compte créé ! Vous pouvez maintenant vous connecter.", "Succès");
        } catch (err) {
          const errEl = document.getElementById("reg-error");
          if(errEl) { errEl.textContent = err.message; setTimeout(() => errEl.textContent = "", 5000); }
        } finally {
          btn.disabled = false; btn.textContent = "S'inscrire";
        }
      });
    }
  }

  /* ══════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════ */
  
  // Landing page prediction logic
  const landingFile = document.getElementById("ai-file-input");
  if (landingFile) {
     const dropZone = document.getElementById("ai-drop-zone");
     const preview = document.getElementById("ai-preview");
     const btn = document.getElementById("ai-btn-predict");
     const res = document.getElementById("ai-result");
     let file = null;
     dropZone?.addEventListener("click", () => landingFile.click());
     landingFile.addEventListener("change", () => {
         file = landingFile.files[0];
         if(file) {
             if(btn) btn.disabled = false;
             const r = new FileReader();
             r.onload = e => { if(preview) { preview.src = e.target.result; preview.classList.remove("hidden"); } if(dropZone) dropZone.classList.add("hidden"); };
             r.readAsDataURL(file);
         }
     });
     btn?.addEventListener("click", async () => {
         if(!file) return;
         btn.disabled = true;
         btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;"></div> Analyse...`;
         
         const progressBar = document.getElementById("ai-progress-bar");
         const progressContainer = document.getElementById("ai-progress-container");
         
         if (progressContainer) progressContainer.classList.remove("hidden");
         if (progressBar) progressBar.style.width = "0%";
 
         let progress = 0;
         const interval = setInterval(() => {
             progress = Math.min(progress + 5, 90);
             if (progressBar) progressBar.style.width = progress + "%";
         }, 100);
 
         try {
             const result = await window.api.predictImage(file);
             clearInterval(interval);
             if (progressBar) progressBar.style.width = "100%";
             
             const predictionsList = document.getElementById("ai-predictions-list");
             if (predictionsList && result.top3) {
                 predictionsList.innerHTML = result.top3.map((item, idx) => `
                     <div class="prediction-item" style="background: var(--bg-hover); border: 1px solid ${idx === 0 ? 'var(--accent-primary)' : 'var(--border-subtle)'}; padding: 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; ${idx === 0 ? 'box-shadow: 0 0 15px rgba(26, 212, 184, 0.1);' : ''}">
                         <div>
                             <span style="font-weight: 600; color: ${idx === 0 ? 'var(--accent-primary)' : 'var(--text-primary)'}">${item.label}</span>
                             ${idx === 0 ? '<span style="font-size: 0.7rem; background: var(--accent-primary); color: #000; padding: 2px 6px; border-radius: 10px; margin-left: 8px; vertical-align: middle;">Meilleur Match</span>' : ''}
                         </div>
                         <span style="font-family: monospace; font-weight: 700; color: var(--accent-primary);">${item.confidence}%</span>
                     </div>
                 `).join('');
                 
                 res.innerHTML += `
                     <p class="text-xs text-muted mt-6 text-center">Connectez-vous pour sauvegarder cette analyse dans votre historique.</p>
                     <button class="btn btn-secondary mt-4 w-full" onclick="location.reload()">Nouvelle Analyse</button>
                 `;
             }
             
             res.classList.remove("hidden");
             if (progressContainer) setTimeout(() => progressContainer.classList.add("hidden"), 500);
         } catch(e) {
             clearInterval(interval);
             if (progressContainer) progressContainer.classList.add("hidden");
             await ui.customAlert(e.message, "Erreur");
         } finally {
             btn.disabled = false;
             btn.innerHTML = "Lancer l'analyse";
         }
     });
  }

  window.addEventListener("authStateChanged", () => {
      const isAuth    = window.api.auth.isAuthenticated();
      const loginBtn  = document.getElementById("nav-login-btn");
      const dashBtn   = document.getElementById("nav-dash-btn");
      const logoutBtn = document.getElementById("nav-logout-btn");
      if (!loginBtn) return;
      if (isAuth) {
        loginBtn.classList.add("hidden");
        dashBtn   && dashBtn.classList.remove("hidden");
        logoutBtn && logoutBtn.classList.remove("hidden");
      } else {
        loginBtn.classList.remove("hidden");
        dashBtn   && dashBtn.classList.add("hidden");
        logoutBtn && logoutBtn.classList.add("hidden");
      }
  });
  
  // Trigger event to set initial state
  window.dispatchEvent(new Event('authStateChanged'));

  if (document.getElementById("analyze-section")) {
    initLayout();
    initPrediction();
    initChatbot();
    loadHistory();
  } else {
    initAuth();
  }

  return { ui, showDetail, deleteHistoryEntry, editHistoryEntry, continueChat };

})();

window.app = app;