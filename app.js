const STORAGE_KEY = "store-cashbook-v1";
const AI_CHAT_STORAGE_KEY = "store-cashbook-ai-chat-v1";
const AI_CLIENT_STATE_MAX_CHARS = 900000;
const AI_FILE_MAX_BYTES = 8 * 1024 * 1024;
const AI_FILE_TEXT_MAX_CHARS = 80000;
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
  inventoryHistorySearch: "",
  inventoryHistoryDate: "",
  salesCatalogSearch: "",
  salesCatalogFilter: "all",
  salesCatalogRow: null,
  salesCustomerCatalogSearch: "",
  salesCustomerCatalogFilter: "all",
  customerFormOpen: false,
  customerMemberFilter: "all",
  customerSearch: "",
  inventoryLogsExpanded: false,
  inventoryLogFilter: "all",
  inventoryLogReasonFilter: "all",
  inventoryLogSearch: "",
  editingInventoryLogId: null,
  salesGoodsFilter: "all",
  salesDraftId: null,
  salesOrderDiscountPercent: 0,
  salesOrderDiscountAmount: 0
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
  timeFilters: document.querySelector("#timeFilters"),
  quickEntryButton: document.querySelector("#quickEntryButton"),
  aiButton: document.querySelector("#aiButton"),
  aiChatModal: document.querySelector("#aiChatModal"),
  aiChatClose: document.querySelector("#aiChatClose"),
  aiChatMessages: document.querySelector("#aiChatMessages"),
  aiChatForm: document.querySelector("#aiChatForm"),
  aiChatInput: document.querySelector("#aiChatInput"),
  aiChatMode: document.querySelector("#aiChatMode"),
  aiClearChat: document.querySelector("#aiClearChat"),
  aiAdminPin: document.querySelector("#aiAdminPin"),
  aiQuickPrompts: document.querySelector("#aiQuickPrompts"),
  aiFileButton: document.querySelector("#aiFileButton"),
  aiFileInput: document.querySelector("#aiFileInput"),
  aiFileStatus: document.querySelector("#aiFileStatus"),
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
  openSalesCustomerCatalog: document.querySelector("#openSalesCustomerCatalog"),
  salesOrderDate: document.querySelector("#salesOrderDate"),
  salesItems: document.querySelector("#salesItems"),
  addSalesItem: document.querySelector("#addSalesItem"),
  salesOrderTotal: document.querySelector("#salesOrderTotal"),
  salesOrderDiscountLine: document.querySelector("#salesOrderDiscountLine"),
  salesOrderDiscountTotal: document.querySelector("#salesOrderDiscountTotal"),
  salesOrderRemainingLine: document.querySelector("#salesOrderRemainingLine"),
  salesOrderRemainingTotal: document.querySelector("#salesOrderRemainingTotal"),
  salesItemSuggestions: document.querySelector("#salesItemSuggestions"),
  salesOrderCount: document.querySelector("#salesOrderCount"),
  salesDraftList: document.querySelector("#salesDraftList"),
  salesGoodsFilter: document.querySelector("#salesGoodsFilter"),
  salesGoodsRangeLabel: document.querySelector("#salesGoodsRangeLabel"),
  salesGoodsReport: document.querySelector("#salesGoodsReport"),
  salesRangeLabel: document.querySelector("#salesRangeLabel"),
  salesHistoryDateLabel: document.querySelector("#salesHistoryDateLabel"),
  salesOrderTable: document.querySelector("#salesOrderTable"),
  salesOrderDetailModal: document.querySelector("#salesOrderDetailModal"),
  salesOrderDetailStatus: document.querySelector("#salesOrderDetailStatus"),
  salesOrderDetailContent: document.querySelector("#salesOrderDetailContent"),
  closeSalesOrderDetail: document.querySelector("#closeSalesOrderDetail"),
  salesCatalogModal: document.querySelector("#salesCatalogModal"),
  salesCatalogCount: document.querySelector("#salesCatalogCount"),
  salesCatalogSearch: document.querySelector("#salesCatalogSearch"),
  salesCatalogFilter: document.querySelector("#salesCatalogFilter"),
  salesCatalogList: document.querySelector("#salesCatalogList"),
  closeSalesCatalog: document.querySelector("#closeSalesCatalog"),
  salesCustomerCatalogModal: document.querySelector("#salesCustomerCatalogModal"),
  salesCustomerCatalogCount: document.querySelector("#salesCustomerCatalogCount"),
  salesCustomerCatalogSearch: document.querySelector("#salesCustomerCatalogSearch"),
  salesCustomerCatalogFilter: document.querySelector("#salesCustomerCatalogFilter"),
  salesCustomerCatalogList: document.querySelector("#salesCustomerCatalogList"),
  closeSalesCustomerCatalog: document.querySelector("#closeSalesCustomerCatalog"),
  openCustomers: document.querySelector("#openCustomers"),
  customersModal: document.querySelector("#customersModal"),
  customersCount: document.querySelector("#customersCount"),
  customersList: document.querySelector("#customersList"),
  toggleCustomerForm: document.querySelector("#toggleCustomerForm"),
  customerForm: document.querySelector("#customerForm"),
  customerNameInput: document.querySelector("#customerNameInput"),
  customerPhoneInput: document.querySelector("#customerPhoneInput"),
  customerMemberTier: document.querySelector("#customerMemberTier"),
  customerMemberFilter: document.querySelector("#customerMemberFilter"),
  customerSearchInput: document.querySelector("#customerSearchInput"),
  customerSearchSuggestions: document.querySelector("#customerSearchSuggestions"),
  customerCreatedAt: document.querySelector("#customerCreatedAt"),
  cancelCustomerForm: document.querySelector("#cancelCustomerForm"),
  closeCustomers: document.querySelector("#closeCustomers"),
  customerHistoryModal: document.querySelector("#customerHistoryModal"),
  customerHistoryStatus: document.querySelector("#customerHistoryStatus"),
  customerHistoryContent: document.querySelector("#customerHistoryContent"),
  closeCustomerHistory: document.querySelector("#closeCustomerHistory"),
  memberTierModal: document.querySelector("#memberTierModal"),
  memberTierStatus: document.querySelector("#memberTierStatus"),
  memberTierContent: document.querySelector("#memberTierContent"),
  closeMemberTier: document.querySelector("#closeMemberTier"),
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
  openInventoryHistory: document.querySelector("#openInventoryHistory"),
  inventoryHistoryModal: document.querySelector("#inventoryHistoryModal"),
  inventoryHistoryCount: document.querySelector("#inventoryHistoryCount"),
  inventoryHistorySearch: document.querySelector("#inventoryHistorySearch"),
  inventoryHistoryDate: document.querySelector("#inventoryHistoryDate"),
  inventoryHistorySummary: document.querySelector("#inventoryHistorySummary"),
  inventoryHistoryList: document.querySelector("#inventoryHistoryList"),
  closeInventoryHistory: document.querySelector("#closeInventoryHistory"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventoryFilter: document.querySelector("#inventoryFilter"),
  inventorySummary: document.querySelector("#inventorySummary"),
  inventoryList: document.querySelector("#inventoryList"),
  closeInventory: document.querySelector("#closeInventory"),
  editInventoryModal: document.querySelector("#editInventoryModal"),
  editInventoryForm: document.querySelector("#editInventoryForm"),
  editInventoryName: document.querySelector("#editInventoryName"),
  editInventoryGroup: document.querySelector("#editInventoryGroup"),
  editInventoryQuantity: document.querySelector("#editInventoryQuantity"),
  editInventoryPrice: document.querySelector("#editInventoryPrice"),
  editInventorySalePrice: document.querySelector("#editInventorySalePrice"),
  cancelEditInventory: document.querySelector("#cancelEditInventory"),
  exportInventoryModal: document.querySelector("#exportInventoryModal"),
  exportInventoryForm: document.querySelector("#exportInventoryForm"),
  exportInventoryName: document.querySelector("#exportInventoryName"),
  exportInventoryDate: document.querySelector("#exportInventoryDate"),
  exportInventoryQuantity: document.querySelector("#exportInventoryQuantity"),
  exportInventoryReason: document.querySelector("#exportInventoryReason"),
  deleteExportInventoryReason: document.querySelector("#deleteExportInventoryReason"),
  toggleExportInventoryReason: document.querySelector("#toggleExportInventoryReason"),
  exportInventoryReasonPanel: document.querySelector("#exportInventoryReasonPanel"),
  exportInventoryNewReason: document.querySelector("#exportInventoryNewReason"),
  addExportInventoryReason: document.querySelector("#addExportInventoryReason"),
  cancelExportInventory: document.querySelector("#cancelExportInventory"),
  editInventoryLogModal: document.querySelector("#editInventoryLogModal"),
  editInventoryLogForm: document.querySelector("#editInventoryLogForm"),
  editInventoryLogName: document.querySelector("#editInventoryLogName"),
  editInventoryLogDate: document.querySelector("#editInventoryLogDate"),
  editInventoryLogQuantity: document.querySelector("#editInventoryLogQuantity"),
  editInventoryLogPrice: document.querySelector("#editInventoryLogPrice"),
  editInventoryLogSalePrice: document.querySelector("#editInventoryLogSalePrice"),
  cancelEditInventoryLog: document.querySelector("#cancelEditInventoryLog"),
  deleteInventoryLog: document.querySelector("#deleteInventoryLog"),
  quickEntrySubmit: document.querySelector("#quickEntrySubmit"),
  openOrderDiscount: document.querySelector("#openOrderDiscount"),
  orderDiscountModal: document.querySelector("#orderDiscountModal"),
  orderDiscountPercent: document.querySelector("#orderDiscountPercent"),
  orderDiscountAmount: document.querySelector("#orderDiscountAmount"),
  cancelOrderDiscount: document.querySelector("#cancelOrderDiscount"),
  applyOrderDiscount: document.querySelector("#applyOrderDiscount"),
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

if (els.aiChatMode) {
  els.aiChatMode.value = "general";
}

const today = toDateInputValue(new Date());
els.rangeMode.value = "today";
els.singleDate.value = today;
els.monthDate.value = today.slice(0, 7);
els.fromDate.value = today;
els.toDate.value = today;

function createStateExportPayload() {
  return JSON.parse(JSON.stringify(state || defaultData));
}

function createAIClientStateSnapshot() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "frontend_json_export_for_ai",
    format: "same_data_as_export_button",
    data: createStateExportPayload()
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length <= AI_CLIENT_STATE_MAX_CHARS) return payload;
  return {
    exportedAt: payload.exportedAt,
    source: payload.source,
    format: payload.format,
    truncated: true,
    maxChars: AI_CLIENT_STATE_MAX_CHARS,
    dataPreview: serialized.slice(0, AI_CLIENT_STATE_MAX_CHARS)
  };
}

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
    exportReasons: [],
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

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-history-jump-category]");
  if (!target) return;

  jumpToHistoryCategory(target.dataset.historyJumpType, target.dataset.historyJumpCategory);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const target = event.target.closest("[data-history-jump-category]");
  if (!target) return;

  event.preventDefault();
  jumpToHistoryCategory(target.dataset.historyJumpType, target.dataset.historyJumpCategory);
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

if (els.aiButton) {
  els.aiButton.addEventListener("click", openAIChat);
}

if (els.aiChatClose) {
  els.aiChatClose.addEventListener("click", closeAIChat);
}

if (els.aiClearChat) {
  els.aiClearChat.addEventListener("click", clearAIConversation);
}

if (els.aiChatMode) {
  els.aiChatMode.addEventListener("change", updateAIInputPlaceholder);
}

if (els.aiChatModal) {
  els.aiChatModal.addEventListener("click", (event) => {
    if (event.target === els.aiChatModal) closeAIChat();
  });
}

if (els.aiChatForm) {
  els.aiChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendAIChatMessage(els.aiChatInput.value);
  });
}

if (els.aiQuickPrompts) {
  els.aiQuickPrompts.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    sendAIChatMessage(button.textContent.trim());
  });
}

if (els.aiFileButton) {
  els.aiFileButton.addEventListener("click", () => {
    els.aiFileInput?.click();
  });
}

if (els.aiFileInput) {
  els.aiFileInput.addEventListener("change", handleAIFileSelect);
}

if (els.aiFileStatus) {
  els.aiFileStatus.addEventListener("click", (event) => {
    const clearButton = event.target.closest("[data-clear-ai-files]");
    if (!clearButton) return;
    aiChatState.attachments = [];
    if (els.aiFileInput) els.aiFileInput.value = "";
    renderAIFileStatus();
  });
}

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

els.openOrderDiscount.addEventListener("click", openOrderDiscountModal);

els.cancelOrderDiscount.addEventListener("click", closeOrderDiscountModal);

els.orderDiscountModal.addEventListener("click", (event) => {
  if (event.target === els.orderDiscountModal) closeOrderDiscountModal();
});

els.orderDiscountPercent.addEventListener("input", () => {
  els.orderDiscountPercent.value = formatPercentInput(els.orderDiscountPercent.value);
  if (els.orderDiscountPercent.value) els.orderDiscountAmount.value = "";
});

els.orderDiscountAmount.addEventListener("input", () => {
  els.orderDiscountAmount.value = formatAmountInput(els.orderDiscountAmount.value);
  if (els.orderDiscountAmount.value) els.orderDiscountPercent.value = "";
});

els.applyOrderDiscount.addEventListener("click", () => {
  uiState.salesOrderDiscountPercent = parsePercentInput(els.orderDiscountPercent.value);
  uiState.salesOrderDiscountAmount = parseAmountInput(els.orderDiscountAmount.value);
  updateSalesOrderTotal();
  closeOrderDiscountModal();
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
    updateSalesOriginalPrice(event.target.closest(".sales-item-row"));
  }

  if (event.target.matches('[data-sales-item="discount"]')) {
    event.target.value = formatPercentInput(event.target.value);
    const row = event.target.closest(".sales-item-row");
    const amountInput = row?.querySelector('[data-sales-item="discountAmount"]');
    if (event.target.value && amountInput) amountInput.value = "";
    applySalesDiscountToRow(row);
  }

  if (event.target.matches('[data-sales-item="discountAmount"]')) {
    event.target.value = formatAmountInput(event.target.value);
    const row = event.target.closest(".sales-item-row");
    const percentInput = row?.querySelector('[data-sales-item="discount"]');
    if (event.target.value && percentInput) percentInput.value = "";
    applySalesDiscountToRow(row);
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
  const catalogButton = event.target.closest("[data-open-sales-catalog]");
  if (catalogButton) {
    openSalesCatalogModal(catalogButton.closest(".sales-item-row"));
    return;
  }

  const stepButton = event.target.closest("[data-sales-quantity-step]");
  if (stepButton) {
    applyQuantityStep(stepButton, '[data-sales-item="quantity"]', "salesQuantityStep", updateSalesOrderTotal);
    return;
  }

  const button = event.target.closest("[data-remove-sales-item]");
  if (!button) return;
  button.closest(".sales-item-row")?.remove();
  if (!els.salesItems.querySelector(".sales-item-row")) addSalesItemRow();
  updateSalesOrderTotal();
});

els.salesItems.addEventListener("touchend", (event) => {
  const stepButton = event.target.closest("[data-sales-quantity-step]");
  if (!stepButton) return;
  event.preventDefault();
  applyQuantityStep(stepButton, '[data-sales-item="quantity"]', "salesQuantityStep", updateSalesOrderTotal);
}, { passive: false });

els.addPurchaseItem.addEventListener("click", () => {
  addPurchaseItemRow();
  updatePurchaseOrderTotal();
});

