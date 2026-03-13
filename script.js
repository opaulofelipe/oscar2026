const STORAGE_KEY = "oscar_bolao_data_v1";
const EXCEL_FILE = "indicados.xlsx";
const INTRO_DURATION = 8000;

const state = {
  categories: [],
  predictions: [],
  realWinners: {}
};

const el = {
  introScreen: document.getElementById("intro-screen"),
  appShell: document.getElementById("app-shell"),
  predictionForm: document.getElementById("prediction-form"),
  participantName: document.getElementById("participant-name"),
  categoriesContainer: document.getElementById("categories-container"),
  winnersContainer: document.getElementById("winners-container"),
  winnersForm: document.getElementById("winners-form"),
  rankingContent: document.getElementById("ranking-content"),
  participantsContent: document.getElementById("participants-content"),
  summaryCategories: document.getElementById("summary-categories"),
  summaryParticipants: document.getElementById("summary-participants"),
  summaryWinners: document.getElementById("summary-winners"),
  openWinnersBtn: document.getElementById("open-winners-btn"),
  openRankingBtn: document.getElementById("open-ranking-btn"),
  openParticipantsBtn: document.getElementById("open-participants-btn"),
  clearFormBtn: document.getElementById("clear-form-btn"),
  resetWinnersBtn: document.getElementById("reset-winners-btn"),
  deleteAllPredictionsBtn: document.getElementById("delete-all-predictions-btn"),
  exportJsonBtn: document.getElementById("export-json-btn"),
  importJsonInput: document.getElementById("import-json-input"),
  toast: document.getElementById("toast"),
  rankingModal: document.getElementById("ranking-modal"),
  participantsModal: document.getElementById("participants-modal"),
  winnersModal: document.getElementById("winners-modal")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  startIntro();
  loadLocalState();
  bindEvents();

  try {
    await loadExcelFromRoot();
    renderPredictionCategories();
    renderWinnersCategories();
    renderRanking();
    renderParticipants();
    updateSummary();
  } catch (error) {
    console.error(error);
    el.categoriesContainer.innerHTML = `
      <div class="empty-state">
        Não foi possível carregar <strong>${EXCEL_FILE}</strong> na raiz do projeto.<br><br>
        Verifique se o arquivo existe e se você abriu o app com servidor local.
      </div>
    `;
    el.winnersContainer.innerHTML = `
      <div class="empty-state">
        As categorias dos vencedores só aparecem quando a planilha é carregada.
      </div>
    `;
    el.participantsContent.innerHTML = `
      <div class="empty-state">
        A lista de participantes aparece quando houver dados salvos.
      </div>
    `;
    showToast(`Erro ao carregar ${EXCEL_FILE}.`);
    updateSummary();
  }
}

function startIntro() {
  setTimeout(() => {
    el.introScreen.classList.add("hidden");
    el.appShell.classList.remove("hidden");
  }, INTRO_DURATION);
}

function bindEvents() {
  el.predictionForm.addEventListener("submit", handleSavePrediction);
  el.winnersForm.addEventListener("submit", handleSaveRealWinners);

  el.openWinnersBtn.addEventListener("click", () => openModal(el.winnersModal));

  el.openRankingBtn.addEventListener("click", () => {
    renderRanking();
    openModal(el.rankingModal);
  });

  el.openParticipantsBtn.addEventListener("click", () => {
    renderParticipants();
    openModal(el.participantsModal);
  });

  el.clearFormBtn.addEventListener("click", clearPredictionForm);
  el.resetWinnersBtn.addEventListener("click", resetRealWinners);
  el.deleteAllPredictionsBtn.addEventListener("click", deleteAllPredictions);
  el.exportJsonBtn.addEventListener("click", exportJsonBackup);
  el.importJsonInput.addEventListener("change", importJsonBackup);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-close-modal");
      const modal = document.getElementById(modalId);
      if (modal) closeModal(modal);
    });
  });
}

