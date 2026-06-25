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
  renameStore: document.querySelector("#renameStore"),
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
  incomeEntryTable: document.querySelector("#incomeEntryTable"),
  expenseEntryTable: document.querySelector("#expenseEntryTable"),
  incomeEntryCount: document.querySelector("#incomeEntryCount"),
  expenseEntryCount: document.querySelector("#expenseEntryCount"),
  incomeHistoryFilter: document.querySelector("#incomeHistoryFilter"),
  expenseHistoryFilter: document.querySelector("#expenseHistoryFilter"),
  incomeNoteSuggestions: document.querySelector("#incomeNoteSuggestions"),
  expenseNoteSuggestions: document.querySelector("#expenseNoteSuggestions"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  syncStatus: document.querySelector("#syncStatus"),
  tabBar: document.querySelector("#tabBar"),
  tabSpacer: document.querySelector("#tabSpacer"),
  editEntryModal: document.querySelector("#editEntryModal"),
  editEntryForm: document.querySelector("#editEntryForm"),
  editEntryType: document.querySelector("#editEntryType"),
  editEntryCategory: document.querySelector("#editEntryCategory"),
  editEntryAmount: document.querySelector("#editEntryAmount"),
  cancelEditEntry: document.querySelector("#cancelEditEntry"),
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
    entries: [],
    createdAt: new Date().toISOString()
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

els.renameStore.addEventListener("click", () => {
  const store = getActiveStore();
  if (!store) return;

  const nextName = window.prompt("Nhập tên cửa hàng mới", store.name);
  if (nextName === null) return;

  const name = nextName.trim();
  if (!name) {
    window.alert("Tên cửa hàng không được để trống.");
    return;
  }

  const duplicated = state.stores.some((item) => item.id !== store.id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicated) {
    window.alert("Tên cửa hàng này đã tồn tại.");
    return;
  }

  store.name = name;
  store.updatedAt = new Date().toISOString();
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
  syncQuickRangeInputs();
  updateFilterFields();
  render();
});

els.singleDate.addEventListener("change", () => {
  els.rangeMode.value = "day";
  updateFilterFields();
  render();
});

els.monthDate.addEventListener("change", () => {
  els.rangeMode.value = "month";
  updateFilterFields();
  render();
});

[els.fromDate, els.toDate].forEach((input) => {
  input.addEventListener("change", () => {
    els.rangeMode.value = "custom";
    updateFilterFields();
    render();
  });
});

[els.incomeHistoryFilter, els.expenseHistoryFilter].forEach((select) => {
  select.addEventListener("change", render);
});

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

window.addEventListener("scroll", updatePinnedTabs, { passive: true });
window.addEventListener("resize", updatePinnedTabs);

document.querySelectorAll('.entry-form input[name="amount"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.value = formatAmountInput(input.value);
  });
});

document.querySelectorAll('.entry-form input[name="note"]').forEach((input) => {
  input.addEventListener("input", () => applyEntrySuggestion(input.closest(".entry-form")));
  input.addEventListener("change", () => applyEntrySuggestion(input.closest(".entry-form")));
});

els.editEntryAmount.addEventListener("input", () => {
  els.editEntryAmount.value = formatAmountInput(els.editEntryAmount.value);
});

els.cancelEditEntry.addEventListener("click", closeEditEntryModal);

els.editEntryModal.addEventListener("click", (event) => {
  if (event.target === els.editEntryModal) closeEditEntryModal();
});

els.editEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedEntry(new FormData(els.editEntryForm));
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
    entries: store.entries || [],
    createdAt: store.createdAt || getEarliestEntryDate(store.entries || []) || today
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
  const amount = parseAmountInput(formData.get("amount"));
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

  openEditEntryModal(store, entry);
}

function openEditEntryModal(store, entry) {
  const categories = store.categories[entry.type] || [];
  els.editEntryForm.elements.entryId.value = entry.id;
  els.editEntryType.textContent = entry.type === "income" ? "Khoản thu" : "Khoản chi";
  els.editEntryCategory.innerHTML = categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");
  els.editEntryCategory.value = entry.categoryId;
  els.editEntryForm.elements.date.value = entry.date;
  els.editEntryForm.elements.note.value = entry.note || "";
  els.editEntryForm.elements.amount.value = formatAmountInput(entry.amount);
  els.editEntryModal.hidden = false;
  els.editEntryCategory.focus();
}

function closeEditEntryModal() {
  els.editEntryModal.hidden = true;
  els.editEntryForm.reset();
}