els.purchaseItems.addEventListener("input", (event) => {
  if (event.target.matches('[data-purchase-item="name"]')) {
    applyPurchaseProductSuggestion(event.target.closest(".purchase-item-row"));
  }

  if (event.target.matches('[data-purchase-item="price"], [data-purchase-item="salePrice"]')) {
    event.target.value = formatAmountInput(event.target.value);
  }

  updatePurchaseOrderTotal();
});

els.purchaseItems.addEventListener("change", (event) => {
  if (!event.target.matches('[data-purchase-item="name"]')) return;
  applyPurchaseProductSuggestion(event.target.closest(".purchase-item-row"));
});

els.purchaseItems.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-purchase-quantity-step]");
  if (stepButton) {
    applyQuantityStep(stepButton, '[data-purchase-item="quantity"]', "purchaseQuantityStep", updatePurchaseOrderTotal);
    return;
  }

  const button = event.target.closest("[data-remove-purchase-item]");
  if (!button) return;
  button.closest(".purchase-item-row")?.remove();
  if (!els.purchaseItems.querySelector(".purchase-item-row")) addPurchaseItemRow();
  updatePurchaseOrderTotal();
});

els.purchaseItems.addEventListener("touchend", (event) => {
  const stepButton = event.target.closest("[data-purchase-quantity-step]");
  if (!stepButton) return;
  event.preventDefault();
  applyQuantityStep(stepButton, '[data-purchase-item="quantity"]', "purchaseQuantityStep", updatePurchaseOrderTotal);
}, { passive: false });

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

els.openInventoryHistory.addEventListener("click", () => {
  openInventoryHistoryModal();
});

els.closeInventoryHistory.addEventListener("click", closeInventoryHistoryModal);

els.inventoryHistoryModal.addEventListener("click", (event) => {
  if (event.target === els.inventoryHistoryModal) closeInventoryHistoryModal();
});

els.closeSalesOrderDetail.addEventListener("click", closeSalesOrderDetailModal);

els.salesOrderDetailModal.addEventListener("click", (event) => {
  if (event.target === els.salesOrderDetailModal) closeSalesOrderDetailModal();
});

els.closeSalesCatalog.addEventListener("click", closeSalesCatalogModal);

els.salesCatalogModal.addEventListener("click", (event) => {
  if (event.target === els.salesCatalogModal) closeSalesCatalogModal();
});

els.openSalesCustomerCatalog.addEventListener("click", openSalesCustomerCatalogModal);

els.closeSalesCustomerCatalog.addEventListener("click", closeSalesCustomerCatalogModal);

els.salesCustomerCatalogModal.addEventListener("click", (event) => {
  if (event.target === els.salesCustomerCatalogModal) closeSalesCustomerCatalogModal();
});

els.salesCatalogSearch.addEventListener("input", () => {
  uiState.salesCatalogSearch = els.salesCatalogSearch.value;
  renderSalesCatalog();
});

els.salesCatalogFilter.addEventListener("change", () => {
  uiState.salesCatalogFilter = els.salesCatalogFilter.value;
  renderSalesCatalog();
});

els.salesCatalogList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-select-sales-catalog-item]");
  if (!item || item.hasAttribute("aria-disabled")) return;
  selectSalesCatalogItem(item.dataset.selectSalesCatalogItem);
});

els.salesCustomerCatalogSearch.addEventListener("input", () => {
  uiState.salesCustomerCatalogSearch = els.salesCustomerCatalogSearch.value;
  renderSalesCustomerCatalog();
});

els.salesCustomerCatalogFilter.addEventListener("change", () => {
  uiState.salesCustomerCatalogFilter = els.salesCustomerCatalogFilter.value;
  renderSalesCustomerCatalog();
});

els.salesCustomerCatalogList.addEventListener("click", (event) => {
  const customer = event.target.closest("[data-select-sales-customer]");
  if (!customer) return;
  selectSalesCustomer(customer.dataset.selectSalesCustomer);
});

els.openCustomers.addEventListener("click", openCustomersModal);

els.closeCustomers.addEventListener("click", closeCustomersModal);

els.customersModal.addEventListener("click", (event) => {
  if (event.target === els.customersModal) closeCustomersModal();
});

els.closeCustomerHistory.addEventListener("click", closeCustomerHistoryModal);

els.customerHistoryModal.addEventListener("click", (event) => {
  if (event.target === els.customerHistoryModal) closeCustomerHistoryModal();
});

els.closeMemberTier.addEventListener("click", closeMemberTierModal);

els.memberTierModal.addEventListener("click", (event) => {
  if (event.target === els.memberTierModal) closeMemberTierModal();
});

els.toggleCustomerForm.addEventListener("click", () => {
  openCustomerForm();
});

els.cancelCustomerForm.addEventListener("click", closeCustomerForm);

els.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCustomerFromForm(new FormData(els.customerForm));
});

els.customerMemberFilter.addEventListener("change", () => {
  uiState.customerMemberFilter = els.customerMemberFilter.value;
  renderCustomers(getActiveStore());
});

els.customerSearchInput.addEventListener("input", () => {
  uiState.customerSearch = els.customerSearchInput.value;
  renderCustomers(getActiveStore());
});

els.customerSearchInput.addEventListener("change", () => {
  uiState.customerSearch = els.customerSearchInput.value;
  renderCustomers(getActiveStore());
});

els.customersList.addEventListener("click", (event) => {
  const tierButton = event.target.closest("[data-member-tier-customer]");
  if (tierButton) {
    event.stopPropagation();
    openMemberTierInfo(tierButton.dataset.memberTierCustomer);
    return;
  }

  const historyButton = event.target.closest("[data-customer-history]");
  if (historyButton) {
    event.stopPropagation();
    openCustomerHistory(historyButton.dataset.customerHistory);
    return;
  }

  const customer = event.target.closest("[data-edit-customer]");
  if (!customer) return;
  openCustomerById(customer.dataset.editCustomer);
});

els.salesOrderTable.addEventListener("click", (event) => {
  if (event.target.closest("[data-delete-order]")) return;
  const row = event.target.closest("[data-open-sales-order]");
  if (!row) return;
  openSalesOrderDetail(row.dataset.openSalesOrder);
});

els.inventorySearch.addEventListener("input", () => {
  uiState.inventorySearch = els.inventorySearch.value;
  renderInventory(getActiveStore());
});

els.inventoryFilter.addEventListener("change", () => {
  uiState.inventoryFilter = els.inventoryFilter.value;
  renderInventory(getActiveStore());
});

els.inventoryHistorySearch.addEventListener("input", () => {
  uiState.inventoryHistorySearch = els.inventoryHistorySearch.value;
  renderInventoryHistory(getActiveStore());
});

els.inventoryHistoryDate.addEventListener("change", () => {
  uiState.inventoryHistoryDate = els.inventoryHistoryDate.value || today;
  renderInventoryHistory(getActiveStore());
});

els.inventoryLogPanel.addEventListener("input", (event) => {
  const searchInput = event.target.closest("[data-inventory-log-search]");
  if (!searchInput) return;

  const caretPosition = searchInput.selectionStart ?? searchInput.value.length;
  uiState.inventoryLogSearch = searchInput.value;
  if (uiState.inventoryLogSearch.trim()) uiState.inventoryLogsExpanded = true;
  renderInventoryLogs(getActiveStore());

  window.requestAnimationFrame(() => {
    const nextInput = els.inventoryLogPanel.querySelector("[data-inventory-log-search]");
    if (!nextInput) return;
    nextInput.focus({ preventScroll: true });
    nextInput.setSelectionRange(caretPosition, caretPosition);
  });
});

els.inventoryList.addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-export-inventory]");
  if (exportButton) {
    event.stopPropagation();
    openExportInventoryModal(exportButton.dataset.exportInventory);
    return;
  }

  const item = event.target.closest("[data-edit-inventory]");
  if (!item) return;
  openEditInventoryModal(item.dataset.editInventory);
});

els.cancelEditInventory.addEventListener("click", closeEditInventoryModal);

els.cancelExportInventory.addEventListener("click", closeExportInventoryModal);

els.toggleExportInventoryReason.addEventListener("click", () => {
  const isOpening = els.exportInventoryReasonPanel.hidden;
  setExportReasonCreator(isOpening);
});

els.addExportInventoryReason.addEventListener("click", addExportInventoryReasonOption);

els.deleteExportInventoryReason.addEventListener("click", deleteSelectedExportInventoryReason);

els.exportInventoryNewReason.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addExportInventoryReasonOption();
});

els.editInventoryModal.addEventListener("click", (event) => {
  if (event.target === els.editInventoryModal) closeEditInventoryModal();
});

els.exportInventoryModal.addEventListener("click", (event) => {
  if (event.target === els.exportInventoryModal) closeExportInventoryModal();
});

els.editInventoryLogModal.addEventListener("click", (event) => {
  if (event.target === els.editInventoryLogModal) closeEditInventoryLogModal();
});

els.exportInventoryForm.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-export-quantity-step]");
  if (!stepButton) return;
  applyQuantityStep(stepButton, "#exportInventoryQuantity", "exportQuantityStep");
});

els.exportInventoryForm.addEventListener("touchend", (event) => {
  const stepButton = event.target.closest("[data-export-quantity-step]");
  if (!stepButton) return;
  event.preventDefault();
  applyQuantityStep(stepButton, "#exportInventoryQuantity", "exportQuantityStep");
}, { passive: false });

els.editInventoryPrice.addEventListener("input", () => {
  els.editInventoryPrice.value = formatAmountInput(els.editInventoryPrice.value);
});

els.editInventorySalePrice.addEventListener("input", () => {
  els.editInventorySalePrice.value = formatAmountInput(els.editInventorySalePrice.value);
});

els.editInventoryLogPrice.addEventListener("input", () => {
  els.editInventoryLogPrice.value = formatAmountInput(els.editInventoryLogPrice.value);
});

els.editInventoryLogSalePrice.addEventListener("input", () => {
  els.editInventoryLogSalePrice.value = formatAmountInput(els.editInventoryLogSalePrice.value);
});

els.editInventoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedInventory(new FormData(els.editInventoryForm));
});

els.exportInventoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  exportInventoryItem(new FormData(els.exportInventoryForm));
});

els.cancelEditInventoryLog.addEventListener("click", closeEditInventoryLogModal);

els.deleteInventoryLog.addEventListener("click", deleteEditingInventoryLog);

els.editInventoryLogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedInventoryLog(new FormData(els.editInventoryLogForm));
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
  const blob = new Blob([JSON.stringify(createStateExportPayload(), null, 2)], { type: "application/json" });
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
  const inventoryLogRow = event.target.closest("[data-edit-inventory-log]");
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

  if (inventoryLogRow && !event.target.closest("button, input, select, a")) {
    openEditInventoryLogModal(inventoryLogRow.dataset.editInventoryLog);
    return;
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

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-inventory-log-filter]")) {
    uiState.inventoryLogFilter = event.target.value;
    if (uiState.inventoryLogFilter !== "export") {
      uiState.inventoryLogReasonFilter = "all";
    }
    uiState.inventoryLogsExpanded = false;
    renderInventoryLogs(getActiveStore());
  }

  if (event.target.matches("[data-inventory-log-reason-filter]")) {
    uiState.inventoryLogReasonFilter = event.target.value;
    uiState.inventoryLogsExpanded = false;
    renderInventoryLogs(getActiveStore());
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

function normalizeExportReasons(store) {
  const reasons = new Set();
  (Array.isArray(store.exportReasons) ? store.exportReasons : []).forEach((reason) => {
    const value = String(reason || "").trim();
    if (value) reasons.add(value);
  });

  if (!Array.isArray(store.exportReasons)) {
    (store.inventoryLogs || []).forEach((log) => {
      const reason = getInventoryLogReason(log);
      if (reason) reasons.add(reason);
    });
  }

  return Array.from(reasons).sort((a, b) => a.localeCompare(b, "vi"));
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
    customers: store.customers || [],
    purchaseCategories: store.purchaseCategories || [],
    purchaseOrders: store.purchaseOrders || [],
    inventoryLogs: store.inventoryLogs || [],
    exportReasons: normalizeExportReasons(store),
    inventory: (store.inventory || []).map((item) => ({
      ...item,
      salePrice: Number(item.salePrice ?? item.lastPrice ?? 0)
    })),
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
    updateTimeFiltersVisibility();
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
  if (!els.customersModal.hidden && !uiState.customerFormOpen) {
    renderCustomers(store);
  }
  els.tabBar.dataset.pinTop = "";
  updateTimeFiltersVisibility();
  updateQuickEntryButton();
  updatePinnedTabs();
}

function renderHistoryFilters(store) {
  renderHistoryFilter(els.incomeHistoryFilter, store.categories.income, true);
  renderHistoryFilter(els.expenseHistoryFilter, store.categories.expense, true);
}

function applyQuantityStep(button, inputSelector, stepDatasetKey, onChange) {
  const row = button.closest(".sales-item-row") || button.closest("form") || document;
  const quantityInput = row?.querySelector(inputSelector);
  if (!quantityInput) return;

  const step = Number(button.dataset[stepDatasetKey] || 0);
  const current = Number.parseInt(quantityInput.value, 10) || 1;
  const max = Number.parseInt(quantityInput.max, 10);
  const next = Math.max(1, current + step);
  quantityInput.value = Number.isFinite(max) && max > 0 ? Math.min(max, next) : next;
  if (typeof onChange === "function") onChange();
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
      const label = `${item.name} - tồn ${Number(item.quantity || 0).toLocaleString("vi-VN")} - ${formatAmountInput(getInventorySalePrice(item))} đ`;
      return `<option value="${escapeHtml(item.name)}" label="${escapeHtml(label)}"></option>`;
    })
    .join("");

  renderPurchaseItemSuggestions(store);
}

function getPurchaseProductSuggestions(store) {
  const suggestions = new Map();
  const remember = (item, updatedAt = "") => {
    const name = String(item?.name || "").trim();
    if (!name) return;

    const key = normalizeSearchText(name);
    if (suggestions.has(key)) return;

    const price = Number(item?.lastPrice ?? item?.price ?? 0);
    const salePrice = Number(item?.salePrice ?? item?.lastPrice ?? item?.price ?? 0);
    suggestions.set(key, {
      name,
      groupName: String(item?.groupName || "").trim(),
      price,
      salePrice,
      updatedAt
    });
  };

  [...(store?.inventory || [])]
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .forEach((item) =>
      remember(
        {
          name: item.name,
          groupName: item.groupName,
          price: item.lastPrice,
          salePrice: getInventorySalePrice(item)
        },
        item.updatedAt || item.createdAt || ""
      )
    );

  [...(store?.purchaseOrders || [])]
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))
    .forEach((order) => {
      (order.items || []).forEach((item) => remember(item, order.createdAt || order.date || ""));
    });

  return [...suggestions.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function ensurePurchaseItemSuggestions() {
  let datalist = document.querySelector("#purchaseItemSuggestions");
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = "purchaseItemSuggestions";
    document.body.append(datalist);
  }

  return datalist;
}

function renderPurchaseItemSuggestions(store) {
  const datalist = ensurePurchaseItemSuggestions();
  datalist.innerHTML = getPurchaseProductSuggestions(store)
    .map((item) => {
      const label = `${item.groupName || "Chưa phân nhóm"} | Vốn ${formatAmountInput(item.price)} | Bán ${formatAmountInput(item.salePrice)}`;
      return `<option value="${escapeHtml(item.name)}" label="${escapeHtml(label)}"></option>`;
    })
    .join("");
}

