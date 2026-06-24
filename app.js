const STORAGE_KEY = "store-cashbook-v1";
const FIREBASE_CONFIG_PLACEHOLDER = "PASTE_YOUR_FIREBASE_CONFIG_HERE";
const FIRESTORE_COLLECTION = "quanlycuahang";
const FIRESTORE_DOCUMENT = "shared-state";

let cloudStore = {
  enabled: false,
  ready: false,
  db: null,
  docRef: null,
  unsubscribe: null,
  lastError: null,
  status: "starting"
};

const defaultData = {
  activeStoreId: null,
  stores: []
};

let state = loadCachedState();

const els = {
  storeForm: document.querySelector("#storeForm"),
  storeName: document.querySelector("#storeName"),
  storeList: document.querySelector("#storeList"),
  storeCount: document.querySelector("#storeCount"),
  dashboard: document.querySelector("#dashboard"),
  activeStoreName: document.querySelector("#activeStoreName"),
  deleteStore: document.querySelector("#deleteStore"),
  rangeMode: document.querySelector("#rangeMode"),
  singleDate: document.querySelector("#singleDate"),
  monthDate: document.querySelector("#monthDate"),
  fromDate: document.querySelector("#fromDate"),
  toDate: document.querySelector("#toDate"),
  singleDateField: document.querySelector("#singleDateField"),
  monthField: document.querySelector("#monthField"),
  fromField: document.querySelector("#fromField"),
  toField: document.querySelector("#toField"),
  totalIncome: document.querySelector("#totalIncome"),
  totalExpense: document.querySelector("#totalExpense"),
  balance: document.querySelector("#balance"),
  incomeCategoryCount: document.querySelector("#incomeCategoryCount"),
  expenseCategoryCount: document.querySelector("#expenseCategoryCount"),
  incomeCategories: document.querySelector("#incomeCategories"),
  expenseCategories: document.querySelector("#expenseCategories"),
  incomeReport: document.querySelector("#incomeReport"),
  expenseReport: document.querySelector("#expenseReport"),
  incomeRangeLabel: document.querySelector("#incomeRangeLabel"),
  expenseRangeLabel: document.querySelector("#expenseRangeLabel"),
  entryTable: document.querySelector("#entryTable"),
  entryCount: document.querySelector("#entryCount"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  syncStatus: document.querySelector("#syncStatus"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  tabPanels: document.querySelectorAll("[data-tab-panel]")
};

const today = toDateInputValue(new Date());
els.singleDate.value = today;
els.monthDate.value = today.slice(0, 7);
els.fromDate.value = today;
els.toDate.value = today;

document.querySelectorAll(".category-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = ensureCategory(form.dataset.type, new FormData(form).get("category"));
    if (!category) return;
    form.reset();
    selectCategory(form.dataset.type, category.id);
  });
});

document.querySelectorAll(".entry-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = addEntry(form.dataset.type, new FormData(form));
    if (!saved) return;
    form.querySelector('[name="amount"]').value = "";
    form.querySelector('[name="note"]').value = "";
  });
});

els.storeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.storeName.value.trim();
  if (!name) return;

  const store = {
    id: createId(),
    name,
    categories: {
      income: [],
      expense: []
    },
    entries: []
  };

  state.stores.push(store);
  state.activeStoreId = store.id;
  els.storeName.value = "";
  saveAndRender();
});

els.storeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-store-id]");
  if (!button) return;
  state.activeStoreId = button.dataset.storeId;
  saveAndRender();
});

els.deleteStore.addEventListener("click", () => {
  const store = getActiveStore();
  if (!store) return;
  const ok = window.confirm(`Xóa cửa hàng "${store.name}" và toàn bộ dữ liệu bên trong?`);
  if (!ok) return;
  state.stores = state.stores.filter((item) => item.id !== store.id);
  state.activeStoreId = state.stores[0]?.id || null;
  saveAndRender();
});

els.rangeMode.addEventListener("change", () => {
  updateFilterFields();
  render();
});

[els.singleDate, els.monthDate, els.fromDate, els.toDate].forEach((input) => {
  input.addEventListener("change", render);
});

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