function saveEditedEntry(formData) {
  const store = getActiveStore();
  if (!store) return;

  const entryId = formData.get("entryId");
  const entry = store.entries.find((item) => item.id === entryId);
  if (!entry) return;

  const categoryId = formData.get("categoryId");
  const nextDate = String(formData.get("date") || "").trim();
  const nextName = String(formData.get("note") || "").trim();
  const amount = parseAmountInput(formData.get("amount"));

  if (!categoryId) {
    window.alert("Vui lòng chọn mục.");
    return;
  }

  if (!isValidDateInput(nextDate)) {
    window.alert("Ngày không hợp lệ.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("Số tiền phải lớn hơn 0.");
    return;
  }

  entry.categoryId = categoryId;
  entry.date = nextDate;
  entry.note = nextName;
  entry.amount = amount;
  entry.updatedAt = new Date().toISOString();
  saveAndRender();
  selectCategory(entry.type, categoryId);
  closeEditEntryModal();
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
  if (!store) {
    resetPinnedTabs();
    return;
  }

  els.activeStoreName.textContent = store.name;
  setDefaultEntryDates();
  updateFilterFields();
  renderCategoryControls(store, "income");
  renderCategoryControls(store, "expense");
  renderEntrySuggestions(store);
  renderHistoryFilters(store);
  renderReports(store);
  els.tabBar.dataset.pinTop = "";
  updatePinnedTabs();
}

function renderHistoryFilters(store) {
  renderHistoryFilter(els.incomeHistoryFilter, store.categories.income);
  renderHistoryFilter(els.expenseHistoryFilter, store.categories.expense);
}

function renderEntrySuggestions(store) {
  renderEntrySuggestionList(els.incomeNoteSuggestions, getEntrySuggestions(store, "income"));
  renderEntrySuggestionList(els.expenseNoteSuggestions, getEntrySuggestions(store, "expense"));
}

function renderEntrySuggestionList(container, suggestions) {
  if (!container) return;

  container.innerHTML = suggestions
    .map((suggestion) => {
      const amount = formatAmountInput(suggestion.amount);
      return `<option value="${escapeHtml(suggestion.note)}" label="${escapeHtml(`${suggestion.note} - ${amount} đ`)}"></option>`;
    })
    .join("");
}

function getEntrySuggestions(store, type) {
  const suggestions = new Map();
  [...store.entries]
    .filter((entry) => entry.type === type && String(entry.note || "").trim())
    .sort((a, b) => String(b.updatedAt || b.createdAt || b.date || "").localeCompare(String(a.updatedAt || a.createdAt || a.date || "")))
    .forEach((entry) => {
      const note = String(entry.note || "").trim();
      const key = note.toLowerCase();
      if (!suggestions.has(key)) {
        suggestions.set(key, {
          note,
          amount: Number(entry.amount || 0)
        });
      }
    });

  return [...suggestions.values()].sort((a, b) => a.note.localeCompare(b.note, "vi"));
}

function applyEntrySuggestion(form) {
  const store = getActiveStore();
  if (!store || !form) return;

  const noteInput = form.querySelector('[name="note"]');
  const amountInput = form.querySelector('[name="amount"]');
  const note = String(noteInput.value || "").trim().toLowerCase();
  if (!note) return;

  const suggestion = getEntrySuggestions(store, form.dataset.type).find((item) => item.note.toLowerCase() === note);
  if (!suggestion) return;

  amountInput.value = formatAmountInput(suggestion.amount);
}

function renderHistoryFilter(select, categories) {
  if (!select) return;

  const currentValue = select.value || "all";
  select.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
  ].join("");

  const stillExists = currentValue === "all" || categories.some((category) => category.id === currentValue);
  select.value = stillExists ? currentValue : "all";
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
  updatePinnedTabs();
}

function updatePinnedTabs() {
  if (!els.tabBar || !els.tabSpacer || els.dashboard.hidden) return;

  if (!els.tabBar.dataset.pinTop) {
    const initialTop = els.tabSpacer.getBoundingClientRect().top + window.scrollY;
    els.tabBar.dataset.pinTop = String(initialTop);
  }

  const pinTop = Number(els.tabBar.dataset.pinTop || 0);
  const shouldPin = window.scrollY >= pinTop;
  const widthSource = els.tabSpacer.parentElement?.getBoundingClientRect();

  els.tabBar.classList.toggle("is-fixed", shouldPin);
  els.tabSpacer.style.height = shouldPin ? `${els.tabBar.offsetHeight}px` : "0px";

  if (shouldPin && widthSource) {
    els.tabBar.style.left = `${widthSource.left}px`;
    els.tabBar.style.width = `${widthSource.width}px`;
  } else {
    els.tabBar.style.left = "";
    els.tabBar.style.width = "";
  }
}