async function loadExcelFromRoot() {
  const response = await fetch(EXCEL_FILE, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Falha ao buscar ${EXCEL_FILE}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const parsed = parseWorksheet(worksheet);

  if (!parsed.length) {
    throw new Error("A planilha não possui categorias válidas.");
  }

  state.categories = parsed;

  if (!state.realWinners || typeof state.realWinners !== "object") {
    state.realWinners = {};
  }

  state.predictions = Array.isArray(state.predictions)
    ? state.predictions.map((entry) => sanitizePrediction(entry))
    : [];

  saveLocalState();
}

function parseWorksheet(worksheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  const categories = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const headerCellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const headerCell = worksheet[headerCellAddress];

    if (!headerCell || !String(headerCell.v).trim()) continue;

    const categoryName = String(headerCell.v).trim();
    const options = [];

    for (let row = 1; row <= range.e.r; row++) {
      const optionCellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const optionCell = worksheet[optionCellAddress];

      if (!optionCell || optionCell.v === undefined || optionCell.v === null) continue;

      const optionValue = String(optionCell.v).trim();
      if (optionValue) options.push(optionValue);
    }

    if (options.length) {
      categories.push({
        id: slugify(categoryName),
        name: categoryName,
        options
      });
    }
  }

  return categories;
}

function sanitizePrediction(entry) {
  return {
    name: typeof entry?.name === "string" ? entry.name.trim() : "",
    picks: typeof entry?.picks === "object" && entry?.picks ? entry.picks : {},
    createdAt: entry?.createdAt || new Date().toISOString()
  };
}

function renderPredictionCategories() {
  if (!state.categories.length) {
    el.categoriesContainer.innerHTML = `<div class="empty-state">Nenhuma categoria encontrada.</div>`;
    return;
  }

  el.categoriesContainer.innerHTML = state.categories
    .map((category) => {
      const optionsHtml = category.options
        .map((option) => `
          <label class="option-label">
            <input type="radio" name="category-${escapeHtml(category.id)}" value="${escapeHtml(option)}">
            <span class="option-text">${escapeHtml(option)}</span>
          </label>
        `)
        .join("");

      return `
        <section class="category-card">
          <h3 class="category-title">${escapeHtml(category.name)}</h3>
          <div class="options-grid">${optionsHtml}</div>
        </section>
      `;
    })
    .join("");
}

function renderWinnersCategories() {
  if (!state.categories.length) {
    el.winnersContainer.innerHTML = `<div class="empty-state">Nenhuma categoria disponível.</div>`;
    return;
  }

  el.winnersContainer.innerHTML = state.categories
    .map((category) => {
      const currentWinner = state.realWinners[category.id] || "";

      const optionsHtml = category.options
        .map((option) => `
          <label class="option-label">
            <input
              type="radio"
              name="winner-${escapeHtml(category.id)}"
              value="${escapeHtml(option)}"
              ${currentWinner === option ? "checked" : ""}
            >
            <span class="option-text">${escapeHtml(option)}</span>
          </label>
        `)
        .join("");

      return `
        <section class="category-card">
          <h3 class="category-title">${escapeHtml(category.name)}</h3>
          <div class="options-grid">${optionsHtml}</div>
        </section>
      `;
    })
    .join("");
}

function handleSavePrediction(event) {
  event.preventDefault();

  const name = el.participantName.value.trim();

  if (!name) {
    showToast("Digite seu nome.");
    return;
  }

  const picks = {};

  for (const category of state.categories) {
    const checked = document.querySelector(`input[name="category-${cssEscape(category.id)}"]:checked`);
    if (checked) {
      picks[category.id] = checked.value;
    }
  }

  if (Object.keys(picks).length !== state.categories.length) {
    showToast("Escolha uma opção em todas as categorias.");
    return;
  }

  const existingIndex = state.predictions.findIndex(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );

  const payload = {
    name,
    picks,
    createdAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    state.predictions[existingIndex] = payload;
    showToast("Palpite atualizado com sucesso.");
  } else {
    state.predictions.push(payload);
    showToast("Palpite salvo com sucesso.");
  }

  saveLocalState();
  updateSummary();
  renderRanking();
  renderParticipants();
  clearPredictionForm();
}

function handleSaveRealWinners(event) {
  event.preventDefault();

  const winners = {};

  for (const category of state.categories) {
    const checked = document.querySelector(`input[name="winner-${cssEscape(category.id)}"]:checked`);
    if (checked) {
      winners[category.id] = checked.value;
    }
  }

  state.realWinners = winners;
  saveLocalState();
  updateSummary();
  renderRanking();
  renderWinnersCategories();
  closeModal(el.winnersModal);
  showToast("Reais vencedores salvos.");
}

