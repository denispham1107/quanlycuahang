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

const uiState = {
  categoryExpanded: {
    income: false,
    expense: false
  },
  rangeMode: "today",
  inventorySearch: "",
  inventoryFilter: "all",
  inventoryLogsExpanded: false,
  salesGoodsFilter: "all",
  salesDraftId: null
};

const els = {
  storeForm: document.querySelector("#storeForm"),
  storeName: document.querySelector("#storeName"),
  storeList: document.querySelector("#storeList"),
  storeCount: document.querySelector("#storeCount"),
  dashboard: document.querySelector("#dashboard"),
  heroStoreName: document.querySelector("#heroStoreName"),
  heroStoreMeta: document.querySelector("#heroStoreMeta"),
  activeStorePanel: document.querySelector(".toolbar"),
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
  totalSales: document.querySelector("#totalSales"),
  totalExpense: document.querySelector("#totalExpense"),
  balance: document.querySelector("#balance"),
  selectedRangeLabel: document.querySelector("#selectedRangeLabel"),
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
  incomeHistorySearch: document.querySelector("#incomeHistorySearch"),
  expenseHistorySearch: document.querySelector("#expenseHistorySearch"),
  incomeHistorySearchSuggestions: document.querySelector("#incomeHistorySearchSuggestions"),
  expenseHistorySearchSuggestions: document.querySelector("#expenseHistorySearchSuggestions"),
  incomeHistoryFilter: document.querySelector("#incomeHistoryFilter"),
  expenseHistoryFilter: document.querySelector("#expenseHistoryFilter"),
  incomeNoteSuggestions: document.querySelector("#incomeNoteSuggestions"),
  expenseNoteSuggestions: document.querySelector("#expenseNoteSuggestions"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  syncStatus: document.querySelector("#syncStatus"),
  tabBar: document.querySelector("#tabBar"),
  tabSpacer: document.querySelector("#tabSpacer"),
  quickEntryButton: document.querySelector("#quickEntryButton"),
  quickEntryModal: document.querySelector("#quickEntryModal"),
  quickEntryForm: document.querySelector("#quickEntryForm"),
  quickEntryTitle: document.querySelector("#quickEntryTitle"),
  quickEntryFields: document.querySelector("#quickEntryFields"),
  quickEntryCategory: document.querySelector("#quickEntryCategory"),
  quickEntryDate: document.querySelector("#quickEntryDate"),
  quickEntryNote: document.querySelector("#quickEntryNote"),
  quickEntryAmount: document.querySelector("#quickEntryAmount"),
  quickEntrySuggestions: document.querySelector("#quickEntrySuggestions"),
  salesOrderFields: document.querySelector("#salesOrderFields"),
  salesCustomerName: document.querySelector("#salesCustomerName"),
  salesCustomerPhone: document.querySelector("#salesCustomerPhone"),
  salesOrderDate: document.querySelector("#salesOrderDate"),
  salesItems: document.querySelector("#salesItems"),
  addSalesItem: document.querySelector("#addSalesItem"),
  salesOrderTotal: document.querySelector("#salesOrderTotal"),
  salesItemSuggestions: document.querySelector("#salesItemSuggestions"),
  salesOrderCount: document.querySelector("#salesOrderCount"),
  salesDraftList: document.querySelector("#salesDraftList"),
  salesGoodsFilter: document.querySelector("#salesGoodsFilter"),
  salesGoodsRangeLabel: document.querySelector("#salesGoodsRangeLabel"),
  salesGoodsReport: document.querySelector("#salesGoodsReport"),
  salesRangeLabel: document.querySelector("#salesRangeLabel"),
  salesHistoryDateLabel: document.querySelector("#salesHistoryDateLabel"),
  salesOrderTable: document.querySelector("#salesOrderTable"),
  purchaseOrderFields: document.querySelector("#purchaseOrderFields"),
  purchaseOrderDate: document.querySelector("#purchaseOrderDate"),
  purchaseItems: document.querySelector("#purchaseItems"),
  addPurchaseItem: document.querySelector("#addPurchaseItem"),
  purchaseOrderTotal: document.querySelector("#purchaseOrderTotal"),
  purchaseGroupSuggestions: document.querySelector("#purchaseGroupSuggestions"),
  inventoryCount: document.querySelector("#inventoryCount"),
  inventoryLogPanel: document.querySelector("#inventoryLogPanel"),
  openBulkPurchase: document.querySelector("#openBulkPurchase"),
  bulkPurchaseFields: document.querySelector("#bulkPurchaseFields"),
  bulkPurchaseDate: document.querySelector("#bulkPurchaseDate"),
  bulkPurchaseText: document.querySelector("#bulkPurchaseText"),
  bulkPurchaseSummary: document.querySelector("#bulkPurchaseSummary"),
  toggleInventory: document.querySelector("#toggleInventory"),
  inventoryModal: document.querySelector("#inventoryModal"),
  inventoryModalCount: document.querySelector("#inventoryModalCount"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventoryFilter: document.querySelector("#inventoryFilter"),
  inventoryList: document.querySelector("#inventoryList"),
  closeInventory: document.querySelector("#closeInventory"),
  editInventoryModal: document.querySelector("#editInventoryModal"),
  editInventoryForm: document.querySelector("#editInventoryForm"),
  editInventoryName: document.querySelector("#editInventoryName"),
  editInventoryGroup: document.querySelector("#editInventoryGroup"),
  editInventoryQuantity: document.querySelector("#editInventoryQuantity"),
  editInventoryPrice: document.querySelector("#editInventoryPrice"),
  cancelEditInventory: document.querySelector("#cancelEditInventory"),
  quickEntrySubmit: document.querySelector("#quickEntrySubmit"),
  saveSalesDraft: document.querySelector("#saveSalesDraft"),
  deleteSalesDraft: document.querySelector("#deleteSalesDraft"),
  cancelQuickEntry: document.querySelector("#cancelQuickEntry"),
  editEntryModal: document.querySelector("#editEntryModal"),
  editEntryForm: document.querySelector("#editEntryForm"),
  editEntryType: document.querySelector("#editEntryType"),
  editEntryCategory: document.querySelector("#editEntryCategory"),
  editEntryAmount: document.querySelector("#editEntryAmount"),
  cancelEditEntry: document.querySelector("#cancelEditEntry"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  tabPanels: document.querySelectorAll("[data-tab-panel]")
};

moveStoreSectionsIntoTab();

const today = toDateInputValue(new Date());
els.rangeMode.value = "today";
els.singleDate.value = today;
els.monthDate.value = today.slice(0, 7);
els.fromDate.value = today;
els.toDate.value = today;

function moveStoreSectionsIntoTab() {
  const storesPanel = document.querySelector('[data-tab-panel="stores"]');
  const storePanel = document.querySelector(".sidebar .panel");
  if (!storesPanel) return;

  if (storePanel) storesPanel.append(storePanel);
  if (els.activeStorePanel) storesPanel.append(els.activeStorePanel);
}

document.querySelectorAll(".category-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = addCategory(form.dataset.type, new FormData(form).get("category"));
    if (!category) return;
    form.reset();
  });
});