function resetPinnedTabs() {
  if (!els.tabBar || !els.tabSpacer) return;
  els.tabBar.classList.remove("is-fixed");
  els.tabBar.style.left = "";
  els.tabBar.style.width = "";
  els.tabBar.dataset.pinTop = "";
  els.tabSpacer.style.height = "0px";
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
  const filteredIncomeEntries = filterEntriesByCategory(incomeEntries, els.incomeHistoryFilter?.value);
  const filteredExpenseEntries = filterEntriesByCategory(expenseEntries, els.expenseHistoryFilter?.value);
  const totalIncome = sumEntries(incomeEntries);
  const totalExpense = sumEntries(expenseEntries);

  els.totalIncome.textContent = formatCurrency(totalIncome);
  els.totalExpense.textContent = formatCurrency(totalExpense);
  els.balance.textContent = formatCurrency(totalIncome - totalExpense);
  els.incomeRangeLabel.textContent = range.label;
  els.expenseRangeLabel.textContent = range.label;
  els.incomeEntryCount.textContent = `${filteredIncomeEntries.length} dòng`;
  els.expenseEntryCount.textContent = `${filteredExpenseEntries.length} dòng`;

  renderReportList(els.incomeReport, store.categories.income, incomeEntries);
  renderReportList(els.expenseReport, store.categories.expense, expenseEntries);
  renderEntryTable(els.incomeEntryTable, store, filteredIncomeEntries);
  renderEntryTable(els.expenseEntryTable, store, filteredExpenseEntries);
}

function filterEntriesByCategory(entries, categoryId) {
  if (!categoryId || categoryId === "all") return entries;
  return entries.filter((entry) => entry.categoryId === categoryId);
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

  const totalAmount = sumEntries(entries);
  const categoryRows = categories
    .map((category) => `
      <div class="report-item">
        <span class="report-name">${escapeHtml(category.name)}</span>
        <span class="report-amount">${formatCurrency(totals.get(category.id) || 0)}</span>
      </div>
    `)
    .join("");

  container.innerHTML = `
    <div class="report-item report-total">
      <span class="report-name">Tổng cộng</span>
      <span class="report-amount">${formatCurrency(totalAmount)}</span>
    </div>
    ${categoryRows}
  `;
}

function renderEntryTable(container, store, entries) {
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = '<tr><td colspan="5" class="empty-list">Chưa có dữ liệu trong khoảng thời gian này</td></tr>';
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const category = store.categories[entry.type].find((item) => item.id === entry.categoryId);
      return `
        <tr>
          <td>${formatDate(entry.date)}</td>
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
  els.singleDateField.hidden = false;
  els.monthField.hidden = false;
  els.fromField.hidden = mode !== "custom";
  els.toField.hidden = mode !== "custom";
}

function syncQuickRangeInputs() {
  const mode = els.rangeMode.value;

  if (mode === "today") {
    els.singleDate.value = today;
  }

  if (mode === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    els.singleDate.value = toDateInputValue(date);
  }

  if (mode === "this-month") {
    els.monthDate.value = today.slice(0, 7);
  }

  if (mode === "last-month") {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    els.monthDate.value = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  }
}

function getDateRange() {
  const mode = els.rangeMode.value;
  const store = getActiveStore();

  if (mode === "all") {
    const start = getStoreStartDate(store);
    return { start, end: today, label: `${formatDate(start)} - ${formatDate(today)}` };
  }

  if (mode === "today") {
    return { start: today, end: today, label: formatDate(today) };
  }

  if (mode === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const value = toDateInputValue(date);
    return { start: value, end: value, label: formatDate(value) };
  }

  if (mode === "this-month") {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const start = `${month}-01`;
    return { start, end: today, label: `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}` };
  }

  if (mode === "last-month") {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const start = `${month}-01`;
    const end = toDateInputValue(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    return { start, end, label: `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}` };
  }

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

function parseAmountInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatAmountInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  }).format(Number(digits));
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

function getStoreStartDate(store) {
  if (!store) return today;
  if (store.createdAt) return String(store.createdAt).slice(0, 10);
  return getEarliestEntryDate(store.entries || []) || today;
}

function getEarliestEntryDate(entries) {
  return entries
    .map((entry) => entry.date)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))[0] || null;
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