function applyPurchaseProductSuggestion(row) {
  const store = getActiveStore();
  if (!store || !row) return false;

  const nameInput = row.querySelector('[data-purchase-item="name"]');
  const selectedName = String(nameInput?.value || "").trim();
  if (!selectedName) return false;

  const suggestion = getPurchaseProductSuggestions(store).find(
    (item) => normalizeSearchText(item.name) === normalizeSearchText(selectedName)
  );

  if (!suggestion) return false;

  const groupInput = row.querySelector('[data-purchase-item="group"]');
  const priceInput = row.querySelector('[data-purchase-item="price"]');
  const salePriceInput = row.querySelector('[data-purchase-item="salePrice"]');

  if (groupInput) groupInput.value = suggestion.groupName || "";
  if (priceInput) priceInput.value = suggestion.price > 0 ? formatAmountInput(suggestion.price) : "";
  if (salePriceInput) salePriceInput.value = suggestion.salePrice > 0 ? formatAmountInput(suggestion.salePrice) : "";
  updatePurchaseOrderTotal();
  return true;
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
  els.openOrderDiscount.hidden = true;
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
  uiState.salesOrderDiscountPercent = 0;
  uiState.salesOrderDiscountAmount = 0;
  closeOrderDiscountModal();
  closeSalesCatalogModal();
  els.salesItems.innerHTML = "";
  els.purchaseItems.innerHTML = "";
  els.quickEntryFields.hidden = false;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = true;
  els.bulkPurchaseText.value = "";
  updateBulkPurchaseSummary();
  els.quickEntrySubmit.disabled = false;
  els.openOrderDiscount.hidden = true;
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
  uiState.salesOrderDiscountPercent = Number(draft?.orderDiscountPercent || 0);
  uiState.salesOrderDiscountAmount = Number(draft?.orderDiscountAmount || 0);
  els.salesCustomerName.value = draft?.customerName || "";
  els.salesCustomerPhone.value = draft?.customerPhone || "";
  els.salesOrderDate.value = draft?.date || els.singleDate.value || today;
  els.salesItems.innerHTML = "";
  renderInventorySuggestionList(store);
  (draft?.items?.length ? draft.items : [{}]).forEach((item) => addSalesItemRow(item));
  updateSalesOrderTotal();
  els.quickEntrySubmit.disabled = false;
  els.openOrderDiscount.hidden = false;
  els.saveSalesDraft.hidden = false;
  els.deleteSalesDraft.hidden = !uiState.salesDraftId;
  els.quickEntrySubmit.textContent = "Hoàn Thành";
  els.quickEntryModal.hidden = false;
}

function addSalesItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "sales-item-row";
  const originalPrice = Number(item.originalPrice || item.price || 0);
  const hasDiscount = Number(item.discountPercent || 0) > 0 || Number(item.discountAmount || 0) > 0;
  const displayPrice = hasDiscount ? Number(item.price || getDiscountedPrice(originalPrice, item.discountPercent, item.discountAmount)) : originalPrice;
  if (hasDiscount && originalPrice > 0) {
    row.dataset.originalPrice = String(originalPrice);
  }
  row.innerHTML = `
    <div class="sales-name-picker">
      <input type="text" data-sales-item="name" placeholder="Hàng hóa" autocomplete="off" list="salesItemSuggestions" value="${escapeHtml(item.name || "")}" />
      <button class="catalog-button" type="button" data-open-sales-catalog title="Mục lục" aria-label="Mục lục">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4.5c0-.83.67-1.5 1.5-1.5H19v15.5H7.2c-.66 0-1.2.54-1.2 1.2V4.5Z"></path>
          <path d="M5 19.7c0-.66.54-1.2 1.2-1.2H19V21H6.2c-.66 0-1.2-.54-1.2-1.2v-.1Z"></path>
          <path d="M8 7h7M8 10h7"></path>
        </svg>
      </button>
    </div>
    <input type="text" data-sales-item="price" inputmode="numeric" placeholder="Giá" autocomplete="off" value="${displayPrice ? formatAmountInput(displayPrice) : ""}" />
    <div class="discount-field">
      <input type="text" data-sales-item="discount" inputmode="numeric" placeholder="Chiết khấu" autocomplete="off" value="${item.discountPercent ? formatPercentInput(item.discountPercent) : ""}" />
      <span aria-hidden="true">%</span>
    </div>
    <input type="text" data-sales-item="discountAmount" inputmode="numeric" placeholder="Giảm tiền" autocomplete="off" value="${item.discountAmount ? formatAmountInput(item.discountAmount) : ""}" />
    <div class="quantity-stepper" aria-label="Số lượng">
      <button class="quantity-step" type="button" data-sales-quantity-step="-1" aria-label="Giảm số lượng">-</button>
      <input type="number" data-sales-item="quantity" min="1" step="1" placeholder="SL" value="${item.quantity || 1}" />
      <button class="quantity-step" type="button" data-sales-quantity-step="1" aria-label="Tăng số lượng">+</button>
    </div>
    <button class="delete-small" type="button" data-remove-sales-item title="Xóa khoản" aria-label="Xóa khoản">×</button>
  `;
  els.salesItems.append(row);
}

function getSalesOrderItems() {
  return [...els.salesItems.querySelectorAll(".sales-item-row")]
    .map((row) => {
      const name = String(row.querySelector('[data-sales-item="name"]')?.value || "").trim();
      const pricing = getSalesRowPricing(row);
      const quantity = Math.max(1, Number.parseInt(row.querySelector('[data-sales-item="quantity"]')?.value, 10) || 1);
      return {
        name,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        quantity,
        total: pricing.price * quantity
      };
    })
    .filter((item) => item.name && Number.isFinite(item.originalPrice) && item.originalPrice > 0 && item.price > 0);
}

function getSalesDraftItems() {
  return [...els.salesItems.querySelectorAll(".sales-item-row")]
    .map((row) => {
      const name = String(row.querySelector('[data-sales-item="name"]')?.value || "").trim();
      const pricing = getSalesRowPricing(row);
      const quantity = Math.max(1, Number.parseInt(row.querySelector('[data-sales-item="quantity"]')?.value, 10) || 1);
      return {
        name,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        quantity,
        total: pricing.price * quantity
      };
    })
    .filter((item) => item.name || item.originalPrice > 0);
}

function getSalesFormData({ completeOnly = false } = {}) {
  const items = completeOnly ? getSalesOrderItems() : getSalesDraftItems();
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const orderDiscountPercent = Number(uiState.salesOrderDiscountPercent || 0);
  const orderDiscountAmount = Number(uiState.salesOrderDiscountAmount || 0);
  const discountTotal = getOrderDiscountAmount(subtotal);
  const total = Math.max(0, subtotal - discountTotal);

  return {
    customerName: String(els.salesCustomerName.value || "").trim(),
    customerPhone: String(els.salesCustomerPhone.value || "").trim(),
    date: els.salesOrderDate.value || today,
    items,
    subtotal,
    orderDiscountPercent,
    orderDiscountAmount,
    discountTotal,
    total
  };
}

function updateSalesOrderTotal() {
  const subtotal = getSalesItemsSubtotal();
  const discountTotal = getOrderDiscountAmount(subtotal);
  const remainingTotal = Math.max(0, subtotal - discountTotal);

  els.salesOrderTotal.textContent = formatCurrency(subtotal);
  els.salesOrderDiscountLine.hidden = discountTotal <= 0;
  els.salesOrderRemainingLine.hidden = discountTotal <= 0;
  els.salesOrderDiscountTotal.textContent = formatCurrency(discountTotal);
  els.salesOrderRemainingTotal.textContent = formatCurrency(remainingTotal);
}

function getSalesItemsSubtotal() {
  return getSalesOrderItems().reduce((sum, item) => sum + item.total, 0);
}

function getOrderDiscountAmount(subtotal) {
  const total = Math.max(0, Number(subtotal || 0));
  const directAmount = Math.min(total, Math.max(0, Number(uiState.salesOrderDiscountAmount || 0)));
  if (directAmount > 0) return directAmount;

  const percent = Math.min(100, Math.max(0, Number(uiState.salesOrderDiscountPercent || 0)));
  return Math.min(total, Math.round(total * percent / 100));
}

function openOrderDiscountModal() {
  els.orderDiscountPercent.value = uiState.salesOrderDiscountPercent ? formatPercentInput(uiState.salesOrderDiscountPercent) : "";
  els.orderDiscountAmount.value = uiState.salesOrderDiscountAmount ? formatAmountInput(uiState.salesOrderDiscountAmount) : "";
  els.orderDiscountModal.hidden = false;
}

function closeOrderDiscountModal() {
  els.orderDiscountModal.hidden = true;
}

function updateSalesOriginalPrice(row) {
  if (!row) return;
  const priceInput = row.querySelector('[data-sales-item="price"]');
  const discountInput = row.querySelector('[data-sales-item="discount"]');
  const discountAmountInput = row.querySelector('[data-sales-item="discountAmount"]');
  const currentPrice = parseAmountInput(priceInput?.value);
  if (currentPrice <= 0) {
    delete row.dataset.originalPrice;
    return;
  }

  if (!parsePercentInput(discountInput?.value) && !parseAmountInput(discountAmountInput?.value)) {
    row.dataset.originalPrice = String(currentPrice);
  }
}

function applySalesDiscountToRow(row) {
  if (!row) return;
  const priceInput = row.querySelector('[data-sales-item="price"]');
  const discountInput = row.querySelector('[data-sales-item="discount"]');
  const discountAmountInput = row.querySelector('[data-sales-item="discountAmount"]');
  if (!priceInput || !discountInput) return;

  const discountPercent = parsePercentInput(discountInput.value);
  const discountAmount = parseAmountInput(discountAmountInput?.value);
  const visiblePrice = parseAmountInput(priceInput.value);
  const originalPrice = Number(row.dataset.originalPrice || visiblePrice || 0);

  if (!discountPercent && !discountAmount) {
    if (originalPrice > 0) priceInput.value = formatAmountInput(originalPrice);
    delete row.dataset.originalPrice;
    return;
  }

  if (!row.dataset.originalPrice && visiblePrice > 0) {
    row.dataset.originalPrice = String(visiblePrice);
  }

  priceInput.value = formatAmountInput(getDiscountedPrice(originalPrice, discountPercent, discountAmount));
}

function getSalesRowPricing(row) {
  const discountPercent = parsePercentInput(row.querySelector('[data-sales-item="discount"]')?.value);
  const discountAmount = parseAmountInput(row.querySelector('[data-sales-item="discountAmount"]')?.value);
  const price = parseAmountInput(row.querySelector('[data-sales-item="price"]')?.value);
  const originalPrice = discountPercent > 0 || discountAmount > 0 ? Number(row.dataset.originalPrice || price || 0) : price;

  return {
    price,
    originalPrice,
    discountPercent,
    discountAmount
  };
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

  const salePrice = getInventorySalePrice(suggestion);
  priceInput.value = formatAmountInput(salePrice);
  row.dataset.originalPrice = String(salePrice);
}

function openSalesCatalogModal(row) {
  const store = getActiveStore();
  if (!store || !row) return;

  uiState.salesCatalogRow = row;
  uiState.salesCatalogSearch = "";
  uiState.salesCatalogFilter = "all";
  els.salesCatalogSearch.value = "";
  renderSalesCatalog();
  els.salesCatalogModal.hidden = false;
  els.salesCatalogSearch.focus();
}

function closeSalesCatalogModal() {
  els.salesCatalogModal.hidden = true;
  uiState.salesCatalogRow = null;
}