document.querySelectorAll(".entry-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = addEntry(form.dataset.type, new FormData(form));
    if (!saved) return;
    form.querySelector('[name="amount"]').value = "";
    form.querySelector('[name="note"]').value = "";
    form.querySelector('[name="categoryId"]').value = "";
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
    orders: [],
    draftOrders: [],
    purchaseCategories: [],
    purchaseOrders: [],
    inventoryLogs: [],
    inventory: [],
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

function applyRangeModeFilter() {
  uiState.rangeMode = els.rangeMode.value;
  syncQuickRangeInputs();
  updateFilterFields();
  render();
}

els.rangeMode.addEventListener("change", applyRangeModeFilter);
els.rangeMode.addEventListener("click", applyRangeModeFilter);
els.rangeMode.addEventListener("blur", applyRangeModeFilter);

function applySingleDateFilter() {
  uiState.rangeMode = "day";
  updateFilterFields();
  render();
}

function applyMonthFilter() {
  uiState.rangeMode = "month";
  updateFilterFields();
  render();
}

["input", "change"].forEach((eventName) => {
  els.singleDate.addEventListener(eventName, applySingleDateFilter);
  els.monthDate.addEventListener(eventName, applyMonthFilter);
});

["focus", "click"].forEach((eventName) => {
  els.singleDate.addEventListener(eventName, applySingleDateFilter);
  els.monthDate.addEventListener(eventName, applyMonthFilter);
});

[els.fromDate, els.toDate].forEach((input) => {
  input.addEventListener("change", () => {
    uiState.rangeMode = "custom";
    els.rangeMode.value = "custom";
    updateFilterFields();
    render();
  });
});

[els.incomeHistoryFilter, els.expenseHistoryFilter].forEach((select) => {
  select.addEventListener("change", render);
});

[els.incomeHistorySearch, els.expenseHistorySearch].forEach((input) => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
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

els.quickEntryButton.addEventListener("click", () => {
  openQuickEntryModal(els.quickEntryButton.dataset.type);
});

els.quickEntryAmount.addEventListener("input", () => {
  els.quickEntryAmount.value = formatAmountInput(els.quickEntryAmount.value);
});

els.quickEntryNote.addEventListener("input", applyQuickEntrySuggestion);
els.quickEntryNote.addEventListener("change", applyQuickEntrySuggestion);

els.cancelQuickEntry.addEventListener("click", closeQuickEntryModal);

els.saveSalesDraft.addEventListener("click", () => {
  if (saveSalesDraft()) closeQuickEntryModal();
});

els.deleteSalesDraft.addEventListener("click", () => {
  if (deleteSalesDraft(uiState.salesDraftId)) closeQuickEntryModal();
});

els.quickEntryModal.addEventListener("click", (event) => {
  if (event.target === els.quickEntryModal) closeQuickEntryModal();
});

els.quickEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = els.quickEntryForm.dataset.type;
  const saved =
    type === "sales"
      ? saveSalesOrder()
      : type === "purchase"
        ? savePurchaseOrder()
        : type === "purchase-bulk"
          ? saveBulkPurchaseOrder()
          : addEntry(type, new FormData(els.quickEntryForm));
  if (saved) closeQuickEntryModal();
});

els.addSalesItem.addEventListener("click", () => {
  addSalesItemRow();
  updateSalesOrderTotal();
});

els.salesItems.addEventListener("input", (event) => {
  if (event.target.matches('[data-sales-item="price"]')) {
    event.target.value = formatAmountInput(event.target.value);
  }

  if (event.target.matches('[data-sales-item="name"]')) {
    applySalesItemSuggestion(event.target.closest(".sales-item-row"));
  }

  updateSalesOrderTotal();
});

els.salesItems.addEventListener("change", (event) => {
  if (event.target.matches('[data-sales-item="name"]')) {
    applySalesItemSuggestion(event.target.closest(".sales-item-row"));
  }

  updateSalesOrderTotal();
});

els.salesItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-sales-item]");
  if (!button) return;
  button.closest(".sales-item-row")?.remove();
  if (!els.salesItems.querySelector(".sales-item-row")) addSalesItemRow();
  updateSalesOrderTotal();
});

els.addPurchaseItem.addEventListener("click", () => {
  addPurchaseItemRow();
  updatePurchaseOrderTotal();
});

els.purchaseItems.addEventListener("input", (event) => {
  if (event.target.matches('[data-purchase-item="price"]')) {
    event.target.value = formatAmountInput(event.target.value);
  }

  updatePurchaseOrderTotal();
});

els.purchaseItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-purchase-item]");
  if (!button) return;
  button.closest(".purchase-item-row")?.remove();
  if (!els.purchaseItems.querySelector(".purchase-item-row")) addPurchaseItemRow();
  updatePurchaseOrderTotal();
});

els.openBulkPurchase.addEventListener("click", () => {
  openBulkPurchaseModal(getActiveStore());
});

els.bulkPurchaseText.addEventListener("input", updateBulkPurchaseSummary);

els.salesGoodsFilter.addEventListener("change", () => {
  uiState.salesGoodsFilter = els.salesGoodsFilter.value;
  renderReports(getActiveStore());
});

els.toggleInventory.addEventListener("click", () => {
  openInventoryModal();
});

els.closeInventory.addEventListener("click", closeInventoryModal);

els.inventoryModal.addEventListener("click", (event) => {
  if (event.target === els.inventoryModal) closeInventoryModal();
});

els.inventorySearch.addEventListener("input", () => {
  uiState.inventorySearch = els.inventorySearch.value;
  renderInventory(getActiveStore());
});

els.inventoryFilter.addEventListener("change", () => {
  uiState.inventoryFilter = els.inventoryFilter.value;
  renderInventory(getActiveStore());
});

els.inventoryList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-edit-inventory]");
  if (!item) return;
  openEditInventoryModal(item.dataset.editInventory);
});

els.cancelEditInventory.addEventListener("click", closeEditInventoryModal);

els.editInventoryModal.addEventListener("click", (event) => {
  if (event.target === els.editInventoryModal) closeEditInventoryModal();
});

els.editInventoryPrice.addEventListener("input", () => {
  els.editInventoryPrice.value = formatAmountInput(els.editInventoryPrice.value);
});

els.editInventoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedInventory(new FormData(els.editInventoryForm));
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
  const orderButton = event.target.closest("[data-delete-order]");
  const editCategoryButton = event.target.closest("[data-edit-category]");
  const editEntryButton = event.target.closest("[data-edit-entry]");
  const toggleCategoryButton = event.target.closest("[data-toggle-categories]");
  const toggleInventoryLogsButton = event.target.closest("[data-toggle-inventory-logs]");
  const draftButton = event.target.closest("[data-open-sales-draft]");
  const draftDeleteButton = event.target.closest("[data-delete-sales-draft]");

  if (categoryButton) {
    deleteCategory(categoryButton.dataset.type, categoryButton.dataset.deleteCategory);
  }

  if (entryButton) {
    deleteEntry(entryButton.dataset.deleteEntry);
  }

  if (orderButton) {
    deleteSalesOrder(orderButton.dataset.deleteOrder);
  }

  if (editCategoryButton) {
    editCategory(editCategoryButton.dataset.type, editCategoryButton.dataset.editCategory);
  }

  if (editEntryButton) {
    editEntry(editEntryButton.dataset.editEntry);
  }

  if (toggleCategoryButton) {
    const type = toggleCategoryButton.dataset.toggleCategories;
    uiState.categoryExpanded[type] = !uiState.categoryExpanded[type];
    render();
  }

  if (toggleInventoryLogsButton) {
    uiState.inventoryLogsExpanded = !uiState.inventoryLogsExpanded;
    renderInventoryLogs(getActiveStore());
  }

  if (draftDeleteButton) {
    deleteSalesDraft(draftDeleteButton.dataset.deleteSalesDraft);
  }

  if (draftButton && !draftDeleteButton) {
    openSalesDraft(draftButton.dataset.openSalesDraft);
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
    orders: store.orders || [],
    draftOrders: store.draftOrders || [],
    purchaseCategories: store.purchaseCategories || [],
    purchaseOrders: store.purchaseOrders || [],
    inventoryLogs: store.inventoryLogs || [],
    inventory: store.inventory || [],
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

  const category = {
    id: createId(),
    name
  };

  store.categories[type].push(category);
  saveAndRender();
  return category;
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

  const entry = store.entries.find((item) => item.id === entryId);
  if (!entry) return;

  entry.status = "cancelled";
  entry.cancelledAt = new Date().toISOString();
  saveAndRender();
}

