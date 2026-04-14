// ═══════════════════════════════════════════
// 🔧 CONFIGURAÇÕES
// ═══════════════════════════════════════════
const GEMINI_API_KEY = "AIzaSyBSSK1Rs5XpZ6wc2Rxv9ohCfJMWjb7q63c";

const firebaseConfig = {
  apiKey:            "AIzaSyCHmNKBDToG5GOCwN39w69VAwU8VVkJClU",
  authDomain:        "ef-mineiros.firebaseapp.com",
  projectId:         "ef-mineiros",
  storageBucket:     "ef-mineiros.firebasestorage.app",
  messagingSenderId: "105151034950",
  appId:             "1:105151034950:web:b3c7494bc3b4a8532e7c47"
};

// ═══════════════════════════════════════════
// 🔥 FIREBASE INIT
// ═══════════════════════════════════════════
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ═══════════════════════════════════════════
// 🌐 ESTADO GLOBAL
// ═══════════════════════════════════════════
let currentUser   = null;
let deleteTarget  = { collection: null, id: null };
let iaResultCache = null;

// ═══════════════════════════════════════════
// 🔀 NAVEGAÇÃO ENTRE TELAS
// ═══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === name);
  });

  const titles = {
    dashboard:  "Dashboard",
    planos:     "Planos de Aula",
    atividades: "Banco de Atividades",
    ia:         "Sugestão com IA"
  };
  document.getElementById("page-title").textContent = titles[name] || name;
}

// ═══════════════════════════════════════════
// 🍞 TOAST
// ═══════════════════════════════════════════
function showToast(msg, type, duration) {
  type     = type     || "info";
  duration = duration || 3000;
  const toast = document.getElementById("toast");
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  toast.textContent = (icons[type] || "") + " " + msg;
  toast.className   = "toast " + type;
  setTimeout(function() { toast.className = "toast hidden"; }, duration);
}

// ═══════════════════════════════════════════
// 🗂️ MODAIS
// ═══════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden");    }

document.querySelectorAll(".modal-close").forEach(function(btn) {
  btn.addEventListener("click", function() { closeModal(btn.dataset.modal); });
});