function renderSalesCatalog() {
  const store = getActiveStore();
  if (!store || !els.salesCatalogList) return;

  const inventory = [...(store.inventory || [])].sort((a, b) =>
    Number(b.quantity || 0) - Number(a.quantity || 0) ||
    String(a.groupName || "").localeCompare(String(b.groupName || ""), "vi") ||
    String(a.name || "").localeCompare(String(b.name || ""), "vi")
  );
  const groups = [
    ...new Map(
      inventory
        .filter((item) => item.groupName)
        .map((item) => [normalizeSearchText(item.groupName), item.groupName])
    ).entries()
  ].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const validFilters = new Set(["all", ...groups.map(([key]) => `group:${key}`)]);

  if (!validFilters.has(uiState.salesCatalogFilter)) {
    uiState.salesCatalogFilter = "all";
  }

  els.salesCatalogFilter.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...groups.map(([key, name]) => `<option value="group:${key}">${escapeHtml(name)}</option>`)
  ].join("");
  els.salesCatalogFilter.value = uiState.salesCatalogFilter;

  const query = normalizeSearchText(uiState.salesCatalogSearch);
  const rows = inventory
    .filter((item) => {
      const groupMatch =
        uiState.salesCatalogFilter === "all" ||
        normalizeSearchText(item.groupName || "") === uiState.salesCatalogFilter.slice(6);
      const searchTarget = normalizeSearchText(`${item.name || ""} ${item.groupName || ""}`);
      return groupMatch && (!query || searchTarget.includes(query));
    })
    .sort((a, b) => {
      if (!query) return 0;
      const aName = normalizeSearchText(a.name || "");
      const bName = normalizeSearchText(b.name || "");
      const aStarts = aName.startsWith(query) ? 0 : 1;
      const bStarts = bName.startsWith(query) ? 0 : 1;
      return aStarts - bStarts || aName.localeCompare(bName);
    });

  els.salesCatalogCount.textContent = `${rows.length} hàng hóa`;

  if (!rows.length) {
    els.salesCatalogList.innerHTML = '<div class="empty-list">Không tìm thấy hàng hóa phù hợp</div>';
    return;
  }

  els.salesCatalogList.innerHTML = rows
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const disabled = quantity <= 0;
      return `
        <button
          class="sales-catalog-item inventory-catalog-item ${disabled ? "is-disabled" : ""}"
          type="button"
          data-select-sales-catalog-item="${item.id}"
          ${disabled ? 'aria-disabled="true"' : ""}
        >
          <span>
            <strong>${escapeHtml(item.name || "")}</strong>
            <small>${escapeHtml(item.groupName || "Chưa phân nhóm")}</small>
          </span>
          <span class="sales-catalog-meta">
            <strong>${formatCurrency(getInventorySalePrice(item))}</strong>
            <small>Tồn: ${quantity.toLocaleString("vi-VN")}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function selectSalesCatalogItem(itemId) {
  const store = getActiveStore();
  const row = uiState.salesCatalogRow;
  if (!store || !row || !itemId) return;

  const item = (store.inventory || []).find((inventoryItem) => inventoryItem.id === itemId);
  if (!item || Number(item.quantity || 0) <= 0) return;

  const nameInput = row.querySelector('[data-sales-item="name"]');
  const priceInput = row.querySelector('[data-sales-item="price"]');
  const quantityInput = row.querySelector('[data-sales-item="quantity"]');
  const discountInput = row.querySelector('[data-sales-item="discount"]');
  const discountAmountInput = row.querySelector('[data-sales-item="discountAmount"]');
  const price = getInventorySalePrice(item);

  if (nameInput) nameInput.value = item.name || "";
  if (priceInput) priceInput.value = price ? formatAmountInput(price) : "";
  if (quantityInput) quantityInput.value = 1;
  if (discountInput) discountInput.value = "";
  if (discountAmountInput) discountAmountInput.value = "";
  if (price > 0) row.dataset.originalPrice = String(price);

  updateSalesOrderTotal();
  closeSalesCatalogModal();
}

function openSalesCustomerCatalogModal() {
  const store = getActiveStore();
  if (!store) return;

  uiState.salesCustomerCatalogSearch = "";
  uiState.salesCustomerCatalogFilter = "all";
  els.salesCustomerCatalogSearch.value = "";
  renderSalesCustomerCatalog();
  els.salesCustomerCatalogModal.hidden = false;
  els.salesCustomerCatalogSearch.focus();
}

function closeSalesCustomerCatalogModal() {
  els.salesCustomerCatalogModal.hidden = true;
}

function renderSalesCustomerCatalog() {
  const store = getActiveStore();
  if (!store || !els.salesCustomerCatalogList) return;

  const customers = getStoreCustomers(store);
  const tiers = [
    ...new Map(
      customers.map((customer) => {
        const tier = String(customer.memberTier || "Thường").trim() || "Thường";
        return [normalizeSearchText(tier), tier];
      })
    ).entries()
  ].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const validFilters = new Set(["all", ...tiers.map(([key]) => `tier:${key}`)]);

  if (!validFilters.has(uiState.salesCustomerCatalogFilter)) {
    uiState.salesCustomerCatalogFilter = "all";
  }

  els.salesCustomerCatalogFilter.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...tiers.map(([key, name]) => `<option value="tier:${key}">${escapeHtml(name)}</option>`)
  ].join("");
  els.salesCustomerCatalogFilter.value = uiState.salesCustomerCatalogFilter;

  const query = normalizeSearchText(uiState.salesCustomerCatalogSearch || "");
  const rows = customers
    .filter((customer) => {
      const tierMatch =
        uiState.salesCustomerCatalogFilter === "all" ||
        normalizeSearchText(customer.memberTier || "Thường") === uiState.salesCustomerCatalogFilter.slice(5);
      const searchTarget = normalizeSearchText(`${customer.name || ""} ${customer.phone || ""} ${customer.memberTier || ""}`);
      return tierMatch && (!query || searchTarget.includes(query));
    })
    .sort((a, b) => {
      if (!query) return 0;
      const aName = normalizeSearchText(`${a.name || ""} ${a.phone || ""}`);
      const bName = normalizeSearchText(`${b.name || ""} ${b.phone || ""}`);
      const aStarts = aName.startsWith(query) ? 0 : 1;
      const bStarts = bName.startsWith(query) ? 0 : 1;
      return aStarts - bStarts || aName.localeCompare(bName);
    });

  els.salesCustomerCatalogCount.textContent = `${rows.length} khách`;

  if (!rows.length) {
    els.salesCustomerCatalogList.innerHTML = '<div class="empty-list">Không tìm thấy khách hàng phù hợp</div>';
    return;
  }

  els.salesCustomerCatalogList.innerHTML = rows
    .map((customer) => `
      <button class="sales-catalog-item customer-catalog-item" type="button" data-select-sales-customer="${escapeHtml(customer.id)}">
        <span>
          <strong>${escapeHtml(customer.name || "")}</strong>
          <small>${escapeHtml(customer.phone || "Chưa có số điện thoại")}</small>
        </span>
        <span class="sales-catalog-meta">
          <strong>${escapeHtml(customer.memberTier || "Thường")}</strong>
          <small>${formatDate(String(customer.createdAt || today).slice(0, 10))}</small>
        </span>
      </button>
    `)
    .join("");
}

function selectSalesCustomer(customerId) {
  const store = getActiveStore();
  if (!store || !customerId) return;

  const customer = getStoreCustomers(store).find((item) => item.id === customerId);
  if (!customer) return;

  els.salesCustomerName.value = customer.name || "";
  els.salesCustomerPhone.value = customer.phone || "";
  closeSalesCustomerCatalogModal();
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
          salePrice: Number(item.originalPrice || item.price || 0),
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

  const {
    customerName,
    customerPhone,
    date,
    items,
    subtotal,
    orderDiscountPercent,
    orderDiscountAmount,
    discountTotal,
    total
  } = getSalesFormData({ completeOnly: true });

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
  ensureCustomerFromSalesOrder(store, { customerName, customerPhone, createdAt });
  store.orders.push({
    id: orderId,
    customerName,
    customerPhone,
    date,
    items: orderItems,
    subtotal,
    orderDiscountPercent,
    orderDiscountAmount,
    discountTotal,
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

function getCustomerKey(name, phone) {
  return `${normalizeSearchText(name)}::${normalizeSearchText(phone)}`;
}

function ensureCustomerFromSalesOrder(store, order) {
  const name = String(order.customerName || "").trim();
  const phone = String(order.customerPhone || "").trim();
  if (!name || !phone) return null;

  store.customers = [...(store.customers || [])];
  const key = getCustomerKey(name, phone);
  const existing = store.customers.find((customer) => getCustomerKey(customer.name, customer.phone) === key);
  if (existing) return existing;

  const customer = {
    id: createId(),
    name,
    phone,
    memberTier: "Thường",
    memberTierStartedAt: "",
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.createdAt || new Date().toISOString(),
    source: "order"
  };
  store.customers.push(customer);
  return customer;
}

function getStoreCustomers(store) {
  const customerMap = new Map();

  (store.customers || []).forEach((customer) => {
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    if (!name || !phone) return;
    customerMap.set(getCustomerKey(name, phone), {
      id: customer.id || createId(),
      name,
      phone,
      memberTier: customer.memberTier || "Thường",
      memberTierStartedAt: customer.memberTierStartedAt || "",
      createdAt: customer.createdAt || customer.updatedAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || customer.createdAt || new Date().toISOString(),
      source: customer.source || "manual"
    });
  });

  (store.orders || []).forEach((order) => {
    const name = String(order.customerName || "").trim();
    const phone = String(order.customerPhone || "").trim();
    if (!name || !phone) return;
    const key = getCustomerKey(name, phone);
    if (customerMap.has(key)) return;
    customerMap.set(key, {
      id: `order-${key}`,
      name,
      phone,
      memberTier: "Thường",
      memberTierStartedAt: "",
      createdAt: order.createdAt || `${order.date || today}T00:00:00`,
      updatedAt: order.createdAt || `${order.date || today}T00:00:00`,
      source: "order"
    });
  });

  return [...customerMap.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function openCustomersModal() {
  const store = getActiveStore();
  if (!store) return;

  uiState.customerFormOpen = false;
  uiState.customerMemberFilter = "all";
  uiState.customerSearch = "";
  renderCustomers(store);
  els.customersModal.hidden = false;
}

function closeCustomersModal() {
  els.customersModal.hidden = true;
  closeCustomerForm();
}

function openCustomerForm(customer = null) {
  uiState.customerFormOpen = true;
  els.customerForm.hidden = false;
  els.customerForm.elements.customerId.value = customer?.id && !String(customer.id).startsWith("order-") ? customer.id : "";
  els.customerNameInput.value = customer?.name || "";
  els.customerPhoneInput.value = customer?.phone || "";
  els.customerMemberTier.value = customer?.memberTier || "Thường";
  els.customerCreatedAt.value = toDateTimeLocalValue(customer?.createdAt || new Date().toISOString());
  els.customerNameInput.focus();
}

function closeCustomerForm() {
  uiState.customerFormOpen = false;
  els.customerForm.hidden = true;
  els.customerForm.reset();
  els.customerMemberTier.value = "Thường";
}

function renderCustomers(store) {
  const allCustomers = getStoreCustomers(store);
  renderCustomerMemberFilter(allCustomers);
  renderCustomerSearchSuggestions(allCustomers);
  if (els.customerSearchInput.value !== uiState.customerSearch) {
    els.customerSearchInput.value = uiState.customerSearch;
  }
  const selectedTier = uiState.customerMemberFilter || "all";
  const tierCustomers =
    selectedTier === "all"
      ? allCustomers
      : allCustomers.filter((customer) => normalizeSearchText(customer.memberTier || "Thường") === selectedTier);
  const query = normalizeSearchText(uiState.customerSearch || "");
  const customers = query
    ? tierCustomers.filter((customer) => {
        const name = normalizeSearchText(customer.name || "");
        const phone = normalizeSearchText(customer.phone || "");
        const joined = normalizeSearchText(`${customer.name || ""} ${customer.phone || ""}`);
        return name.includes(query) || phone.includes(query) || joined.includes(query);
      })
    : tierCustomers;
  els.customersCount.textContent = `${customers.length} khách`;
  els.customerForm.hidden = !uiState.customerFormOpen;

  if (!allCustomers.length) {
    els.customersList.innerHTML = '<div class="empty-list">Chưa có thông tin khách hàng</div>';
    return;
  }

  if (!customers.length) {
    els.customersList.innerHTML = query
      ? '<div class="empty-list">Không tìm thấy khách hàng phù hợp</div>'
      : '<div class="empty-list">Không có khách hàng trong gói thành viên này</div>';
    return;
  }

  els.customersList.innerHTML = customers
    .map((customer) => {
      const createdDate = formatDate(String(customer.createdAt || today).slice(0, 10));
      const createdTime = formatTime(customer.createdAt);
      const tierName = customer.memberTier || "Thường";
      const tierClass = isRegularMemberTier(tierName) ? "is-regular" : "is-premium";
      return `
        <div class="customer-card" role="button" tabindex="0" data-edit-customer="${customer.id}">
          <span class="date-stack">
            <span>${createdDate}</span>
            ${createdTime ? `<small>${createdTime}</small>` : ""}
          </span>
          <span>
            <small>Tên Khách Hàng</small>
            <strong>${escapeHtml(customer.name)}</strong>
          </span>
          <span>
            <small>Số điện thoại</small>
            <strong>${escapeHtml(customer.phone)}</strong>
          </span>
          <span class="member-tier-field" data-member-tier-customer="${customer.id}" title="Xem thời hạn gói">
            <small>Gói thành viên</small>
            <button class="member-tier-badge ${tierClass}" type="button" data-member-tier-customer="${customer.id}" title="Xem thời hạn gói" aria-label="Xem thời hạn gói ${escapeHtml(tierName)}">${escapeHtml(tierName)}</button>
          </span>
          <button class="customer-history-button" type="button" data-customer-history="${customer.id}" title="Lịch sử giao dịch" aria-label="Lịch sử giao dịch">LS</button>
        </div>
      `;
    })
    .join("");
}

function renderCustomerMemberFilter(customers) {
  const tierMap = new Map();
  customers.forEach((customer) => {
    const tierName = String(customer.memberTier || "Thường").trim() || "Thường";
    tierMap.set(normalizeSearchText(tierName), tierName);
  });

  const tiers = [...tierMap.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const validFilters = new Set(["all", ...tiers.map(([key]) => key)]);
  if (!validFilters.has(uiState.customerMemberFilter)) {
    uiState.customerMemberFilter = "all";
  }

  els.customerMemberFilter.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...tiers.map(([key, name]) => `<option value="${key}">${escapeHtml(name)}</option>`)
  ].join("");
  els.customerMemberFilter.value = uiState.customerMemberFilter;
}

function renderCustomerSearchSuggestions(customers) {
  const suggestions = customers
    .map((customer) => {
      const name = String(customer.name || "").trim();
      const phone = String(customer.phone || "").trim();
      if (!name && !phone) return "";
      return phone ? `${name} - ${phone}` : name;
    })
    .filter(Boolean);
  els.customerSearchSuggestions.innerHTML = [...new Set(suggestions)]
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function isRegularMemberTier(tier) {
  return normalizeSearchText(tier || "Thường") === "thuong";
}

function openMemberTierInfo(customerId) {
  const store = getActiveStore();
  if (!store || !customerId) return;

  const customer = getStoreCustomers(store).find((item) => item.id === customerId);
  if (!customer) return;

  const tierName = customer.memberTier || "Thường";
  const regular = isRegularMemberTier(tierName);
  els.memberTierStatus.innerHTML = `<span class="member-tier-badge ${regular ? "is-regular" : "is-premium"}">${escapeHtml(tierName)}</span>`;

  if (regular) {
    els.memberTierContent.innerHTML = `
      <div class="member-tier-info-card">
        <small>Khách hàng</small>
        <strong>${escapeHtml(customer.name || "")}</strong>
      </div>
      <div class="member-tier-info-card">
        <small>Thời hạn</small>
        <strong>Gói Thường không giới hạn thời gian</strong>
      </div>
    `;
    els.memberTierModal.hidden = false;
    return;
  }

  const start = getMemberTierStartDate(customer);
  const end = addMonths(start, 6);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - startOfDay(now).getTime()) / 86400000);
  const expired = daysLeft < 0;

  els.memberTierContent.innerHTML = `
    <div class="member-tier-info-card">
      <small>Khách hàng</small>
      <strong>${escapeHtml(customer.name || "")}</strong>
    </div>
    <div class="member-tier-info-grid">
      <div class="member-tier-info-card">
        <small>Bắt đầu</small>
        <strong>${formatDate(toDateInputValue(start))}</strong>
      </div>
      <div class="member-tier-info-card">
        <small>Hết hạn</small>
        <strong>${formatDate(toDateInputValue(end))}</strong>
      </div>
    </div>
    <div class="member-tier-info-card ${expired ? "is-expired" : "is-active"}">
      <small>Thời gian còn lại</small>
      <strong>${expired ? `Đã hết hạn ${Math.abs(daysLeft).toLocaleString("vi-VN")} ngày` : `Còn ${daysLeft.toLocaleString("vi-VN")} ngày`}</strong>
    </div>
  `;
  els.memberTierModal.hidden = false;
}

function closeMemberTierModal() {
  els.memberTierModal.hidden = true;
  els.memberTierContent.innerHTML = "";
}

function getMemberTierStartDate(customer) {
  const value = customer.memberTierStartedAt || customer.updatedAt || customer.createdAt || new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== day) result.setDate(0);
  return result;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saveCustomerFromForm(formData) {
  const store = getActiveStore();
  if (!store) return false;

  const name = String(formData.get("customerName") || "").trim();
  const phone = String(formData.get("customerPhone") || "").trim();
  const memberTier = String(formData.get("memberTier") || "").trim() || "Thường";
  const createdAt = fromDateTimeLocalValue(String(formData.get("createdAt") || "")) || new Date().toISOString();
  if (!name || !phone) {
    window.alert("Vui lòng nhập tên khách hàng và số điện thoại.");
    return false;
  }

  store.customers = [...(store.customers || [])];
  const id = String(formData.get("customerId") || "");
  const key = getCustomerKey(name, phone);
  const existing =
    store.customers.find((customer) => customer.id === id) ||
    store.customers.find((customer) => getCustomerKey(customer.name, customer.phone) === key);
  const now = new Date().toISOString();
  const premiumTier = !isRegularMemberTier(memberTier);

  if (existing) {
    const previousTier = existing.memberTier || "Thường";
    existing.name = name;
    existing.phone = phone;
    existing.memberTier = memberTier;
    existing.memberTierStartedAt = premiumTier
      ? !isRegularMemberTier(previousTier) && normalizeSearchText(previousTier) === normalizeSearchText(memberTier) && existing.memberTierStartedAt
        ? existing.memberTierStartedAt
        : now
      : "";
    existing.createdAt = createdAt;
    existing.updatedAt = now;
    existing.source = existing.source || "manual";
  } else {
    store.customers.push({
      id: createId(),
      name,
      phone,
      memberTier,
      memberTierStartedAt: premiumTier ? now : "",
      createdAt,
      updatedAt: now,
      source: "manual"
    });
  }

  closeCustomerForm();
  saveAndRender();
  renderCustomers(store);
  return true;
}

function openCustomerById(customerId) {
  const store = getActiveStore();
  if (!store || !customerId) return;
  const customer = getStoreCustomers(store).find((item) => item.id === customerId);
  if (!customer) return;
  openCustomerForm(customer);
}

function openCustomerHistory(customerId) {
  const store = getActiveStore();
  if (!store || !customerId) return;

  const customer = getStoreCustomers(store).find((item) => item.id === customerId);
  if (!customer) return;

  const customerKey = getCustomerKey(customer.name, customer.phone);
  const orders = (store.orders || [])
    .filter((order) => getCustomerKey(order.customerName, order.customerPhone) === customerKey)
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  const total = orders.reduce((sum, order) => (isCancelledEntry(order) ? sum : sum + Number(order.total || 0)), 0);

  els.customerHistoryStatus.textContent = `${orders.length} đơn`;
  els.customerHistoryContent.innerHTML = `
    <div class="customer-history-hero">
      <div>
        <small>Khách hàng</small>
        <strong>${escapeHtml(customer.name || "")}</strong>
      </div>
      <div>
        <small>Số điện thoại</small>
        <strong>${escapeHtml(customer.phone || "")}</strong>
      </div>
      <div>
        <small>Tổng giao dịch</small>
        <strong>${formatCurrency(total)}</strong>
      </div>
    </div>
    ${
      orders.length
        ? `<div class="customer-history-list">${orders.map(renderCustomerHistoryOrder).join("")}</div>`
        : '<div class="empty-list">Khách hàng này chưa có đơn hàng nào</div>'
    }
  `;
  els.customerHistoryModal.hidden = false;
}

function closeCustomerHistoryModal() {
  els.customerHistoryModal.hidden = true;
  els.customerHistoryContent.innerHTML = "";
}

function renderCustomerHistoryOrder(order) {
  const cancelled = isCancelledEntry(order);
  const createdTime = formatTime(order.createdAt || order.updatedAt);
  const subtotal = Number(order.subtotal || order.items?.reduce((sum, item) => sum + Number(item.total || 0), 0) || order.total || 0);
  const discountTotal = Number(order.discountTotal || 0);
  const total = Number(order.total || 0);

  return `
    <article class="customer-history-order ${cancelled ? "entry-cancelled" : ""}">
      <div class="customer-history-order-head">
        <span class="date-stack">
          <span>${formatDate(order.date || today)}</span>
          ${createdTime ? `<small>${createdTime}</small>` : ""}
        </span>
        <strong>${formatCurrency(total)}</strong>
      </div>
      <div class="customer-history-lines">
        ${renderSalesOrderItemLines(order.items || []) || '<div class="empty-list">Không có hàng hóa</div>'}
      </div>
      <div class="customer-history-summary">
        <span>Tổng bill</span>
        <strong>${formatCurrency(subtotal)}</strong>
      </div>
      ${
        discountTotal > 0
          ? `
            <div class="customer-history-summary">
              <span>Chiết khấu</span>
              <strong>${formatCurrency(discountTotal)}</strong>
            </div>
            <div class="customer-history-summary">
              <span>Còn lại</span>
              <strong>${formatCurrency(total)}</strong>
            </div>
          `
          : ""
      }
      ${
        cancelled
          ? '<div class="customer-history-summary cancelled-text"><span>Trạng thái</span><strong>Đã hủy</strong></div>'
          : ""
      }
    </article>
  `;
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
  els.openOrderDiscount.hidden = true;
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
  els.openOrderDiscount.hidden = true;
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

function openInventoryHistoryModal() {
  const store = getActiveStore();
  if (!store) return;

  if (!uiState.inventoryHistoryDate) uiState.inventoryHistoryDate = els.singleDate.value || today;
  els.inventoryHistoryDate.value = uiState.inventoryHistoryDate;
  els.inventoryHistorySearch.value = uiState.inventoryHistorySearch || "";
  renderInventoryHistory(store);
  els.inventoryHistoryModal.hidden = false;
}

function closeInventoryHistoryModal() {
  els.inventoryHistoryModal.hidden = true;
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
  els.editInventorySalePrice.value = formatAmountInput(getInventorySalePrice(item));
  els.editInventoryModal.hidden = false;
}

function closeEditInventoryModal() {
  els.editInventoryModal.hidden = true;
  els.editInventoryForm.reset();
}

function openExportInventoryModal(inventoryId) {
  const store = getActiveStore();
  const item = (store?.inventory || []).find((stock) => stock.id === inventoryId);
  if (!item) return;

  els.exportInventoryForm.elements.inventoryId.value = item.id;
  els.exportInventoryName.textContent = item.name || "Kho hàng";
  els.exportInventoryDate.value = els.singleDate.value || today;
  els.exportInventoryQuantity.value = Math.min(1, Math.max(0, Number(item.quantity || 0))) || 1;
  els.exportInventoryQuantity.max = Math.max(0, Number(item.quantity || 0));
  renderExportInventoryReasonOptions();
  setExportReasonCreator(false);
  els.exportInventoryModal.hidden = false;
}

function closeExportInventoryModal() {
  els.exportInventoryModal.hidden = true;
  els.exportInventoryForm.reset();
  els.exportInventoryQuantity.removeAttribute("max");
  setExportReasonCreator(false);
}

function openEditInventoryLogModal(logId) {
  const store = getActiveStore();
  if (!store) return;

  ensureInventoryLogIds(store);
  const log = findInventoryLogById(store, logId);
  if (!log) return;

  uiState.editingInventoryLogId = log.id;
  els.editInventoryLogForm.elements.logId.value = log.id;
  els.editInventoryLogName.textContent = log.itemName || "Lịch sử kho";
  els.editInventoryLogDate.value = getInventoryLogDate(log);
  els.editInventoryLogQuantity.value = Number(log.newQuantity || 0);
  els.editInventoryLogPrice.value = formatAmountInput(log.newPrice || 0);
  els.editInventoryLogSalePrice.value = formatAmountInput(getInventoryLogNewSalePrice(log));
  els.editInventoryLogModal.hidden = false;
}

function closeEditInventoryLogModal() {
  uiState.editingInventoryLogId = null;
  els.editInventoryLogModal.hidden = true;
  els.editInventoryLogForm.reset();
}

function renderExportInventoryReasonOptions(selectedReason = "") {
  const store = getActiveStore();
  const reasons = getInventoryExportReasons(store);
  const selected = String(selectedReason || "").trim();
  const options = new Set(reasons);
  if (selected) options.add(selected);

  els.exportInventoryReason.innerHTML = [
    `<option value="" ${selected ? "" : "selected"}>Chưa lý do</option>`,
    ...Array.from(options).map((reason) => `<option value="${escapeHtml(reason)}" ${selected === reason ? "selected" : ""}>${escapeHtml(reason)}</option>`)
  ].join("");
}

function setExportReasonCreator(open) {
  if (!els.exportInventoryReasonPanel) return;
  els.exportInventoryReasonPanel.hidden = !open;
  els.toggleExportInventoryReason.setAttribute("aria-expanded", open ? "true" : "false");
  els.toggleExportInventoryReason.textContent = open ? "Ẩn tạo lý do" : "Tạo lý do xuất";
  if (open) {
    window.setTimeout(() => els.exportInventoryNewReason.focus(), 60);
  } else {
    els.exportInventoryNewReason.value = "";
  }
}

function addExportInventoryReasonOption() {
  const store = getActiveStore();
  if (!store) return;

  const reason = String(els.exportInventoryNewReason.value || "").trim();
  if (!reason) {
    window.alert("Vui lòng nhập lý do xuất kho.");
    return;
  }

  store.exportReasons = getInventoryExportReasons(store);
  if (!store.exportReasons.some((current) => normalizeSearchText(current) === normalizeSearchText(reason))) {
    store.exportReasons.push(reason);
    store.exportReasons.sort((a, b) => a.localeCompare(b, "vi"));
  }
  saveStateToCache();
  saveStateToCloud();
  renderExportInventoryReasonOptions(reason);
  setExportReasonCreator(false);
}

function deleteSelectedExportInventoryReason() {
  const store = getActiveStore();
  if (!store) return;

  const reason = String(els.exportInventoryReason.value || "").trim();
  if (!reason) {
    window.alert("Vui lòng chọn một lý do đã tạo để xóa.");
    return;
  }

  const confirmed = window.confirm(`Xóa lý do xuất "${reason}" khỏi danh sách lựa chọn?`);
  if (!confirmed) return;

  store.exportReasons = getInventoryExportReasons(store).filter((current) => normalizeSearchText(current) !== normalizeSearchText(reason));
  saveStateToCache();
  saveStateToCloud();
  renderExportInventoryReasonOptions("");
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
  const salePrice = parseAmountInput(formData.get("salePrice"));

  if (!name || !groupName || !Number.isFinite(quantity) || !Number.isFinite(lastPrice) || lastPrice < 0 || !Number.isFinite(salePrice) || salePrice < 0) {
    window.alert("Vui lòng nhập đầy đủ tên hàng hóa, nhóm, số lượng, giá vốn và giá bán.");
    return false;
  }

  const oldQuantity = Number(item.quantity || 0);
  const oldPrice = Number(item.lastPrice || 0);
  const oldSalePrice = getInventorySalePrice(item);
  const category = ensurePurchaseCategory(store, groupName);
  const updatedAt = new Date().toISOString();
  item.name = name;
  item.groupId = category.id;
  item.groupName = category.name;
  item.quantity = quantity;
  item.lastPrice = lastPrice;
  item.salePrice = salePrice;
  item.totalCost = Math.max(0, quantity * lastPrice);
  item.updatedAt = updatedAt;
  addInventoryLog(store, {
    date: updatedAt.slice(0, 10),
    type: "edit",
    inventoryId: item.id,
    itemName: item.name,
    groupName: item.groupName,
    oldQuantity,
    newQuantity: Number(item.quantity || 0),
    oldPrice,
    newPrice: Number(item.lastPrice || 0),
    oldSalePrice,
    newSalePrice: getInventorySalePrice(item)
  });

  saveAndRender();
  renderInventory(store);
  closeEditInventoryModal();
  return true;
}

function exportInventoryItem(formData) {
  const store = getActiveStore();
  if (!store) return false;

  const item = (store.inventory || []).find((stock) => stock.id === formData.get("inventoryId"));
  if (!item) return false;

  const date = String(formData.get("date") || today);
  const quantity = Number.parseInt(formData.get("quantity"), 10);
  const reason = String(formData.get("reason") || "").trim();
  const oldQuantity = Number(item.quantity || 0);
  const lastPrice = Number(item.lastPrice || 0);
  const salePrice = getInventorySalePrice(item);

  if (!isValidDateInput(date) || !Number.isFinite(quantity) || quantity <= 0) {
    window.alert("Vui lòng chọn ngày xuất và nhập số lượng lớn hơn 0.");
    return false;
  }

  if (quantity > oldQuantity) {
    window.alert(`Số lượng xuất không được lớn hơn tồn kho hiện tại (${oldQuantity.toLocaleString("vi-VN")}).`);
    return false;
  }

  const updatedAt = new Date().toISOString();
  const oldTotalCost = Number(item.totalCost || 0);
  const averageCost = oldQuantity > 0 ? oldTotalCost / oldQuantity : lastPrice;
  item.quantity = oldQuantity - quantity;
  item.totalCost = Math.max(0, oldTotalCost - averageCost * quantity);
  item.updatedAt = updatedAt;
  addInventoryLog(store, {
    date,
    type: "export",
    inventoryId: item.id,
    itemName: item.name,
    groupName: item.groupName,
    oldQuantity,
    newQuantity: Number(item.quantity || 0),
    oldPrice: lastPrice,
    newPrice: lastPrice,
    oldSalePrice: salePrice,
    newSalePrice: salePrice,
    exportReason: reason
  });

  saveAndRender();
  renderInventory(store);
  closeExportInventoryModal();
  return true;
}

function saveEditedInventoryLog(formData) {
  const store = getActiveStore();
  if (!store) return false;

  ensureInventoryLogIds(store);
  const log = findInventoryLogById(store, formData.get("logId"));
  if (!log) return false;

  const date = String(formData.get("date") || "").trim();
  const newQuantity = Number.parseInt(formData.get("newQuantity"), 10);
  const newPrice = parseAmountInput(formData.get("newPrice"));
  const newSalePrice = parseAmountInput(formData.get("newSalePrice"));

  if (
    !isValidDateInput(date) ||
    !Number.isFinite(newQuantity) ||
    newQuantity < 0 ||
    !Number.isFinite(newPrice) ||
    newPrice < 0 ||
    !Number.isFinite(newSalePrice) ||
    newSalePrice < 0
  ) {
    window.alert("Vui lòng chọn ngày, nhập số lượng, giá vốn và giá bán hợp lệ.");
    return false;
  }

  const previousUpdatedAt = String(log.updatedAt || log.date || "");
  const timePart = previousUpdatedAt.includes("T") ? previousUpdatedAt.slice(10) : "T00:00:00.000";
  log.date = date;
  log.updatedAt = `${date}${timePart}`;
  log.newQuantity = newQuantity;
  log.newPrice = newPrice;
  log.newSalePrice = newSalePrice;
  log.editedAt = new Date().toISOString();

  if (!log.inventoryId) {
    const item = findInventoryItemForLog(store, log);
    if (item?.id) log.inventoryId = item.id;
  }

  syncInventoryItemFromLatestLog(store, log);
  saveAndRender();
  closeEditInventoryLogModal();
  return true;
}

function deleteEditingInventoryLog() {
  const store = getActiveStore();
  if (!store) return;

  ensureInventoryLogIds(store);
  const log = findInventoryLogById(store, uiState.editingInventoryLogId);
  if (!log) return;

  const confirmed = window.confirm("Xóa dòng lịch sử kho này? Số lượng và giá hiện tại sẽ được cập nhật theo lịch sử mới nhất còn lại.");
  if (!confirmed) return;

  store.inventoryLogs = (store.inventoryLogs || []).filter((current) => current.id !== log.id);
  syncInventoryItemAfterLogDelete(store, log);
  saveAndRender();
  closeEditInventoryLogModal();
}

function addPurchaseItemRow(item = {}) {
  renderPurchaseItemSuggestions(getActiveStore());
  const row = document.createElement("div");
  row.className = "purchase-item-row sales-item-row";
  row.innerHTML = `
    <input type="text" data-purchase-item="name" placeholder="Hàng hóa" autocomplete="off" list="purchaseItemSuggestions" value="${escapeHtml(item.name || "")}" />
    <input type="text" data-purchase-item="group" placeholder="Nhóm hàng hóa" autocomplete="off" list="purchaseGroupSuggestions" value="${escapeHtml(item.groupName || "")}" />
    <div class="quantity-stepper" aria-label="Số lượng">
      <button class="quantity-step" type="button" data-purchase-quantity-step="-1" aria-label="Giảm số lượng">-</button>
      <input type="number" data-purchase-item="quantity" min="1" step="1" placeholder="SL" value="${item.quantity || 1}" />
      <button class="quantity-step" type="button" data-purchase-quantity-step="1" aria-label="Tăng số lượng">+</button>
    </div>
    <input type="text" data-purchase-item="price" inputmode="numeric" placeholder="Giá vốn" autocomplete="off" value="${item.price ? formatAmountInput(item.price) : ""}" />
    <input type="text" data-purchase-item="salePrice" inputmode="numeric" placeholder="Giá bán" autocomplete="off" value="${item.salePrice ? formatAmountInput(item.salePrice) : ""}" />
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
      const salePrice = parseAmountInput(row.querySelector('[data-purchase-item="salePrice"]')?.value);
      return {
        name,
        groupName,
        quantity,
        price,
        salePrice,
        total: quantity * price
      };
    })
    .filter((item) =>
      item.name &&
      item.groupName &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      Number.isFinite(item.salePrice) &&
      item.salePrice > 0
    );
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
      const oldSalePrice = getInventorySalePrice(current);
      current.quantity = Number(current.quantity || 0) + item.quantity;
      current.totalCost = Number(current.totalCost || 0) + item.total;
      current.lastPrice = item.price;
      current.salePrice = item.salePrice;
      current.updatedAt = createdAt;
      addInventoryLog(store, {
        date,
        type: "purchase",
        inventoryId: current.id,
        itemName: current.name,
        groupName: current.groupName,
        oldQuantity,
        newQuantity: Number(current.quantity || 0),
        oldPrice,
        newPrice: Number(current.lastPrice || 0),
        oldSalePrice,
        newSalePrice: getInventorySalePrice(current)
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
        salePrice: item.salePrice,
        createdAt,
        updatedAt: createdAt
      };
      store.inventory.push(stock);
      addInventoryLog(store, {
        date,
        type: "purchase",
        inventoryId: stock.id,
        itemName: stock.name,
        groupName: stock.groupName,
        oldQuantity: 0,
        newQuantity: Number(stock.quantity || 0),
        oldPrice: 0,
        newPrice: Number(stock.lastPrice || 0),
        oldSalePrice: 0,
        newSalePrice: getInventorySalePrice(stock)
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
    window.alert("Vui lòng nhập hàng hóa, nhóm hàng hóa, số lượng, giá vốn và giá bán.");
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
    if (parts.length !== 4 && parts.length !== 5) {
      if (!silent) window.alert(`Dòng ${index + 1} chưa đúng định dạng: Tên,Số lượng,Nhóm,Giá vốn,Giá bán.`);
      return null;
    }

    const [name, rawQuantity, groupName, rawPrice, rawSalePrice] = parts;
    const quantity = Number.parseInt(rawQuantity, 10);
    const price = parseAmountInput(rawPrice);
    const salePrice = parseAmountInput(rawSalePrice || rawPrice);
    if (!name || !groupName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(salePrice) || salePrice <= 0) {
      if (!silent) window.alert(`Dòng ${index + 1} chưa hợp lệ. Vui lòng kiểm tra tên, số lượng, nhóm, giá vốn và giá bán.`);
      return null;
    }

    items.push({
      name,
      groupName,
      quantity,
      price,
      salePrice,
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

const aiChatState = {
  conversationId: loadAIConversationId(),
  messages: loadAIChatMessages(),
  pending: false,
  dataSnapshot: null,
  dataSnapshotAt: "",
  attachments: []
};

function loadAIConversationId() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || "{}");
    return saved.conversationId || createId();
  } catch (error) {
    return createId();
  }
}

function loadAIChatMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || "{}");
    return Array.isArray(saved.messages) ? saved.messages.slice(-30) : [];
  } catch (error) {
    return [];
  }
}