function deleteSalesOrder(orderId) {
  const store = getActiveStore();
  if (!store) return;

  const order = (store.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  if (isCancelledEntry(order)) return;

  order.status = "cancelled";
  order.cancelledAt = new Date().toISOString();
  if (order.inventoryDeducted) {
    restoreInventoryFromSales(store, order.items || []);
    order.inventoryDeducted = false;
  }
  store.entries
    .filter((entry) => entry.orderId === orderId)
    .forEach((entry) => {
      entry.status = "cancelled";
      entry.cancelledAt = order.cancelledAt;
    });
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

  els.dashboard.hidden = false;
  els.activeStorePanel.hidden = !store;
  els.renameStore.disabled = !store;
  els.deleteStore.disabled = !store;
  if (!store) {
    els.activeStoreName.textContent = "Chưa chọn cửa hàng";
    els.heroStoreName.textContent = "Chưa chọn cửa hàng";
    els.heroStoreMeta.textContent = "Tạo hoặc chọn một cửa hàng";
    activateTab("stores");
    updateQuickEntryButton();
    updatePinnedTabs();
    return;
  }

  els.activeStoreName.textContent = store.name;
  els.heroStoreName.textContent = store.name;
  els.heroStoreMeta.textContent = `${store.entries.length} dòng`;
  setDefaultEntryDates();
  updateFilterFields();
  renderCategoryControls(store, "income");
  renderCategoryControls(store, "expense");
  renderEntrySuggestions(store);
  renderHistoryFilters(store);
  renderReports(store);
  renderInventory(store);
  renderInventoryLogs(store);
  els.tabBar.dataset.pinTop = "";
  updateQuickEntryButton();
  updatePinnedTabs();
}

function renderHistoryFilters(store) {
  renderHistoryFilter(els.incomeHistoryFilter, store.categories.income, true);
  renderHistoryFilter(els.expenseHistoryFilter, store.categories.expense, true);
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

function renderPurchaseGroupSuggestions(store) {
  if (!els.purchaseGroupSuggestions) return;

  els.purchaseGroupSuggestions.innerHTML = (store.purchaseCategories || [])
    .map((category) => `<option value="${escapeHtml(category.name)}"></option>`)
    .join("");
}

function renderInventorySuggestionList(store) {
  if (!els.salesItemSuggestions) return;

  els.salesItemSuggestions.innerHTML = (store.inventory || [])
    .filter((item) => Number(item.quantity || 0) > 0)
    .map((item) => {
      const label = `${item.name} - tồn ${Number(item.quantity || 0).toLocaleString("vi-VN")} - ${formatAmountInput(item.lastPrice || 0)} đ`;
      return `<option value="${escapeHtml(item.name)}" label="${escapeHtml(label)}"></option>`;
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
          amount: Number(entry.orderUnitPrice || entry.amount || 0)
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

function openQuickEntryModal(type) {
  const store = getActiveStore();
  if (!store || !["income", "expense", "sales", "purchase"].includes(type)) return;

  els.quickEntryForm.dataset.type = type;

  if (type === "sales") {
    openSalesOrderModal(store);
    return;
  }

  if (type === "purchase") {
    openPurchaseOrderModal(store);
    return;
  }

  els.quickEntryModal.classList.remove("sales-page-mode");
  const categories = store.categories[type] || [];
  els.quickEntryFields.hidden = false;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = true;
  els.quickEntryTitle.textContent = type === "income" ? "Thêm khoản thu" : "Thêm khoản chi";
  els.quickEntryNote.placeholder = type === "income" ? "Khoản Thu" : "Khoản Chi";
  els.quickEntryAmount.value = "";
  els.quickEntryNote.value = "";
  els.quickEntrySubmit.textContent = "Lưu";
  els.saveSalesDraft.hidden = true;
  els.quickEntryDate.value = els.singleDate.value || today;
  els.quickEntryCategory.innerHTML = [
    '<option value="">Chưa có mục</option>',
    ...categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
  ].join("");
  els.quickEntryCategory.value = "";
  els.quickEntryCategory.disabled = !categories.length;
  els.quickEntrySubmit.disabled = !categories.length;
  renderEntrySuggestionList(els.quickEntrySuggestions, getEntrySuggestions(store, type));
  els.quickEntryModal.hidden = false;
}

function closeQuickEntryModal() {
  els.quickEntryModal.hidden = true;
  els.quickEntryModal.classList.remove("sales-page-mode");
  els.quickEntryForm.reset();
  uiState.salesDraftId = null;
  els.salesItems.innerHTML = "";
  els.purchaseItems.innerHTML = "";
  els.quickEntryFields.hidden = false;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = true;
  els.bulkPurchaseText.value = "";
  updateBulkPurchaseSummary();
  els.quickEntrySubmit.disabled = false;
  els.saveSalesDraft.hidden = true;
  els.deleteSalesDraft.hidden = true;
  els.quickEntrySubmit.textContent = "Lưu";
}

function applyQuickEntrySuggestion() {
  const store = getActiveStore();
  const type = els.quickEntryForm.dataset.type;
  if (!store || !type) return;

  const note = String(els.quickEntryNote.value || "").trim().toLowerCase();
  if (!note) return;

  const suggestion = getEntrySuggestions(store, type).find((item) => item.note.toLowerCase() === note);
  if (!suggestion) return;

  els.quickEntryAmount.value = formatAmountInput(suggestion.amount);
}

function openSalesOrderModal(store, draft = null) {
  els.quickEntryForm.dataset.type = "sales";
  els.quickEntryModal.classList.add("sales-page-mode");
  els.quickEntryTitle.textContent = "Tạo đơn bán hàng";
  els.quickEntryFields.hidden = true;
  els.salesOrderFields.hidden = false;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = true;
  uiState.salesDraftId = draft?.id || null;
  els.salesCustomerName.value = draft?.customerName || "";
  els.salesCustomerPhone.value = draft?.customerPhone || "";
  els.salesOrderDate.value = draft?.date || els.singleDate.value || today;
  els.salesItems.innerHTML = "";
  renderInventorySuggestionList(store);
  (draft?.items?.length ? draft.items : [{}]).forEach((item) => addSalesItemRow(item));
  updateSalesOrderTotal();
  els.quickEntrySubmit.disabled = false;
  els.saveSalesDraft.hidden = false;
  els.deleteSalesDraft.hidden = !uiState.salesDraftId;
  els.quickEntrySubmit.textContent = "Hoàn Thành";
  els.quickEntryModal.hidden = false;
}

function addSalesItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "sales-item-row";
  row.innerHTML = `
    <input type="text" data-sales-item="name" placeholder="Hàng hóa" autocomplete="off" list="salesItemSuggestions" value="${escapeHtml(item.name || "")}" />
    <input type="text" data-sales-item="price" inputmode="numeric" placeholder="Giá" autocomplete="off" value="${item.price ? formatAmountInput(item.price) : ""}" />
    <input type="number" data-sales-item="quantity" min="1" step="1" placeholder="SL" value="${item.quantity || 1}" />
    <button class="delete-small" type="button" data-remove-sales-item title="Xóa khoản" aria-label="Xóa khoản">×</button>
  `;
  els.salesItems.append(row);
}

function getSalesOrderItems() {
  return [...els.salesItems.querySelectorAll(".sales-item-row")]
    .map((row) => {
      const name = String(row.querySelector('[data-sales-item="name"]')?.value || "").trim();
      const price = parseAmountInput(row.querySelector('[data-sales-item="price"]')?.value);
      const quantity = Math.max(1, Number.parseInt(row.querySelector('[data-sales-item="quantity"]')?.value, 10) || 1);
      return {
        name,
        price,
        quantity,
        total: price * quantity
      };
    })
    .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
}

function getSalesDraftItems() {
  return [...els.salesItems.querySelectorAll(".sales-item-row")]
    .map((row) => {
      const name = String(row.querySelector('[data-sales-item="name"]')?.value || "").trim();
      const rawPrice = row.querySelector('[data-sales-item="price"]')?.value;
      const parsedPrice = parseAmountInput(rawPrice);
      const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
      const quantity = Math.max(1, Number.parseInt(row.querySelector('[data-sales-item="quantity"]')?.value, 10) || 1);
      return {
        name,
        price,
        quantity,
        total: price * quantity
      };
    })
    .filter((item) => item.name || item.price > 0);
}

function getSalesFormData({ completeOnly = false } = {}) {
  const items = completeOnly ? getSalesOrderItems() : getSalesDraftItems();
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return {
    customerName: String(els.salesCustomerName.value || "").trim(),
    customerPhone: String(els.salesCustomerPhone.value || "").trim(),
    date: els.salesOrderDate.value || today,
    items,
    total
  };
}

function updateSalesOrderTotal() {
  const total = getSalesOrderItems().reduce((sum, item) => sum + item.total, 0);
  els.salesOrderTotal.textContent = formatCurrency(total);
}

function applySalesItemSuggestion(row) {
  const store = getActiveStore();
  if (!store || !row) return;

  const nameInput = row.querySelector('[data-sales-item="name"]');
  const priceInput = row.querySelector('[data-sales-item="price"]');
  const name = String(nameInput.value || "").trim().toLowerCase();
  if (!name || priceInput.value) return;

  const suggestion = (store.inventory || []).find((item) => item.name.toLowerCase() === name && Number(item.quantity || 0) > 0);
  if (!suggestion) return;

  priceInput.value = formatAmountInput(suggestion.lastPrice || 0);
}

function getInventoryAvailableByName(store, rawName) {
  const key = normalizeSearchText(rawName);
  return (store.inventory || [])
    .filter((item) => normalizeSearchText(item.name) === key)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function validateSalesInventory(store, items) {
  const requested = new Map();
  items.forEach((item) => {
    const key = normalizeSearchText(item.name);
    requested.set(key, {
      name: item.name,
      quantity: (requested.get(key)?.quantity || 0) + item.quantity
    });
  });

  for (const item of requested.values()) {
    const available = getInventoryAvailableByName(store, item.name);
    if (available <= 0) {
      window.alert(`Hàng hóa "${item.name}" chưa có trong kho hoặc đã hết hàng.`);
      return false;
    }

    if (item.quantity > available) {
      window.alert(`Hàng hóa "${item.name}" chỉ còn ${available.toLocaleString("vi-VN")} trong kho.`);
      return false;
    }
  }

  return true;
}

function deductInventoryForSales(store, items) {
  items.forEach((item) => {
    let remaining = item.quantity;
    const key = normalizeSearchText(item.name);
    const stocks = (store.inventory || []).filter((stock) => normalizeSearchText(stock.name) === key && Number(stock.quantity || 0) > 0);

    stocks.forEach((stock) => {
      if (remaining <= 0) return;
      const quantity = Number(stock.quantity || 0);
      const used = Math.min(quantity, remaining);
      const averageCost = quantity > 0 ? Number(stock.totalCost || 0) / quantity : 0;
      stock.quantity = quantity - used;
      stock.totalCost = Math.max(0, Number(stock.totalCost || 0) - averageCost * used);
      stock.updatedAt = new Date().toISOString();
      remaining -= used;
    });
  });
}

function restoreInventoryFromSales(store, items) {
  const now = new Date().toISOString();
  items.forEach((item) => {
    const key = normalizeSearchText(item.name);
    const stock = (store.inventory || []).find((current) => normalizeSearchText(current.name) === key);
    if (stock) {
      stock.quantity = Number(stock.quantity || 0) + Number(item.quantity || 0);
      stock.updatedAt = now;
    } else {
      store.inventory = [
        ...(store.inventory || []),
        {
          id: createId(),
          name: item.name,
          groupId: "",
          groupName: "Bán hàng hoàn lại",
          quantity: Number(item.quantity || 0),
          totalCost: 0,
          lastPrice: Number(item.price || 0),
          createdAt: now,
          updatedAt: now
        }
      ];
    }
  });
}

function saveSalesOrder() {
  const store = getActiveStore();
  if (!store) return false;

  const { customerName, customerPhone, date, items, total } = getSalesFormData({ completeOnly: true });

  if (!customerName) {
    window.alert("Vui lòng nhập tên khách hàng.");
    return false;
  }

  if (!isValidDateInput(date)) {
    window.alert("Ngày bán không hợp lệ.");
    return false;
  }

  if (!items.length) {
    window.alert("Vui lòng nhập ít nhất một hàng hóa, giá và số lượng.");
    return false;
  }

  if (!validateSalesInventory(store, items)) return false;

  const orderId = createId();
  const createdAt = new Date().toISOString();
  const groupLookup = getGoodsGroupLookup(store);
  const orderItems = items.map((item) => ({
    ...item,
    groupName: item.groupName || groupLookup.get(normalizeSearchText(item.name)) || "Chưa phân nhóm"
  }));
  deductInventoryForSales(store, items);
  store.orders.push({
    id: orderId,
    customerName,
    customerPhone,
    date,
    items: orderItems,
    total,
    inventoryDeducted: true,
    createdAt
  });

  if (uiState.salesDraftId) {
    store.draftOrders = (store.draftOrders || []).filter((draft) => draft.id !== uiState.salesDraftId);
  }

  saveAndRender();
  return true;
}

function openPurchaseOrderModal(store) {
  els.quickEntryForm.dataset.type = "purchase";
  els.quickEntryModal.classList.add("sales-page-mode");
  els.quickEntryTitle.textContent = "Nhập hàng vào kho";
  els.quickEntryFields.hidden = true;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = false;
  els.bulkPurchaseFields.hidden = true;
  els.purchaseOrderDate.value = els.singleDate.value || today;
  els.purchaseItems.innerHTML = "";
  renderPurchaseGroupSuggestions(store);
  addPurchaseItemRow();
  updatePurchaseOrderTotal();
  els.quickEntrySubmit.disabled = false;
  els.saveSalesDraft.hidden = true;
  els.deleteSalesDraft.hidden = true;
  els.quickEntrySubmit.textContent = "Hoàn Thành";
  els.quickEntryModal.hidden = false;
}

function openBulkPurchaseModal(store) {
  if (!store) return;

  els.quickEntryForm.dataset.type = "purchase-bulk";
  els.quickEntryModal.classList.add("sales-page-mode");
  els.quickEntryTitle.textContent = "Nhập hàng từ Danh Sách";
  els.quickEntryFields.hidden = true;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = false;
  els.bulkPurchaseDate.value = els.singleDate.value || today;
  els.bulkPurchaseText.value = "";
  updateBulkPurchaseSummary();
  els.quickEntrySubmit.disabled = false;
  els.saveSalesDraft.hidden = true;
  els.deleteSalesDraft.hidden = true;
  els.quickEntrySubmit.textContent = "Hoàn Thành";
  els.quickEntryModal.hidden = false;
  els.bulkPurchaseText.focus();
}

function openInventoryModal() {
  const store = getActiveStore();
  if (!store) return;

  renderInventory(store);
  els.inventoryModal.hidden = false;
}

function closeInventoryModal() {
  els.inventoryModal.hidden = true;
}

function openEditInventoryModal(inventoryId) {
  const store = getActiveStore();
  const item = (store?.inventory || []).find((stock) => stock.id === inventoryId);
  if (!item) return;

  els.editInventoryForm.elements.inventoryId.value = item.id;
  els.editInventoryName.value = item.name || "";
  els.editInventoryGroup.value = item.groupName || "";
  els.editInventoryQuantity.value = Number(item.quantity || 0);
  els.editInventoryPrice.value = formatAmountInput(item.lastPrice || 0);
  els.editInventoryModal.hidden = false;
}

function closeEditInventoryModal() {
  els.editInventoryModal.hidden = true;
  els.editInventoryForm.reset();
}

function saveEditedInventory(formData) {
  const store = getActiveStore();
  if (!store) return false;

  const item = (store.inventory || []).find((stock) => stock.id === formData.get("inventoryId"));
  if (!item) return false;

  const name = String(formData.get("name") || "").trim();
  const groupName = String(formData.get("groupName") || "").trim();
  const quantity = Number.parseInt(formData.get("quantity"), 10);
  const lastPrice = parseAmountInput(formData.get("lastPrice"));

  if (!name || !groupName || !Number.isFinite(quantity) || !Number.isFinite(lastPrice) || lastPrice < 0) {
    window.alert("Vui lòng nhập đầy đủ tên hàng hóa, nhóm, số lượng và giá.");
    return false;
  }

  const oldQuantity = Number(item.quantity || 0);
  const oldPrice = Number(item.lastPrice || 0);
  const category = ensurePurchaseCategory(store, groupName);
  const updatedAt = new Date().toISOString();
  item.name = name;
  item.groupId = category.id;
  item.groupName = category.name;
  item.quantity = quantity;
  item.lastPrice = lastPrice;
  item.totalCost = Math.max(0, quantity * lastPrice);
  item.updatedAt = updatedAt;
  addInventoryLog(store, {
    date: updatedAt.slice(0, 10),
    type: "edit",
    itemName: item.name,
    groupName: item.groupName,
    oldQuantity,
    newQuantity: Number(item.quantity || 0),
    oldPrice,
    newPrice: Number(item.lastPrice || 0)
  });

  saveAndRender();
  renderInventory(store);
  closeEditInventoryModal();
  return true;
}

function addPurchaseItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "purchase-item-row sales-item-row";
  row.innerHTML = `
    <input type="text" data-purchase-item="name" placeholder="Hàng hóa" autocomplete="off" value="${escapeHtml(item.name || "")}" />
    <input type="text" data-purchase-item="group" placeholder="Nhóm hàng hóa" autocomplete="off" list="purchaseGroupSuggestions" value="${escapeHtml(item.groupName || "")}" />
    <input type="number" data-purchase-item="quantity" min="1" step="1" placeholder="SL" value="${item.quantity || 1}" />
    <input type="text" data-purchase-item="price" inputmode="numeric" placeholder="Giá tiền" autocomplete="off" value="${item.price ? formatAmountInput(item.price) : ""}" />
    <button class="delete-small" type="button" data-remove-purchase-item title="Xóa hàng hóa" aria-label="Xóa hàng hóa">×</button>
  `;
  els.purchaseItems.append(row);
}

function getPurchaseOrderItems() {
  return [...els.purchaseItems.querySelectorAll(".purchase-item-row")]
    .map((row) => {
      const name = String(row.querySelector('[data-purchase-item="name"]')?.value || "").trim();
      const groupName = String(row.querySelector('[data-purchase-item="group"]')?.value || "").trim();
      const quantity = Math.max(1, Number.parseInt(row.querySelector('[data-purchase-item="quantity"]')?.value, 10) || 1);
      const price = parseAmountInput(row.querySelector('[data-purchase-item="price"]')?.value);
      return {
        name,
        groupName,
        quantity,
        price,
        total: quantity * price
      };
    })
    .filter((item) => item.name && item.groupName && Number.isFinite(item.price) && item.price > 0);
}

function updatePurchaseOrderTotal() {
  const total = getPurchaseOrderItems().reduce((sum, item) => sum + item.total, 0);
  els.purchaseOrderTotal.textContent = formatCurrency(total);
}

function ensurePurchaseCategory(store, rawName) {
  const name = String(rawName || "").trim();
  if (!name) return null;

  const existing = (store.purchaseCategories || []).find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const category = { id: createId(), name };
  store.purchaseCategories = [...(store.purchaseCategories || []), category];
  return category;
}

function addInventoryLog(store, log) {
  store.inventoryLogs = [
    {
      id: createId(),
      updatedAt: new Date().toISOString(),
      ...log
    },
    ...(store.inventoryLogs || [])
  ];
}

function applyPurchaseItemsToInventory(store, date, items, createdAt) {
  store.inventory = [...(store.inventory || [])];

  items.forEach((item) => {
    const key = normalizeSearchText(`${item.groupName} ${item.name}`);
    const current = store.inventory.find((stock) => normalizeSearchText(`${stock.groupName} ${stock.name}`) === key);
    if (current) {
      const oldQuantity = Number(current.quantity || 0);
      const oldPrice = Number(current.lastPrice || 0);
      current.quantity = Number(current.quantity || 0) + item.quantity;
      current.totalCost = Number(current.totalCost || 0) + item.total;
      current.lastPrice = item.price;
      current.updatedAt = createdAt;
      addInventoryLog(store, {
        date,
        type: "purchase",
        itemName: current.name,
        groupName: current.groupName,
        oldQuantity,
        newQuantity: Number(current.quantity || 0),
        oldPrice,
        newPrice: Number(current.lastPrice || 0)
      });
    } else {
      const stock = {
        id: createId(),
        name: item.name,
        groupId: item.groupId,
        groupName: item.groupName,
        quantity: item.quantity,
        totalCost: item.total,
        lastPrice: item.price,
        createdAt,
        updatedAt: createdAt
      };
      store.inventory.push(stock);
      addInventoryLog(store, {
        date,
        type: "purchase",
        itemName: stock.name,
        groupName: stock.groupName,
        oldQuantity: 0,
        newQuantity: Number(stock.quantity || 0),
        oldPrice: 0,
        newPrice: Number(stock.lastPrice || 0)
      });
    }
  });
}

function savePurchaseOrder() {
  const store = getActiveStore();
  if (!store) return false;

  const date = els.purchaseOrderDate.value || today;
  const items = getPurchaseOrderItems();
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (!isValidDateInput(date)) {
    window.alert("Ngày nhập hàng không hợp lệ.");
    return false;
  }

  if (!items.length) {
    window.alert("Vui lòng nhập hàng hóa, nhóm hàng hóa, số lượng và giá tiền.");
    return false;
  }

  const createdAt = new Date().toISOString();
  const orderId = createId();
  const normalizedItems = items.map((item) => {
    const category = ensurePurchaseCategory(store, item.groupName);
    return {
      ...item,
      groupId: category.id,
      groupName: category.name
    };
  });

  store.purchaseOrders = [
    ...(store.purchaseOrders || []),
    { id: orderId, date, items: normalizedItems, total, createdAt }
  ];

  applyPurchaseItemsToInventory(store, date, normalizedItems, createdAt);

  saveAndRender();
  return true;
}

function parseBulkPurchaseItems({ silent = false } = {}) {
  const lines = String(els.bulkPurchaseText.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 50) {
    if (!silent) window.alert("Danh sách nhập hàng tối đa 50 dòng.");
    return null;
  }

  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length !== 4) {
      if (!silent) window.alert(`Dòng ${index + 1} chưa đúng định dạng: Tên,Số lượng,Nhóm,Giá.`);
      return null;
    }

    const [name, rawQuantity, groupName, rawPrice] = parts;
    const quantity = Number.parseInt(rawQuantity, 10);
    const price = parseAmountInput(rawPrice);
    if (!name || !groupName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      if (!silent) window.alert(`Dòng ${index + 1} chưa hợp lệ. Vui lòng kiểm tra tên, số lượng, nhóm và giá.`);
      return null;
    }

    items.push({
      name,
      groupName,
      quantity,
      price,
      total: quantity * price
    });
  }

  return items;
}

function updateBulkPurchaseSummary() {
  if (!els.bulkPurchaseSummary) return;
  const items = parseBulkPurchaseItems({ silent: true }) || [];
  els.bulkPurchaseSummary.textContent = `${items.length} dòng hợp lệ`;
}

function saveBulkPurchaseOrder() {
  const store = getActiveStore();
  if (!store) return false;

  const date = els.bulkPurchaseDate.value || today;
  if (!isValidDateInput(date)) {
    window.alert("Ngày nhập hàng không hợp lệ.");
    return false;
  }

  const items = parseBulkPurchaseItems();
  if (!items || !items.length) {
    window.alert("Vui lòng nhập ít nhất 1 dòng hàng hóa.");
    return false;
  }

  const createdAt = new Date().toISOString();
  const orderId = createId();
  const normalizedItems = items.map((item) => {
    const category = ensurePurchaseCategory(store, item.groupName);
    return {
      ...item,
      groupId: category.id,
      groupName: category.name
    };
  });
  const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);

  store.purchaseOrders = [
    ...(store.purchaseOrders || []),
    { id: orderId, date, items: normalizedItems, total, createdAt, source: "bulk" }
  ];
  applyPurchaseItemsToInventory(store, date, normalizedItems, createdAt);
  saveAndRender();
  return true;
}

function saveSalesDraft() {
  const store = getActiveStore();
  if (!store) return false;

  const draft = getSalesFormData();
  const hasDraftData =
    draft.customerName ||
    draft.customerPhone ||
    draft.items.length ||
    (draft.date && draft.date !== today);

  if (!hasDraftData) {
    window.alert("Vui lòng nhập thông tin đơn hàng trước khi lưu.");
    return false;
  }

  if (!isValidDateInput(draft.date)) {
    window.alert("Ngày bán không hợp lệ.");
    return false;
  }

  const now = new Date().toISOString();
  const draftId = uiState.salesDraftId || createId();
  const nextDraft = {
    id: draftId,
    ...draft,
    status: "draft",
    createdAt: (store.draftOrders || []).find((item) => item.id === draftId)?.createdAt || now,
    updatedAt: now
  };

  store.draftOrders = [
    ...(store.draftOrders || []).filter((item) => item.id !== draftId),
    nextDraft
  ];
  uiState.salesDraftId = draftId;
  saveAndRender();
  return true;
}

function openSalesDraft(draftId) {
  const store = getActiveStore();
  if (!store) return;

  const draft = (store.draftOrders || []).find((item) => item.id === draftId);
  if (!draft) return;

  openSalesOrderModal(store, draft);
}

function deleteSalesDraft(draftId) {
  const store = getActiveStore();
  if (!store || !draftId) return false;

  store.draftOrders = (store.draftOrders || []).filter((draft) => draft.id !== draftId);
  if (uiState.salesDraftId === draftId) uiState.salesDraftId = null;
  saveAndRender();
  return true;
}

function getActiveTabName() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "stores";
}