function computeScore(prediction) {
  let score = 0;

  for (const category of state.categories) {
    const realWinner = state.realWinners[category.id];
    const picked = prediction.picks[category.id];

    if (realWinner && picked && realWinner === picked) {
      score += 1;
    }
  }

  return score;
}

function renderRanking() {
  if (!state.predictions.length) {
    el.rankingContent.innerHTML = `<div class="empty-state">Ainda não há palpites salvos.</div>`;
    return;
  }

  const ranking = [...state.predictions]
    .map((prediction) => ({
      ...prediction,
      score: computeScore(prediction)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  el.rankingContent.innerHTML = `
    <div class="ranking-list">
      ${ranking.map((item, index) => `
        <div class="ranking-item">
          <div class="ranking-left">
            <div class="ranking-position">${index + 1}</div>
            <div class="ranking-name">${escapeHtml(item.name)}</div>
          </div>
          <div class="ranking-score">${item.score} acerto(s)</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderParticipants() {
  if (!state.predictions.length) {
    el.participantsContent.innerHTML = `<div class="empty-state">Ainda não há participantes salvos.</div>`;
    return;
  }

  const participants = [...state.predictions]
    .map((prediction) => ({
      name: prediction.name,
      markedCount: countMarkedCategories(prediction)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  el.participantsContent.innerHTML = `
    <div class="participants-list">
      ${participants.map((item, index) => `
        <div class="participant-item">
          <div class="participant-left">
            <div class="participant-position">${index + 1}</div>
            <div class="participant-name">${escapeHtml(item.name)}</div>
          </div>
          <div class="participant-count">${item.markedCount} categoria(s)</div>
        </div>
      `).join("")}
    </div>
  `;
}

function countMarkedCategories(prediction) {
  let count = 0;

  for (const category of state.categories) {
    if (prediction.picks && prediction.picks[category.id]) {
      count += 1;
    }
  }

  return count;
}

function updateSummary() {
  el.summaryCategories.textContent = state.categories.length;
  el.summaryParticipants.textContent = state.predictions.length;
  el.summaryWinners.textContent = Object.keys(state.realWinners).length;
}

function clearPredictionForm() {
  el.predictionForm.reset();
}

function resetRealWinners() {
  const confirmed = window.confirm("Tem certeza que deseja resetar os reais vencedores?");
  if (!confirmed) return;

  state.realWinners = {};
  saveLocalState();
  renderWinnersCategories();
  renderRanking();
  updateSummary();
  showToast("Reais vencedores resetados.");
}

function deleteAllPredictions() {
  const confirmed = window.confirm("Tem certeza que deseja apagar todos os palpites?");
  if (!confirmed) return;

  state.predictions = [];
  saveLocalState();
  renderRanking();
  renderParticipants();
  updateSummary();
  showToast("Todos os palpites foram apagados.");
}

function exportJsonBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    predictions: state.predictions,
    realWinners: state.realWinners
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "oscar-bolao-backup.json";
  a.click();
  URL.revokeObjectURL(url);

  showToast("JSON exportado com sucesso.");
}

function importJsonBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!Array.isArray(data.predictions) || typeof data.realWinners !== "object") {
        throw new Error("Formato inválido.");
      }

      state.predictions = data.predictions.map((entry) => sanitizePrediction(entry));
      state.realWinners = data.realWinners || {};

      saveLocalState();
      renderWinnersCategories();
      renderRanking();
      renderParticipants();
      updateSummary();
      showToast("JSON importado com sucesso.");
    } catch (error) {
      console.error(error);
      showToast("Falha ao importar JSON.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.toast.classList.add("hidden");
  }, 2600);
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    state.predictions = Array.isArray(parsed.predictions)
      ? parsed.predictions.map((entry) => sanitizePrediction(entry))
      : [];

    state.realWinners = typeof parsed.realWinners === "object" && parsed.realWinners
      ? parsed.realWinners
      : {};
  } catch (error) {
    console.error("Erro ao carregar storage:", error);
  }
}

function saveLocalState() {
  const payload = {
    predictions: state.predictions,
    realWinners: state.realWinners
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