function saveAIChatMessages() {
  try {
    localStorage.setItem(
      AI_CHAT_STORAGE_KEY,
      JSON.stringify({
        conversationId: aiChatState.conversationId,
        messages: aiChatState.messages.slice(-30)
      })
    );
  } catch (error) {
    console.warn("Cannot write AI chat cache", error);
  }
}

function getAIEndpoint(name) {
  const config = window.aiFunctionConfig || {};
  if (config[name]) return config[name];

  const projectId = window.firebaseAppConfig?.projectId;
  if (!projectId || projectId === FIREBASE_CONFIG_PLACEHOLDER) return "";

  const region = window.appCloudOptions?.functionsRegion || "asia-southeast1";
  const functionNames = {
    chatWithAIUrl: "chatWithAI",
    chatGeneralAIUrl: "chatGeneralAI",
    confirmAIActionUrl: "confirmAIAction"
  };
  const functionName = functionNames[name] || "chatWithAI";
  return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

function getAISelectedMode() {
  return els.aiChatMode?.value === "store" ? "store" : "general";
}

function getAIHistoryForRequest() {
  return aiChatState.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 4000)
    }));
}

function updateAIInputPlaceholder() {
  if (!els.aiChatInput) return;
  els.aiChatInput.placeholder =
    getAISelectedMode() === "store"
      ? "Hỏi AI về thu chi, kho hàng, khách hàng, đơn hàng..."
      : "Hỏi AI về học tập, kinh doanh, code, cửa hàng...";
}