function updateQuickEntryButton() {
  const store = getActiveStore();
  const tabName = getActiveTabName();
  const type =
    tabName === "income"
      ? "income"
      : tabName === "expense"
        ? "expense"
        : tabName === "sales"
          ? "sales"
          : tabName === "purchase"
            ? "purchase"
            : "";
  const showButton = Boolean(store && type);

  els.quickEntryButton.hidden = !showButton;
  if (!showButton) {
    closeQuickEntryModal();
    return;
  }

  els.quickEntryButton.dataset.type = type;
  const label =
    type === "income"
      ? "Thêm khoản thu"
      : type === "expense"
        ? "Thêm khoản chi"
        : type === "sales"
          ? "Tạo đơn bán hàng"
          : "Nhập hàng vào kho";
  els.quickEntryButton.title = label;
  els.quickEntryButton.setAttribute("aria-label", label);
}

function renderHistoryFilter(select, categories, includeCancelled = false) {
  if (!select) return;

  const currentValue = select.value || "all";
  select.innerHTML = [
    '<option value="all">Tất cả</option>',
    includeCancelled ? '<option value="cancelled">Đã hủy</option>' : "",
    ...categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
  ].join("");

  const stillExists =
    currentValue === "all" ||
    (includeCancelled && currentValue === "cancelled") ||
    categories.some((category) => category.id === currentValue);
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
  updateQuickEntryButton();
  updatePinnedTabs();
}