document.querySelectorAll(".modal-overlay").forEach(function(overlay) {
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ═══════════════════════════════════════════
// 🔐 AUTH — LOGIN / CADASTRO / LOGOUT
// ═══════════════════════════════════════════
document.getElementById("btn-go-register").addEventListener("click", function(e) {
  e.preventDefault();
  showScreen("screen-register");
});

document.getElementById("btn-go-login").addEventListener("click", function(e) {
  e.preventDefault();
  showScreen("screen-login");
});

document.getElementById("form-login").addEventListener("submit", async function(e) {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showToast(translateAuthError(err.code), "error");
  }
});

document.getElementById("form-register").addEventListener("submit", async function(e) {
  e.preventDefault();
  const name     = document.getElementById("register-name").value.trim();
  const email    = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection("users").doc(cred.user.uid).set({
      name:      name,
      email:     email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Conta criada com sucesso!", "success");
  } catch (err) {
    showToast(translateAuthError(err.code), "error");
  }
});

document.getElementById("btn-logout").addEventListener("click", async function() {
  await auth.signOut();
});

auth.onAuthStateChanged(function(user) {
  if (user) {
    currentUser = user;
    document.getElementById("user-name-display").textContent =
      user.displayName || user.email.split("@")[0];
    showScreen("screen-app");
    showPage("dashboard");
    loadDashboard();
    loadPlanos();
    loadAtividades();
  } else {
    currentUser = null;
    showScreen("screen-login");
  }
});

function translateAuthError(code) {
  const map = {
    "auth/user-not-found":       "Usuário não encontrado.",
    "auth/wrong-password":       "Senha incorreta.",
    "auth/email-already-in-use": "E-mail já cadastrado.",
    "auth/weak-password":        "Senha muito fraca (mín. 6 caracteres).",
    "auth/invalid-email":        "E-mail inválido.",
    "auth/invalid-credential":   "Credenciais inválidas."
  };
  return map[code] || "Erro ao autenticar. Tente novamente.";
}

// ═══════════════════════════════════════════
// 🧭 SIDEBAR & TOPBAR
// ═══════════════════════════════════════════
document.getElementById("btn-toggle-sidebar").addEventListener("click", function() {
  const sidebar = document.getElementById("sidebar");
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("mobile-open");
  } else {
    sidebar.classList.toggle("collapsed");
  }
});

document.querySelectorAll(".nav-item").forEach(function(item) {
  item.addEventListener("click", function(e) {
    e.preventDefault();
    showPage(item.dataset.page);
    if (window.innerWidth <= 768) {
      document.getElementById("sidebar").classList.remove("mobile-open");
    }
  });
});

document.querySelectorAll(".dash-card[data-page]").forEach(function(card) {
  card.addEventListener("click", function() { showPage(card.dataset.page); });
});

// ═══════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════
async function loadDashboard() {
  if (!currentUser) return;

  const results = await Promise.all([
    db.collection("planos").where("uid", "==", currentUser.uid).get(),
    db.collection("atividades").where("uid", "==", currentUser.uid).get()
  ]);

  const planosSnap = results[0];
  const ativSnap   = results[1];

  document.getElementById("count-planos").textContent     = planosSnap.size;
  document.getElementById("count-atividades").textContent = ativSnap.size;

  const planos = [];
  planosSnap.forEach(function(d) {
    const obj = d.data();
    obj.id = d.id;
    planos.push(obj);
  });

  planos.sort(function(a, b) {
    const sa = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : 0;
    const sb = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : 0;
    return sb - sa;
  });

  const container = document.getElementById("recent-planos-list");
  if (planos.length === 0) {
    container.innerHTML = '<p class="empty-msg">Nenhum plano criado ainda.</p>';
    return;
  }

  container.innerHTML = planos.slice(0, 5).map(function(p) {
    return '<div class="recent-item" onclick="openEditPlano(\'' + p.id + '\')">' +
      '<div class="recent-item-info">' +
        '<strong>' + p.titulo + '</strong>' +
        '<span>' + p.turma + ' · ' + p.area + (p.data ? ' · ' + formatDate(p.data) : '') + '</span>' +
      '</div>' +
      '<i class="fas fa-chevron-right" style="color:var(--text-muted)"></i>' +
    '</div>';
  }).join("");
}

// ═══════════════════════════════════════════
// 📚 PLANOS DE AULA
// ═══════════════════════════════════════════
let allPlanos = [];

async function loadPlanos() {
  if (!currentUser) return;
  const snap = await db.collection("planos")
    .where("uid", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .get();

  allPlanos = [];
  snap.forEach(function(d) {
    const obj = d.data();
    obj.id = d.id;
    allPlanos.push(obj);
  });
  renderPlanos();
}

function renderPlanos() {
  const turma = document.getElementById("filter-plano-turma").value;
  const busca = document.getElementById("filter-plano-busca").value.toLowerCase();

  const filtered = allPlanos.filter(function(p) {
    const matchTurma = !turma || p.turma === turma;
    const matchBusca = !busca ||
      p.titulo.toLowerCase().includes(busca) ||
      (p.area || "").toLowerCase().includes(busca) ||
      (p.bncc || "").toLowerCase().includes(busca);
    return matchTurma && matchBusca;
  });

  const container = document.getElementById("planos-list");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-msg">Nenhum plano encontrado.</p>';
    return;
  }

  container.innerHTML = filtered.map(function(p) {
    return '<div class="card-item">' +
      '<div class="card-item-header">' +
        '<h4>' + p.titulo + '</h4>' +
        '<div class="card-badges">' +
          '<span class="badge badge-blue">'  + p.turma + '</span>' +
          '<span class="badge badge-gray">'  + p.area  + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-item-body">' +
        (p.bncc ? '<strong>BNCC:</strong> ' + p.bncc + '<br>' : '') +
        (p.objetivo ? truncate(p.objetivo, 100) : 'Sem objetivo definido.') +
      '</div>' +
      (p.data ? '<small style="color:var(--text-muted)">📅 ' + formatDate(p.data) + '</small>' : '') +
      '<div class="card-item-footer">' +
        '<button class="btn-icon-sm pdf" title="Exportar PDF" onclick="exportPDF(\'' + p.id + '\')">' +
          '<i class="fas fa-file-pdf"></i>' +
        '</button>' +
        '<button class="btn-icon-sm edit" title="Editar" onclick="openEditPlano(\'' + p.id + '\')">' +
          '<i class="fas fa-edit"></i>' +
        '</button>' +
        '<button class="btn-icon-sm del" title="Excluir" onclick="confirmDelete(\'planos\',\'' + p.id + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

document.getElementById("filter-plano-turma").addEventListener("change", renderPlanos);
document.getElementById("filter-plano-busca").addEventListener("input",  renderPlanos);

document.getElementById("btn-novo-plano").addEventListener("click", function() {
  clearModalPlano();
  document.getElementById("modal-plano-title").textContent = "Novo Plano de Aula";
  openModal("modal-plano");
});

function clearModalPlano() {
  ["plano-id","plano-titulo","plano-bncc","plano-objetivo",
   "plano-desenvolvimento","plano-recursos","plano-avaliacao"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("plano-data").value  = today();
  document.getElementById("plano-turma").value = "1ANO";
  document.getElementById("plano-area").value  = "Linguagens";
}

function openEditPlano(id) {
  const p = allPlanos.find(function(x) { return x.id === id; });
  if (!p) return;
  document.getElementById("plano-id").value              = p.id;
  document.getElementById("plano-titulo").value          = p.titulo          || "";
  document.getElementById("plano-turma").value           = p.turma           || "1ANO";
  document.getElementById("plano-area").value            = p.area            || "Linguagens";
  document.getElementById("plano-data").value            = p.data            || today();
  document.getElementById("plano-bncc").value            = p.bncc            || "";
  document.getElementById("plano-objetivo").value        = p.objetivo        || "";
  document.getElementById("plano-desenvolvimento").value = p.desenvolvimento || "";
  document.getElementById("plano-recursos").value        = p.recursos        || "";
  document.getElementById("plano-avaliacao").value       = p.avaliacao       || "";
  document.getElementById("modal-plano-title").textContent = "Editar Plano de Aula";
  openModal("modal-plano");
}

document.getElementById("btn-salvar-plano").addEventListener("click", async function() {
  const titulo = document.getElementById("plano-titulo").value.trim();
  const turma  = document.getElementById("plano-turma").value;
  if (!titulo) { showToast("Informe o título do plano.", "error"); return; }

  const data = {
    uid:             currentUser.uid,
    titulo:          titulo,
    turma:           turma,
    area:            document.getElementById("plano-area").value,
    data:            document.getElementById("plano-data").value,
    bncc:            document.getElementById("plano-bncc").value.trim(),
    objetivo:        document.getElementById("plano-objetivo").value.trim(),
    desenvolvimento: document.getElementById("plano-desenvolvimento").value.trim(),
    recursos:        document.getElementById("plano-recursos").value.trim(),
    avaliacao:       document.getElementById("plano-avaliacao").value.trim(),
    updatedAt:       firebase.firestore.FieldValue.serverTimestamp()
  };

  const id = document.getElementById("plano-id").value;
  try {
    if (id) {
      await db.collection("planos").doc(id).update(data);
      showToast("Plano atualizado!", "success");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("planos").add(data);
      showToast("Plano criado!", "success");
    }
    closeModal("modal-plano");
    loadPlanos();
    loadDashboard();
  } catch (err) {
    showToast("Erro ao salvar plano.", "error");
    console.error(err);
  }
});

// ═══════════════════════════════════════════
// 🗂️ BANCO DE ATIVIDADES
// ═══════════════════════════════════════════
let allAtividades = [];

async function loadAtividades() {
  if (!currentUser) return;
  const snap = await db.collection("atividades")
    .where("uid", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .get();

  allAtividades = [];
  snap.forEach(function(d) {
    const obj = d.data();
    obj.id = d.id;
    allAtividades.push(obj);
  });
  renderAtividades();
}

function renderAtividades() {
  const turma = document.getElementById("filter-ativ-turma").value;
  const area  = document.getElementById("filter-ativ-area").value;
  const busca = document.getElementById("filter-ativ-busca").value.toLowerCase();

  const filtered = allAtividades.filter(function(a) {
    const matchTurma = !turma || a.turma === turma;
    const matchArea  = !area  || a.area  === area;
    const matchBusca = !busca ||
      a.titulo.toLowerCase().includes(busca) ||
      (a.descricao || "").toLowerCase().includes(busca);
    return matchTurma && matchArea && matchBusca;
  });

  const container = document.getElementById("atividades-list");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-msg">Nenhuma atividade encontrada.</p>';
    return;
  }

  container.innerHTML = filtered.map(function(a) {
    return '<div class="card-item">' +
      '<div class="card-item-header">' +
        '<h4>' + a.titulo + '</h4>' +
        '<div class="card-badges">' +
          '<span class="badge badge-blue">'  + a.turma + '</span>' +
          '<span class="badge badge-green">' + a.area  + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-item-body">' +
        (a.bncc ? '<strong>BNCC:</strong> ' + a.bncc + '<br>' : '') +
        (a.descricao ? truncate(a.descricao, 100) : 'Sem descrição.') +
      '</div>' +
      (a.materiais ? '<small style="color:var(--text-muted)">🧰 ' + a.materiais + '</small>' : '') +
      '<div class="card-item-footer">' +
        '<button class="btn-icon-sm edit" title="Editar" onclick="openEditAtividade(\'' + a.id + '\')">' +
          '<i class="fas fa-edit"></i>' +
        '</button>' +
        '<button class="btn-icon-sm del" title="Excluir" onclick="confirmDelete(\'atividades\',\'' + a.id + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

document.getElementById("filter-ativ-turma").addEventListener("change", renderAtividades);
document.getElementById("filter-ativ-area").addEventListener("change",  renderAtividades);
document.getElementById("filter-ativ-busca").addEventListener("input",  renderAtividades);

document.getElementById("btn-nova-atividade").addEventListener("click", function() {
  clearModalAtividade();
  document.getElementById("modal-ativ-title").textContent = "Nova Atividade";
  openModal("modal-atividade");
});

function clearModalAtividade() {
  ["ativ-id","ativ-titulo","ativ-bncc","ativ-descricao","ativ-materiais"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("ativ-turma").value = "1ANO";
  document.getElementById("ativ-area").value  = "Linguagens";
}

function openEditAtividade(id) {
  const a = allAtividades.find(function(x) { return x.id === id; });
  if (!a) return;
  document.getElementById("ativ-id").value        = a.id;
  document.getElementById("ativ-titulo").value    = a.titulo    || "";
  document.getElementById("ativ-turma").value     = a.turma     || "1ANO";
  document.getElementById("ativ-area").value      = a.area      || "Linguagens";
  document.getElementById("ativ-bncc").value      = a.bncc      || "";
  document.getElementById("ativ-descricao").value = a.descricao || "";
  document.getElementById("ativ-materiais").value = a.materiais || "";
  document.getElementById("modal-ativ-title").textContent = "Editar Atividade";
  openModal("modal-atividade");
}

document.getElementById("btn-salvar-atividade").addEventListener("click", async function() {
  const titulo = document.getElementById("ativ-titulo").value.trim();
  const turma  = document.getElementById("ativ-turma").value;
  if (!titulo) { showToast("Informe o título da atividade.", "error"); return; }

  const data = {
    uid:       currentUser.uid,
    titulo:    titulo,
    turma:     turma,
    area:      document.getElementById("ativ-area").value,
    bncc:      document.getElementById("ativ-bncc").value.trim(),
    descricao: document.getElementById("ativ-descricao").value.trim(),
    materiais: document.getElementById("ativ-materiais").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const id = document.getElementById("ativ-id").value;
  try {
    if (id) {
      await db.collection("atividades").doc(id).update(data);
      showToast("Atividade atualizada!", "success");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("atividades").add(data);
      showToast("Atividade salva!", "success");
    }
    closeModal("modal-atividade");
    loadAtividades();
    loadDashboard();
  } catch (err) {
    showToast("Erro ao salvar atividade.", "error");
    console.error(err);
  }
});

// ═══════════════════════════════════════════
// 🗑️ EXCLUSÃO
// ═══════════════════════════════════════════
function confirmDelete(collection, id) {
  deleteTarget = { collection: collection, id: id };
  openModal("modal-confirm");
}

document.getElementById("btn-confirm-delete").addEventListener("click", async function() {
  const collection = deleteTarget.collection;
  const id         = deleteTarget.id;
  try {
    await db.collection(collection).doc(id).delete();
    showToast("Item excluído.", "success");
    closeModal("modal-confirm");
    if (collection === "planos") {
      loadPlanos();
    } else {
      loadAtividades();
    }
    loadDashboard();
  } catch (err) {
    showToast("Erro ao excluir.", "error");
    console.error(err);
  }
});

// ═══════════════════════════════════════════
// 🤖 IA — GEMINI
// ═══════════════════════════════════════════
document.getElementById("btn-gerar-ia").addEventListener("click", gerarSugestaoIA);

async function gerarSugestaoIA() {
  const turma    = document.getElementById("ia-turma").value;
  const area     = document.getElementById("ia-area").value;
  const tema     = document.getElementById("ia-tema").value.trim();
  const objetivo = document.getElementById("ia-objetivo").value.trim();

  if (!tema) {
    showToast("Informe o tema ou habilidade BNCC.", "error");
    return;
  }

  const resultDiv = document.getElementById("ia-result");
  resultDiv.innerHTML =
    '<div class="ia-loading">' +
      '<div class="spinner"></div>' +
      '<p>Gerando sugestão com IA...</p>' +
    '</div>';

  const prompt =
    "Você é um especialista em educação infantil e ensino fundamental.\n" +
    "Crie uma sugestão detalhada de atividade pedagógica com as seguintes informações:\n\n" +
    "- Turma: " + turma + "\n" +
    "- Área do Conhecimento: " + area + "\n" +
    "- Tema / Habilidade BNCC: " + tema + "\n" +
    "- Objetivo: " + (objetivo || "Não especificado") + "\n\n" +
    "A resposta deve conter as seguintes seções em HTML simples (use apenas <h4>, <p>, <ul>, <li>, <strong>, <section>):\n" +
    "1. Título da Atividade\n" +
    "2. Objetivo\n" +
    "3. Habilidade BNCC relacionada\n" +
    "4. Materiais necessários\n" +
    "5. Desenvolvimento passo a passo\n" +
    "6. Tempo estimado\n" +
    "7. Avaliação sugerida\n" +
    "8. Dica Extra\n\n" +
    "Responda em português do Brasil, de forma prática e criativa.";

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) throw new Error("HTTP " + response.status);

    const json = await response.json();
    const text = (json.candidates &&
                  json.candidates[0] &&
                  json.candidates[0].content &&
                  json.candidates[0].content.parts &&
                  json.candidates[0].content.parts[0] &&
                  json.candidates[0].content.parts[0].text) ? json.candidates[0].content.parts[0].text : "";

    if (!text) throw new Error("Resposta vazia da IA.");

    const cleaned = text
      .replace(/```html/gi, "")
      .replace(/```/g, "")
      .trim();

    iaResultCache = { turma: turma, area: area, tema: tema, objetivo: objetivo, html: cleaned };

    resultDiv.innerHTML =
      '<div class="ia-result-content">' +
        cleaned +
        '<div class="ia-actions">' +
          '<button class="btn-primary" onclick="salvarAtividadeIA()">' +
            '<i class="fas fa-save"></i> Salvar no Banco' +
          '</button>' +
          '<button class="btn-pdf" onclick="exportPDFIA()">' +
            '<i class="fas fa-file-pdf"></i> Exportar PDF' +
          '</button>' +
          '<button class="btn-secondary" onclick="gerarSugestaoIA()">' +
            '<i class="fas fa-redo"></i> Gerar Novamente' +
          '</button>' +
        '</div>' +
      '</div>';

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML =
      '<div class="ia-result-placeholder">' +
        '<i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i>' +
        '<p>Erro ao conectar com a IA. Verifique sua chave Gemini.<br>' +
        '<small>' + err.message + '</small></p>' +
      '</div>';
  }
}

async function salvarAtividadeIA() {
  if (!iaResultCache || !currentUser) return;
  const el     = document.querySelector(".ia-result-content h3, .ia-result-content h4");
  const titulo = el ? el.textContent : "Atividade gerada por IA";

  try {
    await db.collection("atividades").add({
      uid:       currentUser.uid,
      titulo:    titulo.trim(),
      turma:     iaResultCache.turma,
      area:      iaResultCache.area,
      bncc:      iaResultCache.tema,
      descricao: iaResultCache.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      materiais: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Atividade salva no banco!", "success");
    loadAtividades();
    loadDashboard();
  } catch (err) {
    showToast("Erro ao salvar atividade.", "error");
  }
}

// ═══════════════════════════════════════════
// 📄 EXPORT PDF — PLANO DE AULA
// ═══════════════════════════════════════════
document.getElementById("btn-exportar-pdf").addEventListener("click", function() {
  const id = document.getElementById("plano-id").value;
  if (id) {
    exportPDF(id);
  } else {
    exportPDFFromModal();
  }
});

function exportPDF(id) {
  const p = allPlanos.find(function(x) { return x.id === id; });
  if (!p) return;
  gerarPDFPlano(p);
}

function exportPDFFromModal() {
  const p = {
    titulo:          document.getElementById("plano-titulo").value,
    turma:           document.getElementById("plano-turma").value,
    area:            document.getElementById("plano-area").value,
    data:            document.getElementById("plano-data").value,
    bncc:            document.getElementById("plano-bncc").value,
    objetivo:        document.getElementById("plano-objetivo").value,
    desenvolvimento: document.getElementById("plano-desenvolvimento").value,
    recursos:        document.getElementById("plano-recursos").value,
    avaliacao:       document.getElementById("plano-avaliacao").value
  };
  if (!p.titulo) { showToast("Preencha pelo menos o título.", "error"); return; }
  gerarPDFPlano(p);
}

function gerarPDFPlano(p) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W  = 210;
  const mL = 20;
  const mR = 20;
  const mT = 20;
  const lW = W - mL - mR;
  let   y  = mT;

  // ── CABEÇALHO ──
  doc.setFillColor(21, 87, 176);
  doc.rect(0, 0, W, 36, "F");

  doc.setFillColor(26, 115, 232);
  doc.rect(0, 36, W, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("EduPlan", mL, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Plano de Aula", mL, 24);

  doc.setFontSize(9);
  doc.text(
    "Gerado em " + formatDate(new Date().toISOString().split("T")[0]),
    W - mR, 24, { align: "right" }
  );

  y = 52;

  // ── TÍTULO ──
  doc.setFillColor(232, 240, 254);
  doc.roundedRect(mL, y, lW, 18, 3, 3, "F");
  doc.setTextColor(21, 87, 176);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(p.titulo || "Sem título", mL + 6, y + 12);
  y += 24;

  // ── INFORMAÇÕES RÁPIDAS ──
  const infoItems = [
    ["Turma", p.turma || "-"],
    ["Área",  p.area  || "-"],
    ["Data",  p.data  ? formatDate(p.data) : "-"],
    ["BNCC",  p.bncc  || "-"]
  ];

  const colW = lW / 4;
  const boxH = 20;

  infoItems.forEach(function(item, i) {
    const x = mL + i * colW;

    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }

    doc.setDrawColor(26, 115, 232);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, colW - 2, boxH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(26, 115, 232);
    doc.text(item[0].toUpperCase(), x + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const val = doc.splitTextToSize(item[1], colW - 10);
    doc.text(val[0], x + 4, y + 13);
  });

  y += boxH + 8;

  // ── SEÇÕES ──
  const sections = [
    { label: "Objetivo(s)",                   value: p.objetivo        },
    { label: "Desenvolvimento / Metodologia", value: p.desenvolvimento },
    { label: "Recursos / Materiais",          value: p.recursos        },
    { label: "Avaliação",                     value: p.avaliacao       }
  ];

  sections.forEach(function(sec) {
    if (!sec.value) return;

    if (y > 250) { doc.addPage(); y = mT; }

    doc.setFillColor(26, 115, 232);
    doc.roundedRect(mL, y, lW, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(sec.label.toUpperCase(), mL + 5, y + 5.5);
    y += 10;

    doc.setFillColor(245, 247, 252);
    const lines    = doc.splitTextToSize(sec.value, lW - 10);
    const contentH = lines.length * 5 + 8;

    if (y + contentH > 270) { doc.addPage(); y = mT; }

    doc.roundedRect(mL, y, lW, contentH, 2, 2, "F");
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lines, mL + 5, y + 6);
    y += contentH + 6;
  });

  // ── RODAPÉ ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(21, 87, 176);
    doc.rect(0, 285, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("EduPlan — Planejamento Escolar Inteligente", mL, 292);
    doc.text("Página " + i + " de " + pageCount, W - mR, 292, { align: "right" });
  }

  doc.save(sanitize(p.titulo || "plano") + "_" + (p.turma || "turma") + ".pdf");
  showToast("PDF exportado com sucesso!", "success");
}

// ═══════════════════════════════════════════
// 📄 EXPORT PDF — SUGESTÃO IA
// ═══════════════════════════════════════════
function exportPDFIA() {
  if (!iaResultCache) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W  = 210;
  const mL = 20;
  const mR = 20;
  const lW = W - mL - mR;
  let   y  = 20;

  // Cabeçalho
  doc.setFillColor(21, 87, 176);
  doc.rect(0, 0, W, 36, "F");

  doc.setFillColor(26, 115, 232);
  doc.rect(0, 36, W, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("EduPlan", mL, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Sugestão de Atividade — IA", mL, 24);

  doc.setFontSize(9);
  doc.text(
    "Gerado em " + formatDate(new Date().toISOString().split("T")[0]),
    W - mR, 24, { align: "right" }
  );

  y = 52;

  doc.setFillColor(232, 240, 254);
  doc.roundedRect(mL, y, lW, 14, 3, 3, "F");
  doc.setTextColor(21, 87, 176);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    iaResultCache.turma + "  ·  " + iaResultCache.area + "  ·  " + iaResultCache.tema,
    mL + 6, y + 9
  );
  y += 20;

  const text = iaResultCache.html
    .replace(/<h[1-6][^>]*>/gi,  "\n")
    .replace(/<\/h[1-6]>/gi,     "\n")
    .replace(/<li[^>]*>/gi,      "• ")
    .replace(/<\/li>/gi,         "\n")
    .replace(/<p[^>]*>/gi,       "\n")
    .replace(/<br\s*\/?>/gi,     "\n")
    .replace(/<[^>]+>/g,         "")
    .replace(/\n{3,}/g,          "\n\n")
    .trim();

  const lines = doc.splitTextToSize(text, lW - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  lines.forEach(function(line) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(line, mL, y);
    y += 5;
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(21, 87, 176);
    doc.rect(0, 285, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("EduPlan — Planejamento Escolar Inteligente", mL, 292);
    doc.text("Página " + i + " de " + pageCount, W - mR, 292, { align: "right" });
  }

  doc.save("sugestao_ia_" + sanitize(iaResultCache.tema) + ".pdf");
  showToast("PDF da IA exportado!", "success");
}

// ═══════════════════════════════════════════
// 🛠️ UTILITÁRIOS
// ═══════════════════════════════════════════
function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(str) {
  if (!str) return "";
  const parts = str.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function truncate(str, n) {
  return str.length > n ? str.substring(0, n) + "..." : str;
}

function sanitize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/gi, "_").substring(0, 40);
}