function clearAIConversation() {
  aiChatState.messages = [];
  aiChatState.conversationId = createId();
  aiChatState.dataSnapshot = null;
  aiChatState.dataSnapshotAt = "";
  aiChatState.attachments = [];
  if (els.aiFileInput) els.aiFileInput.value = "";
  saveAIChatMessages();
  renderAIFileStatus();
  renderAIChat();
}

function renderAIFileStatus() {
  if (!els.aiFileStatus) return;
  const files = aiChatState.attachments || [];
  if (!files.length) {
    els.aiFileStatus.hidden = true;
    els.aiFileStatus.innerHTML = "";
    return;
  }

  els.aiFileStatus.hidden = false;
  els.aiFileStatus.innerHTML = `
    <div class="ai-file-status-inner">
      <div class="ai-file-list">
        ${files
          .map(
            (file) => `
              <span class="ai-file-chip" title="${escapeHtml(file.name)}">
                <span>${escapeHtml(file.name)}</span>
                <small>${escapeHtml(file.kind || file.type || "file")}${file.truncated ? " · rút gọn" : ""}</small>
              </span>
            `
          )
          .join("")}
      </div>
      <button class="ai-file-clear" type="button" data-clear-ai-files>Gỡ file</button>
    </div>
  `;
}

function getAIFileKind(file) {
  const name = String(file.name || "").toLowerCase();
  if (/\.(xlsx|xls)$/i.test(name)) return "excel";
  if (/\.(docx|doc)$/i.test(name)) return "word";
  if (/\.(json)$/i.test(name)) return "json";
  if (/\.(html|htm)$/i.test(name)) return "html";
  if (/\.(csv|tsv)$/i.test(name)) return "csv";
  if (/\.(txt|md|js|css|xml|log)$/i.test(name)) return "text";
  if ((file.type || "").startsWith("text/")) return "text";
  return "unknown";
}

function clampAIFileText(text) {
  const value = String(text || "");
  if (value.length <= AI_FILE_TEXT_MAX_CHARS) {
    return { text: value, truncated: false };
  }
  return {
    text: value.slice(0, AI_FILE_TEXT_MAX_CHARS),
    truncated: true
  };
}

async function readAITextFile(file) {
  return clampAIFileText(await file.text());
}

async function readAIExcelFile(file) {
  if (!window.XLSX) {
    return {
      text: "Không thể đọc nội dung Excel vì thư viện XLSX chưa tải được. Hãy thử lại khi có mạng hoặc đổi sang CSV/TXT.",
      truncated: false,
      note: "xlsx_library_missing"
    };
  }

  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
  const parts = workbook.SheetNames.slice(0, 8).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    return [`# Sheet: ${sheetName}`, ...rows.slice(0, 300).map((row) => row.join("\t"))].join("\n");
  });
  return clampAIFileText(parts.join("\n\n"));
}

async function readAIWordFile(file) {
  if (!window.mammoth || !/\.docx$/i.test(file.name || "")) {
    return {
      text:
        "Không thể đọc trực tiếp file Word dạng này trên trình duyệt. Hãy dùng file .docx hoặc chuyển nội dung sang TXT nếu cần AI đọc chính xác.",
      truncated: false,
      note: "word_reader_unavailable"
    };
  }

  const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return clampAIFileText(result.value || "");
}

async function readAIFile(file) {
  const kind = getAIFileKind(file);
  if (file.size > AI_FILE_MAX_BYTES) {
    return {
      name: file.name,
      type: file.type || "",
      size: file.size,
      kind,
      text: `File "${file.name}" quá lớn để gửi cho AI trong một lần. Vui lòng rút gọn file dưới 8MB hoặc tách thành file nhỏ hơn.`,
      truncated: true,
      extractionNote: "file_too_large"
    };
  }

  let extracted;
  if (kind === "excel") {
    extracted = await readAIExcelFile(file);
  } else if (kind === "word") {
    extracted = await readAIWordFile(file);
  } else if (["text", "json", "html", "csv"].includes(kind)) {
    extracted = await readAITextFile(file);
  } else {
    extracted = {
      text:
        "Định dạng file này chưa trích xuất được nội dung trực tiếp trong trình duyệt. AI chỉ biết tên, loại và dung lượng file.",
      truncated: false,
      note: "unsupported_browser_extraction"
    };
  }

  return {
    name: file.name,
    type: file.type || "",
    size: file.size,
    kind,
    text: extracted.text,
    truncated: extracted.truncated,
    extractionNote: extracted.note || ""
  };
}

async function handleAIFileSelect(event) {
  const files = Array.from(event.target.files || []).slice(0, 5);
  if (!files.length) return;

  const previousLabel = els.aiFileButton?.getAttribute("aria-label") || "";
  if (els.aiFileButton) {
    els.aiFileButton.disabled = true;
    els.aiFileButton.setAttribute("aria-label", "Đang đọc file");
  }

  try {
    aiChatState.attachments = await Promise.all(files.map(readAIFile));
    renderAIFileStatus();
    addAIMessage(
      "assistant",
      `Đã nạp ${aiChatState.attachments.length} file cho AI. Bạn hãy nhập câu hỏi về nội dung file hoặc dữ liệu cửa hàng.`
    );
  } catch (error) {
    addAIMessage("assistant", `Không đọc được file: ${error.message}`);
  } finally {
    if (els.aiFileButton) {
      els.aiFileButton.disabled = false;
      els.aiFileButton.setAttribute("aria-label", previousLabel || "Tải file lên cho AI");
    }
  }
}

function openAIChat() {
  if (!els.aiChatModal) return;
  updateAIInputPlaceholder();
  if (getAISelectedMode() === "store") {
    aiChatState.dataSnapshot = createAIClientStateSnapshot();
    aiChatState.dataSnapshotAt = aiChatState.dataSnapshot.exportedAt || new Date().toISOString();
  } else {
    aiChatState.dataSnapshot = null;
    aiChatState.dataSnapshotAt = "";
  }
  els.aiChatModal.hidden = false;
  document.body.classList.add("modal-open");
  if (!aiChatState.messages.length) {
    aiChatState.messages.push({
      role: "assistant",
      content:
        "Xin chào, tôi là ChatGPT AI. Bạn có thể hỏi về học tập, kinh doanh, marketing, dịch thuật, lập trình, ý tưởng hoặc dữ liệu cửa hàng."
    });
  }
  renderAIFileStatus();
  renderAIChat();
  setTimeout(() => els.aiChatInput?.focus(), 50);
}

function closeAIChat() {
  if (!els.aiChatModal) return;
  els.aiChatModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function addAIMessage(role, content, actions = []) {
  aiChatState.messages.push({
    role,
    content: String(content || ""),
    actions: Array.isArray(actions) ? actions : []
  });
  saveAIChatMessages();
  renderAIChat();
}

function renderAIChat() {
  if (!els.aiChatMessages) return;

  els.aiChatMessages.innerHTML = aiChatState.messages
    .map((message) => {
      const actions = (message.actions || []).map(renderAIActionCard).join("");
      return `
        <div class="ai-message ${message.role === "user" ? "user" : "assistant"}">
          <div>${escapeHtml(message.content).replace(/\n/g, "<br>")}</div>
          ${actions}
        </div>
      `;
    })
    .join("");

  if (aiChatState.pending) {
    els.aiChatMessages.insertAdjacentHTML(
      "beforeend",
      '<div class="ai-message assistant ai-loading">AI đang trả lời...</div>'
    );
  }

  els.aiChatMessages.scrollTop = els.aiChatMessages.scrollHeight;
}

function renderAIActionCard(action) {
  const id = action.id || action.actionId || "";
  const title = action.type || "Đề xuất thao tác";
  const payload = action.payload ? JSON.stringify(action.payload, null, 2) : "";
  const disabled = action.status && action.status !== "pending_confirmation";

  return `
    <div class="ai-action-card" data-action-id="${escapeHtml(id)}">
      <strong>${escapeHtml(title)}</strong>
      <pre>${escapeHtml(payload)}</pre>
      <div class="ai-action-buttons">
        <button type="button" data-confirm-ai-action="${escapeHtml(id)}" ${disabled ? "disabled" : ""}>Xác nhận</button>
        <button type="button" data-cancel-ai-action="${escapeHtml(id)}" ${disabled ? "disabled" : ""}>Hủy</button>
      </div>
    </div>
  `;
}

async function sendAIChatMessage(rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message || aiChatState.pending) return;

  const selectedMode = getAISelectedMode();
  const endpoint = getAIEndpoint(selectedMode === "store" ? "chatWithAIUrl" : "chatGeneralAIUrl");
  if (!endpoint) {
    addAIMessage(
      "assistant",
      "Chưa cấu hình URL Firebase Function AI. Hãy deploy Functions rồi dán URL vào window.aiFunctionConfig trong firebase-config.js."
    );
    return;
  }

  const attachments = (aiChatState.attachments || []).slice();
  const clientState = selectedMode === "store" ? createAIClientStateSnapshot() : null;
  if (clientState) {
    aiChatState.dataSnapshot = clientState;
    aiChatState.dataSnapshotAt = clientState.exportedAt || new Date().toISOString();
  } else {
    aiChatState.dataSnapshot = null;
    aiChatState.dataSnapshotAt = "";
  }
  const history = selectedMode === "general" ? getAIHistoryForRequest() : [];
  const visibleMessage = attachments.length
    ? `${message}\n\nFile gửi kèm: ${attachments.map((file) => file.name).join(", ")}`
    : message;
  addAIMessage("user", visibleMessage);
  els.aiChatInput.value = "";
  aiChatState.pending = true;
  renderAIChat();

  try {
    const adminPin = els.aiAdminPin?.value || "";
    const body =
      selectedMode === "store"
        ? {
            message,
            conversationId: aiChatState.conversationId,
            mode: "read_only",
            pin: adminPin,
            clientState,
            attachments
          }
        : {
            message,
            conversationId: aiChatState.conversationId,
            mode: "general",
            history,
            attachments
          };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "AI đang bận hoặc đã vượt giới hạn sử dụng, vui lòng thử lại sau.");
    }
    addAIMessage("assistant", data.reply || "AI chưa có câu trả lời.", data.actions || []);
  } catch (error) {
    addAIMessage(
      "assistant",
      error.message || "AI đang bận hoặc đã vượt giới hạn sử dụng, vui lòng thử lại sau."
    );
  } finally {
    aiChatState.pending = false;
    renderAIChat();
  }
}

if (els.aiChatMessages) {
  els.aiChatMessages.addEventListener("click", async (event) => {
    const confirmButton = event.target.closest("[data-confirm-ai-action]");
    const cancelButton = event.target.closest("[data-cancel-ai-action]");
    if (cancelButton) {
      cancelButton.closest(".ai-action-card")?.remove();
      return;
    }
    if (!confirmButton) return;
    const actionId = confirmButton.dataset.confirmAiAction;
    await confirmAIAction(actionId);
  });
}