function updatePinnedTabs() {
  if (!els.tabBar || !els.tabSpacer || els.dashboard.hidden) {
    resetPinnedTabs();
    return;
  }

  const spacerRect = els.tabSpacer.getBoundingClientRect();
  const dashboardRect = els.dashboard.getBoundingClientRect();
  const shouldFix = spacerRect.top <= 0 && dashboardRect.bottom > els.tabBar.offsetHeight;

  if (!shouldFix) {
    resetPinnedTabs();
    return;
  }

  const left = Math.max(8, dashboardRect.left);
  const width = Math.min(dashboardRect.width, window.innerWidth - left * 2);
  els.tabSpacer.style.height = `${els.tabBar.offsetHeight}px`;
  els.tabBar.classList.add("is-fixed");
  els.tabBar.style.left = `${left}px`;
  els.tabBar.style.width = `${width}px`;
  els.tabBar.dataset.pinTop = "true";
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
  select.innerHTML = [
    '<option value="">Chưa có mục</option>',
    ...categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
  ].join("");
  select.value = "";
  select.disabled = !categories.length;
  select.closest("form").querySelector('button[type="submit"]').disabled = !categories.length;

  if (!categories.length) {
    listEl.innerHTML = '<div class="empty-list">Thêm ít nhất một mục để nhập dữ liệu</div>';
    return;
  }

  const expanded = uiState.categoryExpanded[type];
  const visibleCategories = expanded ? categories : categories.slice(-2);
  const toggleButton =
    categories.length > 2
      ? `
        <button class="category-toggle${expanded ? " expanded" : ""}" type="button" data-toggle-categories="${type}" aria-label="${expanded ? "Thu gọn mục" : "Hiển thị tất cả mục"}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
          </svg>
        </button>
      `
      : "";

  listEl.classList.toggle("expanded", expanded);
  listEl.innerHTML =
    visibleCategories
      .map((category) => `
        <div class="category-item">
          <span class="category-name">${escapeHtml(category.name)}</span>
          <button class="edit-small" type="button" data-type="${type}" data-edit-category="${category.id}" title="Sửa mục" aria-label="Sửa mục">Sửa</button>
          <button class="delete-small" type="button" data-type="${type}" data-delete-category="${category.id}" title="Xóa mục" aria-label="Xóa mục">×</button>
        </div>
      `)
      .join("") + toggleButton;
}