els.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `du-lieu-thu-chi-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importData.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.stores)) throw new Error("Sai cấu trúc dữ liệu");
    state = normalizeState(imported);
    saveAndRender();
  } catch (error) {
    window.alert("Không thể nhập dữ liệu. Vui lòng chọn file JSON đã xuất từ ứng dụng.");
  } finally {
    event.target.value = "";
  }
});

document.addEventListener("click", (event) => {
  const categoryButton = event.target.closest("[data-delete-category]");
  const entryButton = event.target.closest("[data-delete-entry]");
  const editCategoryButton = event.target.closest("[data-edit-category]");
  const editEntryButton = event.target.closest("[data-edit-entry]");

  if (categoryButton) {
    deleteCategory(categoryButton.dataset.type, categoryButton.dataset.deleteCategory);
  }

  if (entryButton) {
    deleteEntry(entryButton.dataset.deleteEntry);
  }

  if (editCategoryButton) {
    editCategory(editCategoryButton.dataset.type, editCategoryButton.dataset.editCategory);
  }

  if (editEntryButton) {
    editEntry(editEntryButton.dataset.editEntry);
  }
});

function loadCachedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : cloneDefaultData();
  } catch (error) {
    return cloneDefaultData();
  }
}

function normalizeState(data) {
  const source = data && typeof data === "object" ? data : cloneDefaultData();
  const stores = (source.stores || []).map((store) => ({
    id: store.id || createId(),
    name: store.name || "Cửa hàng chưa đặt tên",
    categories: {
      income: store.categories?.income || [],
      expense: store.categories?.expense || []
    },
    entries: store.entries || []
  }));

  const activeStoreId = stores.some((store) => store.id === source.activeStoreId)
    ? source.activeStoreId
    : stores[0]?.id || null;

  return { ...source, activeStoreId, stores };
}

function saveAndRender() {
  saveStateToCache();
  render();
  saveStateToCloud();
}

function saveStateToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Cannot write local cache", error);
  }
}

function getFirebaseConfig() {
  const config = window.firebaseAppConfig;
  if (!config || typeof config !== "object") return null;
  if (!config.apiKey || config.apiKey === FIREBASE_CONFIG_PLACEHOLDER) return null;
  if (!config.projectId || config.projectId === FIREBASE_CONFIG_PLACEHOLDER) return null;
  return config;
}

function getFirestorePath() {
  const options = window.appCloudOptions || {};
  return {
    collection: options.collection || FIRESTORE_COLLECTION,
    document: options.document || FIRESTORE_DOCUMENT
  };
}

function initCloudStorage() {
  const config = getFirebaseConfig();

  if (!config) {
    cloudStore.status = "missing-config";
    updateSyncStatus("Chưa cấu hình cloud", "warning");
    return;
  }

  if (!window.firebase?.initializeApp || !window.firebase?.firestore) {
    cloudStore.status = "missing-sdk";
    updateSyncStatus("Không tải được Firebase", "error");
    return;
  }

  try {
    const app = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(config);
    cloudStore.db = window.firebase.firestore(app);
    const path = getFirestorePath();
    cloudStore.docRef = cloudStore.db.collection(path.collection).doc(path.document);
    cloudStore.enabled = true;
    cloudStore.status = "ready";
    updateSyncStatus("Đang tải dữ liệu cloud...", "loading");

    cloudStore.unsubscribe = cloudStore.docRef.onSnapshot(
      (snapshot) => {
        if (!snapshot.exists) {
          saveStateToCloud();
          updateSyncStatus("Đã tạo dữ liệu cloud", "ok");
          return;
        }

        const remote = snapshot.data()?.state || snapshot.data();
        state = normalizeState(remote);
        saveStateToCache();
        render();
        updateSyncStatus("Đã đồng bộ cloud", "ok");
      },
      (error) => {
        cloudStore.lastError = error;
        cloudStore.status = "sync-error";
        updateSyncStatus("Lỗi đồng bộ cloud", "error");
        console.error("Firestore sync error", error);
      }
    );
  } catch (error) {
    cloudStore.lastError = error;
    cloudStore.status = "init-error";
    updateSyncStatus("Lỗi kết nối cloud", "error");
    console.error("Cannot initialize cloud storage", error);
  }
}

async function saveStateToCloud() {
  if (!cloudStore.enabled || !cloudStore.docRef) {
    if (cloudStore.status === "missing-config") {
      updateSyncStatus("Chưa cấu hình cloud", "warning");
    } else if (cloudStore.status === "missing-sdk") {
      updateSyncStatus("Không tải được Firebase", "error");
    } else if (cloudStore.status === "starting") {
      updateSyncStatus("Đang khởi tạo cloud...", "loading");
    }
    return;
  }

  try {
    updateSyncStatus("Đang lưu cloud...", "loading");
    await cloudStore.docRef.set(
      {
        state,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    updateSyncStatus("Đã lưu cloud", "ok");
  } catch (error) {
    cloudStore.lastError = error;
    updateSyncStatus("Lưu cloud thất bại", "error");
    console.error("Cannot save cloud state", error);
  }
}

function updateSyncStatus(message, status) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = message;
  els.syncStatus.dataset.status = status;
}

function getActiveStore() {
  return state.stores.find((store) => store.id === state.activeStoreId) || null;
}

function addCategory(type, rawName) {
  const store = getActiveStore();
  const name = String(rawName || "").trim();
  if (!store || !name) return null;

  const exists = store.categories[type].find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    window.alert("Mục này đã tồn tại trong cửa hàng hiện tại.");
    return;
  }

  store.categories[type].push({
    id: createId(),
    name
  });
  saveAndRender();
}

function ensureCategory(type, rawName) {
  const store = getActiveStore();
  const name = String(rawName || "").trim();
  if (!store || !name) return null;

  const existing = store.categories[type].find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    selectCategory(type, existing.id);
    return existing;
  }

  const category = {
    id: createId(),
    name
  };

  store.categories[type].push(category);
  saveAndRender();
  selectCategory(type, category.id);
  return category;
}

function addEntry(type, formData) {
  const store = getActiveStore();
  if (!store) return false;

  let categoryId = formData.get("categoryId");
  const amount = Number(formData.get("amount"));
  const date = formData.get("date");
  const note = String(formData.get("note") || "").trim();

  if (!categoryId) {
    const categoryInput = document.querySelector(`.category-form[data-type="${type}"] [name="category"]`);
    const category = ensureCategory(type, categoryInput?.value);
    if (category) {
      categoryId = category.id;
      categoryInput.value = "";
    }
  }

  if (!categoryId || !date || !Number.isFinite(amount) || amount <= 0) {
    window.alert("Vui lòng chọn mục, ngày và nhập số tiền lớn hơn 0.");
    return;
  }

  store.entries.push({
    id: createId(),
    type,
    categoryId,
    date,
    amount,
    note,
    createdAt: new Date().toISOString()
  });
  saveAndRender();
  return true;
}

function deleteCategory(type, categoryId) {
  const store = getActiveStore();
  if (!store) return;

  const used = store.entries.some((entry) => entry.categoryId === categoryId);
  if (used) {
    window.alert("Mục này đã có dữ liệu thu chi. Hãy xóa các dòng liên quan trước khi xóa mục.");
    return;
  }

  store.categories[type] = store.categories[type].filter((category) => category.id !== categoryId);
  saveAndRender();
}

function editCategory(type, categoryId) {
  const store = getActiveStore();
  if (!store) return;

  const category = store.categories[type].find((item) => item.id === categoryId);
  if (!category) return;

  const nextName = window.prompt("Nhập tên mục mới", category.name);
  if (nextName === null) return;

  const name = nextName.trim();
  if (!name) {
    window.alert("Tên mục không được để trống.");
    return;
  }

  const duplicated = store.categories[type].some((item) => item.id !== categoryId && item.name.toLowerCase() === name.toLowerCase());
  if (duplicated) {
    window.alert("Tên mục này đã tồn tại.");
    return;
  }

  category.name = name;
  saveAndRender();
  selectCategory(type, category.id);
}

function deleteEntry(entryId) {
  const store = getActiveStore();
  if (!store) return;
  store.entries = store.entries.filter((entry) => entry.id !== entryId);
  saveAndRender();
}

function editEntry(entryId) {
  const store = getActiveStore();
  if (!store) return;

  const entry = store.entries.find((item) => item.id === entryId);
  if (!entry) return;

  const currentCategory = store.categories[entry.type].find((item) => item.id === entry.categoryId);
  const categoryName = window.prompt("Nhập mục cho khoản này", currentCategory?.name || "");
  if (categoryName === null) return;

  const category = ensureCategory(entry.type, categoryName);
  if (!category) {
    window.alert("Mục không được để trống.");
    return;
  }

  const nextDate = window.prompt("Nhập ngày theo dạng yyyy-mm-dd", entry.date);
  if (nextDate === null) return;
  if (!isValidDateInput(nextDate.trim())) {
    window.alert("Ngày không hợp lệ. Vui lòng nhập theo dạng yyyy-mm-dd.");
    return;
  }

  const nextName = window.prompt("Nhập tên khoản", entry.note || "");
  if (nextName === null) return;

  const nextAmount = window.prompt("Nhập số tiền", String(entry.amount || ""));
  if (nextAmount === null) return;

  const amount = Number(String(nextAmount).replaceAll(",", "").trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("Số tiền phải lớn hơn 0.");
    return;
  }

  entry.categoryId = category.id;
  entry.date = nextDate.trim();
  entry.note = nextName.trim();
  entry.amount = amount;
  entry.updatedAt = new Date().toISOString();
  saveAndRender();
  selectCategory(entry.type, category.id);
}

function selectCategory(type, categoryId) {
  const select = document.querySelector(`.entry-form[data-type="${type}"] select[name="categoryId"]`);
  if (!select || !categoryId) return;
  select.disabled = false;
  select.value = categoryId;
}

function render() {
  const store = getActiveStore();
  els.storeCount.textContent = state.stores.length;
  renderStores();

  els.dashboard.hidden = !store;
  if (!store) return;

  els.activeStoreName.textContent = store.name;
  setDefaultEntryDates();
  updateFilterFields();
  renderCategoryControls(store, "income");
  renderCategoryControls(store, "expense");
  renderReports(store);
}

function activateTab(tabName) {
  els.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  els.tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === tabName;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

function renderStores() {
  if (!state.stores.length) {
    els.storeList.innerHTML = '<div class="empty-list">Chưa có cửa hàng</div>';
    return;
  }

  els.storeList.innerHTML = state.stores
    .map((store) => {
      const active = store.id === state.activeStoreId ? " active" : "";
      const entryCount = store.entries.length;
      return `
        <button class="store-button${active}" type="button" data-store-id="${store.id}">
          <span class="store-name">${escapeHtml(store.name)}</span>
          <span class="store-meta">${entryCount} dòng</span>
        </button>
      `;
    })
    .join("");
}

function setDefaultEntryDates() {
  document.querySelectorAll('.entry-form input[name="date"]').forEach((input) => {
    if (!input.value) input.value = els.singleDate.value || today;
  });
}

function renderCategoryControls(store, type) {
  const categories = store.categories[type];
  const listEl = type === "income" ? els.incomeCategories : els.expenseCategories;
  const countEl = type === "income" ? els.incomeCategoryCount : els.expenseCategoryCount;
  const select = document.querySelector(`.entry-form[data-type="${type}"] select[name="categoryId"]`);

  countEl.textContent = `${categories.length} mục`;
  select.innerHTML = categories.length
    ? categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("")
    : '<option value="">Chưa có mục</option>';
  select.disabled = !categories.length;
  select.closest("form").querySelector('button[type="submit"]').disabled = !categories.length;

  if (!categories.length) {
    listEl.innerHTML = '<div class="empty-list">Thêm ít nhất một mục để nhập dữ liệu</div>';
    return;
  }

  listEl.innerHTML = categories
    .map((category) => `
      <div class="category-item">
        <span class="category-name">${escapeHtml(category.name)}</span>
        <button class="edit-small" type="button" data-type="${type}" data-edit-category="${category.id}" title="Sửa mục" aria-label="Sửa mục">Sửa</button>
        <button class="delete-small" type="button" data-type="${type}" data-delete-category="${category.id}" title="Xóa mục" aria-label="Xóa mục">×</button>
      </div>
    `)
    .join("");
}

function renderReports(store) {
  const range = getDateRange();
  const entries = store.entries
    .filter((entry) => entry.date >= range.start && entry.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const incomeEntries = entries.filter((entry) => entry.type === "income");
  const expenseEntries = entries.filter((entry) => entry.type === "expense");
  const totalIncome = sumEntries(incomeEntries);
  const totalExpense = sumEntries(expenseEntries);

  els.totalIncome.textContent = formatCurrency(totalIncome);
  els.totalExpense.textContent = formatCurrency(totalExpense);
  els.balance.textContent = formatCurrency(totalIncome - totalExpense);
  els.incomeRangeLabel.textContent = range.label;
  els.expenseRangeLabel.textContent = range.label;
  els.entryCount.textContent = `${entries.length} dòng`;

  renderReportList(els.incomeReport, store.categories.income, incomeEntries);
  renderReportList(els.expenseReport, store.categories.expense, expenseEntries);
  renderEntryTable(store, entries);
}

function renderReportList(container, categories, entries) {
  if (!categories.length) {
    container.innerHTML = '<div class="empty-list">Chưa có mục</div>';
    return;
  }

  const totals = new Map(categories.map((category) => [category.id, 0]));
  entries.forEach((entry) => {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) || 0) + entry.amount);
  });

  container.innerHTML = categories
    .map((category) => `
      <div class="report-item">
        <span class="report-name">${escapeHtml(category.name)}</span>
        <span class="report-amount">${formatCurrency(totals.get(category.id) || 0)}</span>
      </div>
    `)
    .join("");
}

function renderEntryTable(store, entries) {
  if (!entries.length) {
    els.entryTable.innerHTML = '<tr><td colspan="6" class="empty-list">Chưa có dữ liệu trong khoảng thời gian này</td></tr>';
    return;
  }

  els.entryTable.innerHTML = entries
    .map((entry) => {
      const category = store.categories[entry.type].find((item) => item.id === entry.categoryId);
      const typeText = entry.type === "income" ? "Thu" : "Chi";
      return `
        <tr>
          <td>${formatDate(entry.date)}</td>
          <td><span class="type-pill ${entry.type}">${typeText}</span></td>
          <td>${escapeHtml(category?.name || "Mục đã xóa")}</td>
          <td>${escapeHtml(entry.note || "")}</td>
          <td class="amount-cell">${formatCurrency(entry.amount)}</td>
          <td>
            <button class="edit-small" type="button" data-edit-entry="${entry.id}" title="Sửa dòng" aria-label="Sửa dòng">Sửa</button>
            <button class="delete-small" type="button" data-delete-entry="${entry.id}" title="Xóa dòng" aria-label="Xóa dòng">×</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function updateFilterFields() {
  const mode = els.rangeMode.value;
  els.singleDateField.hidden = mode === "month" || mode === "custom";
  els.monthField.hidden = mode !== "month";
  els.fromField.hidden = mode !== "custom";
  els.toField.hidden = mode !== "custom";
}

function getDateRange() {
  const mode = els.rangeMode.value;

  if (mode === "month") {
    const month = els.monthDate.value || today.slice(0, 7);
    const start = `${month}-01`;
    const end = toDateInputValue(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    return { start, end, label: `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}` };
  }

  if (mode === "custom") {
    let start = els.fromDate.value || today;
    let end = els.toDate.value || start;
    if (start > end) [start, end] = [end, start];
    return { start, end, label: `${formatDate(start)} - ${formatDate(end)}` };
  }

  const date = els.singleDate.value || today;
  if (mode === "week") {
    const base = parseDateInput(date);
    const day = base.getDay() || 7;
    const startDate = new Date(base);
    startDate.setDate(base.getDate() - day + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const start = toDateInputValue(startDate);
    const end = toDateInputValue(endDate);
    return { start, end, label: `${formatDate(start)} - ${formatDate(end)}` };
  }

  return { start: date, end: date, label: formatDate(date) };
}

function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateInput(value);
  return toDateInputValue(date) === value;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultData));
}

render();
initCloudStorage();