async function confirmAIAction(actionId) {
  const endpoint = getAIEndpoint("confirmAIActionUrl");
  if (!endpoint) {
    addAIMessage("assistant", "Chưa cấu hình URL Firebase Function confirmAIAction.");
    return;
  }
  if (!actionId) return;

  try {
    const adminPin = els.aiAdminPin?.value || "";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
      body: JSON.stringify({
        actionId,
        pin: adminPin
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không xác nhận được thao tác.");
    addAIMessage("assistant", data.message || "Đã xác nhận thao tác AI.");
  } catch (error) {
    addAIMessage("assistant", `Lỗi xác nhận: ${error.message}`);
  }
}

function getActiveTabName() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "stores";
}

function updateQuickEntryButton() {
  const store = getActiveStore();
  const tabName = getActiveTabName();
  if (els.aiButton) {
    els.aiButton.hidden = !(store && tabName === "overview");
  }
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
  updateTimeFiltersVisibility(tabName);
  updateQuickEntryButton();
  updatePinnedTabs();
}

function getActiveTabName() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "stores";
}

function updateTimeFiltersVisibility(tabName = getActiveTabName()) {
  if (!els.timeFilters) return;
  const visibleTabs = new Set(["overview", "income", "expense", "purchase", "sales"]);
  const store = getActiveStore();
  els.timeFilters.hidden = !store || !visibleTabs.has(tabName);
}

function updateStickyControlMetrics() {
  const tabHeight = els.tabBar?.offsetHeight || 0;
  document.documentElement.style.setProperty("--tab-bar-sticky-height", `${tabHeight}px`);
}

function updatePinnedTabs() {
  if (!els.tabBar || !els.tabSpacer || els.dashboard.hidden) {
    resetPinnedTabs();
    return;
  }

  updateStickyControlMetrics();

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
  updateStickyControlMetrics();
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
  renderReportList(els.incomeReport, store.categories.income, activeIncomeEntries, "income");
  renderReportList(els.expenseReport, store.categories.expense, activeExpenseEntries, "expense");
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
    container.innerHTML = '<tr><td colspan="5" class="empty-list">Chưa có đơn hàng trong khoảng thời gian này</td></tr>';
    return;
  }

  const store = getActiveStore();
  const customerLookup = new Map(
    (store ? getStoreCustomers(store) : []).map((customerInfo) => [
      getCustomerKey(customerInfo.name, customerInfo.phone),
      customerInfo
    ])
  );

  container.innerHTML = orders
    .map((order) => {
      const cancelled = isCancelledEntry(order);
      const createdTime = formatTime(order.createdAt || order.updatedAt);
      const customerInfo = customerLookup.get(getCustomerKey(order.customerName, order.customerPhone));
      const memberTier = customerInfo?.memberTier || "Thường";
      const memberTierClass = isRegularMemberTier(memberTier) ? "is-regular" : "is-premium";
      const customer = [
        `<span class="sales-history-customer-name">${escapeHtml(order.customerName || "")}</span>`,
        order.customerName
          ? `<span class="member-tier-badge sales-history-member-tier ${memberTierClass}">${escapeHtml(memberTier)}</span>`
          : "",
        cancelled ? '<span class="cancelled-pill">Hủy</span>' : ""
      ].join("");
      const actions = cancelled
        ? '<span class="muted-action">Đã hủy</span>'
        : `<button class="delete-small" type="button" data-delete-order="${order.id}" title="Xóa đơn" aria-label="Xóa đơn">×</button>`;

      return `
        <tr class="sales-order-row ${cancelled ? "entry-cancelled" : ""}" data-open-sales-order="${order.id}">
          <td>
            <span class="date-stack">
              <span>${formatDate(order.date)}</span>
              ${createdTime ? `<small>${createdTime}</small>` : ""}
            </span>
          </td>
          <td><span class="sales-history-customer">${customer}</span></td>
          <td>${escapeHtml(order.customerPhone || "")}</td>
          <td class="amount-cell">${formatCurrency(order.total || 0)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join("");
}

function openSalesOrderDetail(orderId) {
  const store = getActiveStore();
  if (!store || !orderId) return;

  const order = (store.orders || []).find((item) => item.id === orderId);
  if (!order) return;

  const cancelled = isCancelledEntry(order);
  const createdTime = formatTime(order.createdAt || order.updatedAt);
  const dateText = [formatDate(order.date || today), createdTime].filter(Boolean).join(" ");
  const subtotal = Number(order.subtotal || order.items?.reduce((sum, item) => sum + Number(item.total || 0), 0) || order.total || 0);
  const discountTotal = Number(order.discountTotal || 0);
  const total = Number(order.total || 0);

  els.salesOrderDetailStatus.innerHTML = cancelled ? '<span class="cancelled-pill">Hủy</span>' : "Đơn bán hàng";
  els.salesOrderDetailContent.innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-field">
        <span>Ngày</span>
        <strong>${escapeHtml(dateText)}</strong>
      </div>
      <div class="order-detail-field">
        <span>Khách hàng</span>
        <strong>${escapeHtml(order.customerName || "")}</strong>
      </div>
      <div class="order-detail-field">
        <span>Số điện thoại</span>
        <strong>${escapeHtml(order.customerPhone || "")}</strong>
      </div>
      <div class="order-detail-field">
        <span>Trạng thái</span>
        <strong>${cancelled ? "Đã hủy" : "Hoàn thành"}</strong>
      </div>
    </div>
    <div class="order-detail-section">
      <h3>Chi tiết</h3>
      ${renderSalesOrderItemLines(order.items || []) || '<div class="empty-list">Không có hàng hóa</div>'}
    </div>
    <div class="order-detail-summary">
      <div>
        <span>Tổng bill</span>
        <strong>${formatCurrency(subtotal)}</strong>
      </div>
      ${
        discountTotal > 0
          ? `
            <div>
              <span>Chiết khấu</span>
              <strong>${formatCurrency(discountTotal)}</strong>
            </div>
            <div>
              <span>Còn lại</span>
              <strong>${formatCurrency(total)}</strong>
            </div>
          `
          : ""
      }
      ${
        cancelled
          ? `
            <div>
              <span>Trạng thái</span>
              <strong>Đã hủy</strong>
            </div>
          `
          : ""
      }
    </div>
  `;
  els.salesOrderDetailModal.hidden = false;
}

function closeSalesOrderDetailModal() {
  els.salesOrderDetailModal.hidden = true;
  els.salesOrderDetailContent.innerHTML = "";
}

function renderSalesOrderItemLines(items) {
  if (!items.length) return "";
  return `<div class="sales-item-lines">${items.map(renderSalesOrderItemLine).join("")}</div>`;
}

function renderSalesOrderItemLine(item) {
  const quantity = Number(item.quantity || 0);
  const originalPrice = Number(item.originalPrice || item.price || 0);
  const originalTotal = originalPrice * quantity;
  const finalTotal = Number(item.total || 0);
  const hasDiscount = (Number(item.discountPercent || 0) > 0 || Number(item.discountAmount || 0) > 0) && originalTotal > finalTotal;

  if (!hasDiscount) {
    return `
      <div class="sales-detail-line">
        <span class="sales-detail-name">${escapeHtml(item.name || "")} x${quantity}</span>
        <span class="sales-detail-total">${formatCurrency(finalTotal)}</span>
      </div>
    `;
  }

  return `
    <div class="sales-detail-line">
      <span class="sales-detail-name">${escapeHtml(item.name || "")} x${quantity}</span>
      <span class="sales-discount-price">
        <span class="old-value">${formatCurrency(originalTotal)}</span>
        <span class="new-value">${formatCurrency(finalTotal)}</span>
      </span>
    </div>
  `;
}

function renderSalesDraftList(drafts) {
  if (!els.salesDraftList) return;

  if (!drafts.length) {
    els.salesDraftList.innerHTML = "";
    return;
  }

  const store = getActiveStore();
  const customerLookup = new Map(
    (store ? getStoreCustomers(store) : []).map((customerInfo) => [
      getCustomerKey(customerInfo.name, customerInfo.phone),
      customerInfo
    ])
  );

  const rows = [...drafts]
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .map((draft) => {
      const title = draft.customerName || "Đơn chưa có tên khách";
      const draftTime = formatTime(draft.updatedAt || draft.createdAt);
      const customerInfo = customerLookup.get(getCustomerKey(draft.customerName, draft.customerPhone));
      const memberTier = customerInfo?.memberTier || "Thường";
      const memberTierClass = isRegularMemberTier(memberTier) ? "is-regular" : "is-premium";
      const customer = draft.customerName
        ? `
          <span class="sales-history-customer">
            <span class="sales-history-customer-name">${escapeHtml(title)}</span>
            <span class="member-tier-badge sales-history-member-tier ${memberTierClass}">${escapeHtml(memberTier)}</span>
          </span>
        `
        : escapeHtml(title);

      return `
        <tr class="draft-order-row" data-open-sales-draft="${draft.id}">
          <td>
            <span class="date-stack">
              <span>${formatDate(draft.date || today)}</span>
              ${draftTime ? `<small>${draftTime}</small>` : ""}
            </span>
          </td>
          <td>${customer}</td>
          <td>${escapeHtml(draft.customerPhone || "")}</td>
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
  const totalCost = inventory.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
  if (els.inventorySummary) {
    els.inventorySummary.innerHTML = `
      <div class="report-item report-total">
        <span>Tổng giá trị kho</span>
        <span class="report-amount">${formatCurrency(totalCost)}</span>
      </div>
    `;
  }

  if (!inventory.length) {
    els.inventoryList.innerHTML = '<div class="empty-list">Không có hàng hóa phù hợp</div>';
    return;
  }

  els.inventoryList.innerHTML = `
    ${inventory
      .map(
        (item) => {
          const quantity = Number(item.quantity || 0);
          return `
          <div class="inventory-item" data-edit-inventory="${escapeHtml(item.id || "")}" role="button" tabindex="0">
            <div class="inventory-main">
              <span class="inventory-group-row">
                <span class="inventory-group">${escapeHtml(item.groupName || "Chưa phân nhóm")}</span>
                <button class="inventory-export-button" type="button" data-export-inventory="${escapeHtml(item.id || "")}" ${quantity <= 0 ? "disabled" : ""}>Xuất</button>
              </span>
              <strong>${escapeHtml(item.name || "")}</strong>
              <span class="inventory-date">Cập nhật: ${formatDate(String(item.updatedAt || item.createdAt || today).slice(0, 10))}</span>
            </div>
            <div class="inventory-meta">
              <span>SL: ${quantity.toLocaleString("vi-VN")}</span>
              <span>Giá vốn: ${formatCurrency(item.lastPrice || 0)}</span>
              <span>Giá bán: ${formatCurrency(getInventorySalePrice(item))}</span>
              <span>Tổng: ${formatCurrency(item.totalCost || 0)}</span>
            </div>
          </div>
        `;
        }
      )
      .join("")}
  `;
}

function renderInventoryHistory(store) {
  if (!els.inventoryHistoryList || !store) return;

  const selectedDate = uiState.inventoryHistoryDate || today;
  const query = normalizeSearchText(uiState.inventoryHistorySearch || "");
  const snapshot = buildInventorySnapshotAtStartOfDay(store, selectedDate)
    .filter((item) => Number(item.quantity || 0) > 0)
    .filter((item) => !query || normalizeSearchText(item.name || "").includes(query))
    .sort((a, b) =>
      String(a.groupName || "").localeCompare(String(b.groupName || ""), "vi") ||
      String(a.name || "").localeCompare(String(b.name || ""), "vi")
    );

  if (els.inventoryHistoryDate && els.inventoryHistoryDate.value !== selectedDate) {
    els.inventoryHistoryDate.value = selectedDate;
  }

  els.inventoryHistoryCount.textContent = `${snapshot.length} mặt hàng`;
  const totalCost = snapshot.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.lastPrice || 0),
    0
  );

  if (els.inventoryHistorySummary) {
    els.inventoryHistorySummary.innerHTML = `
      <div class="report-item report-total">
        <span>Đầu ngày ${formatDate(selectedDate)}</span>
        <span class="report-amount">${formatCurrency(totalCost)}</span>
      </div>
    `;
  }

  if (!snapshot.length) {
    els.inventoryHistoryList.innerHTML = '<div class="empty-list">Không có hàng hóa phù hợp trong ngày đã chọn.</div>';
    return;
  }

  els.inventoryHistoryList.innerHTML = snapshot
    .map(
      (item) => `
        <div class="inventory-item inventory-history-item">
          <div class="inventory-main">
            <span class="inventory-group-row">
              <span class="inventory-group">${escapeHtml(item.groupName || "Chưa phân nhóm")}</span>
            </span>
            <strong>${escapeHtml(item.name || "")}</strong>
            <span class="inventory-date">Đầu ngày: ${formatDate(selectedDate)}</span>
          </div>
          <div class="inventory-meta">
            <span>SL: ${Number(item.quantity || 0).toLocaleString("vi-VN")}</span>
            <span>Giá vốn: ${formatCurrency(item.lastPrice || 0)}</span>
            <span>Giá bán: ${formatCurrency(getInventorySalePrice(item))}</span>
            <span>Tổng: ${formatCurrency(Number(item.quantity || 0) * Number(item.lastPrice || 0))}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function buildInventorySnapshotAtStartOfDay(store, targetDate) {
  const itemsByKey = new Map();

  (store.inventory || []).forEach((item) => {
    const snapshot = {
      ...item,
      quantity: Number(item.quantity || 0),
      lastPrice: Number(item.lastPrice || 0),
      salePrice: getInventorySalePrice(item)
    };
    itemsByKey.set(getInventorySnapshotKey(snapshot), snapshot);
  });

  (store.orders || [])
    .filter((order) => !isCancelledEntry(order) && String(order.date || order.createdAt || today).slice(0, 10) > targetDate)
    .forEach((order) => {
      (order.items || []).forEach((soldItem) => {
        const matchedItem =
          [...itemsByKey.values()].find(
            (item) => normalizeSearchText(item.name || "") === normalizeSearchText(soldItem.name || "")
          ) || null;
        const key = matchedItem
          ? getInventorySnapshotKey(matchedItem)
          : getInventorySnapshotKey({
              name: soldItem.name,
              groupName: soldItem.groupName || "Bán hàng"
            });
        const item = itemsByKey.get(key) || {
          id: key,
          name: soldItem.name || "",
          groupName: soldItem.groupName || "Bán hàng",
          quantity: 0,
          lastPrice: 0,
          salePrice: Number(soldItem.originalPrice || soldItem.price || 0)
        };

        item.quantity = Number(item.quantity || 0) + Number(soldItem.quantity || 0);
        item.totalCost = Math.max(0, item.quantity * Number(item.lastPrice || 0));
        itemsByKey.set(key, item);
      });
    });

  [...(store.inventoryLogs || [])]
    .filter((log) => getInventoryLogDate(log) > targetDate)
    .sort((a, b) => String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || "")))
    .forEach((log) => {
      const key = getInventorySnapshotKey({
        name: log.itemName,
        groupName: log.groupName
      });
      const item = itemsByKey.get(key) || {
        id: key,
        name: log.itemName || "",
        groupName: log.groupName || "",
        quantity: Number(log.newQuantity || 0),
        lastPrice: Number(log.newPrice || 0),
        salePrice: getInventoryLogNewSalePrice(log)
      };

      item.quantity = Number(log.oldQuantity || 0);
      item.lastPrice = Number(log.oldPrice || 0);
      item.salePrice = getInventoryLogOldSalePrice(log);
      item.totalCost = Math.max(0, item.quantity * item.lastPrice);
      itemsByKey.set(key, item);
    });

  return [...itemsByKey.values()].map((item) => ({
    ...item,
    totalCost: Math.max(0, Number(item.quantity || 0) * Number(item.lastPrice || 0))
  }));
}

function getInventorySnapshotKey(item) {
  return normalizeSearchText(`${item?.groupName || ""} ${item?.name || ""}`);
}

function ensureInventoryLogIds(store) {
  if (!store || !Array.isArray(store.inventoryLogs)) return false;

  let changed = false;
  store.inventoryLogs.forEach((log) => {
    if (!log.id) {
      log.id = createId();
      changed = true;
    }
  });
  return changed;
}

function findInventoryLogById(store, logId) {
  return (store?.inventoryLogs || []).find((log) => log.id === logId);
}

function getInventoryLogItemKey(log) {
  return normalizeSearchText(`${log?.groupName || ""} ${log?.itemName || ""}`);
}

function getInventoryItemKey(item) {
  return normalizeSearchText(`${item?.groupName || ""} ${item?.name || ""}`);
}

function findInventoryItemForLog(store, log) {
  if (!store || !log) return null;

  if (log.inventoryId) {
    const byId = (store.inventory || []).find((item) => item.id === log.inventoryId);
    if (byId) return byId;
  }

  const key = getInventoryLogItemKey(log);
  return (store.inventory || []).find((item) => getInventoryItemKey(item) === key) || null;
}

function findLatestInventoryLogForItem(store, referenceLog, excludeId = "") {
  const key = getInventoryLogItemKey(referenceLog);
  return [...(store?.inventoryLogs || [])]
    .filter((log) => {
      if (!log || log.id === excludeId) return false;
      if (referenceLog?.inventoryId && log.inventoryId === referenceLog.inventoryId) return true;
      return key && getInventoryLogItemKey(log) === key;
    })
    .sort((a, b) => String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || "")))[0] || null;
}