function renderReports(store) {
  const range = getDateRange();
  const entries = store.entries
    .filter((entry) => entry.date >= range.start && entry.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const incomeEntries = entries.filter((entry) => entry.type === "income" && !entry.orderId);
  const expenseEntries = entries.filter((entry) => entry.type === "expense");
  const activeIncomeEntries = incomeEntries.filter((entry) => !isCancelledEntry(entry));
  const activeExpenseEntries = expenseEntries.filter((entry) => !isCancelledEntry(entry));
  const filteredIncomeEntries = filterEntriesBySearch(
    filterEntriesByCategory(incomeEntries, els.incomeHistoryFilter?.value),
    els.incomeHistorySearch?.value
  );
  const filteredExpenseEntries = filterEntriesBySearch(
    filterEntriesByCategory(expenseEntries, els.expenseHistoryFilter?.value),
    els.expenseHistorySearch?.value
  );
  const totalIncome = sumEntries(activeIncomeEntries);
  const totalExpense = sumEntries(activeExpenseEntries);

  els.totalIncome.textContent = formatCurrency(totalIncome);
  els.totalExpense.textContent = formatCurrency(totalExpense);
  els.selectedRangeLabel.textContent = range.label;
  els.incomeRangeLabel.textContent = range.label;
  els.expenseRangeLabel.textContent = range.label;
  if (els.salesGoodsRangeLabel) {
    els.salesGoodsRangeLabel.textContent = range.label;
  }
  els.incomeEntryCount.textContent = `${filteredIncomeEntries.length} dòng`;
  els.expenseEntryCount.textContent = `${filteredExpenseEntries.length} dòng`;
  const salesOrders = (store.orders || [])
    .filter((order) => order.date >= range.start && order.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const activeSalesOrders = salesOrders.filter((order) => !isCancelledEntry(order));
  const totalSalesAmount = activeSalesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  els.totalSales.textContent = formatCurrency(totalSalesAmount);
  els.balance.textContent = formatCurrency(totalIncome + totalSalesAmount - totalExpense);
  els.salesHistoryDateLabel.textContent = range.label;
  els.salesRangeLabel.innerHTML = `
    <span>Tổng</span>
    <span class="report-amount sales-range-total">${formatCurrency(totalSalesAmount)}</span>
  `;
  els.salesOrderCount.textContent = `${salesOrders.length} đơn`;
  renderSalesDraftList(store.draftOrders || []);

  renderHistorySearchSuggestions(els.incomeHistorySearchSuggestions, incomeEntries);
  renderHistorySearchSuggestions(els.expenseHistorySearchSuggestions, expenseEntries);
  renderReportList(els.incomeReport, store.categories.income, activeIncomeEntries);
  renderReportList(els.expenseReport, store.categories.expense, activeExpenseEntries);
  renderSalesGoodsReport(els.salesGoodsReport, activeSalesOrders, store);
  renderEntryTable(els.incomeEntryTable, store, filteredIncomeEntries);
  renderEntryTable(els.expenseEntryTable, store, filteredExpenseEntries);
  renderSalesOrderTable(els.salesOrderTable, salesOrders);
}

function renderSalesGoodsReport(container, orders, store) {
  if (!container) return;

  const goods = new Map();
  const groupLookup = getGoodsGroupLookup(store);

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = String(item.name || "").trim();
      if (!name) return;

      const groupName = String(item.groupName || groupLookup.get(normalizeSearchText(name)) || "Chưa phân nhóm");
      const key = `${normalizeSearchText(groupName)}::${normalizeSearchText(name)}`;
      const total = Number(item.total || 0);
      const quantity = Number(item.quantity || 0);
      const current = goods.get(key) || { name, groupName, total: 0, quantity: 0 };
      current.total += total;
      current.quantity += quantity;
      goods.set(key, current);
    });
  });

  if (!goods.size) {
    renderSalesGoodsFilter([]);
    container.innerHTML = '<div class="empty-list">Chưa có hàng hóa bán ra trong khoảng thời gian này</div>';
    return;
  }

  const allRows = [...goods.values()].sort((a, b) =>
    a.groupName.localeCompare(b.groupName, "vi") || a.name.localeCompare(b.name, "vi")
  );
  renderSalesGoodsFilter(allRows);

  const selectedGroup = uiState.salesGoodsFilter || "all";
  const rows =
    selectedGroup === "all"
      ? allRows
      : allRows.filter((item) => normalizeSearchText(item.groupName) === selectedGroup);

  if (!rows.length) {
    container.innerHTML = '<div class="empty-list">Không có hàng hóa trong nhóm đã chọn</div>';
    return;
  }

  const grandTotal = rows.reduce((sum, item) => sum + Number(item.total || 0), 0);
  container.innerHTML = `
    <div class="report-item report-total">
      <span>Tổng cộng</span>
      <span class="report-amount">${formatCurrency(grandTotal)}</span>
    </div>
    ${rows
      .map(
        (item) => `
          <div class="report-item">
            <span>
              ${escapeHtml(item.name)}
              <span class="item-group">${escapeHtml(item.groupName)}</span>
              <span class="item-quantity">x${item.quantity.toLocaleString("vi-VN")}</span>
            </span>
            <span class="report-amount">${formatCurrency(item.total)}</span>
          </div>
        `
      )
      .join("")}
  `;
}

function getGoodsGroupLookup(store) {
  const lookup = new Map();
  (store?.inventory || []).forEach((item) => {
    const name = normalizeSearchText(item.name || "");
    if (name && item.groupName && !lookup.has(name)) lookup.set(name, item.groupName);
  });
  (store?.purchaseOrders || []).forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = normalizeSearchText(item.name || "");
      if (name && item.groupName && !lookup.has(name)) lookup.set(name, item.groupName);
    });
  });
  return lookup;
}

function renderSalesGoodsFilter(rows) {
  if (!els.salesGoodsFilter) return;

  const groups = [
    ...new Map(
      rows
        .filter((item) => item.groupName)
        .map((item) => [normalizeSearchText(item.groupName), item.groupName])
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const validFilters = new Set(["all", ...groups.map(([key]) => key)]);

  if (!validFilters.has(uiState.salesGoodsFilter)) {
    uiState.salesGoodsFilter = "all";
  }

  els.salesGoodsFilter.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...groups.map(([key, name]) => `<option value="${key}">${escapeHtml(name)}</option>`)
  ].join("");
  els.salesGoodsFilter.value = uiState.salesGoodsFilter;
}

function renderSalesOrderTable(container, orders) {
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = '<tr><td colspan="6" class="empty-list">Chưa có đơn hàng trong khoảng thời gian này</td></tr>';
    return;
  }

  container.innerHTML = orders
    .map((order) => {
      const cancelled = isCancelledEntry(order);
      const items = (order.items || [])
        .map((item) => `${escapeHtml(item.name)} x${item.quantity} - ${formatCurrency(item.total)}`)
        .join("<br>");
      const customer = [
        escapeHtml(order.customerName || ""),
        cancelled ? '<span class="cancelled-pill">Hủy</span>' : ""
      ].join("");
      const actions = cancelled
        ? '<span class="muted-action">Đã hủy</span>'
        : `<button class="delete-small" type="button" data-delete-order="${order.id}" title="Xóa đơn" aria-label="Xóa đơn">×</button>`;

      return `
        <tr class="${cancelled ? "entry-cancelled" : ""}">
          <td>${formatDate(order.date)}</td>
          <td>${customer}</td>
          <td>${escapeHtml(order.customerPhone || "")}</td>
          <td class="note-cell">${items}</td>
          <td class="amount-cell">${formatCurrency(order.total || 0)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSalesDraftList(drafts) {
  if (!els.salesDraftList) return;

  if (!drafts.length) {
    els.salesDraftList.innerHTML = "";
    return;
  }

  const rows = [...drafts]
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .map((draft) => {
      const title = draft.customerName || "Đơn chưa có tên khách";
      const items = (draft.items || [])
        .map((item) => `${escapeHtml(item.name)} x${item.quantity} - ${formatCurrency(item.total)}`)
        .join("<br>");

      return `
        <tr class="draft-order-row" data-open-sales-draft="${draft.id}">
          <td>${formatDate(draft.date || today)}</td>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(draft.customerPhone || "")}</td>
          <td class="note-cell">${items || "Chưa có khoản thu"}</td>
          <td class="amount-cell">${formatCurrency(draft.total || 0)}</td>
          <td>
            <button class="delete-small" type="button" data-delete-sales-draft="${draft.id}" title="Xóa đơn đang lưu" aria-label="Xóa đơn đang lưu">×</button>
          </td>
        </tr>
      `;
    })
    .join("");

  els.salesDraftList.innerHTML = `
    <div class="draft-order-heading">Đơn hàng đang lưu</div>
    <div class="table-wrap draft-order-table-wrap">
      <table class="sales-table draft-order-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Khách hàng</th>
            <th>Số điện thoại</th>
            <th>Chi tiết</th>
            <th>Tổng bill</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderInventory(store) {
  if (!els.inventoryList || !store) return;

  const allInventory = [...(store.inventory || [])].sort((a, b) =>
    String(a.groupName || "").localeCompare(String(b.groupName || ""), "vi") ||
    String(a.name || "").localeCompare(String(b.name || ""), "vi")
  );
  const groups = [
    ...new Map(
      allInventory
        .filter((item) => item.groupName)
        .map((item) => [normalizeSearchText(item.groupName), item.groupName])
    ).values(),
  ].sort((a, b) => String(a).localeCompare(String(b), "vi"));
  const groupOptions = groups.map((groupName) => `group:${normalizeSearchText(groupName)}`);
  const validFilters = new Set(["all", "out-of-stock", ...groupOptions]);

  if (!validFilters.has(uiState.inventoryFilter)) {
    uiState.inventoryFilter = "all";
  }

  if (els.inventorySearch && els.inventorySearch.value !== uiState.inventorySearch) {
    els.inventorySearch.value = uiState.inventorySearch;
  }

  if (els.inventoryFilter) {
    els.inventoryFilter.innerHTML = [
      '<option value="all">Tất cả</option>',
      '<option value="out-of-stock">Hết hàng</option>',
      ...groups.map(
        (groupName) =>
          `<option value="group:${normalizeSearchText(groupName)}">${escapeHtml(groupName)}</option>`
      ),
    ].join("");
    els.inventoryFilter.value = uiState.inventoryFilter;
  }

  const query = normalizeSearchText(uiState.inventorySearch || "");
  const inventory = allInventory.filter((item) => {
    const quantity = Number(item.quantity || 0);
    const matchesSearch = !query || normalizeSearchText(item.name || "").includes(query);
    const matchesFilter =
      uiState.inventoryFilter === "all" ||
      (uiState.inventoryFilter === "out-of-stock" && quantity <= 0) ||
      (uiState.inventoryFilter.startsWith("group:") &&
        normalizeSearchText(item.groupName || "") === uiState.inventoryFilter.slice(6));
    return matchesSearch && matchesFilter;
  });

  els.inventoryCount.textContent = `${allInventory.length} mặt hàng`;
  els.inventoryModalCount.textContent = `${inventory.length} mặt hàng`;

  if (!inventory.length) {
    els.inventoryList.innerHTML = '<div class="empty-list">Không có hàng hóa phù hợp</div>';
    return;
  }

  const totalCost = inventory.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
  els.inventoryList.innerHTML = `
    <div class="report-item report-total">
      <span>Tổng giá trị kho</span>
      <span class="report-amount">${formatCurrency(totalCost)}</span>
    </div>
    ${inventory
      .map(
        (item) => `
          <button class="inventory-item" type="button" data-edit-inventory="${escapeHtml(item.id || "")}">
            <div>
              <span class="inventory-group">${escapeHtml(item.groupName || "Chưa phân nhóm")}</span>
              <strong>${escapeHtml(item.name || "")}</strong>
              <span class="inventory-date">Cập nhật: ${formatDate(String(item.updatedAt || item.createdAt || today).slice(0, 10))}</span>
            </div>
            <div class="inventory-meta">
              <span>SL: ${Number(item.quantity || 0).toLocaleString("vi-VN")}</span>
              <span>Giá gần nhất: ${formatCurrency(item.lastPrice || 0)}</span>
              <span>Tổng: ${formatCurrency(item.totalCost || 0)}</span>
            </div>
          </button>
        `
      )
      .join("")}
  `;
}

function renderInventoryLogs(store) {
  if (!els.inventoryLogPanel) return;

  const range = getDateRange();
  const logs = [...(store?.inventoryLogs || [])]
    .filter((log) => {
      const logDate = getInventoryLogDate(log);
      return logDate >= range.start && logDate <= range.end;
    })
    .sort((a, b) =>
      String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || ""))
    );

  if (!logs.length) {
    els.inventoryLogPanel.innerHTML = '<div class="empty-list inventory-log-empty">Chưa có cập nhật kho.</div>';
    return;
  }

  const expanded = uiState.inventoryLogsExpanded;
  els.inventoryLogPanel.classList.toggle("inventory-log-expanded", expanded);
  els.inventoryLogPanel.classList.toggle("inventory-log-collapsed", !expanded);

  els.inventoryLogPanel.innerHTML = `
    <div class="inventory-log-heading">Lịch sử cập nhật kho</div>
    <div class="table-wrap inventory-log-table-wrap">
      <table class="inventory-log-table">
        <thead>
          <tr>
            <th>Ngày Cập Nhật</th>
            <th>Tên Hàng Hóa</th>
            <th>Tên Nhóm</th>
            <th>Số lượng</th>
            <th>Giá tiền</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (log, index) => `
                <tr class="${index > 0 ? "inventory-log-extra" : ""}">
                  <td>${formatDate(getInventoryLogDate(log))}</td>
                  <td>${escapeHtml(log.itemName || "")}</td>
                  <td>${escapeHtml(log.groupName || "")}</td>
                  <td>
                    <span class="inventory-log-change">
                      <span class="old-value">${Number(log.oldQuantity || 0).toLocaleString("vi-VN")}</span>
                      <span class="change-arrow">→</span>
                      <span class="new-value">${Number(log.newQuantity || 0).toLocaleString("vi-VN")}</span>
                    </span>
                  </td>
                  <td>
                    <span class="inventory-log-change">
                      <span class="old-value">${formatCurrency(log.oldPrice || 0)}</span>
                      <span class="change-arrow">→</span>
                      <span class="new-value">${formatCurrency(log.newPrice || 0)}</span>
                    </span>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${
      logs.length > 1
        ? `
          <button class="category-toggle inventory-log-toggle${expanded ? " expanded" : ""}" type="button" data-toggle-inventory-logs aria-label="${expanded ? "Thu gọn lịch sử kho" : "Hiển thị tất cả lịch sử kho"}">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
            </svg>
          </button>
        `
        : ""
    }
  `;
}

function getInventoryLogDate(log) {
  return String(log?.date || log?.updatedAt || today).slice(0, 10);
}

function filterEntriesByCategory(entries, categoryId) {
  if (!categoryId || categoryId === "all") return entries;
  if (categoryId === "cancelled") return entries.filter(isCancelledEntry);
  return entries.filter((entry) => entry.categoryId === categoryId);
}

function isCancelledEntry(entry) {
  return entry.status === "cancelled";
}

function filterEntriesBySearch(entries, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return entries;

  const terms = query.split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const note = normalizeSearchText(entry.note);
    return terms.every((term) => note.includes(term));
  });
}

function renderHistorySearchSuggestions(container, entries) {
  if (!container) return;

  const notes = new Map();
  entries.forEach((entry) => {
    const note = String(entry.note || "").trim();
    if (!note) return;

    const key = normalizeSearchText(note);
    if (!notes.has(key)) notes.set(key, note);
  });

  container.innerHTML = [...notes.values()]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((note) => `<option value="${escapeHtml(note)}"></option>`)
    .join("");
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
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
  if (!entries.length) {
    container.innerHTML = '<tr><td colspan="5" class="empty-list">Chưa có dữ liệu trong khoảng thời gian này</td></tr>';
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const category = store.categories[entry.type].find((item) => item.id === entry.categoryId);
      const cancelled = isCancelledEntry(entry);
      const note = [
        escapeHtml(entry.note || ""),
        cancelled ? '<span class="cancelled-pill">Hủy</span>' : ""
      ].join("");
      const actions = cancelled
        ? '<span class="muted-action">Đã hủy</span>'
        : `
            <button class="edit-small" type="button" data-edit-entry="${entry.id}" title="Sửa dòng" aria-label="Sửa dòng">Sửa</button>
            <button class="delete-small" type="button" data-delete-entry="${entry.id}" title="Xóa dòng" aria-label="Xóa dòng">×</button>
          `;

      return `
        <tr class="${cancelled ? "entry-cancelled" : ""}">
          <td>${formatDate(entry.date)}</td>
          <td>${escapeHtml(category?.name || "Mục đã xóa")}</td>
          <td class="note-cell">${note}</td>
          <td class="amount-cell">${formatCurrency(entry.amount)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join("");
}
function updateFilterFields() {
  const mode = uiState.rangeMode;
  els.singleDateField.hidden = false;
  els.monthField.hidden = false;
  els.fromField.hidden = mode !== "custom";
  els.toField.hidden = mode !== "custom";
}

function syncQuickRangeInputs() {
  const mode = uiState.rangeMode;

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
  const mode = uiState.rangeMode;
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