function applyInventoryLogValuesToItem(item, log) {
  if (!item || !log) return;

  item.quantity = Number(log.newQuantity ?? log.oldQuantity ?? item.quantity ?? 0);
  item.lastPrice = Number(log.newPrice ?? log.oldPrice ?? item.lastPrice ?? 0);
  item.salePrice = Number(getInventoryLogNewSalePrice(log));
  item.totalCost = Math.max(0, Number(item.quantity || 0) * Number(item.lastPrice || 0));
  item.updatedAt = log.updatedAt || log.date || new Date().toISOString();
}

function syncInventoryItemFromLatestLog(store, referenceLog) {
  const item = findInventoryItemForLog(store, referenceLog);
  if (!item) return;

  const latestLog = findLatestInventoryLogForItem(store, referenceLog);
  if (latestLog) applyInventoryLogValuesToItem(item, latestLog);
}

function syncInventoryItemAfterLogDelete(store, deletedLog) {
  const item = findInventoryItemForLog(store, deletedLog);
  if (!item) return;

  const latestLog = findLatestInventoryLogForItem(store, deletedLog, deletedLog.id);
  if (latestLog) {
    applyInventoryLogValuesToItem(item, latestLog);
    return;
  }

  item.quantity = Number(deletedLog.oldQuantity || 0);
  item.lastPrice = Number(deletedLog.oldPrice || 0);
  item.salePrice = Number(getInventoryLogOldSalePrice(deletedLog));
  item.totalCost = Math.max(0, Number(item.quantity || 0) * Number(item.lastPrice || 0));
  item.updatedAt = new Date().toISOString();
}

function renderInventoryLogs(store) {
  if (!els.inventoryLogPanel) return;

  ensureInventoryLogIds(store);

  const range = getDateRange();
  const allowedFilters = new Set(["all", "purchase", "export"]);
  if (!allowedFilters.has(uiState.inventoryLogFilter)) {
    uiState.inventoryLogFilter = "all";
  }
  if (uiState.inventoryLogFilter !== "export") {
    uiState.inventoryLogReasonFilter = "all";
  } else if (
    uiState.inventoryLogReasonFilter !== "all" &&
    !getInventoryExportReasons(store).includes(uiState.inventoryLogReasonFilter)
  ) {
    uiState.inventoryLogReasonFilter = "all";
  }
  const scopedLogs = [...(store?.inventoryLogs || [])]
    .filter((log) => {
      const logDate = getInventoryLogDate(log);
      const purpose = getInventoryLogPurpose(log);
      const matchesPurpose = uiState.inventoryLogFilter === "all" || purpose.value === uiState.inventoryLogFilter;
      const logReason = getInventoryLogReason(log);
      const matchesReason =
        uiState.inventoryLogFilter !== "export" ||
        uiState.inventoryLogReasonFilter === "all" ||
        logReason === uiState.inventoryLogReasonFilter;
      return logDate >= range.start && logDate <= range.end && matchesPurpose && matchesReason;
    })
    .sort((a, b) =>
      String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || ""))
    );
  const logs = filterInventoryLogsBySearch(scopedLogs, uiState.inventoryLogSearch);

  if (!logs.length) {
    els.inventoryLogPanel.innerHTML = `
      <div class="inventory-log-heading">Lịch sử cập nhật kho</div>
      ${renderInventoryLogFilter(store, scopedLogs)}
      <div class="empty-list inventory-log-empty">${uiState.inventoryLogSearch.trim() ? "Không có hàng hóa phù hợp." : "Chưa có cập nhật kho."}</div>
    `;
    return;
  }

  const expanded = uiState.inventoryLogsExpanded;
  const logsTotal = logs.reduce((sum, log) => sum + getInventoryLogTotal(log), 0);
  els.inventoryLogPanel.classList.toggle("inventory-log-expanded", expanded);
  els.inventoryLogPanel.classList.toggle("inventory-log-collapsed", !expanded);

  els.inventoryLogPanel.innerHTML = `
    <div class="inventory-log-heading">Lịch sử cập nhật kho</div>
    ${renderInventoryLogFilter(store, scopedLogs)}
    <div class="inventory-log-summary">
      <span>Tổng cộng</span>
      <strong>${formatCurrency(logsTotal)}</strong>
    </div>
    <div class="table-wrap inventory-log-table-wrap">
      <table class="inventory-log-table">
        <thead>
          <tr>
            <th>Ngày Cập Nhật</th>
            <th>Tên Hàng Hóa</th>
            <th>Tên Nhóm</th>
            <th>Mục đích</th>
            <th>Lý Do Xuất</th>
            <th>Số lượng</th>
            <th>Giá vốn</th>
            <th>Giá bán</th>
            <th>Tổng tiền</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (log, index) => {
                const purpose = getInventoryLogPurpose(log);
                const total = getInventoryLogTotal(log);
                const reason = getInventoryLogReason(log);
                return `
                  <tr class="${index > 0 ? "inventory-log-extra" : ""}" data-edit-inventory-log="${escapeHtml(log.id)}" title="Bấm để sửa lịch sử kho">
                    <td>${formatDate(getInventoryLogDate(log))}</td>
                    <td>${escapeHtml(log.itemName || "")}</td>
                    <td>${escapeHtml(log.groupName || "")}</td>
                    <td><span class="inventory-log-purpose ${purpose.value}">${purpose.label}</span></td>
                    <td>${purpose.value === "export" ? escapeHtml(reason || "Chưa ghi") : "—"}</td>
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
                    <td>
                      <span class="inventory-log-change">
                        <span class="old-value">${formatCurrency(getInventoryLogOldSalePrice(log))}</span>
                        <span class="change-arrow">→</span>
                        <span class="new-value">${formatCurrency(getInventoryLogNewSalePrice(log))}</span>
                      </span>
                    </td>
                    <td><span class="inventory-log-total">${formatCurrency(total)}</span></td>
                  </tr>
                `;
              }
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

function renderInventoryLogFilter(store, suggestionLogs = []) {
  const options = [
    ["all", "Tất cả"],
    ["purchase", "Nhập kho"],
    ["export", "Xuất kho"]
  ];
  const reasonOptions = getInventoryExportReasons(store);
  const itemNames = new Map();
  suggestionLogs.forEach((log) => {
    const itemName = String(log?.itemName || "").trim();
    const key = normalizeSearchText(itemName);
    if (key && !itemNames.has(key)) itemNames.set(key, itemName);
  });

  return `
    <div class="inventory-log-filter">
      <label for="inventoryLogFilter">Phân loại</label>
      <select id="inventoryLogFilter" data-inventory-log-filter>
        ${options
          .map(([value, label]) => `<option value="${value}" ${uiState.inventoryLogFilter === value ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </div>
    <div class="inventory-log-filter inventory-log-search-filter">
      <label for="inventoryLogSearch">Tìm kiếm</label>
      <input id="inventoryLogSearch" data-inventory-log-search type="text" value="${escapeHtml(uiState.inventoryLogSearch)}" placeholder="Nhập tên hàng hóa..." autocomplete="off" list="inventoryLogSearchSuggestions" />
      <datalist id="inventoryLogSearchSuggestions">
        ${[...itemNames.values()]
          .sort((a, b) => a.localeCompare(b, "vi"))
          .map((itemName) => `<option value="${escapeHtml(itemName)}"></option>`)
          .join("")}
      </datalist>
    </div>
    ${
      uiState.inventoryLogFilter === "export"
        ? `
          <div class="inventory-log-filter inventory-log-reason-filter">
            <label for="inventoryLogReasonFilter">Lý do xuất</label>
            <select id="inventoryLogReasonFilter" data-inventory-log-reason-filter>
              <option value="all" ${uiState.inventoryLogReasonFilter === "all" ? "selected" : ""}>Tất cả</option>
              ${reasonOptions
                .map((reason) => `<option value="${escapeHtml(reason)}" ${uiState.inventoryLogReasonFilter === reason ? "selected" : ""}>${escapeHtml(reason)}</option>`)
                .join("")}
            </select>
          </div>
        `
        : ""
    }
  `;
}

function filterInventoryLogsBySearch(logs, rawQuery) {
  const query = normalizeSearchText(rawQuery).replace(/\s+/g, " ");
  if (!query) return logs;

  return logs
    .map((log, index) => ({
      log,
      index,
      score: getInventoryLogSearchScore(log?.itemName, query)
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.log);
}

function getInventoryLogSearchScore(itemName, query) {
  const name = normalizeSearchText(itemName).replace(/\s+/g, " ");
  if (!name) return Number.POSITIVE_INFINITY;
  if (name === query) return 0;
  if (name.startsWith(query)) return 0.05 + (name.length - query.length) / Math.max(name.length, 1) / 10;
  if (name.includes(query)) return 0.1 + (name.length - query.length) / Math.max(name.length, 1) / 10;

  const queryTerms = query.split(" ").filter(Boolean);
  const nameTerms = name.split(" ").filter(Boolean);
  if (queryTerms.every((term) => name.includes(term))) return 0.2;

  const compactName = name.replace(/\s+/g, "");
  const compactQuery = query.replace(/\s+/g, "");
  if (compactName.includes(compactQuery)) return 0.24;

  const termDistances = queryTerms.map((queryTerm) => {
    if (queryTerm.length <= 2) return nameTerms.includes(queryTerm) ? 0 : 1;
    return Math.min(
      ...nameTerms.map((nameTerm) =>
        getNormalizedEditDistance(queryTerm, nameTerm)
      )
    );
  });
  const maxTermDistance = Math.max(...termDistances);
  const averageTermDistance = termDistances.reduce((sum, distance) => sum + distance, 0) / termDistances.length;
  if (maxTermDistance <= 0.42) return 0.3 + averageTermDistance;

  const fullDistance = getNormalizedEditDistance(compactQuery, compactName);
  return fullDistance <= 0.42 ? 0.8 + fullDistance : Number.POSITIVE_INFINITY;
}

function getNormalizedEditDistance(left, right) {
  const longestLength = Math.max(left.length, right.length, 1);
  return getEditDistance(left, right) / longestLength;
}

function getEditDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function getInventoryLogReason(log) {
  return String(log?.exportReason || log?.reason || "").trim();
}

function getInventoryExportReasons(store) {
  const reasons = new Set();
  (Array.isArray(store?.exportReasons) ? store.exportReasons : []).forEach((reason) => {
    const value = String(reason || "").trim();
    if (value) reasons.add(value);
  });

  if (!Array.isArray(store?.exportReasons)) {
    (store?.inventoryLogs || []).forEach((log) => {
      if (getInventoryLogPurpose(log).value !== "export") return;
      const reason = getInventoryLogReason(log);
      if (reason) reasons.add(reason);
    });
  }

  return Array.from(reasons).sort((a, b) => a.localeCompare(b, "vi"));
}

function getInventoryLogPurpose(log) {
  const oldQuantity = Number(log?.oldQuantity || 0);
  const newQuantity = Number(log?.newQuantity || 0);
  if (newQuantity > oldQuantity) return { value: "purchase", label: "Nhập kho" };
  if (newQuantity < oldQuantity) return { value: "export", label: "Xuất kho" };
  return { value: "edit", label: "Cập nhật kho" };
}

function getInventoryLogTotal(log) {
  const oldQuantity = Number(log?.oldQuantity || 0);
  const newQuantity = Number(log?.newQuantity || 0);
  const changedQuantity = Math.abs(newQuantity - oldQuantity);
  if (!changedQuantity) return 0;

  const price = Number(log?.newPrice || log?.oldPrice || 0);
  return Math.max(0, changedQuantity * price);
}

function getInventoryLogOldSalePrice(log) {
  return Number(log?.oldSalePrice ?? log?.oldPrice ?? 0);
}

function getInventoryLogNewSalePrice(log) {
  return Number(log?.newSalePrice ?? log?.newPrice ?? 0);
}

function getInventoryLogDate(log) {
  return String(log?.date || log?.updatedAt || today).slice(0, 10);
}

function getInventorySalePrice(item) {
  return Number(item?.salePrice ?? item?.lastPrice ?? 0);
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

function jumpToHistoryCategory(type, categoryId) {
  const isIncome = type === "income";
  const filter = isIncome ? els.incomeHistoryFilter : els.expenseHistoryFilter;
  const search = isIncome ? els.incomeHistorySearch : els.expenseHistorySearch;
  const historySection = filter?.closest(".panel");

  if (!filter || !categoryId) return;

  filter.value = categoryId;
  if (search) search.value = "";
  render();

  window.requestAnimationFrame(() => {
    historySection?.scrollIntoView({ behavior: "smooth", block: "start" });
    filter.focus({ preventScroll: true });
  });
}

function renderReportList(container, categories, entries, type) {
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
      <div class="report-item report-category-link" role="button" tabindex="0" data-history-jump-type="${type}" data-history-jump-category="${category.id}" title="Loc lich su theo muc nay">
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
  els.singleDateField.hidden = false;
  els.monthField.hidden = false;
  els.fromField.hidden = false;
  els.toField.hidden = false;
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

function parsePercentInput(value) {
  const normalized = String(value || "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function formatPercentInput(value) {
  const percent = parsePercentInput(value);
  if (!percent) return "";
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
}

function getDiscountedPrice(price, discountPercent, discountAmount = 0) {
  const originalPrice = Number(price || 0);
  const amount = Math.min(originalPrice, Math.max(0, Number(discountAmount || 0)));
  if (amount > 0) return Math.max(0, Math.round(originalPrice - amount));

  const discount = Math.min(100, Math.max(0, Number(discountPercent || 0)));
  return Math.max(0, Math.round(originalPrice * (100 - discount) / 100));
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

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function toDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
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

