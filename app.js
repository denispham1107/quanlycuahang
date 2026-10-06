const STORAGE_KEY = "store-cashbook-v1";
const AI_CHAT_STORAGE_KEY = "store-cashbook-ai-chat-v1";
const AI_CLIENT_STATE_MAX_CHARS = 900000;
const AI_FILE_MAX_BYTES = 8 * 1024 * 1024;
const AI_FILE_TEXT_MAX_CHARS = 80000;
const FIREBASE_CONFIG_PLACEHOLDER = "PASTE_YOUR_FIREBASE_CONFIG_HERE";
const FIRESTORE_COLLECTION = "quanlycuahang";
const FIRESTORE_DOCUMENT = "shared-state";
const IS_IOS_DEVICE =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const USE_MOBILE_APP_THEME = IS_IOS_DEVICE || /Android/i.test(navigator.userAgent);
document.documentElement.classList.toggle("mobile-app-theme", USE_MOBILE_APP_THEME);

let cloudStore = {
  enabled: false,
  ready: false,
  db: null,
  docRef: null,
  unsubscribe: null,
  lastError: null,
  status: "starting"
};

let authState = {
  ready: false,
  user: null,
  profile: null,
  role: ""
};
let authRestoreAttempt = 0;
let authSlowTimer = null;
let authDb = null;
let firebaseAuthInstance = null;

const defaultData = {
  activeStoreId: null,
  stores: []
};

let state = loadCachedState();
let timeFiltersAutoCollapseTimer = null;
const historySearchRenderTimers = {
  income: null,
  expense: null
};
const historySearchSuggestionCache = {
  income: [],
  expense: []
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Website vẫn hoạt động bình thường nếu trình duyệt không cho phép đăng ký PWA.
    });
  });
}

const uiState = {
  categoryExpanded: {
    income: false,
    expense: false
  },
  rangeMode: "today",
  timeFiltersExpanded: false,
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
  salesOrderDiscountAmount: 0,
  activityHistoryRangeMode: "all",
  activityHistoryAreaFilter: "all",
  activityHistoryActorFilter: "all"
};

const els = {
  authScreen: document.querySelector("#authScreen"),
  authTitle: document.querySelector("#authTitle"),
  authDescription: document.querySelector("#authDescription"),
  authStartup: document.querySelector("#authStartup"),
  authStartupMessage: document.querySelector("#authStartupMessage"),
  authStartupRetry: document.querySelector("#authStartupRetry"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  loginSubmit: document.querySelector("#loginSubmit"),
  signedInUser: document.querySelector("#signedInUser"),
  signedInUserName: document.querySelector("#signedInUserName"),
  signedInUserRole: document.querySelector("#signedInUserRole"),
  signOutButton: document.querySelector("#signOutButton"),
  storeForm: document.querySelector("#storeForm"),
  storeName: document.querySelector("#storeName"),
  mobileAddStoreToggle: document.querySelector("#mobileAddStoreToggle"),
  storeList: document.querySelector("#storeList"),
  storeCount: document.querySelector("#storeCount"),
  dashboard: document.querySelector("#dashboard"),
  heroStoreName: document.querySelector("#heroStoreName"),
  heroStoreMeta: document.querySelector("#heroStoreMeta"),
  storeHeroEntryCount: document.querySelector("#storeHeroEntryCount"),
  storeHeroTotalCount: document.querySelector("#storeHeroTotalCount"),
  activeStorePanel: document.querySelector(".toolbar"),
  activeStoreName: document.querySelector("#activeStoreName"),
  overviewStoreName: document.querySelector("#overviewStoreName"),
  mobileOverviewStoreName: document.querySelector("#mobileOverviewStoreName"),
  mobileOverviewRangeLabel: document.querySelector("#mobileOverviewRangeLabel"),
  mobileTotalIncome: document.querySelector("#mobileTotalIncome"),
  mobileTotalSales: document.querySelector("#mobileTotalSales"),
  mobileTotalExpense: document.querySelector("#mobileTotalExpense"),
  mobileBalance: document.querySelector("#mobileBalance"),
  renameStore: document.querySelector("#renameStore"),
  deleteStore: document.querySelector("#deleteStore"),
  rangeMode: document.querySelector("#rangeMode"),
  timeFilterCurrentValue: document.querySelector("#timeFilterCurrentValue"),
  timePresetButtons: document.querySelectorAll("[data-time-preset]"),
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
  incomeHistoryRangeLabel: document.querySelector("#incomeHistoryRangeLabel"),
  expenseHistoryRangeLabel: document.querySelector("#expenseHistoryRangeLabel"),
  incomeHistoryTotal: document.querySelector("#incomeHistoryTotal"),
  expenseHistoryTotal: document.querySelector("#expenseHistoryTotal"),
  incomeHistorySearch: document.querySelector("#incomeHistorySearch"),
  expenseHistorySearch: document.querySelector("#expenseHistorySearch"),
  incomeHistorySearchSuggestions: document.querySelector("#incomeHistorySearchSuggestions"),
  expenseHistorySearchSuggestions: document.querySelector("#expenseHistorySearchSuggestions"),
  incomeIosHistorySuggestions: document.querySelector("#incomeIosHistorySuggestions"),
  expenseIosHistorySuggestions: document.querySelector("#expenseIosHistorySuggestions"),
  incomeHistoryFilter: document.querySelector("#incomeHistoryFilter"),
  expenseHistoryFilter: document.querySelector("#expenseHistoryFilter"),
  incomeNoteSuggestions: document.querySelector("#incomeNoteSuggestions"),
  expenseNoteSuggestions: document.querySelector("#expenseNoteSuggestions"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  settingsMenu: document.querySelector("#settingsMenu"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsActions: document.querySelector("#settingsActions"),
  openEmployeeManager: document.querySelector("#openEmployeeManager"),
  employeeManagerPage: document.querySelector("#employeeManagerPage"),
  closeEmployeeManager: document.querySelector("#closeEmployeeManager"),
  employeeCreateForm: document.querySelector("#employeeCreateForm"),
  employeeStore: document.querySelector("#employeeStore"),
  employeeManagerStatus: document.querySelector("#employeeManagerStatus"),
  employeeAccountList: document.querySelector("#employeeAccountList"),
  employeeCount: document.querySelector("#employeeCount"),
  openActivityHistory: document.querySelector("#openActivityHistory"),
  activityHistoryPage: document.querySelector("#activityHistoryPage"),
  activityHistoryStoreName: document.querySelector("#activityHistoryStoreName"),
  activityHistoryList: document.querySelector("#activityHistoryList"),
  activityHistoryRangeMode: document.querySelector("#activityHistoryRangeMode"),
  activityHistoryAreaFilter: document.querySelector("#activityHistoryAreaFilter"),
  activityHistoryActorFilter: document.querySelector("#activityHistoryActorFilter"),
  activityHistoryCustomRange: document.querySelector("#activityHistoryCustomRange"),
  activityHistoryFromDate: document.querySelector("#activityHistoryFromDate"),
  activityHistoryToDate: document.querySelector("#activityHistoryToDate"),
  activityHistoryResultCount: document.querySelector("#activityHistoryResultCount"),
  closeActivityHistory: document.querySelector("#closeActivityHistory"),
  syncStatus: document.querySelector("#syncStatus"),
  stickyControlDock: document.querySelector("#stickyControlDock"),
  tabBar: document.querySelector("#tabBar"),
  tabSpacer: document.querySelector("#tabSpacer"),
  timeFilters: document.querySelector("#timeFilters"),
  timeFilterToggle: document.querySelector("#timeFilterToggle"),
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
  quickEntryClose: document.querySelector("#quickEntryClose"),
  quickEntryFields: document.querySelector("#quickEntryFields"),
  quickEntryCategory: document.querySelector("#quickEntryCategory"),
  quickCategoryToggle: document.querySelector("#quickCategoryToggle"),
  quickCategoryCreator: document.querySelector("#quickCategoryCreator"),
  quickNewCategoryName: document.querySelector("#quickNewCategoryName"),
  quickCategoryCreate: document.querySelector("#quickCategoryCreate"),
  quickCategoryError: document.querySelector("#quickCategoryError"),
  quickEntryDate: document.querySelector("#quickEntryDate"),
  quickEntryNote: document.querySelector("#quickEntryNote"),
  quickEntryAmount: document.querySelector("#quickEntryAmount"),
  quickEntrySuggestions: document.querySelector("#quickEntrySuggestions"),
  openBulkCashPage: document.querySelector("#openBulkCashPage"),
  bulkCashPage: document.querySelector("#bulkCashPage"),
  bulkCashCard: document.querySelector("#bulkCashCard"),
  bulkCashTitle: document.querySelector("#bulkCashTitle"),
  bulkCashContext: document.querySelector("#bulkCashContext"),
  bulkCashText: document.querySelector("#bulkCashText"),
  bulkCashCount: document.querySelector("#bulkCashCount"),
  bulkCashFileButton: document.querySelector("#bulkCashFileButton"),
  bulkCashFile: document.querySelector("#bulkCashFile"),
  bulkCashFileHint: document.querySelector("#bulkCashFileHint"),
  bulkCashErrors: document.querySelector("#bulkCashErrors"),
  closeBulkCashPage: document.querySelector("#closeBulkCashPage"),
  cancelBulkCashPage: document.querySelector("#cancelBulkCashPage"),
  completeBulkCashPage: document.querySelector("#completeBulkCashPage"),
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
  salesCatalogPage: document.querySelector("#salesCatalogPage"),
  salesCatalogTotalCount: document.querySelector("#salesCatalogTotalCount"),
  salesCatalogAvailableCount: document.querySelector("#salesCatalogAvailableCount"),
  salesCatalogGroupCount: document.querySelector("#salesCatalogGroupCount"),
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
  customersPage: document.querySelector("#customersPage"),
  customersCard: document.querySelector(".customers-card"),
  customersCount: document.querySelector("#customersCount"),
  customersList: document.querySelector("#customersList"),
  customerMemberChips: document.querySelector("#customerMemberChips"),
  closeCustomersTop: document.querySelector("#closeCustomersTop"),
  toggleCustomerForm: document.querySelector("#toggleCustomerForm"),
  customerForm: document.querySelector("#customerForm"),
  customerNameInput: document.querySelector("#customerNameInput"),
  customerPhoneInput: document.querySelector("#customerPhoneInput"),
  customerMemberTier: document.querySelector("#customerMemberTier"),
  customerMemberFilter: document.querySelector("#customerMemberFilter"),
  customerSearchInput: document.querySelector("#customerSearchInput"),
  customerSearchSuggestions: document.querySelector("#customerSearchSuggestions"),
  customerCreatedAt: document.querySelector("#customerCreatedAt"),
  customerCreatedDate: document.querySelector("#customerCreatedDate"),
  customerCreatedTime: document.querySelector("#customerCreatedTime"),
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
  editInventoryLogReasonField: document.querySelector("#editInventoryLogReasonField"),
  editInventoryLogReason: document.querySelector("#editInventoryLogReason"),
  editInventoryLogReasonSuggestions: document.querySelector("#editInventoryLogReasonSuggestions"),
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

if (USE_MOBILE_APP_THEME) {
  // Match the visual and keyboard order of the amount-first mobile quick sheet.
  const [mainRow, detailRow] = els.quickEntryFields.querySelectorAll(":scope > .form-row");
  mainRow?.prepend(els.quickEntryAmount.closest(".field"));
  detailRow?.prepend(els.quickEntryCategory.closest(".field"));
}

const desktopUi = !USE_MOBILE_APP_THEME ? {
  filterRail: document.querySelector("#desktopFilterRail"),
  filterBody: document.querySelector("#desktopFilterBody"),
  collapse: document.querySelector("#desktopFilterCollapse"),
  categoryField: document.querySelector("#desktopCategoryField"),
  categoryFilter: document.querySelector("#desktopCategoryFilter"),
  heading: document.querySelector("#desktopPageHeading"),
  title: document.querySelector("#desktopPageTitle"),
  subtitle: document.querySelector("#desktopPageSubtitle"),
  primaryAction: document.querySelector("#desktopPrimaryAction"),
  primaryActionLabel: document.querySelector("#desktopPrimaryActionLabel"),
  insights: document.querySelector("#desktopInsights")
} : null;

if (desktopUi) {
  document.querySelector("#desktopNavHost").appendChild(els.tabBar);
  document.querySelector("#desktopFilterControls").append(els.timeFilterToggle, els.timeFilters);
  document.querySelector("#desktopAddStoreShortcut").addEventListener("click", () => {
    els.storeName.scrollIntoView({ behavior: "smooth", block: "center" });
    els.storeName.focus({ preventScroll: true });
  });
  desktopUi.collapse.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("desktop-filters-collapsed");
    desktopUi.collapse.setAttribute("aria-expanded", String(!collapsed));
    desktopUi.collapse.setAttribute("aria-label", collapsed ? "Mở bộ lọc" : "Thu gọn bộ lọc");
    desktopUi.collapse.title = collapsed ? "Mở bộ lọc" : "Thu gọn bộ lọc";
    desktopUi.collapse.textContent = collapsed ? "»" : "«";
  });
  desktopUi.primaryAction.addEventListener("click", () => els.quickEntryButton.click());
  document.querySelector("#desktopFilterApply").addEventListener("click", render);
  document.querySelector("#desktopFilterReset").addEventListener("click", () => {
    els.rangeMode.value = "today";
    uiState.rangeMode = "today";
    els.singleDate.value = today;
    els.monthDate.value = today.slice(0, 7);
    els.fromDate.value = today;
    els.toDate.value = today;
    desktopUi.categoryFilter.value = "all";
    const linked = getDesktopCategorySource();
    if (linked) {
      linked.value = "all";
      linked.dispatchEvent(new Event("change", { bubbles: true }));
    }
    render();
  });
  desktopUi.categoryFilter.addEventListener("change", () => {
    const linked = getDesktopCategorySource();
    if (!linked) return;
    linked.value = desktopUi.categoryFilter.value;
    linked.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

if (USE_MOBILE_APP_THEME && els.tabBar) {
  // The bottom navigation must not be clipped by a short tab panel or the dock.
  document.body.appendChild(els.tabBar);
}

const mobileTimeFilterShell = USE_MOBILE_APP_THEME ? document.createElement("div") : null;
if (mobileTimeFilterShell && els.timeFilters && els.timeFilterToggle) {
  // Keep the fixed filter rail outside the dock's clipping and pinning context.
  mobileTimeFilterShell.className = "mobile-time-filter-shell";
  mobileTimeFilterShell.hidden = true;
  mobileTimeFilterShell.append(els.timeFilterToggle, els.timeFilters);
  document.body.appendChild(mobileTimeFilterShell);
  els.timeFilters.hidden = true;
  els.timeFilters.addEventListener("focusin", clearTimeFiltersAutoCollapse);
}

function updateCashQuickEntryViewport() {
  if (!USE_MOBILE_APP_THEME || !els.quickEntryModal.classList.contains("cash-quick-entry-mode")) return;
  const viewport = window.visualViewport;
  els.quickEntryModal.style.setProperty("--cash-quick-viewport-height", `${viewport?.height || window.innerHeight}px`);
  els.quickEntryModal.style.setProperty("--cash-quick-viewport-top", `${viewport?.offsetTop || 0}px`);
  if (!els.quickCategoryCreator.hidden && document.activeElement === els.quickNewCategoryName) {
    requestAnimationFrame(ensureQuickCategoryCreatorVisible);
  }
}

function ensureQuickCategoryCreatorVisible() {
  if (!USE_MOBILE_APP_THEME || els.quickEntryModal.hidden ||
      !els.quickEntryModal.classList.contains("cash-quick-entry-mode") || els.quickCategoryCreator.hidden) return;

  const card = els.quickEntryForm;
  const cardRect = card.getBoundingClientRect();
  const creatorRect = els.quickCategoryCreator.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
  const visibleTop = Math.max(cardRect.top, viewportTop) + 16;
  const visibleBottom = Math.min(cardRect.bottom, viewportBottom) - 16;

  if (creatorRect.height > visibleBottom - visibleTop || creatorRect.top < visibleTop) {
    card.scrollTop += creatorRect.top - visibleTop;
  } else if (creatorRect.bottom > visibleBottom) {
    card.scrollTop += creatorRect.bottom - visibleBottom;
  }
}

if (USE_MOBILE_APP_THEME && window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateCashQuickEntryViewport);
  window.visualViewport.addEventListener("scroll", updateCashQuickEntryViewport);
}

if (els.aiChatMode) {
  els.aiChatMode.value = "general";
}

const today = toDateInputValue(new Date());
els.rangeMode.value = "today";
els.singleDate.value = today;
els.monthDate.value = today.slice(0, 7);
els.fromDate.value = today;
els.toDate.value = today;

function isAdminUser() {
  return authState.role === "admin";
}

function isEmployeeUser() {
  return authState.role === "employee";
}

const DEFAULT_EMPLOYEE_PERMISSIONS = Object.freeze({
  purchase: Object.freeze({ view: true, create: true, inventoryView: false }),
  sales: Object.freeze({ view: true, create: true, draft: false }),
  history: Object.freeze({ viewOwn: true })
});

function normalizeEmployeePermissions(profile = {}) {
  const source = profile.permissions;
  if (!source || typeof source !== "object") {
    return JSON.parse(JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS));
  }
  const permissions = {
    purchase: {
      view: source.purchase?.view === true,
      create: source.purchase?.create === true,
      inventoryView: source.purchase?.inventoryView === true
    },
    sales: {
      view: source.sales?.view === true,
      create: source.sales?.create === true,
      draft: source.sales?.draft === true
    },
    history: {
      viewOwn: source.history?.viewOwn === true
    }
  };
  if (permissions.purchase.create) permissions.purchase.view = true;
  if (permissions.purchase.inventoryView) permissions.purchase.view = true;
  if (permissions.sales.create) permissions.sales.view = true;
  if (permissions.sales.draft) {
    permissions.sales.create = true;
    permissions.sales.view = true;
  }
  return permissions;
}

function employeeCan(area, action) {
  if (!isEmployeeUser()) return true;
  return normalizeEmployeePermissions(authState.profile)?.[area]?.[action] === true;
}

const EMPLOYEE_EMPTY_TABS = new Set(["stores", "overview", "income", "expense"]);

function isEmployeeEmptyTab(tabName) {
  return isEmployeeUser() && EMPLOYEE_EMPTY_TABS.has(tabName);
}

function getFirstEmployeeTab() {
  if (employeeCan("purchase", "view")) return "purchase";
  if (employeeCan("sales", "view")) return "sales";
  return "purchase";
}

function getCurrentActor() {
  return {
    actorUid: authState.user?.uid || "",
    actorName: authState.profile?.displayName || authState.user?.email || "",
    actorRole: authState.role || ""
  };
}

els.loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = String(els.loginEmail.value || "").trim();
  const password = String(els.loginPassword.value || "");
  if (!email || !password) {
    showLoginError("Vui lòng nhập email và mật khẩu.");
    return;
  }

  els.loginSubmit.disabled = true;
  els.loginSubmit.textContent = "Đang đăng nhập...";
  showLoginError("");
  try {
    const auth = window.firebase.auth();
    try {
      await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
    } catch (error) {
      console.warn("Cannot persist authentication locally", error);
    }
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    showLoginError("Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được cấp quyền.");
  } finally {
    els.loginSubmit.disabled = false;
    els.loginSubmit.textContent = "Đăng nhập";
  }
});

els.signOutButton?.addEventListener("click", async () => {
  await window.firebase.auth().signOut();
});

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

  if (USE_MOBILE_APP_THEME) {
    if (storePanel) storesPanel.append(storePanel);
    if (els.activeStorePanel) storesPanel.append(els.activeStorePanel);
    return;
  }

  const storeLayout = storesPanel.querySelector(".desktop-store-layout");
  const details = storesPanel.querySelector(".desktop-store-details");
  const hero = document.querySelector("#activeStoreHero");
  const stats = hero?.querySelector(".store-dashboard-stats");
  if (storePanel) storeLayout.prepend(storePanel);
  if (hero) details.append(hero);
  if (stats && els.activeStorePanel) els.activeStorePanel.insertBefore(stats, els.activeStorePanel.querySelector(".toolbar-actions"));
  if (els.activeStorePanel) details.append(els.activeStorePanel);
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

els.mobileAddStoreToggle.addEventListener("click", () => {
  const expanded = els.mobileAddStoreToggle.getAttribute("aria-expanded") === "true";
  els.mobileAddStoreToggle.setAttribute("aria-expanded", String(!expanded));
  els.storeForm.classList.toggle("is-open", !expanded);
  if (!expanded) els.storeName.focus();
});

els.storeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.storeName.value.trim();
  if (!name) return;

  const createdAt = new Date().toISOString();
  const storeId = createId();
  const store = {
    id: storeId,
    name,
    categories: {
      income: [],
      expense: []
    },
    entries: [],
    orders: [],
    salesBillSequences: {},
    draftOrders: [],
    purchaseCategories: [],
    purchaseOrders: [],
    inventoryLogs: [],
    inventory: [],
    exportReasons: [],
    activityHistory: [
      {
        id: createId(),
        action: "create",
        area: "Cửa hàng",
        message: `Tạo cửa hàng "${name}".`,
        createdAt,
        ...getCurrentActor(),
        tab: "stores",
        targetType: "store",
        targetId: storeId
      }
    ],
    createdAt
  };

  state.stores.push(store);
  state.activeStoreId = store.id;
  els.storeName.value = "";
  els.storeForm.classList.remove("is-open");
  els.mobileAddStoreToggle.setAttribute("aria-expanded", "false");
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

  const previousName = store.name;
  store.name = name;
  store.updatedAt = new Date().toISOString();
  recordActivity(store, "update", "Cửa hàng", `Đổi tên cửa hàng từ "${previousName}" thành "${name}".`, {
    tab: "stores",
    targetType: "store",
    targetId: store.id
  });
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

function applyRangeModeFilter(event) {
  uiState.rangeMode = els.rangeMode.value;
  syncQuickRangeInputs();
  updateFilterFields();
  render();
  if (event?.type === "change" && els.rangeMode.value !== "custom") {
    scheduleTimeFiltersAutoCollapse();
  }
}

els.rangeMode.addEventListener("change", applyRangeModeFilter);
if (!USE_MOBILE_APP_THEME) {
  els.rangeMode.addEventListener("click", applyRangeModeFilter);
  els.rangeMode.addEventListener("blur", applyRangeModeFilter);
}

els.timePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.rangeMode.value = button.dataset.timePreset;
    applyRangeModeFilter({ type: "change" });
  });
});

function applySingleDateFilter() {
  uiState.rangeMode = "day";
  els.rangeMode.value = "day";
  updateFilterFields();
  render();
}

function applyMonthFilter() {
  uiState.rangeMode = "month";
  els.rangeMode.value = "month";
  updateFilterFields();
  render();
}

(USE_MOBILE_APP_THEME ? ["change"] : ["input", "change"]).forEach((eventName) => {
  els.singleDate.addEventListener(eventName, applySingleDateFilter);
  els.monthDate.addEventListener(eventName, applyMonthFilter);
});

els.singleDate.addEventListener("change", scheduleTimeFiltersAutoCollapse);
els.monthDate.addEventListener("change", scheduleTimeFiltersAutoCollapse);
document.querySelector("#applySingleDate")?.addEventListener("click", () => {
  applySingleDateFilter();
  scheduleTimeFiltersAutoCollapse();
});
document.querySelector("#applyMonthDate")?.addEventListener("click", () => {
  applyMonthFilter();
  scheduleTimeFiltersAutoCollapse();
});
document.querySelector("#applyCustomRange")?.addEventListener("click", () => {
  if (!els.fromDate.value || !els.toDate.value) return;
  uiState.rangeMode = "custom";
  els.rangeMode.value = "custom";
  render();
  scheduleTimeFiltersAutoCollapse();
});

if (!USE_MOBILE_APP_THEME) {
  ["focus", "click"].forEach((eventName) => {
    els.singleDate.addEventListener(eventName, applySingleDateFilter);
    els.monthDate.addEventListener(eventName, applyMonthFilter);
  });
}

[els.fromDate, els.toDate].forEach((input) => {
  input.addEventListener("change", () => {
    uiState.rangeMode = "custom";
    els.rangeMode.value = "custom";
    updateFilterFields();
    render();
    if (!USE_MOBILE_APP_THEME && els.fromDate.value && els.toDate.value) {
      scheduleTimeFiltersAutoCollapse();
    }
  });
});

[
  [els.incomeHistoryFilter, "income"],
  [els.expenseHistoryFilter, "expense"]
].forEach(([select, type]) => {
  select.addEventListener("change", () => renderHistorySearchResults(type));
});

[
  [els.incomeHistorySearch, "income"],
  [els.expenseHistorySearch, "expense"]
].forEach(([input, type]) => {
  input.addEventListener("input", (event) => {
    if (event.isComposing) return;
    renderIosHistorySuggestions(type);
    scheduleHistorySearchRender(type);
  });
  input.addEventListener("change", () => scheduleHistorySearchRender(type, !IS_IOS_DEVICE));
  input.addEventListener("compositionend", () => {
    renderIosHistorySuggestions(type);
    scheduleHistorySearchRender(type, !IS_IOS_DEVICE);
  });
  input.addEventListener("focus", () => renderIosHistorySuggestions(type));
});

configureIosHistorySearch();

document.addEventListener("click", (event) => {
  const suggestion = event.target.closest("[data-ios-history-suggestion]");
  if (suggestion) {
    const type = suggestion.dataset.historyType === "expense" ? "expense" : "income";
    const input = type === "income" ? els.incomeHistorySearch : els.expenseHistorySearch;
    input.value = suggestion.textContent.trim();
    input.focus({ preventScroll: true });
    hideIosHistorySuggestions(type);
    scheduleHistorySearchRender(type, true);
    return;
  }

  if (IS_IOS_DEVICE && !event.target.closest(".history-search")) {
    hideIosHistorySuggestions("income");
    hideIosHistorySuggestions("expense");
  }
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

document.querySelector(".overview-charts")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-overview-bar]");
  if (button) showOverviewBarValue(button);
});

els.timeFilterToggle?.addEventListener("click", () => {
  clearTimeFiltersAutoCollapse();
  uiState.timeFiltersExpanded = !uiState.timeFiltersExpanded;
  updateTimeFiltersVisibility();
  window.requestAnimationFrame(() => {
    updatePinnedTabs();
    window.requestAnimationFrame(updatePinnedTabs);
  });
});

els.timeFilters?.addEventListener("transitionend", updatePinnedTabs);

function clearTimeFiltersAutoCollapse() {
  if (!timeFiltersAutoCollapseTimer) return;
  window.clearTimeout(timeFiltersAutoCollapseTimer);
  timeFiltersAutoCollapseTimer = null;
}

function scheduleTimeFiltersAutoCollapse() {
  clearTimeFiltersAutoCollapse();
  if (!uiState.timeFiltersExpanded || els.timeFilters?.hidden) return;

  timeFiltersAutoCollapseTimer = window.setTimeout(() => {
    timeFiltersAutoCollapseTimer = null;
    if (!uiState.timeFiltersExpanded) return;
    uiState.timeFiltersExpanded = false;
    updateTimeFiltersVisibility();
    window.requestAnimationFrame(() => {
      updatePinnedTabs();
      window.requestAnimationFrame(updatePinnedTabs);
    });
  }, USE_MOBILE_APP_THEME ? 1000 : 2500);
}

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

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mobile-flow-action]");
  if (!button || !USE_MOBILE_APP_THEME) return;
  const type = button.dataset.flowType;
  const action = button.dataset.mobileFlowAction;
  if (type !== "income" && type !== "expense") return;
  if (action === "add") {
    openQuickEntryModal(type);
    return;
  }
  const view = action === "close"
    ? `close-${button.closest("[data-mobile-flow-panel]")?.dataset.mobileFlowPanel || ""}`
    : action;
  setMobileCashFlowPanel(type, view, action === "manage" ? ".category-section" : null);
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

els.quickEntryClose.addEventListener("click", closeQuickEntryModal);
els.openBulkCashPage.addEventListener("click", () => openBulkCashPage());
els.closeBulkCashPage.addEventListener("click", closeBulkCashPage);
els.cancelBulkCashPage.addEventListener("click", closeBulkCashPage);
els.completeBulkCashPage.addEventListener("click", completeBulkCashPage);
els.bulkCashText.addEventListener("input", updateBulkCashCount);
els.bulkCashFileButton.addEventListener("click", () => {
  els.bulkCashFile.value = "";
  els.bulkCashFile.click();
});
els.bulkCashFile.addEventListener("change", importBulkCashFile);
els.bulkCashPage.addEventListener("focusin", (event) => {
  if (!event.target.matches("textarea, input")) return;
  [100, 350].forEach((delay) => window.setTimeout(() => ensureBulkCashFocusVisible(event.target), delay));
});
window.visualViewport?.addEventListener("resize", updateBulkCashViewport);
window.visualViewport?.addEventListener("scroll", updateBulkCashViewport);

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

els.quickCategoryToggle.addEventListener("click", () => {
  const opening = els.quickCategoryCreator.hidden;
  setQuickCategoryCreatorOpen(opening);
  if (opening) {
    els.quickNewCategoryName.focus({ preventScroll: true });
    requestAnimationFrame(ensureQuickCategoryCreatorVisible);
    // iOS changes the visual viewport after focus; check again once its keyboard settles.
    window.setTimeout(ensureQuickCategoryCreatorVisible, 350);
  }
});

els.quickCategoryCreate.addEventListener("click", createQuickEntryCategory);
els.quickNewCategoryName.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  createQuickEntryCategory();
});
els.quickNewCategoryName.addEventListener("input", () => {
  els.quickCategoryError.hidden = true;
  els.quickCategoryError.textContent = "";
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
    openSalesCatalogPage(catalogButton.closest(".sales-item-row"));
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

els.closeSalesCatalog.addEventListener("click", closeSalesCatalogPage);
window.visualViewport?.addEventListener("resize", updateSalesCatalogViewport);
window.visualViewport?.addEventListener("scroll", updateSalesCatalogViewport);
els.salesCatalogPage.addEventListener("focusin", (event) => {
  if (!event.target.matches("input, select")) return;
  [100, 350].forEach((delay) => window.setTimeout(() => ensureSalesCatalogFocusVisible(event.target), delay));
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

els.openCustomers.addEventListener("click", () => openCustomersPage());

els.closeCustomers.addEventListener("click", closeCustomersPage);
els.closeCustomersTop.addEventListener("click", closeCustomersPage);

window.visualViewport?.addEventListener("resize", updateCustomersViewport);
window.visualViewport?.addEventListener("scroll", updateCustomersViewport);
els.customersCard.addEventListener("focusin", (event) => {
  if (!event.target.matches("input, select, textarea")) return;
  [100, 350].forEach((delay) => window.setTimeout(() => ensureCustomerFocusVisible(event.target), delay));
});

window.addEventListener("popstate", () => {
  const detailHash = window.location.hash;
  if (["#bulk-income", "#bulk-expense"].includes(detailHash) && els.authScreen.hidden && isAdminUser() && getActiveStore() && !els.quickEntryModal.hidden) {
    openBulkCashPage({ fromHistory: true });
  } else {
    hideBulkCashPage({ restoreFocus: !els.quickEntryModal.hidden });
  }
  if (detailHash === "#employees" && els.authScreen.hidden && isAdminUser()) {
    openEmployeeManagerPage({ fromHistory: true });
  } else {
    hideEmployeeManagerPage({ restoreFocus: false });
  }
  if (detailHash === "#activity-history" && els.authScreen.hidden && getActiveStore() && (!isEmployeeUser() || employeeCan("history", "viewOwn"))) {
    openActivityHistoryPage({ fromHistory: true });
  } else {
    hideActivityHistoryPage({ restoreFocus: false });
  }
  if (window.location.hash === "#sales-catalog" && els.authScreen.hidden && getActiveStore() && uiState.salesCatalogRow?.isConnected && !els.quickEntryModal.hidden) {
    openSalesCatalogPage(uiState.salesCatalogRow, { fromHistory: true });
  } else {
    hideSalesCatalogPage();
    if (window.location.hash === "#sales-catalog") {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
  }
  if (window.location.hash === "#customers" && els.authScreen.hidden && getActiveStore()) {
    openCustomersPage({ fromHistory: true });
  } else {
    hideCustomersPage();
  }
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

if (USE_MOBILE_APP_THEME) {
  els.customerCreatedAt.required = false;
  els.customerCreatedDate.required = true;
  els.customerCreatedTime.required = true;
}

for (const input of [els.customerCreatedDate, els.customerCreatedTime]) {
  input.addEventListener("input", syncCustomerCreatedAtFromMobile);
  input.addEventListener("change", syncCustomerCreatedAtFromMobile);
  input.addEventListener("blur", () => {
    if (input === els.customerCreatedDate) {
      const date = parseCustomerMobileDate(input.value);
      if (date) input.value = formatDate(date);
    } else {
      const time = parseCustomerMobileTime(input.value);
      if (time) input.value = time;
    }
    syncCustomerCreatedAtFromMobile();
  });
}

els.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (USE_MOBILE_APP_THEME) syncCustomerCreatedAtFromMobile();
  saveCustomerFromForm(new FormData(els.customerForm));
});

els.customerMemberFilter.addEventListener("change", () => {
  uiState.customerMemberFilter = els.customerMemberFilter.value;
  renderCustomers(getActiveStore());
});

els.customerMemberChips.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-customer-tier-filter]");
  if (!chip) return;
  uiState.customerMemberFilter = chip.dataset.customerTierFilter;
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

els.customersList.addEventListener("keydown", (event) => {
  if (event.target !== event.target.closest(".customer-card")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openCustomerById(event.target.dataset.editCustomer);
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
  if (isEmployeeUser()) return;
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

els.editInventoryLogQuantity.addEventListener("input", updateEditInventoryLogReasonVisibility);

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

function updateSettingsMenuViewport() {
  if (!els.settingsToggle || !els.settingsActions || els.settingsActions.hidden) return;
  const toggleRect = els.settingsToggle.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const menuGap = 10;
  const viewportGap = 12;
  const availableHeight = Math.max(
    160,
    Math.floor(viewportHeight - toggleRect.bottom - menuGap - viewportGap)
  );
  els.settingsActions.style.setProperty("--settings-menu-available-height", `${availableHeight}px`);
}

function setSettingsMenuOpen(open) {
  if (!els.settingsToggle || !els.settingsActions) return;
  const shouldOpen = Boolean(open);
  els.settingsActions.hidden = !shouldOpen;
  els.settingsToggle.classList.toggle("active", shouldOpen);
  els.settingsToggle.setAttribute("aria-expanded", String(shouldOpen));
  els.settingsMenu?.closest(".topbar")?.classList.toggle("settings-menu-open", shouldOpen);
  if (shouldOpen) window.requestAnimationFrame(updateSettingsMenuViewport);
}

els.settingsToggle?.addEventListener("click", () => {
  setSettingsMenuOpen(els.settingsActions?.hidden);
});

window.addEventListener("resize", updateSettingsMenuViewport);
window.visualViewport?.addEventListener("resize", updateSettingsMenuViewport);

document.addEventListener("click", (event) => {
  if (!els.settingsMenu || els.settingsMenu.contains(event.target)) return;
  setSettingsMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!els.bulkCashPage.hidden) {
    closeBulkCashPage();
    return;
  }
  if (!els.salesOrderDetailModal?.hidden) {
    closeSalesOrderDetailModal();
    return;
  }
  if (!els.employeeManagerPage?.hidden) {
    closeEmployeeManagerPage();
    return;
  }
  if (!els.activityHistoryPage?.hidden) {
    closeActivityHistoryPage();
    return;
  }
  if (!els.settingsActions?.hidden) {
    setSettingsMenuOpen(false);
    els.settingsToggle?.focus();
  }
});

els.openEmployeeManager?.addEventListener("click", () => openEmployeeManagerPage());
els.closeEmployeeManager?.addEventListener("click", closeEmployeeManagerPage);
els.employeeCreateForm?.addEventListener("change", (event) => {
  enforceEmployeePermissionDependencies(els.employeeCreateForm, event.target);
});
els.employeeCreateForm?.addEventListener("submit", createEmployeeAccount);
els.employeeAccountList?.addEventListener("change", (event) => {
  const card = event.target.closest("[data-employee-uid]");
  if (card) enforceEmployeePermissionDependencies(card, event.target);
});
els.employeeAccountList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-employee]");
  if (button) updateEmployeeAccount(button.closest("[data-employee-uid]"));
});
els.openActivityHistory?.addEventListener("click", () => openActivityHistoryPage());
els.closeActivityHistory?.addEventListener("click", closeActivityHistoryPage);
window.visualViewport?.addEventListener("resize", updateSettingsDetailViewport);
window.visualViewport?.addEventListener("scroll", updateSettingsDetailViewport);
[els.employeeManagerPage, els.activityHistoryPage].forEach((page) => page?.addEventListener("focusin", (event) => {
  if (!event.target.matches("input, select, textarea")) return;
  [100, 350].forEach((delay) => window.setTimeout(() => ensureSettingsDetailFocusVisible(event.target), delay));
}));
els.activityHistoryList?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-activity-id]");
  if (row) navigateToActivity(row.dataset.activityId);
});
els.activityHistoryList?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-activity-id]");
  if (!row) return;
  event.preventDefault();
  navigateToActivity(row.dataset.activityId);
});
els.activityHistoryRangeMode?.addEventListener("change", () => {
  uiState.activityHistoryRangeMode = els.activityHistoryRangeMode.value;
  updateActivityHistoryFilterVisibility();
  renderActivityHistory(getActiveStore());
});
els.activityHistoryAreaFilter?.addEventListener("change", () => {
  uiState.activityHistoryAreaFilter = els.activityHistoryAreaFilter.value;
  renderActivityHistory(getActiveStore());
});
els.activityHistoryActorFilter?.addEventListener("change", () => {
  uiState.activityHistoryActorFilter = els.activityHistoryActorFilter.value;
  renderActivityHistory(getActiveStore());
});
[els.activityHistoryFromDate, els.activityHistoryToDate].forEach((input) => {
  input?.addEventListener("change", () => renderActivityHistory(getActiveStore()));
});

els.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(createStateExportPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `du-lieu-thu-chi-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setSettingsMenuOpen(false);
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
    setSettingsMenuOpen(false);
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

  if (
    isEmployeeUser() &&
    (categoryButton ||
      entryButton ||
      orderButton ||
      editCategoryButton ||
      editEntryButton ||
      inventoryLogRow ||
      draftDeleteButton ||
      (draftButton && !employeeCan("sales", "draft")))
  ) {
    return;
  }

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

function getSalesBillDateSuffix(date) {
  const value = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}${month}${year}`;
}

function formatSalesBillCode(number, date) {
  const billNumber = Math.max(1, Math.floor(Number(number) || 1));
  const suffix = getSalesBillDateSuffix(date);
  return suffix ? `HD${String(billNumber).padStart(2, "0")}-${suffix}` : "";
}

function getSalesBillNumber(order, date) {
  const storedNumber = Math.floor(Number(order?.billNumber || 0));
  if (storedNumber > 0) return storedNumber;
  const match = String(order?.billCode || "").match(/^HD(\d+)-(\d{8})$/);
  if (!match || match[2] !== getSalesBillDateSuffix(date)) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeStoreSalesBills(store) {
  const orders = (Array.isArray(store?.orders) ? store.orders : []).map((order) => ({ ...order }));
  const sequences = {};
  Object.entries(store?.salesBillSequences || {}).forEach(([date, number]) => {
    const normalized = Math.floor(Number(number || 0));
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && normalized > 0) sequences[date] = normalized;
  });

  const ordersByDate = new Map();
  orders.forEach((order) => {
    const date = String(order.date || "");
    if (!getSalesBillDateSuffix(date)) return;
    if (!ordersByDate.has(date)) ordersByDate.set(date, []);
    ordersByDate.get(date).push(order);
  });

  ordersByDate.forEach((dateOrders, date) => {
    dateOrders.sort(
      (a, b) =>
        String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""))
    );
    const usedNumbers = new Set();
    const pendingOrders = [];
    let sequence = Math.max(0, Number(sequences[date] || 0));

    dateOrders.forEach((order) => {
      const billNumber = getSalesBillNumber(order, date);
      if (!billNumber || usedNumbers.has(billNumber)) {
        pendingOrders.push(order);
        return;
      }
      usedNumbers.add(billNumber);
      sequence = Math.max(sequence, billNumber);
      order.billNumber = billNumber;
      order.billCode = formatSalesBillCode(billNumber, date);
    });

    pendingOrders.forEach((order) => {
      do sequence += 1;
      while (usedNumbers.has(sequence));
      usedNumbers.add(sequence);
      order.billNumber = sequence;
      order.billCode = formatSalesBillCode(sequence, date);
    });
    if (sequence > 0) sequences[date] = sequence;
  });

  return { orders, salesBillSequences: sequences };
}

function allocateSalesBillCode(store, date) {
  const normalized = normalizeStoreSalesBills(store);
  store.orders = normalized.orders;
  store.salesBillSequences = normalized.salesBillSequences;
  const billNumber = Math.max(0, Number(store.salesBillSequences[date] || 0)) + 1;
  store.salesBillSequences[date] = billNumber;
  return { billNumber, billCode: formatSalesBillCode(billNumber, date) };
}

function normalizeState(data) {
  const source = data && typeof data === "object" ? data : cloneDefaultData();
  const stores = (source.stores || []).map((store) => {
    const salesBills = normalizeStoreSalesBills(store);
    return {
      id: store.id || createId(),
      name: store.name || "Cửa hàng chưa đặt tên",
      categories: {
        income: store.categories?.income || [],
        expense: store.categories?.expense || []
      },
      entries: store.entries || [],
      orders: salesBills.orders,
      salesBillSequences: salesBills.salesBillSequences,
      draftOrders: store.draftOrders || [],
      customers: store.customers || [],
      purchaseCategories: store.purchaseCategories || [],
      purchaseOrders: store.purchaseOrders || [],
      inventoryLogs: store.inventoryLogs || [],
      activityHistory: Array.isArray(store.activityHistory) ? store.activityHistory : [],
      exportReasons: normalizeExportReasons(store),
      inventory: (store.inventory || []).map((item) => ({
        ...item,
        salePrice: Number(item.salePrice ?? item.lastPrice ?? 0)
      })),
      createdAt: store.createdAt || getEarliestEntryDate(store.entries || []) || today
    };
  });

  const activeStoreId = stores.some((store) => store.id === source.activeStoreId)
    ? source.activeStoreId
    : stores[0]?.id || null;

  return { ...source, activeStoreId, stores };
}

function saveAndRender(employeeMutation = null) {
  saveStateToCache();
  render();
  saveStateToCloud(employeeMutation);
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

function showLoginError(message) {
  if (!els.loginError) return;
  els.loginError.textContent = message;
  els.loginError.hidden = !message;
}

function showAuthenticatedApp(profile) {
  clearAuthStartupTimers();
  document.body.classList.remove("auth-pending");
  els.authScreen.hidden = true;
  els.appShell.hidden = false;
  if (USE_MOBILE_APP_THEME && els.tabBar) els.tabBar.hidden = false;
  els.signedInUser.hidden = false;
  els.signedInUserName.textContent = profile.displayName || authState.user?.email || "Tài khoản";
  els.signedInUserRole.textContent = profile.role === "admin" ? "Admin" : "Nhân viên";
  if (window.location.hash === "#sales-catalog" && !uiState.salesCatalogRow) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
  if (window.location.hash === "#customers" && getActiveStore()) openCustomersPage({ fromHistory: true });
}

function clearAuthStartupTimers() {
  window.clearTimeout(window.authStartupWatchdog);
  window.clearTimeout(authSlowTimer);
  authSlowTimer = null;
}

function showAuthLoading(message = "Đang kiểm tra tài khoản và quyền truy cập...") {
  document.body.classList.add("auth-pending");
  hideSalesCatalogPage({ restoreFocus: false });
  hideCustomersPage({ restoreFocus: false });
  els.appShell.hidden = true;
  updateTimeFiltersVisibility();
  els.authScreen.hidden = false;
  els.authTitle.textContent = "Đang mở ứng dụng";
  els.authDescription.textContent = "Đang khôi phục phiên đăng nhập của bạn.";
  els.authStartupMessage.textContent = message;
  els.authStartupRetry.hidden = true;
  els.authStartup.hidden = false;
  els.loginForm.hidden = true;
}

function showAuthProblem(message) {
  document.body.classList.add("auth-pending");
  hideSalesCatalogPage({ restoreFocus: false });
  hideCustomersPage({ restoreFocus: false });
  els.appShell.hidden = true;
  updateTimeFiltersVisibility();
  els.authTitle.textContent = "Chưa thể mở ứng dụng";
  els.authDescription.textContent = "Ứng dụng chưa xác định được trạng thái đăng nhập.";
  els.authStartupMessage.textContent = message;
  els.authStartupRetry.hidden = false;
  els.authStartup.hidden = false;
  els.loginForm.hidden = true;
  els.authScreen.hidden = false;
}

function showLoginScreen(message = "") {
  clearAuthStartupTimers();
  document.body.classList.add("auth-pending");
  document.body.classList.remove("employee-session");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("sales-order-detail-open");
  hideSalesCatalogPage({ restoreFocus: false });
  hideCustomersPage({ restoreFocus: false });
  hideBulkCashPage({ restoreFocus: false });
  hideEmployeeManagerPage({ restoreFocus: false });
  hideActivityHistoryPage({ restoreFocus: false });
  if (["#customers", "#sales-catalog", "#employees", "#activity-history", "#bulk-income", "#bulk-expense"].includes(window.location.hash)) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
  if (els.salesOrderDetailModal) els.salesOrderDetailModal.hidden = true;
  els.quickEntryModal.hidden = true;
  els.bulkCashText.value = "";
  els.bulkCashPage.dataset.type = "";
  els.bulkCashPage.dataset.storeId = "";
  resetBulkCashFileImport();
  els.appShell.hidden = true;
  if (USE_MOBILE_APP_THEME && els.tabBar) els.tabBar.hidden = true;
  if (mobileTimeFilterShell) mobileTimeFilterShell.hidden = true;
  if (USE_MOBILE_APP_THEME && els.timeFilters) els.timeFilters.hidden = true;
  els.authScreen.hidden = false;
  els.authTitle.textContent = "Đăng nhập";
  els.authDescription.textContent = "Dùng tài khoản được quản trị viên cấp để tiếp tục.";
  els.authStartup.hidden = true;
  els.loginForm.hidden = false;
  els.signedInUser.hidden = true;
  showLoginError(message);
  window.setTimeout(() => els.loginEmail?.focus({ preventScroll: true }), 50);
}

function stopCloudStorage() {
  cloudStore.unsubscribe?.();
  cloudStore = {
    enabled: false,
    ready: false,
    db: null,
    docRef: null,
    unsubscribe: null,
    lastError: null,
    status: "starting"
  };
}

function applyRoleAccess() {
  const employee = isEmployeeUser();
  const purchaseView = employeeCan("purchase", "view");
  const purchaseCreate = employeeCan("purchase", "create");
  const inventoryView = employeeCan("purchase", "inventoryView");
  const salesView = employeeCan("sales", "view");
  const salesDraft = employeeCan("sales", "draft");
  const historyViewOwn = employeeCan("history", "viewOwn");
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.dataset.roleHidden = employee ? "true" : "false";
  });
  document.body.classList.toggle("employee-session", employee);
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const allowed =
      !employee ||
      EMPLOYEE_EMPTY_TABS.has(button.dataset.tab) ||
      (button.dataset.tab === "purchase" && purchaseView) ||
      (button.dataset.tab === "sales" && salesView);
    button.dataset.roleHidden = allowed ? "false" : "true";
    button.disabled = !allowed;
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    const empty = isEmployeeEmptyTab(panel.dataset.tabPanel);
    panel.dataset.employeeEmpty = String(empty);
    panel.inert = empty && panel.dataset.tabPanel !== "stores";
  });
  els.activeStorePanel.dataset.roleHidden = employee ? "true" : "false";
  document.querySelector(".sidebar")?.setAttribute("data-role-hidden", employee && USE_MOBILE_APP_THEME ? "true" : "false");
  els.openCustomers.dataset.roleHidden = employee ? "true" : "false";
  els.openBulkPurchase.dataset.roleHidden = employee && !purchaseCreate ? "true" : "false";
  els.toggleInventory.dataset.roleHidden = employee && !inventoryView ? "true" : "false";
  els.toggleInventory.disabled = employee && !inventoryView;
  els.saveSalesDraft.dataset.roleHidden = employee && !salesDraft ? "true" : "false";
  els.deleteSalesDraft.dataset.roleHidden = employee ? "true" : "false";
  els.openActivityHistory.dataset.roleHidden = employee && !historyViewOwn ? "true" : "false";
  els.openActivityHistory.disabled = employee && !historyViewOwn;
}

async function loadUserProfile(db, user) {
  const snapshot = await db.collection("users").doc(user.uid).get();
  if (!snapshot.exists) throw new Error("PROFILE_NOT_FOUND");
  const profile = snapshot.data() || {};
  if (!["admin", "employee"].includes(profile.role) || profile.active === false) {
    throw new Error("PROFILE_DISABLED");
  }
  return profile;
}

function isProfileAccessDenied(error) {
  return ["PROFILE_NOT_FOUND", "PROFILE_DISABLED"].includes(error?.message) ||
    ["permission-denied", "auth/user-disabled"].includes(error?.code);
}

async function restoreAuthenticatedUser(db, user) {
  const attempt = ++authRestoreAttempt;
  try {
    stopCloudStorage();
    showAuthLoading();
    window.clearTimeout(authSlowTimer);
    authSlowTimer = window.setTimeout(() => {
      if (attempt === authRestoreAttempt) {
        showAuthProblem("Kiểm tra quyền đang chậm. Bạn có thể thử lại; phiên đăng nhập vẫn được giữ.");
      }
    }, 8000);

    const profile = await loadUserProfile(db, user);
    if (attempt !== authRestoreAttempt) return;
    window.clearTimeout(authSlowTimer);
    authSlowTimer = null;
    authState = { ready: true, user, profile, role: profile.role };
    if (profile.role === "employee") state = cloneDefaultData();
    applyRoleAccess();
    showAuthenticatedApp(profile);
    initCloudStorage();
  } catch (error) {
    if (attempt !== authRestoreAttempt) return;
    window.clearTimeout(authSlowTimer);
    authSlowTimer = null;
    if (isProfileAccessDenied(error)) {
      const message = "Tài khoản chưa được cấp quyền hoặc đã bị khóa.";
      try {
        await firebaseAuthInstance.signOut();
        showLoginScreen(message);
      } catch (signOutError) {
        showAuthProblem("Không thể kết thúc phiên bị từ chối quyền. Vui lòng thử lại.");
      }
      return;
    }
    console.error("Cannot restore authenticated profile", error);
    showAuthProblem("Không thể kiểm tra quyền do kết nối gián đoạn. Hãy thử lại khi có mạng.");
  }
}

async function initAuthentication() {
  const config = getFirebaseConfig();
  if (!config || !window.firebase?.auth || !window.firebase?.firestore) {
    showAuthProblem("Không tải được Firebase Authentication. Hãy kiểm tra kết nối và thử lại.");
    return;
  }

  try {
    const app = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(config);
    authDb = window.firebase.firestore(app);
    firebaseAuthInstance = window.firebase.auth(app);
  } catch (error) {
    console.error("Cannot initialize Firebase Authentication", error);
    showAuthProblem("Không thể khởi tạo Firebase. Hãy thử lại.");
    return;
  }

  try {
    firebaseAuthInstance.onAuthStateChanged((user) => {
      if (!user) {
        ++authRestoreAttempt;
        stopCloudStorage();
        authState = { ready: true, user: null, profile: null, role: "" };
        state = cloneDefaultData();
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          console.warn("Cannot clear local cache", error);
        }
        showLoginScreen();
        return;
      }
      restoreAuthenticatedUser(authDb, user);
    }, (error) => {
      console.error("Cannot read authentication state", error);
      showAuthProblem("Không thể đọc phiên đăng nhập. Hãy thử lại.");
    });
  } catch (error) {
    console.error("Cannot observe authentication state", error);
    showAuthProblem("Không thể theo dõi phiên đăng nhập. Hãy thử lại.");
  }
}

window.retryAuthStartup = () => {
  const user = firebaseAuthInstance?.currentUser;
  if (authDb && user) restoreAuthenticatedUser(authDb, user);
  else window.location.reload();
};

window.addEventListener("online", () => {
  if (!els.authScreen.hidden && !els.authStartup.hidden && !els.authStartupRetry.hidden) {
    window.retryAuthStartup();
  }
});

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

    if (isEmployeeUser()) {
      loadEmployeeState();
      return;
    }

    cloudStore.unsubscribe = cloudStore.docRef.onSnapshot(
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists) {
          if (snapshot.metadata?.fromCache) {
            updateSyncStatus("Đang kiểm tra dữ liệu cloud...", "loading");
            return;
          }
          saveStateToCloud();
          updateSyncStatus("Đã tạo dữ liệu cloud", "ok");
          return;
        }

        const remote = snapshot.data()?.state || snapshot.data();
        state = normalizeState(remote);
        saveStateToCache();
        render();
        updateSyncStatus(snapshot.metadata?.fromCache ? "Đang cập nhật từ cloud..." : "Đã đồng bộ cloud", snapshot.metadata?.fromCache ? "loading" : "ok");
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

function getEmployeeFunctionUrl(name) {
  const config = window.employeeFunctionConfig || {};
  return String(config[name] || "").trim();
}

async function callEmployeeFunction(name, body = {}) {
  const url = getEmployeeFunctionUrl(name);
  if (!url) throw new Error("EMPLOYEE_FUNCTION_MISSING");
  const token = await authState.user.getIdToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "EMPLOYEE_REQUEST_FAILED");
  return result;
}

const employeeManagerState = {
  employees: [],
  stores: []
};

function setEmployeeManagerStatus(message = "", type = "") {
  if (!els.employeeManagerStatus) return;
  els.employeeManagerStatus.textContent = message;
  els.employeeManagerStatus.dataset.type = type;
  els.employeeManagerStatus.hidden = !message;
}

function getPermissionsFromContainer(container) {
  const checked = (name) => Boolean(container?.querySelector(`[name="${name}"]`)?.checked);
  const permissions = {
    purchase: {
      view: checked("purchaseView"),
      create: checked("purchaseCreate"),
      inventoryView: checked("purchaseInventoryView")
    },
    sales: {
      view: checked("salesView"),
      create: checked("salesCreate"),
      draft: checked("salesDraft")
    },
    history: {
      viewOwn: checked("historyViewOwn")
    }
  };
  if (permissions.purchase.create) permissions.purchase.view = true;
  if (permissions.purchase.inventoryView) permissions.purchase.view = true;
  if (permissions.sales.create) permissions.sales.view = true;
  if (permissions.sales.draft) {
    permissions.sales.create = true;
    permissions.sales.view = true;
  }
  return permissions;
}

function enforceEmployeePermissionDependencies(container, changedInput) {
  if (!container || !changedInput?.name) return;
  const purchaseView = container.querySelector('[name="purchaseView"]');
  const purchaseCreate = container.querySelector('[name="purchaseCreate"]');
  const purchaseInventoryView = container.querySelector('[name="purchaseInventoryView"]');
  const salesView = container.querySelector('[name="salesView"]');
  const salesCreate = container.querySelector('[name="salesCreate"]');
  const salesDraft = container.querySelector('[name="salesDraft"]');
  if (changedInput.name === "purchaseCreate" && changedInput.checked && purchaseView) purchaseView.checked = true;
  if (changedInput.name === "purchaseInventoryView" && changedInput.checked && purchaseView) purchaseView.checked = true;
  if (changedInput.name === "purchaseView" && !changedInput.checked) {
    if (purchaseCreate) purchaseCreate.checked = false;
    if (purchaseInventoryView) purchaseInventoryView.checked = false;
  }
  if (changedInput.name === "salesCreate" && changedInput.checked && salesView) salesView.checked = true;
  if (changedInput.name === "salesDraft" && changedInput.checked) {
    if (salesCreate) salesCreate.checked = true;
    if (salesView) salesView.checked = true;
  }
  if (changedInput.name === "salesCreate" && !changedInput.checked && salesDraft) salesDraft.checked = false;
  if (changedInput.name === "salesView" && !changedInput.checked) {
    if (salesCreate) salesCreate.checked = false;
    if (salesDraft) salesDraft.checked = false;
  }
}

function employeeStoreOptions(selectedStoreId = "") {
  return employeeManagerState.stores
    .map(
      (store) =>
        `<option value="${escapeHtml(store.id)}" ${store.id === selectedStoreId ? "selected" : ""}>${escapeHtml(
          store.name || "Cửa hàng"
        )}</option>`
    )
    .join("");
}

function employeePermissionFields(permissions) {
  const normalized = normalizeEmployeePermissions({ permissions });
  const field = (name, checked, label) =>
    `<label><input name="${name}" type="checkbox" ${checked ? "checked" : ""} /> ${label}</label>`;
  return [
    field("purchaseView", normalized.purchase.view, "Xem tab Nhập hàng"),
    field("purchaseCreate", normalized.purchase.create, "Tạo mới trong Nhập hàng"),
    field("purchaseInventoryView", normalized.purchase.inventoryView, "Xem Kho hàng (không được Xuất)"),
    field("salesView", normalized.sales.view, "Xem tab Bán hàng"),
    field("salesCreate", normalized.sales.create, "Tạo mới trong Bán hàng"),
    field("salesDraft", normalized.sales.draft, "Lưu và mở đơn đang lưu"),
    field("historyViewOwn", normalized.history.viewOwn, "Xem lịch sử của chính mình")
  ].join("");
}

function renderEmployeeAccounts(payload = {}) {
  employeeManagerState.employees = Array.isArray(payload.employees) ? payload.employees : [];
  employeeManagerState.stores = Array.isArray(payload.stores) ? payload.stores : [];
  if (els.employeeStore) {
    els.employeeStore.innerHTML = employeeStoreOptions(employeeManagerState.stores[0]?.id || "");
    els.employeeStore.disabled = !employeeManagerState.stores.length;
  }
  const createButton = els.employeeCreateForm?.querySelector('[type="submit"]');
  if (createButton) createButton.disabled = !employeeManagerState.stores.length;
  if (els.employeeCount) {
    els.employeeCount.textContent = `${employeeManagerState.employees.length.toLocaleString("vi-VN")} nhân viên`;
  }
  if (!els.employeeAccountList) return;
  if (!employeeManagerState.employees.length) {
    els.employeeAccountList.innerHTML = '<div class="empty-list">Chưa có tài khoản nhân viên.</div>';
    return;
  }
  els.employeeAccountList.innerHTML = employeeManagerState.employees
    .map(
      (employee) => `
        <article class="employee-account-card" data-employee-uid="${escapeHtml(employee.uid)}">
          <div class="employee-account-heading">
            <div>
              <strong>${escapeHtml(employee.displayName || "Nhân viên")}</strong>
              <small>${escapeHtml(employee.email || "Không tìm thấy email Authentication")}</small>
            </div>
            <label class="employee-active-toggle">
              <input name="active" type="checkbox" ${employee.active !== false ? "checked" : ""} />
              Đang hoạt động
            </label>
          </div>
          <div class="employee-form-grid employee-edit-grid">
            <div class="field">
              <label>Tên nhân viên</label>
              <input name="displayName" type="text" maxlength="120" value="${escapeHtml(employee.displayName || "")}" />
            </div>
            <div class="field">
              <label>Cửa hàng</label>
              <select name="storeId">${employeeStoreOptions(employee.storeId)}</select>
            </div>
          </div>
          <fieldset class="employee-permissions employee-card-permissions">
            <legend>Quyền được cấp</legend>
            ${employeePermissionFields(employee.permissions)}
          </fieldset>
          <div class="employee-card-actions">
            <span class="employee-card-status" role="status"></span>
            <button type="button" data-save-employee>Lưu phân quyền</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadEmployeeAccounts() {
  setEmployeeManagerStatus("Đang tải tài khoản nhân viên...", "loading");
  try {
    const result = await callEmployeeFunction("manageAccountsUrl", { action: "list" });
    renderEmployeeAccounts(result);
    setEmployeeManagerStatus(
      employeeManagerState.stores.length ? "" : "Hãy tạo ít nhất một cửa hàng trước khi tạo nhân viên.",
      employeeManagerState.stores.length ? "" : "warning"
    );
  } catch (error) {
    setEmployeeManagerStatus(error.message || "Không tải được tài khoản nhân viên.", "error");
  }
}

function openEmployeeManagerPage({ fromHistory = false } = {}) {
  if (!isAdminUser() || !els.employeeManagerPage) return;
  setSettingsMenuOpen(false);
  if (!fromHistory && window.location.hash !== "#employees") {
    window.history.pushState({ ...window.history.state, employeeManagerPage: true }, "", "#employees");
  }
  els.employeeManagerPage.hidden = false;
  els.employeeManagerPage.scrollTop = 0;
  document.body.classList.add("settings-detail-page-open");
  els.appShell.inert = true;
  els.appShell.setAttribute("aria-hidden", "true");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = true;
  updateSettingsDetailViewport();
  updateTimeFiltersVisibility();
  loadEmployeeAccounts();
  els.closeEmployeeManager.focus({ preventScroll: true });
}

function closeEmployeeManagerPage() {
  if (window.location.hash === "#employees" && window.history.state?.employeeManagerPage) {
    window.history.back();
    return;
  }
  hideEmployeeManagerPage();
  clearSettingsDetailHash("#employees");
}

function hideEmployeeManagerPage({ restoreFocus = true } = {}) {
  if (!els.employeeManagerPage || els.employeeManagerPage.hidden) return;
  els.employeeManagerPage.hidden = true;
  setEmployeeManagerStatus();
  finishSettingsDetailPageClose();
  if (restoreFocus) els.settingsToggle?.focus({ preventScroll: true });
}

async function createEmployeeAccount(event) {
  event.preventDefault();
  if (!isAdminUser() || !els.employeeCreateForm) return;
  const form = els.employeeCreateForm;
  if (!form.reportValidity()) return;
  const permissions = getPermissionsFromContainer(form);
  if (!permissions.purchase.view && !permissions.sales.view) {
    setEmployeeManagerStatus("Nhân viên phải được xem ít nhất một tab nghiệp vụ.", "error");
    return;
  }
  const submitButton = form.querySelector('[type="submit"]');
  const formData = new FormData(form);
  submitButton.disabled = true;
  setEmployeeManagerStatus("Đang tạo tài khoản nhân viên...", "loading");
  try {
    const result = await callEmployeeFunction("manageAccountsUrl", {
      action: "create",
      displayName: String(formData.get("displayName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      storeId: String(formData.get("storeId") || ""),
      permissions
    });
    renderEmployeeAccounts(result);
    form.reset();
    if (els.employeeStore && employeeManagerState.stores[0]) els.employeeStore.value = employeeManagerState.stores[0].id;
    setEmployeeManagerStatus("Đã tạo tài khoản nhân viên thành công.", "success");
  } catch (error) {
    setEmployeeManagerStatus(error.message || "Không thể tạo tài khoản nhân viên.", "error");
  } finally {
    submitButton.disabled = !employeeManagerState.stores.length;
  }
}

async function updateEmployeeAccount(card) {
  if (!isAdminUser() || !card) return;
  const permissions = getPermissionsFromContainer(card);
  const status = card.querySelector(".employee-card-status");
  const button = card.querySelector("[data-save-employee]");
  if (!permissions.purchase.view && !permissions.sales.view) {
    status.textContent = "Phải được xem ít nhất một tab.";
    status.dataset.type = "error";
    return;
  }
  button.disabled = true;
  status.textContent = "Đang lưu...";
  status.dataset.type = "loading";
  try {
    const result = await callEmployeeFunction("manageAccountsUrl", {
      action: "update",
      uid: card.dataset.employeeUid,
      displayName: String(card.querySelector('[name="displayName"]')?.value || "").trim(),
      storeId: String(card.querySelector('[name="storeId"]')?.value || ""),
      active: Boolean(card.querySelector('[name="active"]')?.checked),
      permissions
    });
    renderEmployeeAccounts(result);
    setEmployeeManagerStatus("Đã cập nhật phân quyền nhân viên.", "success");
  } catch (error) {
    status.textContent = error.message || "Lưu thất bại.";
    status.dataset.type = "error";
    button.disabled = false;
  }
}

async function loadEmployeeState() {
  try {
    const result = await callEmployeeFunction("getStateUrl");
    state = normalizeState(result.state || cloneDefaultData());
    if (authState.profile?.storeId && state.stores.some((store) => store.id === authState.profile.storeId)) {
      state.activeStoreId = authState.profile.storeId;
    }
    saveStateToCache();
    activateTab(getFirstEmployeeTab());
    render();
    updateSyncStatus("Đã đồng bộ cloud", "ok");
  } catch (error) {
    cloudStore.lastError = error;
    updateSyncStatus("Không tải được dữ liệu nhân viên", "error");
    console.error("Cannot load employee state", error);
  }
}

async function saveStateToCloud(employeeMutation = null) {
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
    if (isEmployeeUser()) {
      if (!employeeMutation) {
        updateSyncStatus("Chỉ được phép tạo mới", "warning");
        await loadEmployeeState();
        return;
      }
      const result = await callEmployeeFunction("saveMutationUrl", { mutation: employeeMutation });
      state = normalizeState(result.state || state);
      saveStateToCache();
      render();
      updateSyncStatus("Đã lưu cloud", "ok");
      return;
    }
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

function recordActivity(store, action, area, message, details = {}) {
  if (!store) return;
  const options = typeof details === "string" ? { createdAt: details } : details || {};
  const actor = getCurrentActor();
  const activity = {
    id: createId(),
    action: ["create", "update", "delete"].includes(action) ? action : "update",
    area: String(area || "Cửa hàng"),
    message: String(message || "Cập nhật dữ liệu."),
    createdAt: options.createdAt || new Date().toISOString(),
    actorUid: options.actorUid || actor.actorUid,
    actorName: options.actorName || actor.actorName,
    actorRole: options.actorRole || actor.actorRole
  };
  ["tab", "targetType", "targetId", "targetDate"].forEach((key) => {
    if (options[key]) activity[key] = String(options[key]);
  });
  store.activityHistory = [
    activity,
    ...(Array.isArray(store.activityHistory) ? store.activityHistory : [])
  ];
  return activity;
}

function formatActivityDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
  const datePart = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timePart = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${datePart} ${timePart}`;
}

function getActivityHistoryDateRange() {
  const mode = uiState.activityHistoryRangeMode || "all";
  if (mode === "all") return null;

  const now = new Date();
  if (mode === "today") return { start: today, end: today };
  if (mode === "yesterday") {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const value = toDateInputValue(date);
    return { start: value, end: value };
  }
  if (mode === "this-month") {
    return { start: `${today.slice(0, 7)}-01`, end: today };
  }
  if (mode === "last-month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toDateInputValue(firstDay), end: toDateInputValue(lastDay) };
  }

  let start = els.activityHistoryFromDate?.value || today;
  let end = els.activityHistoryToDate?.value || start;
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

function getActivityHistoryDateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toDateInputValue(date);
}

function updateActivityHistoryFilterVisibility() {
  if (!els.activityHistoryCustomRange) return;
  const custom = uiState.activityHistoryRangeMode === "custom";
  els.activityHistoryCustomRange.hidden = !custom;
}

function getActivityActorLabel(activity) {
  const name = String(activity?.actorName || "").trim();
  if (name) return name;
  if (activity?.actorRole === "admin") return "Quản trị viên";
  if (activity?.actorRole === "employee") return "Nhân viên";
  return "Không rõ người thực hiện";
}

function getActivityActorFilterKey(activity) {
  return `actor:${normalizeSearchText(getActivityActorLabel(activity)) || "unknown"}`;
}

function renderActivityHistoryFilterOptions(activities) {
  const areas = [...new Set(activities.map((activity) => String(activity.area || "Cửa hàng").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));
  if (els.activityHistoryAreaFilter) {
    const requestedArea = uiState.activityHistoryAreaFilter || "all";
    els.activityHistoryAreaFilter.innerHTML = [
      '<option value="all">Tất cả nghiệp vụ</option>',
      ...areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`)
    ].join("");
    uiState.activityHistoryAreaFilter = areas.includes(requestedArea) ? requestedArea : "all";
    els.activityHistoryAreaFilter.value = uiState.activityHistoryAreaFilter;
  }

  if (els.activityHistoryActorFilter) {
    const actors = new Map();
    activities.forEach((activity) => {
      const key = getActivityActorFilterKey(activity);
      if (!actors.has(key)) actors.set(key, getActivityActorLabel(activity));
    });
    const actorOptions = [...actors.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
    const requestedActor = uiState.activityHistoryActorFilter || "all";
    els.activityHistoryActorFilter.innerHTML = [
      '<option value="all">Tất cả người thực hiện</option>',
      ...actorOptions.map(
        ([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`
      )
    ].join("");
    uiState.activityHistoryActorFilter = actors.has(requestedActor) ? requestedActor : "all";
    els.activityHistoryActorFilter.value = uiState.activityHistoryActorFilter;
  }
}

function renderActivityHistory(store) {
  if (!els.activityHistoryList || !els.activityHistoryStoreName) return;
  els.activityHistoryStoreName.textContent = store?.name || "Chưa chọn cửa hàng";
  const range = getActivityHistoryDateRange();
  const availableActivities = [...(Array.isArray(store?.activityHistory) ? store.activityHistory : [])]
    .filter((activity) => {
      if (!isEmployeeUser()) return true;
      return activity.actorUid === authState.user?.uid && ["Nhập hàng", "Bán hàng"].includes(activity.area);
    });
  renderActivityHistoryFilterOptions(availableActivities);
  const areaFilter = uiState.activityHistoryAreaFilter || "all";
  const actorFilter = uiState.activityHistoryActorFilter || "all";
  const activities = availableActivities
    .filter((activity) => {
      if (!range) return true;
      const date = getActivityHistoryDateKey(activity.createdAt);
      return date && date >= range.start && date <= range.end;
    })
    .filter((activity) => areaFilter === "all" || String(activity.area || "Cửa hàng") === areaFilter)
    .filter((activity) => actorFilter === "all" || getActivityActorFilterKey(activity) === actorFilter)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (els.activityHistoryResultCount) {
    els.activityHistoryResultCount.textContent = `${activities.length.toLocaleString("vi-VN")} sự kiện`;
  }

  if (!activities.length) {
    const hasFilter = Boolean(range || areaFilter !== "all" || actorFilter !== "all");
    els.activityHistoryList.innerHTML = `<div class="empty-list">${
      hasFilter ? "Không có sự kiện phù hợp với các bộ lọc." : "Chưa có sự kiện nào được ghi lại."
    }</div>`;
    return;
  }

  els.activityHistoryList.innerHTML = activities
    .map(
      (activity) => {
        const target = resolveActivityTarget(store, activity);
        const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(target.targetDate || "") ? formatDate(target.targetDate) : "";
        return `
        <article class="activity-history-item" data-action="${escapeHtml(activity.action || "update")}" data-activity-id="${escapeHtml(
          activity.id || ""
        )}" tabindex="0" role="button">
          <time class="activity-history-time" datetime="${escapeHtml(activity.createdAt || "")}">${escapeHtml(
            formatActivityDateTime(activity.createdAt)
          )}</time>
          <span class="activity-history-area">${escapeHtml(activity.area || "Cửa hàng")}</span>
          <span class="activity-history-content">
            <span class="activity-history-message">${escapeHtml(activity.message || "Cập nhật dữ liệu.")}</span>
            ${targetDate ? `<span class="activity-history-record-date">Ngày dữ liệu: ${escapeHtml(targetDate)}</span>` : ""}
            <span class="activity-history-actor">Thực hiện bởi: ${escapeHtml(getActivityActorLabel(activity))}</span>
          </span>
        </article>
      `;
      }
    )
    .join("");
}

function resolveActivityTarget(store, activity) {
  const resolved = {
    tab: activity.tab || "",
    targetType: activity.targetType || "",
    targetId: activity.targetId || "",
    targetDate: activity.targetDate || ""
  };
  if (resolved.targetId || resolved.targetDate) return resolved;

  const timestamp = String(activity.createdAt || "");
  const area = String(activity.area || "");
  if (area === "Thu" || area === "Chi") {
    const type = area === "Thu" ? "income" : "expense";
    const entry = (store.entries || []).find(
      (item) =>
        item.type === type && [item.createdAt, item.updatedAt, item.cancelledAt].some((value) => String(value || "") === timestamp)
    );
    return {
      tab: type,
      targetType: "entry",
      targetId: entry?.id || "",
      targetDate: entry?.date || ""
    };
  }

  if (area === "Bán hàng") {
    const order = (store.orders || []).find((item) =>
      [item.createdAt, item.updatedAt, item.cancelledAt].some((value) => String(value || "") === timestamp)
    );
    return { tab: "sales", targetType: "sales-order", targetId: order?.id || "", targetDate: order?.date || "" };
  }

  if (["Nhập hàng", "Xuất kho", "Kho hàng"].includes(area)) {
    const activityTime = new Date(timestamp).getTime();
    const log = (store.inventoryLogs || [])
      .map((item) => ({
        item,
        distance: Math.min(
          ...[item.updatedAt, item.editedAt]
            .map((value) => Math.abs(new Date(value || 0).getTime() - activityTime))
            .filter(Number.isFinite)
        )
      }))
      .filter(({ distance }) => Number.isFinite(distance))
      .sort((a, b) => a.distance - b.distance)[0];
    if (log && log.distance <= 5000) {
      return {
        tab: "purchase",
        targetType: "inventory-log",
        targetId: log.item.id || "",
        targetDate: getInventoryLogDate(log.item)
      };
    }
    const order = (store.purchaseOrders || []).find((item) => String(item.createdAt || "") === timestamp);
    return {
      tab: "purchase",
      targetType: "purchase-order",
      targetId: order?.id || "",
      targetDate: order?.date || ""
    };
  }

  return { ...resolved, tab: resolved.tab || (area === "Cửa hàng" ? "stores" : "") };
}

function openActivityHistoryPage({ fromHistory = false } = {}) {
  if (isEmployeeUser() && !employeeCan("history", "viewOwn")) return;
  const store = getActiveStore();
  setSettingsMenuOpen(false);
  if (!store) {
    window.alert("Vui lòng chọn cửa hàng để xem lịch sử.");
    return;
  }
  els.activityHistoryRangeMode.value = uiState.activityHistoryRangeMode;
  if (!els.activityHistoryFromDate.value) els.activityHistoryFromDate.value = today;
  if (!els.activityHistoryToDate.value) els.activityHistoryToDate.value = today;
  updateActivityHistoryFilterVisibility();
  renderActivityHistory(store);
  if (!fromHistory && window.location.hash !== "#activity-history") {
    window.history.pushState({ ...window.history.state, activityHistoryPage: true }, "", "#activity-history");
  }
  els.activityHistoryPage.hidden = false;
  els.activityHistoryPage.scrollTop = 0;
  document.body.classList.add("settings-detail-page-open");
  els.appShell.inert = true;
  els.appShell.setAttribute("aria-hidden", "true");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = true;
  updateSettingsDetailViewport();
  updateTimeFiltersVisibility();
  els.closeActivityHistory?.focus({ preventScroll: true });
}

function closeActivityHistoryPage() {
  if (window.location.hash === "#activity-history" && window.history.state?.activityHistoryPage) {
    window.history.back();
    return;
  }
  hideActivityHistoryPage();
  clearSettingsDetailHash("#activity-history");
}

function hideActivityHistoryPage({ restoreFocus = true } = {}) {
  if (!els.activityHistoryPage || els.activityHistoryPage.hidden) return;
  els.activityHistoryPage.hidden = true;
  finishSettingsDetailPageClose();
  if (restoreFocus) els.settingsToggle?.focus({ preventScroll: true });
}

function finishSettingsDetailPageClose() {
  const anotherPageOpen = !els.employeeManagerPage.hidden || !els.activityHistoryPage.hidden;
  document.body.classList.toggle("settings-detail-page-open", anotherPageOpen);
  els.appShell.inert = anotherPageOpen;
  if (anotherPageOpen) els.appShell.setAttribute("aria-hidden", "true");
  else els.appShell.removeAttribute("aria-hidden");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = anotherPageOpen;
  updateTimeFiltersVisibility();
}

function clearSettingsDetailHash(hash) {
  if (window.location.hash === hash) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
}

function updateSettingsDetailViewport() {
  if (!USE_MOBILE_APP_THEME) return;
  const page = !els.employeeManagerPage.hidden ? els.employeeManagerPage :
    !els.activityHistoryPage.hidden ? els.activityHistoryPage : null;
  if (!page) return;
  const viewport = window.visualViewport;
  page.style.setProperty("--settings-detail-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  page.style.setProperty("--settings-detail-visual-top", `${Math.round(viewport?.offsetTop || 0)}px`);
  ensureSettingsDetailFocusVisible(document.activeElement);
}

function ensureSettingsDetailFocusVisible(target) {
  const page = target?.closest?.(".settings-detail-page");
  if (!page || page.hidden) return;
  const pageBounds = page.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  if (targetBounds.bottom > pageBounds.bottom - 18) {
    page.scrollTop += targetBounds.bottom - pageBounds.bottom + 18;
  } else if (targetBounds.top < pageBounds.top + 18) {
    page.scrollTop -= pageBounds.top - targetBounds.top + 18;
  }
}

function findActivityTargetRow(target) {
  const targetAttributes = {
    entry: "data-entry-id",
    "sales-order": "data-open-sales-order",
    "inventory-log": "data-edit-inventory-log",
    store: "data-store-id"
  };
  const attribute = targetAttributes[target.targetType];
  if (!attribute || !target.targetId) return null;
  return [...document.querySelectorAll(`[${attribute}]`)].find(
    (element) => element.getAttribute(attribute) === target.targetId
  ) || null;
}

function showActivityNavigationNotice(message) {
  document.querySelector(".activity-navigation-notice")?.remove();
  const notice = document.createElement("div");
  notice.className = "activity-navigation-notice";
  notice.setAttribute("role", "status");
  notice.textContent = message;
  document.body.append(notice);
  window.setTimeout(() => notice.remove(), 3200);
}

function navigateToActivity(activityId) {
  const store = getActiveStore();
  const activity = (store?.activityHistory || []).find((item) => item.id === activityId);
  if (!store || !activity) return;

  const target = resolveActivityTarget(store, activity);
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(target.targetDate || "") ? target.targetDate : "";

  if (targetDate) {
    uiState.rangeMode = "day";
    els.rangeMode.value = "day";
    els.singleDate.value = targetDate;
  }

  if (target.tab === "income" || target.tab === "expense") {
    const search = target.tab === "income" ? els.incomeHistorySearch : els.expenseHistorySearch;
    const filter = target.tab === "income" ? els.incomeHistoryFilter : els.expenseHistoryFilter;
    if (search) search.value = "";
    if (filter) filter.value = "all";
  }

  if (target.tab === "purchase") {
    uiState.inventoryLogsExpanded = true;
    uiState.inventoryLogFilter = "all";
    uiState.inventoryLogReasonFilter = "all";
    uiState.inventoryLogSearch = "";
  }

  hideActivityHistoryPage({ restoreFocus: false });
  clearSettingsDetailHash("#activity-history");
  activateTab(target.tab || "stores");
  render();

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const row = findActivityTargetRow(target);
      if (row) {
        row.classList.add("activity-target-highlight");
        row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        window.setTimeout(() => row.classList.remove("activity-target-highlight"), 3600);
        showActivityNavigationNotice("Đã chuyển đến đúng dòng dữ liệu.");
        return;
      }

      const panel = document.querySelector(`[data-tab-panel="${target.tab || "stores"}"]`);
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      showActivityNavigationNotice(
        target.targetId
          ? "Đã chuyển đến đúng khu vực và ngày dữ liệu. Dòng gốc có thể đã bị xóa."
          : "Đã chuyển đến khu vực liên quan. Nhật ký cũ chưa có đủ thông tin để xác định chính xác dòng."
      );
    });
  });
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
  recordActivity(store, "create", type === "income" ? "Thu" : "Chi", `Tạo mục "${name}".`, {
    tab: type,
    targetType: "category",
    targetId: category.id
  });
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
  recordActivity(store, "create", type === "income" ? "Thu" : "Chi", `Tạo mục "${name}".`, {
    tab: type,
    targetType: "category",
    targetId: category.id
  });
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

  const createdAt = new Date().toISOString();
  const entry = {
    id: createId(),
    type,
    categoryId,
    date,
    amount,
    note,
    createdAt
  };
  store.entries.push(entry);
  recordActivity(
    store,
    "create",
    type === "income" ? "Thu" : "Chi",
    `Tạo ${type === "income" ? "khoản thu" : "khoản chi"} "${note || "Không tên"}" - ${formatCurrency(amount)}.`,
    { createdAt, tab: type, targetType: "entry", targetId: entry.id, targetDate: date }
  );
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

  const category = store.categories[type].find((item) => item.id === categoryId);
  store.categories[type] = store.categories[type].filter((item) => item.id !== categoryId);
  recordActivity(
    store,
    "delete",
    type === "income" ? "Thu" : "Chi",
    `Xóa mục "${category?.name || "Không rõ tên"}".`,
    { tab: type, targetType: "category", targetId: categoryId }
  );
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

  const previousName = category.name;
  category.name = name;
  recordActivity(
    store,
    "update",
    type === "income" ? "Thu" : "Chi",
    `Sửa tên mục từ "${previousName}" thành "${name}".`,
    { tab: type, targetType: "category", targetId: category.id }
  );
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
  recordActivity(
    store,
    "delete",
    entry.type === "income" ? "Thu" : "Chi",
    `Xóa ${entry.type === "income" ? "khoản thu" : "khoản chi"} "${entry.note || "Không tên"}" - ${formatCurrency(entry.amount)}.`,
    { createdAt: entry.cancelledAt, tab: entry.type, targetType: "entry", targetId: entry.id, targetDate: entry.date }
  );
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
  recordActivity(
    store,
    "delete",
    "Bán hàng",
    `Hủy đơn bán hàng của "${order.customerName || "Không rõ khách"}" - ${formatCurrency(order.total)}.`,
    { createdAt: order.cancelledAt, tab: "sales", targetType: "sales-order", targetId: order.id, targetDate: order.date }
  );
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

  const previousName = entry.note || "Không tên";
  const previousAmount = Number(entry.amount || 0);
  entry.categoryId = categoryId;
  entry.date = nextDate;
  entry.note = nextName;
  entry.amount = amount;
  entry.updatedAt = new Date().toISOString();
  recordActivity(
    store,
    "update",
    entry.type === "income" ? "Thu" : "Chi",
    `Sửa ${entry.type === "income" ? "khoản thu" : "khoản chi"} "${previousName}" (${formatCurrency(
      previousAmount
    )}) thành "${nextName || "Không tên"}" (${formatCurrency(amount)}).`,
    { createdAt: entry.updatedAt, tab: entry.type, targetType: "entry", targetId: entry.id, targetDate: entry.date }
  );
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
  els.storeHeroTotalCount.textContent = state.stores.length;
  renderStores();

  els.dashboard.hidden = false;
  els.activeStorePanel.hidden = !store;
  els.renameStore.disabled = !store;
  els.deleteStore.disabled = !store;
  applyRoleAccess();
  if (!store) {
    hideSalesCatalogPage({ restoreFocus: false });
    uiState.salesCatalogRow = null;
    if (!els.customersPage.hidden) hideCustomersPage({ restoreFocus: false });
    hideBulkCashPage({ restoreFocus: false });
    if (["#bulk-income", "#bulk-expense"].includes(window.location.hash)) els.quickEntryModal.hidden = true;
    hideActivityHistoryPage({ restoreFocus: false });
    if (["#customers", "#sales-catalog", "#activity-history", "#bulk-income", "#bulk-expense"].includes(window.location.hash)) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    els.activeStoreName.textContent = "Chưa chọn cửa hàng";
    els.overviewStoreName.textContent = "Chưa chọn cửa hàng";
    if (desktopUi) document.querySelector("#desktopOverviewStoreName").textContent = "Chưa chọn cửa hàng";
    els.mobileOverviewStoreName.textContent = "Chưa chọn cửa hàng";
    els.heroStoreName.textContent = "Chưa chọn cửa hàng";
    els.heroStoreMeta.textContent = "Tạo hoặc chọn một cửa hàng";
    els.storeHeroEntryCount.textContent = "0 dòng";
    activateTab("stores");
    updateTimeFiltersVisibility();
    updateQuickEntryButton();
    updatePinnedTabs();
    updateDesktopPageChrome();
    if (window.location.hash === "#employees" && els.employeeManagerPage.hidden && authState.ready && els.authScreen.hidden && isAdminUser()) {
      openEmployeeManagerPage({ fromHistory: true });
    }
    return;
  }

  els.activeStoreName.textContent = store.name;
  els.overviewStoreName.textContent = store.name;
  if (desktopUi) document.querySelector("#desktopOverviewStoreName").textContent = store.name;
  els.mobileOverviewStoreName.textContent = store.name;
  els.heroStoreName.textContent = store.name;
  els.heroStoreMeta.textContent = `${store.entries.length} dòng`;
  els.storeHeroEntryCount.textContent = `${store.entries.length} dòng`;
  setDefaultEntryDates();
  updateFilterFields();
  renderCategoryControls(store, "income");
  renderCategoryControls(store, "expense");
  renderEntrySuggestions(store);
  renderHistoryFilters(store);
  renderReports(store);
  renderInventory(store);
  renderInventoryLogs(store);
  renderDesktopInsights(store);
  updateDesktopCategoryFilter();
  if (els.activityHistoryPage && !els.activityHistoryPage.hidden) {
    renderActivityHistory(store);
  }
  if (!els.customersPage.hidden && !uiState.customerFormOpen) {
    renderCustomers(store);
  }
  if (!els.salesCatalogPage.hidden) renderSalesCatalog();
  els.tabBar.dataset.pinTop = "";
  updateTimeFiltersVisibility();
  updateQuickEntryButton();
  updatePinnedTabs();
  updateDesktopPageChrome();
  if (window.location.hash === "#customers" && els.customersPage.hidden && authState.ready && els.authScreen.hidden) {
    openCustomersPage({ fromHistory: true });
  }
  if (window.location.hash === "#employees" && els.employeeManagerPage.hidden && authState.ready && els.authScreen.hidden && isAdminUser()) {
    openEmployeeManagerPage({ fromHistory: true });
  }
  if (window.location.hash === "#activity-history" && els.activityHistoryPage.hidden && authState.ready && els.authScreen.hidden) {
    openActivityHistoryPage({ fromHistory: true });
  }
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

function setQuickCategoryCreatorOpen(open) {
  els.quickCategoryCreator.hidden = !open;
  els.quickCategoryToggle.setAttribute("aria-expanded", String(open));
  const compact = USE_MOBILE_APP_THEME && els.quickEntryModal.classList.contains("cash-quick-entry-mode");
  els.quickEntryModal.classList.toggle("cash-category-editing", compact && open);
  els.quickCategoryToggle.textContent = compact && open ? "Hủy" : "+ Mục";
  els.quickCategoryToggle.setAttribute("aria-label", compact && open ? "Hủy tạo danh mục mới" : "Tạo danh mục mới");
  if (compact) els.quickEntryForm.scrollTop = 0;
  if (!open) {
    if (compact && document.activeElement === els.quickNewCategoryName) els.quickNewCategoryName.blur();
    els.quickNewCategoryName.value = "";
    els.quickCategoryError.textContent = "";
    els.quickCategoryError.hidden = true;
  }
}

function refreshQuickEntryCategoryOptions(store, type, selectedId = "") {
  const categories = store.categories[type] || [];
  els.quickEntryCategory.innerHTML = [
    `<option value="">${categories.length ? "Chọn mục" : "Chưa có mục"}</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
  ].join("");
  els.quickEntryCategory.disabled = !categories.length;
  els.quickEntryCategory.value = selectedId;
  els.quickEntrySubmit.disabled = !categories.length;
}

function createQuickEntryCategory() {
  const type = els.quickEntryForm.dataset.type;
  if (!isAdminUser() || (type !== "income" && type !== "expense")) return;

  const name = els.quickNewCategoryName.value.trim();
  const store = getActiveStore();
  if (!store) return;
  if (!name) {
    els.quickCategoryError.textContent = "Vui lòng nhập tên danh mục.";
    els.quickCategoryError.hidden = false;
    els.quickNewCategoryName.focus();
    return;
  }
  if (store.categories[type].some((category) => category.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
    els.quickCategoryError.textContent = "Danh mục này đã tồn tại. Hãy chọn trong danh sách Mục.";
    els.quickCategoryError.hidden = false;
    return;
  }

  const category = addCategory(type, name);
  if (!category) return;
  refreshQuickEntryCategoryOptions(getActiveStore(), type, category.id);
  setQuickCategoryCreatorOpen(false);
}

function openQuickEntryModal(type) {
  const store = getActiveStore();
  if (!store || !["income", "expense", "sales", "purchase"].includes(type)) return;

  els.quickEntryForm.dataset.type = type;
  els.openBulkCashPage.hidden = !isAdminUser() || (type !== "income" && type !== "expense");

  if (type === "sales") {
    openSalesOrderModal(store);
    return;
  }

  if (type === "purchase") {
    openPurchaseOrderModal(store);
    return;
  }

  els.quickEntryModal.classList.remove("sales-page-mode");
  els.quickEntryModal.classList.toggle("cash-quick-entry-mode", USE_MOBILE_APP_THEME);
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
  els.quickEntryAmount.placeholder = USE_MOBILE_APP_THEME ? "0 đ" : "";
  refreshQuickEntryCategoryOptions(store, type);
  setQuickCategoryCreatorOpen(!categories.length);
  renderEntrySuggestionList(els.quickEntrySuggestions, getEntrySuggestions(store, type));
  updateCashQuickEntryViewport();
  els.quickEntryModal.hidden = false;
  updateTimeFiltersVisibility();
}

function closeQuickEntryModal() {
  hideBulkCashPage({ restoreFocus: false });
  clearBulkCashHash();
  els.bulkCashText.value = "";
  els.bulkCashPage.dataset.type = "";
  els.bulkCashPage.dataset.storeId = "";
  resetBulkCashFileImport();
  updateBulkCashCount();
  els.quickEntryModal.hidden = true;
  hideSalesCatalogPage({ restoreFocus: false });
  uiState.salesCatalogRow = null;
  if (window.location.hash === "#sales-catalog") {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
  updateTimeFiltersVisibility();
  els.quickEntryModal.classList.remove("sales-page-mode", "cash-quick-entry-mode");
  els.quickEntryForm.reset();
  setQuickCategoryCreatorOpen(false);
  uiState.salesDraftId = null;
  uiState.salesOrderDiscountPercent = 0;
  uiState.salesOrderDiscountAmount = 0;
  closeOrderDiscountModal();
  els.salesItems.innerHTML = "";
  els.purchaseItems.innerHTML = "";
  els.quickEntryFields.hidden = false;
  els.salesOrderFields.hidden = true;
  els.purchaseOrderFields.hidden = true;
  els.bulkPurchaseFields.hidden = true;
  els.bulkPurchaseText.value = "";
  updateBulkPurchaseSummary();
  els.quickEntrySubmit.disabled = false;
  els.openBulkCashPage.hidden = true;
  els.openOrderDiscount.hidden = true;
  els.saveSalesDraft.hidden = true;
  els.deleteSalesDraft.hidden = true;
  els.quickEntrySubmit.textContent = "Lưu";
}

function parseBulkCashColumns(line) {
  const normalizedLine = line.replace(/[“”]/g, '"');
  const fields = [];
  let value = "";
  let quoted = false;
  let afterQuote = false;
  for (let index = 0; index < normalizedLine.length; index += 1) {
    const char = normalizedLine[index];
    if (quoted) {
      if (char === '"' && normalizedLine[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        value += char;
      }
    } else if (afterQuote) {
      if (char === ",") {
        fields.push(value.trim());
        value = "";
        afterQuote = false;
      } else if (!/\s/.test(char)) {
        return { error: "Có ký tự thừa sau dấu ngoặc kép." };
      }
    } else if (char === ",") {
      fields.push(value.trim());
      value = "";
    } else if (char === '"') {
      if (value.trim()) return { error: "Dấu ngoặc kép phải nằm ở đầu ô." };
      value = "";
      quoted = true;
    } else {
      value += char;
    }
  }
  if (quoted) return { error: "Chưa đóng dấu ngoặc kép." };
  fields.push(value.trim());
  return { fields };
}

function parseBulkCashDate(value, defaultDate) {
  const raw = String(value || "").trim();
  if (!raw) return defaultDate;
  const dayFirst = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const compactDayFirst = raw.match(/^(\d{2})(\d{2})(\d{4})$/);
  const normalized = compactDayFirst
    ? `${compactDayFirst[3]}-${compactDayFirst[2]}-${compactDayFirst[1]}`
    : dayFirst
    ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`
    : raw;
  return isValidDateInput(normalized) ? normalized : null;
}

function looksLikeBulkCashDate(value) {
  const raw = String(value || "").trim();
  return /^(?:\d{8}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})$/.test(raw);
}

function parseBulkCashRows(text, defaultDate = toDateInputValue(new Date()), { maxRows = 200 } = {}) {
  const rows = [];
  const errors = [];
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const nonempty = lines.map((value, index) => ({ value: value.trim(), number: index + 1 }))
    .filter((line) => line.value);
  if (!nonempty.length) errors.push("Hãy nhập ít nhất một khoản.");
  if (maxRows !== null && nonempty.length > maxRows) errors.push(`Tối đa ${maxRows} dòng; hiện có ${nonempty.length} dòng.`);

  nonempty.forEach(({ value, number }) => {
    const parsed = parseBulkCashColumns(value);
    if (parsed.error) {
      errors.push(`Dòng ${number}: ${parsed.error}`);
      return;
    }
    const fields = parsed.fields;
    if (fields.length < 3 || fields.length > 4) {
      errors.push(`Dòng ${number}: Cần 3 hoặc 4 ô: tên, số tiền, mục, ngày (tùy chọn).`);
      return;
    }
    const [note, amountText, thirdField, fourthField = ""] = fields;
    if (!note || note.length > 200) {
      errors.push(`Dòng ${number}: Tên khoản phải có từ 1 đến 200 ký tự.`);
      return;
    }
    const compactAmount = amountText.replace(/\s/g, "");
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(compactAmount)) {
      errors.push(`Dòng ${number}: Số tiền phải là số nguyên, có thể dùng dấu chấm phân tách nghìn.`);
      return;
    }
    const amount = Number(compactAmount.replaceAll(".", ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      errors.push(`Dòng ${number}: Số tiền phải lớn hơn 0 và nằm trong giới hạn hợp lệ.`);
      return;
    }
    const thirdIsDate = looksLikeBulkCashDate(thirdField);
    const fourthIsDate = looksLikeBulkCashDate(fourthField);
    if (thirdIsDate && fourthIsDate) {
      errors.push(`Dòng ${number}: Chỉ nhập một ngày và một mục.`);
      return;
    }
    const categoryName = thirdIsDate ? fourthField : thirdField;
    const dateText = thirdIsDate ? thirdField : fourthField;
    if (!categoryName || categoryName.length > 80) {
      errors.push(`Dòng ${number}: Mục phải có từ 1 đến 80 ký tự.`);
      return;
    }
    const date = parseBulkCashDate(dateText, defaultDate);
    if (!date) {
      errors.push(`Dòng ${number}: Ngày không hợp lệ. Dùng DDMMYYYY, DD/MM/YYYY hoặc YYYY-MM-DD.`);
      return;
    }
    rows.push({ note, amount, categoryName, date });
  });
  return { rows, errors, lineCount: nonempty.length };
}

function updateBulkCashCount() {
  const count = els.bulkCashText.value.split(/\r\n|\n|\r/).filter((line) => line.trim()).length;
  const fromFile = els.bulkCashPage.dataset.source === "file";
  els.bulkCashCount.textContent = fromFile ? `${count} dòng từ file` : `${count} / 200 dòng`;
  els.bulkCashCount.classList.toggle("is-over-limit", !fromFile && count > 200);
  els.bulkCashErrors.hidden = true;
  els.bulkCashErrors.replaceChildren();
  els.bulkCashText.removeAttribute("aria-invalid");
}

let bulkCashFileRequestId = 0;

function setBulkCashFileLoading(loading) {
  els.bulkCashPage.dataset.reading = loading ? "true" : "false";
  els.bulkCashText.disabled = loading;
  if (els.completeBulkCashPage) els.completeBulkCashPage.disabled = loading;
}

function resetBulkCashFileImport() {
  bulkCashFileRequestId += 1;
  setBulkCashFileLoading(false);
  els.bulkCashPage.dataset.source = "manual";
  els.bulkCashText.maxLength = 70000;
  if (els.bulkCashFile) els.bulkCashFile.value = "";
  if (els.bulkCashFileHint) {
    els.bulkCashFileHint.textContent = "Chọn biểu tượng tài liệu để nhập từ file .txt hoặc .md.";
    delete els.bulkCashFileHint.dataset.state;
  }
}

async function readBulkCashWithTimeout(read, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("File read timed out")), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readBulkCashFileText(file, timeoutMs = Math.min(15000, Math.max(5000, Math.ceil((file.size || 0) / 1048576) * 2000)), onAttempt) {
  const attempts = [];
  if (typeof FileReader === "function") {
    attempts.push(() => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.onabort = () => reject(new Error("FileReader was cancelled"));
      reader.readAsText(file, "UTF-8");
    }));
  }
  if (typeof file.text === "function") attempts.push(() => file.text());
  if (typeof file.arrayBuffer === "function" && typeof TextDecoder === "function") {
    attempts.push(async () => new TextDecoder("utf-8").decode(await file.arrayBuffer()));
  }
  if (!attempts.length) throw new Error("No file reader available");
  // Read independently: one stalled browser API must not delay another working API.
  return readBulkCashWithTimeout(() => Promise.any(attempts.map((attempt, index) => {
    onAttempt?.(index + 1, attempts.length);
    return Promise.resolve().then(attempt).then((content) => {
      if (typeof content !== "string" || (!content && file.size > 0)) throw new Error("File content is empty");
      return content;
    });
  })), timeoutMs);
}

function normalizeBulkCashFileText(content) {
  return String(content || "").replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)
    .map((line) => line.replace(/^\s*[-*]\s+(?=\S)/, ""))
    .join("\n");
}

async function importBulkCashFile() {
  const file = els.bulkCashFile.files?.[0];
  if (!file || els.bulkCashPage.hidden) return;
  const requestId = ++bulkCashFileRequestId;
  setBulkCashFileLoading(false);
  if (!/\.(?:txt|md)$/i.test(file.name)) {
    els.bulkCashFileHint.textContent = "Chỉ nhận file .txt hoặc .md.";
    els.bulkCashFileHint.dataset.state = "error";
    return;
  }
  const type = els.bulkCashPage.dataset.type;
  const storeId = els.bulkCashPage.dataset.storeId;
  els.bulkCashFileHint.textContent = `Đang đọc ${file.name}...`;
  els.bulkCashFileHint.dataset.state = "loading";
  setBulkCashFileLoading(true);
  try {
    const content = await readBulkCashFileText(file);
    if (els.bulkCashPage.hidden || requestId !== bulkCashFileRequestId || els.bulkCashPage.dataset.type !== type || els.bulkCashPage.dataset.storeId !== storeId) return;
    const normalized = normalizeBulkCashFileText(content);
    if (!normalized.trim()) {
      els.bulkCashFileHint.textContent = "File không có dòng khoản nào. Hãy chọn file khác.";
      els.bulkCashFileHint.dataset.state = "error";
      return;
    }
    // The DOM maxLength setter rejects negative values. Remove the attribute to unlock file imports.
    els.bulkCashText.removeAttribute("maxlength");
    els.bulkCashText.value = normalized;
    els.bulkCashPage.dataset.source = "file";
    updateBulkCashCount();
    els.bulkCashFileHint.textContent = `Đã tải ${file.name}. Kiểm tra các dòng rồi bấm Hoàn thành.`;
    els.bulkCashFileHint.dataset.state = "success";
    setBulkCashFileLoading(false);
    els.bulkCashText.focus({ preventScroll: true });
  } catch (error) {
    if (els.bulkCashPage.hidden || requestId !== bulkCashFileRequestId) return;
    console.error("Cannot read bulk cash file", error);
    els.bulkCashFileHint.textContent = "Không đọc được file. Hãy chọn lại tệp .txt/.md hoặc dán nội dung vào ô bên dưới.";
    els.bulkCashFileHint.dataset.state = "error";
  } finally {
    if (requestId === bulkCashFileRequestId) setBulkCashFileLoading(false);
  }
}

function showBulkCashErrors(errors) {
  els.bulkCashErrors.replaceChildren();
  errors.slice(0, 20).forEach((message) => {
    const line = document.createElement("p");
    line.textContent = message;
    els.bulkCashErrors.append(line);
  });
  if (errors.length > 20) {
    const more = document.createElement("p");
    more.textContent = `Còn ${errors.length - 20} lỗi khác.`;
    els.bulkCashErrors.append(more);
  }
  els.bulkCashErrors.hidden = false;
  els.bulkCashText.setAttribute("aria-invalid", "true");
  els.bulkCashErrors.scrollIntoView({ block: "nearest" });
}

function openBulkCashPage({ fromHistory = false } = {}) {
  const type = fromHistory
    ? (window.location.hash === "#bulk-expense" ? "expense" : "income")
    : els.quickEntryForm.dataset.type;
  const store = getActiveStore();
  if (!isAdminUser() || !store || !["income", "expense"].includes(type) || els.quickEntryModal.hidden) return;
  if (els.bulkCashPage.dataset.type !== type || els.bulkCashPage.dataset.storeId !== store.id) {
    els.bulkCashText.value = "";
    resetBulkCashFileImport();
    updateBulkCashCount();
  }
  els.bulkCashPage.dataset.type = type;
  els.bulkCashPage.dataset.storeId = store.id;
  els.bulkCashCard.dataset.type = type;
  els.bulkCashTitle.textContent = type === "income" ? "Thêm khoản thu từ danh sách" : "Thêm khoản chi từ danh sách";
  els.bulkCashContext.textContent = type === "income" ? "Thu / Nhập danh sách" : "Chi / Nhập danh sách";
  if (!fromHistory && !["#bulk-income", "#bulk-expense"].includes(window.location.hash)) {
    window.history.pushState({ ...window.history.state, bulkCashPage: true }, "", `#bulk-${type}`);
  }
  els.bulkCashPage.hidden = false;
  els.bulkCashPage.scrollTop = 0;
  document.body.classList.add("bulk-cash-page-open");
  els.appShell.inert = true;
  els.appShell.setAttribute("aria-hidden", "true");
  els.quickEntryModal.inert = true;
  els.quickEntryModal.setAttribute("aria-hidden", "true");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = true;
  updateBulkCashViewport();
  updateTimeFiltersVisibility();
  els.closeBulkCashPage.focus({ preventScroll: true });
}

function closeBulkCashPage() {
  if (["#bulk-income", "#bulk-expense"].includes(window.location.hash) && window.history.state?.bulkCashPage) {
    window.history.back();
    return;
  }
  hideBulkCashPage();
  clearBulkCashHash();
}

function hideBulkCashPage({ restoreFocus = true } = {}) {
  if (els.bulkCashPage.hidden) return;
  if (els.bulkCashPage.dataset.reading === "true") {
    bulkCashFileRequestId += 1;
    els.bulkCashFileHint.textContent = "Đã hủy đọc file. Chọn lại file để tiếp tục.";
    els.bulkCashFileHint.dataset.state = "cancelled";
  }
  setBulkCashFileLoading(false);
  els.bulkCashPage.hidden = true;
  document.body.classList.remove("bulk-cash-page-open");
  els.quickEntryModal.inert = false;
  els.quickEntryModal.removeAttribute("aria-hidden");
  els.appShell.inert = false;
  els.appShell.removeAttribute("aria-hidden");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = false;
  updateTimeFiltersVisibility();
  if (restoreFocus && !els.quickEntryModal.hidden) els.openBulkCashPage.focus({ preventScroll: true });
}

function clearBulkCashHash() {
  if (["#bulk-income", "#bulk-expense"].includes(window.location.hash)) {
    window.history.replaceState({ ...window.history.state, bulkCashPage: false }, "", `${window.location.pathname}${window.location.search}`);
  }
}

function updateBulkCashViewport() {
  if (!USE_MOBILE_APP_THEME || els.bulkCashPage.hidden) return;
  const viewport = window.visualViewport;
  els.bulkCashPage.style.setProperty("--bulk-cash-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  els.bulkCashPage.style.setProperty("--bulk-cash-visual-top", `${Math.round(viewport?.offsetTop || 0)}px`);
  ensureBulkCashFocusVisible(document.activeElement);
}

function ensureBulkCashFocusVisible(target) {
  if (els.bulkCashPage.hidden || !els.bulkCashPage.contains(target)) return;
  const bounds = els.bulkCashPage.getBoundingClientRect();
  const field = target.getBoundingClientRect();
  if (field.height > bounds.height - 36) {
    els.bulkCashPage.scrollTop += field.top - bounds.top - 18;
    return;
  }
  if (field.bottom > bounds.bottom - 18) els.bulkCashPage.scrollTop += field.bottom - bounds.bottom + 18;
  else if (field.top < bounds.top + 18) els.bulkCashPage.scrollTop -= bounds.top - field.top + 18;
}

function completeBulkCashPage() {
  if (els.bulkCashPage.hidden || els.bulkCashPage.dataset.reading === "true") return;
  const type = els.bulkCashPage.dataset.type;
  const store = getActiveStore();
  if (!isAdminUser() || !store || store.id !== els.bulkCashPage.dataset.storeId || !["income", "expense"].includes(type)) {
    showBulkCashErrors(["Cửa hàng hoặc quyền truy cập đã thay đổi. Hãy quay lại và mở lại trang nhập danh sách."]);
    return;
  }
  const maxRows = els.bulkCashPage.dataset.source === "file" ? null : 200;
  const { rows, errors } = parseBulkCashRows(els.bulkCashText.value, toDateInputValue(new Date()), { maxRows });
  if (errors.length) {
    showBulkCashErrors(errors);
    return;
  }
  const categories = store.categories[type];
  const byName = new Map(categories.map((category) => [category.name.toLocaleLowerCase("vi"), category]));
  const area = type === "income" ? "Thu" : "Chi";
  rows.forEach((row) => {
    const key = row.categoryName.toLocaleLowerCase("vi");
    let category = byName.get(key);
    if (!category) {
      category = { id: createId(), name: row.categoryName };
      categories.push(category);
      byName.set(key, category);
      recordActivity(store, "create", area, `Tạo mục "${category.name}".`, {
        tab: type, targetType: "category", targetId: category.id
      });
    }
    const createdAt = new Date().toISOString();
    const entry = {
      id: createId(), type, categoryId: category.id, date: row.date,
      amount: row.amount, note: row.note, createdAt
    };
    store.entries.push(entry);
    recordActivity(store, "create", area,
      `Tạo ${type === "income" ? "khoản thu" : "khoản chi"} "${row.note}" - ${formatCurrency(row.amount)}.`,
      { createdAt, tab: type, targetType: "entry", targetId: entry.id, targetDate: row.date });
  });
  saveAndRender();
  els.bulkCashText.value = "";
  hideBulkCashPage({ restoreFocus: false });
  clearBulkCashHash();
  closeQuickEntryModal();
  showActivityNavigationNotice(`Đã thêm ${rows.length} khoản ${type === "income" ? "thu" : "chi"}.`);
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
  els.quickEntryModal.classList.remove("cash-quick-entry-mode");
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
  els.saveSalesDraft.hidden = isEmployeeUser() && !employeeCan("sales", "draft");
  els.deleteSalesDraft.hidden = isEmployeeUser() || !uiState.salesDraftId;
  els.quickEntrySubmit.textContent = "Hoàn Thành";
  els.quickEntryModal.hidden = false;
  updateTimeFiltersVisibility();
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

function openSalesCatalogPage(row, { fromHistory = false } = {}) {
  const store = getActiveStore();
  if (!store || !row || els.quickEntryModal.hidden) return;

  uiState.salesCatalogRow = row;
  if (!fromHistory) {
    uiState.salesCatalogSearch = "";
    uiState.salesCatalogFilter = "all";
    els.salesCatalogSearch.value = "";
    if (window.location.hash !== "#sales-catalog") {
      window.history.pushState({ ...window.history.state, salesCatalogPage: true }, "", "#sales-catalog");
    }
  }
  renderSalesCatalog();
  els.salesCatalogPage.hidden = false;
  els.salesCatalogPage.scrollTop = 0;
  document.body.classList.add("sales-catalog-page-open");
  els.appShell.inert = true;
  els.appShell.setAttribute("aria-hidden", "true");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = true;
  els.quickEntryModal.inert = true;
  els.quickEntryModal.setAttribute("aria-hidden", "true");
  updateSalesCatalogViewport();
  updateTimeFiltersVisibility();
  els.closeSalesCatalog.focus({ preventScroll: true });
}

function closeSalesCatalogPage() {
  if (window.location.hash === "#sales-catalog" && window.history.state?.salesCatalogPage) {
    window.history.back();
    return;
  }
  hideSalesCatalogPage();
  if (window.location.hash === "#sales-catalog") {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
}

function hideSalesCatalogPage({ restoreFocus = true } = {}) {
  if (els.salesCatalogPage.hidden) return;
  els.salesCatalogPage.hidden = true;
  document.body.classList.remove("sales-catalog-page-open");
  els.appShell.inert = !els.customersPage.hidden;
  if (els.customersPage.hidden) els.appShell.removeAttribute("aria-hidden");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = !els.customersPage.hidden;
  els.quickEntryModal.inert = false;
  els.quickEntryModal.removeAttribute("aria-hidden");
  updateTimeFiltersVisibility();
  if (restoreFocus && !els.quickEntryModal.hidden) {
    uiState.salesCatalogRow?.querySelector("[data-open-sales-catalog]")?.focus({ preventScroll: true });
  }
}

function updateSalesCatalogViewport() {
  if (!USE_MOBILE_APP_THEME || els.salesCatalogPage.hidden) return;
  const viewport = window.visualViewport;
  els.salesCatalogPage.style.setProperty("--sales-catalog-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  els.salesCatalogPage.style.setProperty("--sales-catalog-visual-top", `${Math.round(viewport?.offsetTop || 0)}px`);
  ensureSalesCatalogFocusVisible(document.activeElement);
}

function ensureSalesCatalogFocusVisible(target) {
  if (els.salesCatalogPage.hidden || !els.salesCatalogPage.contains(target)) return;
  const pageBounds = els.salesCatalogPage.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  if (targetBounds.bottom > pageBounds.bottom - 18) {
    els.salesCatalogPage.scrollTop += targetBounds.bottom - pageBounds.bottom + 18;
  } else if (targetBounds.top < pageBounds.top + 18) {
    els.salesCatalogPage.scrollTop -= pageBounds.top - targetBounds.top + 18;
  }
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
  els.salesCatalogTotalCount.textContent = String(inventory.length);
  els.salesCatalogAvailableCount.textContent = String(inventory.filter((item) => Number(item.quantity || 0) > 0).length);
  els.salesCatalogGroupCount.textContent = String(groups.length);

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

  els.salesCatalogCount.textContent = `${rows.length} hàng hoá`;

  if (!rows.length) {
    els.salesCatalogList.innerHTML = '<div class="sales-catalog-empty"><strong>Chưa tìm thấy hàng hoá</strong><span>Hãy thử tên khác hoặc chọn lại nhóm hàng.</span></div>';
    return;
  }

  els.salesCatalogList.innerHTML = rows
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const disabled = quantity <= 0;
      return `
        <button
          class="sales-catalog-item goods-catalog-item ${disabled ? "is-disabled" : ""}"
          type="button"
          data-select-sales-catalog-item="${item.id}"
          ${disabled ? 'aria-disabled="true"' : ""}
        >
          <span class="goods-catalog-main">
            <span class="goods-catalog-mark" aria-hidden="true">▣</span>
            <span class="goods-catalog-copy">
              <strong>${escapeHtml(item.name || "")}</strong>
              <small>${escapeHtml(item.groupName || "Chưa phân nhóm")}</small>
            </span>
          </span>
          <span class="goods-catalog-bottom">
            <span class="goods-catalog-price"><small>Giá bán</small><strong>${formatCurrency(getInventorySalePrice(item))}</strong></span>
            <span class="goods-catalog-select">${disabled ? "Hết hàng" : `Còn ${quantity.toLocaleString("vi-VN")} · Chọn →`}</span>
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
  closeSalesCatalogPage();
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
  const bill = allocateSalesBillCode(store, date);
  const groupLookup = getGoodsGroupLookup(store);
  const orderItems = items.map((item) => ({
    ...item,
    groupName: item.groupName || groupLookup.get(normalizeSearchText(item.name)) || "Chưa phân nhóm"
  }));
  deductInventoryForSales(store, items);
  ensureCustomerFromSalesOrder(store, { customerName, customerPhone, createdAt });
  const order = {
    id: orderId,
    ...bill,
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
  };
  store.orders.push(order);

  recordActivity(
    store,
    "create",
    "Bán hàng",
    `Tạo đơn bán hàng ${bill.billCode} cho "${customerName}" - ${items.length} mặt hàng, tổng ${formatCurrency(total)}.`,
    { createdAt, tab: "sales", targetType: "sales-order", targetId: orderId, targetDate: date }
  );

  const completedDraftId = uiState.salesDraftId || "";
  if (completedDraftId) {
    store.draftOrders = (store.draftOrders || []).filter((draft) => draft.id !== completedDraftId);
  }

  saveAndRender({ type: "sales-create", storeId: store.id, order, draftId: completedDraftId });
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

function openCustomersPage({ fromHistory = false } = {}) {
  if (isEmployeeUser()) {
    if (window.location.hash === "#customers") {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    return;
  }
  const store = getActiveStore();
  if (!store) return;
  if (getActiveTabName() !== "sales") activateTab("sales");

  closeCustomerForm();
  uiState.customerMemberFilter = "all";
  uiState.customerSearch = "";
  renderCustomers(store);
  if (!fromHistory && window.location.hash !== "#customers") {
    window.history.pushState({ ...window.history.state, customersPage: true }, "", "#customers");
  }
  els.customersPage.hidden = false;
  els.customersPage.scrollTop = 0;
  document.body.classList.add("customers-page-open");
  els.appShell.inert = true;
  els.appShell.setAttribute("aria-hidden", "true");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = true;
  updateCustomersViewport();
  updateTimeFiltersVisibility();
  els.closeCustomersTop.focus({ preventScroll: true });
}

function closeCustomersPage() {
  if (window.location.hash === "#customers" && window.history.state?.customersPage) {
    window.history.back();
    return;
  }
  hideCustomersPage();
  if (window.location.hash === "#customers") {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
}

function hideCustomersPage({ restoreFocus = true } = {}) {
  if (els.customersPage.hidden) return;
  els.customersPage.hidden = true;
  document.body.classList.remove("customers-page-open");
  els.appShell.inert = false;
  els.appShell.removeAttribute("aria-hidden");
  if (USE_MOBILE_APP_THEME) els.tabBar.inert = false;
  closeCustomerHistoryModal();
  closeMemberTierModal();
  updateTimeFiltersVisibility();
  closeCustomerForm();
  if (restoreFocus) els.openCustomers.focus({ preventScroll: true });
}

function updateCustomersViewport() {
  if (!USE_MOBILE_APP_THEME || els.customersPage.hidden) return;
  const viewport = window.visualViewport;
  els.customersPage.style.setProperty("--customers-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
  els.customersPage.style.setProperty("--customers-visual-top", `${Math.round(viewport?.offsetTop || 0)}px`);
  ensureCustomerFocusVisible(document.activeElement);
}

function ensureCustomerFocusVisible(target) {
  if (els.customersPage.hidden || !els.customersPage.contains(target)) return;
  const cardBounds = els.customersPage.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  if (targetBounds.bottom > cardBounds.bottom - 18) {
    els.customersPage.scrollTop += targetBounds.bottom - cardBounds.bottom + 18;
  } else if (targetBounds.top < cardBounds.top + 18) {
    els.customersPage.scrollTop -= cardBounds.top - targetBounds.top + 18;
  }
}

function openCustomerForm(customer = null) {
  // Capture the opening moment for a new customer; editing keeps the saved timestamp.
  const initialCreatedAt = customer?.createdAt || new Date();
  uiState.customerFormOpen = true;
  els.customerForm.hidden = false;
  els.customersCard.classList.add("customer-form-open");
  els.customersPage.scrollTop = 0;
  els.customerForm.elements.customerId.value = customer?.id && !String(customer.id).startsWith("order-") ? customer.id : "";
  els.customerNameInput.value = customer?.name || "";
  els.customerPhoneInput.value = customer?.phone || "";
  els.customerMemberTier.value = customer?.memberTier || "Thường";
  els.customerCreatedAt.value = toDateTimeLocalValue(initialCreatedAt);
  const [createdDate = "", createdTime = ""] = els.customerCreatedAt.value.split("T");
  els.customerCreatedDate.value = createdDate ? formatDate(createdDate) : "";
  els.customerCreatedTime.value = createdTime;
  if (USE_MOBILE_APP_THEME) syncCustomerCreatedAtFromMobile();
  els.customerNameInput.focus();
}

function parseCustomerMobileDate(value) {
  const text = String(value || "").trim();
  const parts = /^\d{8}$/.test(text)
    ? [text.slice(0, 2), text.slice(2, 4), text.slice(4)]
    : text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)?.slice(1);
  if (!parts) return "";
  const [day, month, year] = parts.map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCustomerMobileTime(value) {
  const text = String(value || "").trim();
  const parts = /^\d{3,4}$/.test(text)
    ? [text.slice(0, -2), text.slice(-2)]
    : text.match(/^(\d{1,2}):(\d{2})$/)?.slice(1);
  if (!parts) return "";
  const [hour, minute] = parts.map(Number);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function syncCustomerCreatedAtFromMobile() {
  const date = parseCustomerMobileDate(els.customerCreatedDate.value);
  const time = parseCustomerMobileTime(els.customerCreatedTime.value);
  els.customerCreatedDate.setCustomValidity(date || !els.customerCreatedDate.value ? "" : "Ngày không hợp lệ. Nhập dd/mm/yyyy hoặc 8 chữ số.");
  els.customerCreatedTime.setCustomValidity(time || !els.customerCreatedTime.value ? "" : "Giờ không hợp lệ. Nhập HH:mm hoặc 4 chữ số.");
  els.customerCreatedAt.value = date && time ? `${date}T${time}` : "";
}

function closeCustomerForm() {
  uiState.customerFormOpen = false;
  els.customerForm.hidden = true;
  els.customersCard.classList.remove("customer-form-open");
  els.customerForm.reset();
  els.customerMemberTier.value = "Thường";
  els.customerCreatedDate.setCustomValidity("");
  els.customerCreatedTime.setCustomValidity("");
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
      : allCustomers.filter((customer) => {
          const tier = normalizeSearchText(customer.memberTier || "Thường");
          return selectedTier === "other" ? tier !== "thuong" : tier === selectedTier;
        });
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
      const customerInitial = Array.from(String(customer.name || "?").trim())[0]?.toLocaleUpperCase("vi") || "?";
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
          <div class="customer-mobile-card">
            <span class="customer-avatar" aria-hidden="true">${escapeHtml(customerInitial)}</span>
            <span class="customer-mobile-info">
              <strong>${escapeHtml(customer.name)}</strong>
              <span class="customer-mobile-phone">${escapeHtml(customer.phone)}</span>
              <button class="member-tier-badge ${tierClass}" type="button" data-member-tier-customer="${customer.id}" title="Xem thời hạn gói" aria-label="Xem thời hạn gói ${escapeHtml(tierName)}">♛ ${escapeHtml(tierName)}</button>
            </span>
            <span class="customer-mobile-actions">
              <small>${createdDate}</small>
              <button class="customer-mobile-history" type="button" data-customer-history="${customer.id}" aria-label="Lịch sử giao dịch của ${escapeHtml(customer.name)}">▤ <span>Lịch sử</span></button>
            </span>
            <button class="customer-mobile-edit" type="button" data-edit-customer="${customer.id}" aria-label="Sửa thông tin ${escapeHtml(customer.name)}">✎</button>
          </div>
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
  const validFilters = new Set(["all", "thuong", "other", ...tiers.map(([key]) => key)]);
  if (!validFilters.has(uiState.customerMemberFilter)) {
    uiState.customerMemberFilter = "all";
  }

  els.customerMemberFilter.innerHTML = [
    '<option value="all">Tất cả</option>',
    ...tiers.map(([key, name]) => `<option value="${key}">${escapeHtml(name)}</option>`)
  ].join("");
  els.customerMemberFilter.value = tiers.some(([key]) => key === uiState.customerMemberFilter)
    ? uiState.customerMemberFilter
    : "all";
  els.customerMemberChips.innerHTML = [
    ["all", "Tất cả"],
    ["thuong", "Thường"],
    ["other", "Khác"]
  ].map(([value, label]) => `<button class="customer-member-chip${uiState.customerMemberFilter === value ? " is-active" : ""}" type="button" data-customer-tier-filter="${value}" aria-pressed="${uiState.customerMemberFilter === value}">${label}</button>`).join("");
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
  const createdAt = fromDateTimeLocalValue(String(formData.get("createdAt") || ""));
  if (!name || !phone) {
    window.alert("Vui lòng nhập tên khách hàng và số điện thoại.");
    return false;
  }
  if (!createdAt) {
    window.alert("Ngày giờ khởi tạo không hợp lệ.");
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
  els.quickEntryModal.classList.remove("cash-quick-entry-mode");
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
  updateTimeFiltersVisibility();
}

function openBulkPurchaseModal(store) {
  if (!store) return;

  els.quickEntryForm.dataset.type = "purchase-bulk";
  els.quickEntryModal.classList.remove("cash-quick-entry-mode");
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
  updateTimeFiltersVisibility();
  els.bulkPurchaseText.focus();
}

function openInventoryModal() {
  if (isEmployeeUser() && !employeeCan("purchase", "inventoryView")) return;
  const store = getActiveStore();
  if (!store) return;

  renderInventory(store);
  els.inventoryModal.hidden = false;
}

function closeInventoryModal() {
  els.inventoryModal.hidden = true;
}

function openInventoryHistoryModal() {
  if (isEmployeeUser() && !employeeCan("purchase", "inventoryView")) return;
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
  if (isEmployeeUser()) return;
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
  if (isEmployeeUser()) return;
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
  renderEditInventoryLogReasonSuggestions(getInventoryLogReason(log));
  els.editInventoryLogReason.value = getInventoryLogReason(log);
  updateEditInventoryLogReasonVisibility();
  els.editInventoryLogModal.hidden = false;
}

function closeEditInventoryLogModal() {
  uiState.editingInventoryLogId = null;
  els.editInventoryLogModal.hidden = true;
  els.editInventoryLogForm.reset();
}

function renderEditInventoryLogReasonSuggestions(selectedReason = "") {
  const options = new Set(getInventoryExportReasons(getActiveStore()));
  const selected = String(selectedReason || "").trim();
  if (selected) options.add(selected);

  els.editInventoryLogReasonSuggestions.innerHTML = Array.from(options)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((reason) => `<option value="${escapeHtml(reason)}"></option>`)
    .join("");
}

function updateEditInventoryLogReasonVisibility() {
  const store = getActiveStore();
  const log = findInventoryLogById(store, uiState.editingInventoryLogId);
  const newQuantity = Number.parseInt(els.editInventoryLogQuantity.value, 10);
  const isExport = Boolean(log) && Number.isFinite(newQuantity) && newQuantity < Number(log.oldQuantity || 0);

  els.editInventoryLogReasonField.hidden = !isExport;
  els.editInventoryLogReason.disabled = !isExport;
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
  if (isEmployeeUser()) return false;
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
  const inventoryLog = addInventoryLog(store, {
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

  recordActivity(
    store,
    "update",
    "Kho hàng",
    `Sửa hàng hóa "${name}" - số lượng ${oldQuantity.toLocaleString("vi-VN")} thành ${quantity.toLocaleString(
      "vi-VN"
    )}.`,
    {
      createdAt: updatedAt,
      tab: "purchase",
      targetType: "inventory-log",
      targetId: inventoryLog.id,
      targetDate: inventoryLog.date
    }
  );

  saveAndRender();
  renderInventory(store);
  closeEditInventoryModal();
  return true;
}

function exportInventoryItem(formData) {
  if (isEmployeeUser()) return false;
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
  const inventoryLog = addInventoryLog(store, {
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

  recordActivity(
    store,
    "create",
    "Xuất kho",
    `Xuất "${item.name}" - ${quantity.toLocaleString("vi-VN")} sản phẩm${reason ? `, lý do: ${reason}` : ""}.`,
    {
      createdAt: updatedAt,
      tab: "purchase",
      targetType: "inventory-log",
      targetId: inventoryLog.id,
      targetDate: date
    }
  );

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
  const previousPurpose = getInventoryLogPurpose(log);
  const previousItemName = String(log.itemName || "Không rõ hàng hóa");

  const date = String(formData.get("date") || "").trim();
  const newQuantity = Number.parseInt(formData.get("newQuantity"), 10);
  const newPrice = parseAmountInput(formData.get("newPrice"));
  const newSalePrice = parseAmountInput(formData.get("newSalePrice"));
  const exportReason = String(formData.get("exportReason") || "").trim();

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
  if (newQuantity < Number(log.oldQuantity || 0)) {
    log.exportReason = exportReason;
    delete log.reason;
    if (exportReason) {
      store.exportReasons = getInventoryExportReasons(store);
      if (!store.exportReasons.some((reason) => normalizeSearchText(reason) === normalizeSearchText(exportReason))) {
        store.exportReasons.push(exportReason);
        store.exportReasons.sort((a, b) => a.localeCompare(b, "vi"));
      }
    }
  } else {
    delete log.exportReason;
    delete log.reason;
  }
  log.editedAt = new Date().toISOString();

  if (!log.inventoryId) {
    const item = findInventoryItemForLog(store, log);
    if (item?.id) log.inventoryId = item.id;
  }

  syncInventoryItemFromLatestLog(store, log);
  const nextPurpose = getInventoryLogPurpose(log);
  recordActivity(
    store,
    "update",
    nextPurpose.value === "export" ? "Xuất kho" : "Nhập hàng",
    `Sửa lịch sử ${previousPurpose.label.toLowerCase()} của "${previousItemName}".`,
    { createdAt: log.editedAt, tab: "purchase", targetType: "inventory-log", targetId: log.id, targetDate: date }
  );
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

  const purpose = getInventoryLogPurpose(log);
  store.inventoryLogs = (store.inventoryLogs || []).filter((current) => current.id !== log.id);
  syncInventoryItemAfterLogDelete(store, log);
  recordActivity(
    store,
    "delete",
    purpose.value === "export" ? "Xuất kho" : "Nhập hàng",
    `Xóa lịch sử ${purpose.label.toLowerCase()} của "${log.itemName || "Không rõ hàng hóa"}".`,
    { tab: "purchase", targetType: "inventory-log", targetId: log.id, targetDate: getInventoryLogDate(log) }
  );
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
  const inventoryLog = {
    id: createId(),
    updatedAt: new Date().toISOString(),
    ...log
  };
  store.inventoryLogs = [
    inventoryLog,
    ...(store.inventoryLogs || [])
  ];
  return inventoryLog;
}

function applyPurchaseItemsToInventory(store, date, items, createdAt) {
  store.inventory = [...(store.inventory || [])];
  const inventoryLogs = [];

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
      inventoryLogs.push(addInventoryLog(store, {
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
      }));
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
      inventoryLogs.push(addInventoryLog(store, {
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
      }));
    }
  });
  return inventoryLogs;
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

  const purchaseOrder = { id: orderId, date, items: normalizedItems, total, createdAt };
  store.purchaseOrders = [
    ...(store.purchaseOrders || []),
    purchaseOrder
  ];

  const inventoryLogs = applyPurchaseItemsToInventory(store, date, normalizedItems, createdAt);

  recordActivity(
    store,
    "create",
    "Nhập hàng",
    `Nhập ${normalizedItems.length} mặt hàng vào kho - tổng ${formatCurrency(total)}.`,
    {
      createdAt,
      tab: "purchase",
      targetType: "inventory-log",
      targetId: inventoryLogs[0]?.id || orderId,
      targetDate: date
    }
  );

  saveAndRender({ type: "purchase-create", storeId: store.id, order: purchaseOrder });
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

  const purchaseOrder = { id: orderId, date, items: normalizedItems, total, createdAt, source: "bulk" };
  store.purchaseOrders = [
    ...(store.purchaseOrders || []),
    purchaseOrder
  ];
  const inventoryLogs = applyPurchaseItemsToInventory(store, date, normalizedItems, createdAt);
  recordActivity(
    store,
    "create",
    "Nhập hàng",
    `Nhập nhanh ${normalizedItems.length} mặt hàng vào kho - tổng ${formatCurrency(total)}.`,
    {
      createdAt,
      tab: "purchase",
      targetType: "inventory-log",
      targetId: inventoryLogs[0]?.id || orderId,
      targetDate: date
    }
  );
  saveAndRender({ type: "purchase-create", storeId: store.id, order: purchaseOrder });
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
  const existingDraft = (store.draftOrders || []).find((item) => item.id === draftId);
  const nextDraft = {
    ...(existingDraft || {}),
    id: draftId,
    ...draft,
    status: "draft",
    createdAt: existingDraft?.createdAt || now,
    updatedAt: now
  };

  store.draftOrders = [
    ...(store.draftOrders || []).filter((item) => item.id !== draftId),
    nextDraft
  ];
  uiState.salesDraftId = draftId;
  saveAndRender({ type: "sales-draft-save", storeId: store.id, draft: nextDraft });
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

const optionalAIFileReaders = new Map();

function loadOptionalAIFileReader(name, url) {
  if (window[name]) return Promise.resolve(true);
  if (optionalAIFileReaders.has(name)) return optionalAIFileReaders.get(name);

  const loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    let finished = false;
    let timer;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (!window[name]) script.remove();
      resolve(Boolean(window[name]));
    };
    script.onload = finish;
    script.onerror = finish;
    timer = window.setTimeout(finish, 12000);
    document.head.appendChild(script);
  }).finally(() => optionalAIFileReaders.delete(name));

  optionalAIFileReaders.set(name, loading);
  return loading;
}

async function readAIExcelFile(file) {
  if (!window.XLSX) {
    await loadOptionalAIFileReader("XLSX", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
  }
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
  if (!window.mammoth && /\.docx$/i.test(file.name || "")) {
    await loadOptionalAIFileReader("mammoth", "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
  }
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
  updateTimeFiltersVisibility();
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
  updateTimeFiltersVisibility();
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
    els.aiButton.hidden = !(store && tabName === "overview" && !isEmployeeEmptyTab(tabName));
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
  const employeeCreateAllowed =
    !isEmployeeUser() ||
    (type === "purchase" && employeeCan("purchase", "create")) ||
    (type === "sales" && employeeCan("sales", "create"));
  const showButton = Boolean(store && type && employeeCreateAllowed);

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
  if (
    isEmployeeUser() &&
    !EMPLOYEE_EMPTY_TABS.has(tabName) &&
    !(
      (tabName === "purchase" && employeeCan("purchase", "view")) ||
      (tabName === "sales" && employeeCan("sales", "view"))
    )
  ) {
    tabName = getFirstEmployeeTab();
  }
  if (USE_MOBILE_APP_THEME) {
    clearTimeFiltersAutoCollapse();
    uiState.timeFiltersExpanded = false;
    document.body.classList.toggle("mobile-secondary-tab", tabName !== "stores");
  }
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
  updateDesktopCategoryFilter();
  updateDesktopPageChrome(tabName);
  renderDesktopInsights(getActiveStore());
}

function getActiveTabName() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "stores";
}

function getDesktopCategorySource() {
  const tabName = getActiveTabName();
  if (tabName === "income") return els.incomeHistoryFilter;
  if (tabName === "expense") return els.expenseHistoryFilter;
  if (tabName === "sales") return els.salesGoodsFilter;
  return null;
}

function updateDesktopCategoryFilter() {
  if (!desktopUi) return;
  const source = getDesktopCategorySource();
  desktopUi.categoryField.hidden = !source;
  if (!source) return;
  const options = [...source.options];
  desktopUi.categoryFilter.innerHTML = options.length
    ? options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.textContent)}</option>`).join("")
    : '<option value="all">Tất cả</option>';
  desktopUi.categoryFilter.value = source.value;
}

function updateDesktopPageChrome(tabName = getActiveTabName()) {
  if (!desktopUi) return;
  const employeeEmpty = isEmployeeEmptyTab(tabName);
  const pages = {
    stores: ["Cửa hàng", "Chọn và quản lý cửa hàng của bạn", ""],
    overview: ["Tổng quan", "Theo dõi hoạt động của cửa hàng", ""],
    income: ["Thu", "Theo dõi và quản lý các khoản thu", "Thêm thu"],
    expense: ["Chi", "Theo dõi và quản lý các khoản chi", "Thêm chi"],
    purchase: ["Nhập hàng", "Theo dõi nhập hàng và kho", "Nhập hàng"],
    sales: ["Bán hàng", "Quản lý đơn hàng và doanh thu", "Tạo đơn hàng"]
  };
  const [title, subtitle, action] = pages[tabName] || pages.stores;
  document.body.dataset.activeTab = tabName;
  desktopUi.title.textContent = title;
  desktopUi.subtitle.textContent = subtitle;
  desktopUi.primaryActionLabel.textContent = action;
  desktopUi.primaryAction.hidden = !action || els.quickEntryButton.hidden;
  desktopUi.filterRail.hidden = employeeEmpty || tabName === "stores" || !getActiveStore();
  desktopUi.heading.hidden = employeeEmpty || tabName === "stores";
  desktopUi.insights.hidden = employeeEmpty || !["income", "expense", "sales", "purchase"].includes(tabName);
}

function renderDesktopOverviewBreakdown(rangeLabel, amounts) {
  if (!desktopUi) return;
  document.querySelector("#desktopOverviewRangeLabel").textContent = rangeLabel;
  const maxAmount = Math.max(0, ...Object.values(amounts));
  const empty = document.querySelector("#desktopOverviewEmpty");
  const bars = document.querySelector("#desktopOverviewBars");
  empty.hidden = maxAmount > 0;
  bars.hidden = maxAmount === 0;
  bars.querySelectorAll("[data-overview-bar]").forEach((row) => {
    const amount = Math.max(0, amounts[row.dataset.overviewBar] || 0);
    row.querySelector("strong").textContent = formatCurrency(amount);
    row.querySelector(".desktop-overview-track > span").style.width = `${maxAmount ? amount / maxAmount * 100 : 0}%`;
  });
}

function renderDesktopInsights(store) {
  if (!desktopUi || !store) return;
  const range = getDateRange();
  const inRange = (entry) => entry.date >= range.start && entry.date <= range.end && !isCancelledEntry(entry);
  const tabName = getActiveTabName();
  let cards = [];
  if (tabName === "income" || tabName === "expense") {
    const entries = (store.entries || []).filter((entry) => entry.type === tabName && (tabName !== "income" || !entry.orderId) && inRange(entry));
    const total = sumEntries(entries);
    const categoryTotals = (store.categories?.[tabName] || []).map((category) => ({
      label: category.name,
      amount: sumEntries(entries.filter((entry) => entry.categoryId === category.id))
    })).sort((a, b) => b.amount - a.amount);
    cards = [
      { label: tabName === "income" ? "Tổng thu" : "Tổng chi", value: formatCurrency(total), kind: "total" },
      ...categoryTotals.slice(0, 2).map((item, index) => ({ label: item.label, value: formatCurrency(item.amount), kind: index === 0 ? "category-one" : "category-two" }))
    ];
  } else if (tabName === "sales") {
    const orders = (store.orders || []).filter(inRange);
    cards = [
      { label: "Tổng bán hàng", value: formatCurrency(orders.reduce((sum, order) => sum + Number(order.total || 0), 0)), kind: "total" },
      { label: "Đơn hàng", value: String(orders.length), kind: "category-one" },
      { label: "Hàng hóa đã bán", value: String(orders.reduce((sum, order) => sum + (order.items || []).length, 0)), kind: "category-two" }
    ];
  } else if (tabName === "purchase") {
    cards = [
      { label: "Mặt hàng trong kho", value: String((store.inventory || []).length), kind: "total" },
      { label: "Lượt cập nhật kho", value: String((store.inventoryLogs || []).filter(inRange).length), kind: "category-one" },
      { label: "Tổng tồn kho", value: String((store.inventory || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)), kind: "category-two" }
    ];
  }
  desktopUi.insights.innerHTML = cards.map((card) => `
    <article class="desktop-insight ${card.kind}">
      <span class="desktop-insight-icon" aria-hidden="true">${card.kind === "total" ? "◉" : card.kind === "category-one" ? "▤" : "⌂"}</span>
      <div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>
    </article>
  `).join("");
}

function getMobileTimeFilterLabel() {
  const labels = {
    all: "Toàn thời gian",
    today: "Hôm nay",
    yesterday: "Hôm qua",
    "this-month": "Tháng này",
    "last-month": "Tháng trước"
  };
  if (labels[uiState.rangeMode]) return labels[uiState.rangeMode];

  const range = getDateRange();
  if (uiState.rangeMode === "day") return `Theo ngày · ${range.label}`;
  if (uiState.rangeMode === "week") return `Theo tuần · ${range.label}`;
  if (uiState.rangeMode === "month") return `Theo tháng · ${range.label}`;
  return `Tùy chọn · ${range.label}`;
}

function isMobileTimeFilterSuppressed() {
  if (!USE_MOBILE_APP_THEME) return false;
  return Boolean(
    (els.quickEntryModal && !els.quickEntryModal.hidden) ||
    (els.salesCatalogPage && !els.salesCatalogPage.hidden) ||
    (els.customersPage && !els.customersPage.hidden) ||
    (els.bulkCashPage && !els.bulkCashPage.hidden) ||
    (els.employeeManagerPage && !els.employeeManagerPage.hidden) ||
    (els.activityHistoryPage && !els.activityHistoryPage.hidden) ||
    (els.aiChatModal && !els.aiChatModal.hidden)
  );
}

function updateTimeFiltersVisibility(tabName = getActiveTabName()) {
  if (!els.timeFilters || !els.timeFilterToggle || !els.stickyControlDock) return;
  const visibleTabs = new Set(["overview", "income", "expense", "purchase", "sales"]);
  const store = getActiveStore();
  const suppressed = isMobileTimeFilterSuppressed();
  if (suppressed && uiState.timeFiltersExpanded) {
    clearTimeFiltersAutoCollapse();
    uiState.timeFiltersExpanded = false;
  }
  const filtersAvailable = Boolean(store) && visibleTabs.has(tabName) && !suppressed && !isEmployeeEmptyTab(tabName);
  const filtersExpanded = filtersAvailable && (desktopUi ? true : uiState.timeFiltersExpanded);

  if (USE_MOBILE_APP_THEME && filtersAvailable) {
    const currentLabel = getMobileTimeFilterLabel();
    els.timeFilterCurrentValue.textContent = currentLabel;
    els.timePresetButtons.forEach((button) => {
      const selected = button.dataset.timePreset === uiState.rangeMode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  els.stickyControlDock.classList.toggle("filters-available", filtersAvailable);
  els.timeFilterToggle.hidden = Boolean(desktopUi) || !filtersAvailable;
  els.timeFilterToggle.classList.toggle("active", filtersExpanded);
  els.timeFilterToggle.setAttribute("aria-expanded", String(filtersExpanded));
  els.timeFilterToggle.setAttribute("aria-label", filtersExpanded ? "Thu gọn bộ lọc thời gian" : USE_MOBILE_APP_THEME ? `Mở bộ lọc thời gian: ${els.timeFilterCurrentValue.textContent}` : "Mở bộ lọc thời gian");
  els.timeFilterToggle.title = filtersExpanded ? "Thu gọn bộ lọc thời gian" : "Mở bộ lọc thời gian";
  els.timeFilters.hidden = !filtersAvailable || (USE_MOBILE_APP_THEME && els.appShell.hidden);
  els.timeFilters.classList.toggle("is-collapsed", !filtersExpanded);
  if (USE_MOBILE_APP_THEME) els.timeFilters.inert = !filtersExpanded;
  if (mobileTimeFilterShell) {
    mobileTimeFilterShell.hidden = !filtersAvailable || els.appShell.hidden;
    mobileTimeFilterShell.classList.toggle("is-expanded", filtersExpanded);
  }
}

function updateStickyControlMetrics() {
  const dockHeight = els.stickyControlDock?.offsetHeight || els.tabBar?.offsetHeight || 0;
  document.documentElement.style.setProperty("--sticky-control-dock-height", `${dockHeight}px`);
  document.documentElement.style.setProperty("--tab-bar-sticky-height", `${dockHeight}px`);
}

function getStickyControlTop() {
  if (!els.stickyControlDock) return 0;
  const computedTop = Number.parseFloat(window.getComputedStyle(els.stickyControlDock).top);
  return Number.isFinite(computedTop) ? Math.max(0, computedTop) : 0;
}

function updatePinnedTabs() {
  if (!els.stickyControlDock || !els.tabBar || !els.tabSpacer || els.dashboard.hidden) {
    resetPinnedTabs();
    return;
  }

  if (USE_MOBILE_APP_THEME || desktopUi) {
    resetPinnedTabs();
    return;
  }

  updateStickyControlMetrics();

  // tabSpacer stays in the document flow and is the stable pin threshold.
  // Do not derive this from the dock itself: once fixed, its viewport position
  // no longer represents the original location of the six primary tabs.
  const anchorRect = els.tabSpacer.getBoundingClientRect();
  const dashboardRect = els.dashboard.getBoundingClientRect();
  const stickyTop = getStickyControlTop();
  const dockHeight = els.stickyControlDock.offsetHeight;
  const shouldFix = anchorRect.top <= stickyTop && dashboardRect.bottom > stickyTop + dockHeight;

  if (!shouldFix) {
    resetPinnedTabs();
    return;
  }

  const wasFixed = els.stickyControlDock.classList.contains("is-fixed");
  if (!wasFixed && uiState.timeFiltersExpanded) {
    clearTimeFiltersAutoCollapse();
    uiState.timeFiltersExpanded = false;
    updateTimeFiltersVisibility();
  }

  const viewportLeft = Math.max(0, dashboardRect.left);
  const viewportRight = Math.min(window.innerWidth, dashboardRect.right);
  const pinnedWidth = Math.max(0, viewportRight - viewportLeft);
  els.stickyControlDock.classList.add("is-fixed");
  els.stickyControlDock.style.left = `${viewportLeft}px`;
  els.stickyControlDock.style.width = `${pinnedWidth}px`;
  els.tabSpacer.style.height = `${els.stickyControlDock.offsetHeight}px`;
  els.tabBar.dataset.pinTop = "true";
  updateStickyControlMetrics();
}

function resetPinnedTabs() {
  if (!els.stickyControlDock || !els.tabBar || !els.tabSpacer) return;
  els.stickyControlDock.classList.remove("is-fixed");
  els.stickyControlDock.style.left = "";
  els.stickyControlDock.style.width = "";
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
        <button class="store-button${active}" type="button" data-store-id="${escapeHtml(store.id)}" aria-pressed="${Boolean(active)}">
          <span class="store-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10h16M5 10l1-5h12l1 5M6 10v9h12v-9M9 19v-5h6v5" /></svg></span>
          <span class="store-copy"><span class="store-name">${escapeHtml(store.name)}</span><span class="store-detail">${active ? "Đang chọn · " : ""}${entryCount} dòng dữ liệu</span></span>
          <span class="store-meta">${entryCount} dòng</span>
          <span class="store-row-trailing" aria-hidden="true">${active ? "✓" : "›"}</span>
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

function getMonthlyExpenseCategoryData(store, referenceDate = new Date()) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthKey = toDateInputValue(monthStart).slice(0, 7);
  const dayCount = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: toDateInputValue(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), index + 1)),
    q: 0,
    p: 0
  }));
  const dayByDate = new Map(days.map((item) => [item.date, item]));
  const normalizeName = (name) => String(name || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
  const categoryIds = {
    q: new Set((store.categories?.expense || []).filter((item) => normalizeName(item.name) === "chi tiêu q").map((item) => item.id)),
    p: new Set((store.categories?.expense || []).filter((item) => normalizeName(item.name) === "chi tiêu p").map((item) => item.id))
  };
  const totals = { q: { amount: 0, count: 0 }, p: { amount: 0, count: 0 } };

  (store.entries || []).forEach((entry) => {
    if (entry.type !== "expense" || isCancelledEntry(entry)) return;
    const day = dayByDate.get(entry.date);
    if (!day) return;
    const type = categoryIds.q.has(entry.categoryId) ? "q" : categoryIds.p.has(entry.categoryId) ? "p" : null;
    const amount = Number(entry.amount);
    if (!type || !Number.isFinite(amount)) return;
    day[type] += amount;
    totals[type].amount += amount;
    totals[type].count += 1;
  });
  return { monthKey, days, totals, missing: ["q", "p"].filter((type) => categoryIds[type].size === 0) };
}

function renderOverviewExpenseCategories(store) {
  const plot = document.querySelector("#overviewCategoryPlot");
  if (!plot) return;
  const { monthKey, days, totals, missing } = getMonthlyExpenseCategoryData(store);
  const maximum = Math.max(0, ...days.flatMap((item) => [item.q, item.p]));
  const barHeight = (amount) => amount > 0 && maximum > 0 ? `${Math.max(2, amount / maximum * 100)}%` : "0%";
  document.querySelector("#overviewCategoryMonth").textContent = `Tháng ${monthKey.slice(5)}/${monthKey.slice(0, 4)}`;
  for (const type of ["q", "p"]) {
    const prefix = type.toUpperCase();
    document.getElementById(`overviewCategory${prefix}Total`).textContent = formatCurrency(totals[type].amount);
    document.getElementById(`overviewCategory${prefix}Count`).textContent = `${totals[type].count.toLocaleString("vi-VN")} khoản`;
  }
  plot.innerHTML = days.map((item) => `
    <div class="overview-category-day">
      <div class="overview-category-day-bars">
        <button class="category-q" type="button" data-overview-bar data-chart-label="Ngày ${formatDate(item.date)} · Chi tiêu Q" data-chart-amount="${item.q}" aria-label="Ngày ${formatDate(item.date)}, Chi tiêu Q: ${formatCurrency(item.q)}"><span style="--bar-height: ${barHeight(item.q)}"></span></button>
        <button class="category-p" type="button" data-overview-bar data-chart-label="Ngày ${formatDate(item.date)} · Chi tiêu P" data-chart-amount="${item.p}" aria-label="Ngày ${formatDate(item.date)}, Chi tiêu P: ${formatCurrency(item.p)}"><span style="--bar-height: ${barHeight(item.p)}"></span></button>
      </div>
      <span>${item.date.slice(8, 10)}</span>
    </div>
  `).join("");
  resetOverviewChartSelection(plot);
  const empty = document.querySelector("#overviewCategoryEmpty");
  empty.hidden = maximum > 0 && missing.length === 0;
  empty.textContent = missing.length
    ? `Chưa có danh mục ${missing.map((type) => `Chi tiêu ${type.toUpperCase()}`).join(" và ")}. Có thể thêm trong tab Chi.`
    : "Chưa có khoản Chi tiêu Q hoặc Chi tiêu P trong tháng này.";
}

function getOverviewChartData(store, referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: toDateInputValue(new Date(year, month, index + 1)),
    income: 0,
    expense: 0
  }));
  const dayByDate = new Map(days.map((item) => [item.date, item]));
  const months = [-2, -1, 0].map((offset) => ({
    key: toDateInputValue(new Date(year, month + offset, 1)).slice(0, 7),
    income: 0,
    expense: 0
  }));
  const monthByKey = new Map(months.map((item) => [item.key, item]));
  const totals = { income: { amount: 0, count: 0 }, expense: { amount: 0, count: 0 } };
  const addAmount = (date, type, value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return;
    const daily = dayByDate.get(date);
    if (daily) {
      daily[type] += amount;
      totals[type].amount += amount;
      totals[type].count += 1;
    }
    const monthly = monthByKey.get(String(date || "").slice(0, 7));
    if (monthly) monthly[type] += amount;
  };

  (store.entries || []).forEach((entry) => {
    if (isCancelledEntry(entry)) return;
    if (entry.type === "income" && !entry.orderId) addAmount(entry.date, "income", entry.amount);
    if (entry.type === "expense") addAmount(entry.date, "expense", entry.amount);
  });
  (store.orders || []).forEach((order) => {
    if (!isCancelledEntry(order)) addAmount(order.date, "income", order.total);
  });
  return { days, months, totals };
}

function renderOverviewCharts(store) {
  const weekPlot = document.querySelector("#overviewWeekPlot");
  if (!weekPlot) return;
  const { days, months, totals } = getOverviewChartData(store);
  const weekMax = Math.max(0, ...days.flatMap((item) => [item.income, item.expense]));
  const barHeight = (amount, maximum) => amount > 0 && maximum > 0 ? `${Math.max(2, amount / maximum * 100)}%` : "0%";
  document.querySelector("#overviewWeekPeriod").textContent = `Tháng ${months[2].key.slice(5)}/${months[2].key.slice(0, 4)}`;
  for (const type of ["income", "expense"]) {
    const prefix = type === "income" ? "Income" : "Expense";
    document.getElementById(`overview${prefix}Total`).textContent = formatCurrency(totals[type].amount);
    document.getElementById(`overview${prefix}Count`).textContent = `${totals[type].count.toLocaleString("vi-VN")} khoản`;
  }
  weekPlot.setAttribute("aria-label", days.map((item) => `${formatDate(item.date)}: tiền vào ${formatCurrency(item.income)}, tiền ra ${formatCurrency(item.expense)}`).join("; "));
  weekPlot.innerHTML = days.map((item) => `
    <div class="overview-week-day">
      <div class="overview-week-bars">
        <button class="money-in" type="button" data-overview-bar data-chart-label="Ngày ${formatDate(item.date)} · Tiền vào" data-chart-amount="${item.income}" aria-label="Ngày ${formatDate(item.date)}, tiền vào: ${formatCurrency(item.income)}"><span style="--bar-height: ${barHeight(item.income, weekMax)}"></span></button>
        <button class="money-out" type="button" data-overview-bar data-chart-label="Ngày ${formatDate(item.date)} · Tiền ra" data-chart-amount="${item.expense}" aria-label="Ngày ${formatDate(item.date)}, tiền ra: ${formatCurrency(item.expense)}"><span style="--bar-height: ${barHeight(item.expense, weekMax)}"></span></button>
      </div>
      <span>${item.date.slice(8, 10)}</span>
    </div>
  `).join("");
  resetOverviewChartSelection(weekPlot);
  document.querySelector("#overviewWeekEmpty").hidden = weekMax > 0;

  for (const [type, plotId, emptyId] of [
    ["income", "overviewIncomeMonthPlot", "overviewIncomeMonthEmpty"],
    ["expense", "overviewExpenseMonthPlot", "overviewExpenseMonthEmpty"]
  ]) {
    const plot = document.getElementById(plotId);
    const maximum = Math.max(0, ...months.map((item) => item[type]));
    plot.setAttribute("aria-label", `${type === "income" ? "Tiền vào" : "Tiền ra"}: ${months.map((item) => `tháng ${item.key.slice(5)}/${item.key.slice(0, 4)} ${formatCurrency(item[type])}`).join(", ")}`);
    plot.innerHTML = months.map((item) => `
      <div class="overview-month-column">
        <strong>${formatCurrency(item[type])}</strong>
        <button class="overview-month-track" type="button" data-overview-bar data-chart-label="Tháng ${item.key.slice(5)}/${item.key.slice(0, 4)} · ${type === "income" ? "Tiền vào" : "Tiền ra"}" data-chart-amount="${item[type]}" aria-label="Tháng ${item.key.slice(5)}/${item.key.slice(0, 4)}, ${type === "income" ? "tiền vào" : "tiền ra"}: ${formatCurrency(item[type])}"><span style="--bar-height: ${barHeight(item[type], maximum)}"></span></button>
        <span>Tháng ${item.key.slice(5)}/${item.key.slice(0, 4)}</span>
      </div>
    `).join("");
    resetOverviewChartSelection(plot);
    document.getElementById(emptyId).hidden = maximum > 0;
  }
}

function resetOverviewChartSelection(plot) {
  const detail = plot.closest(".overview-chart-card")?.querySelector(".overview-chart-selection");
  if (detail) detail.hidden = true;
}

function showOverviewBarValue(button) {
  const card = button.closest(".overview-chart-card");
  if (!card) return;
  card.querySelectorAll("[data-overview-bar]").forEach((bar) => {
    bar.classList.toggle("is-selected", bar === button);
    bar.setAttribute("aria-pressed", String(bar === button));
  });
  const detail = card.querySelector(".overview-chart-selection");
  detail.querySelector(".overview-chart-selection-label").textContent = button.dataset.chartLabel;
  detail.querySelector(".overview-chart-selection-value").textContent = formatCurrency(Number(button.dataset.chartAmount) || 0);
  detail.hidden = false;
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
  els.mobileTotalIncome.textContent = formatCurrency(totalIncome);
  els.mobileTotalExpense.textContent = formatCurrency(totalExpense);
  els.selectedRangeLabel.textContent = range.label;
  els.mobileOverviewRangeLabel.textContent = range.label;
  els.incomeRangeLabel.textContent = range.label;
  els.expenseRangeLabel.textContent = range.label;
  els.incomeHistoryRangeLabel.textContent = range.label;
  els.expenseHistoryRangeLabel.textContent = range.label;
  if (els.salesGoodsRangeLabel) {
    els.salesGoodsRangeLabel.textContent = range.label;
  }
  els.incomeEntryCount.textContent = `${filteredIncomeEntries.length} dòng`;
  els.expenseEntryCount.textContent = `${filteredExpenseEntries.length} dòng`;
  els.incomeHistoryTotal.innerHTML = `
    <span class="report-name">Tổng cộng</span>
    <span class="report-amount">${formatCurrency(sumEntries(filteredIncomeEntries.filter((entry) => !isCancelledEntry(entry))))}</span>
  `;
  els.expenseHistoryTotal.innerHTML = `
    <span class="report-name">Tổng cộng</span>
    <span class="report-amount">${formatCurrency(sumEntries(filteredExpenseEntries.filter((entry) => !isCancelledEntry(entry))))}</span>
  `;
  const salesOrders = (store.orders || [])
    .filter((order) => order.date >= range.start && order.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const activeSalesOrders = salesOrders.filter((order) => !isCancelledEntry(order));
  const totalSalesAmount = activeSalesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  els.totalSales.textContent = formatCurrency(totalSalesAmount);
  els.balance.textContent = formatCurrency(totalIncome + totalSalesAmount - totalExpense);
  els.mobileTotalSales.textContent = formatCurrency(totalSalesAmount);
  els.mobileBalance.textContent = els.balance.textContent;
  els.salesHistoryDateLabel.textContent = range.label;
  renderDesktopOverviewBreakdown(range.label, { income: totalIncome, sales: totalSalesAmount, expense: totalExpense });
  renderOverviewExpenseCategories(store);
  renderOverviewCharts(store);
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
  renderMobileCashFlow(store, "income", range, activeIncomeEntries);
  renderMobileCashFlow(store, "expense", range, activeExpenseEntries);
}

function renderMobileCashFlow(store, type, range, entries) {
  const prefix = type === "income" ? "mobileIncomeFlow" : "mobileExpenseFlow";
  const categories = store.categories[type] || [];
  const total = sumEntries(entries);
  const categoryTotals = new Map(categories.map((category) => [category.id, 0]));
  entries.forEach((entry) => {
    categoryTotals.set(entry.categoryId, (categoryTotals.get(entry.categoryId) || 0) + Number(entry.amount || 0));
  });

  document.getElementById(`${prefix}Context`).textContent = `${store.name} · ${range.label}`;
  document.getElementById(`${prefix}Total`).textContent = formatCurrency(total);
  document.getElementById(`${prefix}Status`).textContent = entries.length
    ? `${entries.length} giao dịch trong kỳ`
    : "Chưa có giao dịch trong kỳ";
  document.getElementById(`${prefix}EntryCount`).textContent = entries.length.toLocaleString("vi-VN");
  document.getElementById(`${prefix}CategoryCount`).textContent = categories.length.toLocaleString("vi-VN");

  const preview = categories.slice(0, 3);
  document.getElementById(`${prefix}Categories`).innerHTML = preview.length
    ? preview.map((category) => `
        <button class="mobile-flow-category" type="button" data-history-jump-type="${type}" data-history-jump-category="${escapeHtml(category.id)}" aria-label="Xem lịch sử mục ${escapeHtml(category.name)}">
          <span>${escapeHtml(category.name)}</span><strong>${formatCurrency(categoryTotals.get(category.id) || 0)}</strong>
        </button>
      `).join("")
    : '<div class="mobile-flow-empty">Chưa có danh mục. Chọn Quản lý để thêm mục.</div>';
  const more = document.getElementById(`${prefix}More`);
  more.hidden = categories.length === 0;
  more.firstChild.textContent = `Xem đủ ${categories.length} danh mục `;

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  document.getElementById(`${prefix}History`).innerHTML = entries.length
    ? entries.slice(0, 2).map((entry) => `
        <div class="mobile-flow-history-row">
          <div><strong>${escapeHtml(entry.note || categoryNames.get(entry.categoryId) || "Khoản chưa đặt tên")}</strong><span>${formatDate(entry.date)} · ${escapeHtml(categoryNames.get(entry.categoryId) || "Mục đã xóa")}</span></div>
          <b>${formatCurrency(entry.amount)}</b>
        </div>
      `).join("")
    : `<div class="mobile-flow-empty">Chưa có khoản ${type === "income" ? "thu" : "chi"} trong kỳ này.</div>`;
}

function setMobileCashFlowPanel(type, view, innerTarget = null) {
  if (!USE_MOBILE_APP_THEME) return;
  const panel = document.querySelector(`[data-tab-panel="${type}"]`);
  if (!panel) return;
  const current = panel.dataset.mobileFlowView || "";
  const reportOpen = current === "report" || current === "report-history";
  const historyOpen = current === "history" || current === "report-history";
  let next = "";
  if (view === "manage") next = "manage";
  if (view === "report") next = historyOpen ? "report-history" : "report";
  if (view === "history") next = reportOpen ? "report-history" : "history";
  if (view === "close-report") next = historyOpen ? "history" : "";
  if (view === "close-history") next = reportOpen ? "report" : "";
  panel.dataset.mobileFlowView = next;
  const target = view === "manage"
    ? panel.querySelector(`[data-mobile-flow-panel="manage"]${innerTarget ? ` ${innerTarget}` : ""}`)
    : view === "history" || next === "history"
      ? panel.querySelector(".mobile-flow-history-overview")
      : view === "report" || next === "report"
        ? panel.querySelector('[data-mobile-flow-panel="report"]')
        : panel.querySelector(".mobile-cash-flow");
  window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
        : isAdminUser()
          ? `<button class="delete-small" type="button" data-delete-order="${order.id}" title="Xóa đơn" aria-label="Xóa đơn">×</button>`
          : "";

      return `
        <tr class="sales-order-row ${cancelled ? "entry-cancelled" : ""}" data-open-sales-order="${order.id}">
          <td class="sales-bill-code">${escapeHtml(order.billCode || "—")}</td>
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

  els.salesOrderDetailStatus.innerHTML = cancelled ? '<span class="cancelled-pill">Đã hủy</span>' : '<span class="completed-pill">Hoàn thành</span>';
  els.salesOrderDetailContent.innerHTML = `
    <dl class="order-detail-meta" aria-label="Thông tin đơn hàng">
      <div>
        <dt>Mã bill</dt>
        <dd>${escapeHtml(order.billCode || "—")}</dd>
      </div>
      <div>
        <dt>Ngày bán</dt>
        <dd>${escapeHtml(dateText)}</dd>
      </div>
      <div>
        <dt>Khách hàng</dt>
        <dd>${escapeHtml(order.customerName || "—")}</dd>
      </div>
      <div>
        <dt>Số điện thoại</dt>
        <dd>${escapeHtml(order.customerPhone || "—")}</dd>
      </div>
    </dl>
    <div class="order-detail-main">
      <section class="order-detail-items-section">
        <div class="order-detail-section-heading">
          <h3>Hàng hóa đã mua</h3>
          <span>${(order.items || []).length} mặt hàng</span>
        </div>
        ${renderSalesOrderItemLines(order.items || []) || '<div class="empty-list">Không có hàng hóa</div>'}
      </section>
      <aside class="order-detail-summary" aria-label="Tổng tiền đơn hàng">
        <div>
          <span>${discountTotal > 0 ? "Tạm tính" : "Tổng bill"}</span>
          <strong>${formatCurrency(subtotal)}</strong>
        </div>
        ${discountTotal > 0 ? `<div><span>Chiết khấu đơn</span><strong class="order-detail-discount">-${formatCurrency(discountTotal)}</strong></div>` : ""}
        ${discountTotal > 0 ? `<div class="order-detail-grand-total"><span>Thanh toán</span><strong>${formatCurrency(total)}</strong></div>` : ""}
      </aside>
    </div>
  `;
  els.salesOrderDetailModal.hidden = false;
  document.body.classList.add("sales-order-detail-open");
  window.setTimeout(() => els.closeSalesOrderDetail?.focus({ preventScroll: true }), 0);
}

function closeSalesOrderDetailModal() {
  els.salesOrderDetailModal.hidden = true;
  els.salesOrderDetailContent.innerHTML = "";
  document.body.classList.remove("sales-order-detail-open");
}

function renderSalesOrderItemLines(items) {
  if (!items.length) return "";
  return `
    <div class="order-detail-products" role="table" aria-label="Danh sách hàng hóa trong đơn">
      <div class="order-detail-products-header" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Hàng hóa</span>
        <span role="columnheader">SL</span>
        <span role="columnheader">Đơn giá</span>
        <span role="columnheader">Giảm</span>
        <span role="columnheader">Thành tiền</span>
      </div>
      <div class="order-detail-product-list" role="rowgroup">
        ${items.map((item, index) => renderSalesOrderItemLine(item, index)).join("")}
      </div>
    </div>
  `;
}

function renderSalesOrderItemLine(item, index = 0) {
  const quantity = Number(item.quantity || 0);
  const originalPrice = Number(item.originalPrice || item.price || 0);
  const originalTotal = originalPrice * quantity;
  const finalTotal = Number(item.total || 0);
  const finalPrice = Number(item.price || (quantity > 0 ? finalTotal / quantity : 0));
  const discountTotal = Math.max(0, originalTotal - finalTotal);
  const hasDiscount = discountTotal > 0;

  return `
    <div class="order-detail-product-row" role="row">
      <span class="order-detail-product-index" role="cell">${index + 1}</span>
      <strong class="order-detail-product-name" role="cell">${escapeHtml(item.name || "")}</strong>
      <span class="order-detail-product-quantity" role="cell" data-label="SL">${quantity}</span>
      <span class="order-detail-product-price" role="cell" data-label="Đơn giá">
        ${hasDiscount ? `<span class="old-value">${formatCurrency(originalPrice)}</span>` : ""}
        <span>${formatCurrency(finalPrice)}</span>
      </span>
      <span class="order-detail-product-discount" role="cell" data-label="Giảm">${hasDiscount ? `-${formatCurrency(discountTotal)}` : "—"}</span>
      <strong class="order-detail-product-total" role="cell" data-label="Thành tiền">${formatCurrency(finalTotal)}</strong>
    </div>
  `;
}

function renderSalesDraftList(drafts) {
  if (!els.salesDraftList) return;

  if (isEmployeeUser() && !employeeCan("sales", "draft")) {
    els.salesDraftList.innerHTML = "";
    return;
  }

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

  const canDeleteDraft = !isEmployeeUser();
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
          ${
            canDeleteDraft
              ? `<td><button class="delete-small" type="button" data-delete-sales-draft="${draft.id}" title="Xóa đơn đang lưu" aria-label="Xóa đơn đang lưu">×</button></td>`
              : ""
          }
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
            ${canDeleteDraft ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderInventory(store) {
  if (!els.inventoryList || !store) return;

  if (isEmployeeUser() && !employeeCan("purchase", "inventoryView")) {
    els.inventoryList.innerHTML = "";
    if (els.inventorySummary) els.inventorySummary.innerHTML = "";
    return;
  }

  const canManageInventory = !isEmployeeUser();

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
          <div class="inventory-item" ${
            canManageInventory
              ? `data-edit-inventory="${escapeHtml(item.id || "")}" role="button" tabindex="0"`
              : ""
          }>
            <div class="inventory-main">
              <span class="inventory-group-row">
                <span class="inventory-group">${escapeHtml(item.groupName || "Chưa phân nhóm")}</span>
                ${
                  canManageInventory
                    ? `<button class="inventory-export-button" type="button" data-export-inventory="${escapeHtml(item.id || "")}" ${quantity <= 0 ? "disabled" : ""}>Xuất</button>`
                    : ""
                }
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
                  <tr class="${index > 0 ? "inventory-log-extra" : ""}" ${
                    isAdminUser()
                      ? `data-edit-inventory-log="${escapeHtml(log.id)}" title="Bấm để sửa lịch sử kho"`
                      : ""
                  }>
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
                    <td>${renderInventoryLogPrice(log.oldPrice, log.newPrice)}</td>
                    <td>${renderInventoryLogPrice(getInventoryLogOldSalePrice(log), getInventoryLogNewSalePrice(log))}</td>
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

  const exactQuery = String(rawQuery || "").normalize("NFC").toLocaleLowerCase("vi").trim().replace(/\s+/g, " ");
  const exactMatches = logs.filter(
    (log) => String(log?.itemName || "").normalize("NFC").toLocaleLowerCase("vi").trim().replace(/\s+/g, " ") === exactQuery
  );
  if (exactMatches.length) return exactMatches;

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

  const availableNameTerms = [...nameTerms];
  const termDistances = queryTerms.map((queryTerm) => {
    if (!availableNameTerms.length) return 1;

    const distances = availableNameTerms.map((nameTerm) =>
      queryTerm.length <= 2
        ? (queryTerm === nameTerm ? 0 : 1)
        : getNormalizedEditDistance(queryTerm, nameTerm)
    );
    const bestDistance = Math.min(...distances);
    availableNameTerms.splice(distances.indexOf(bestDistance), 1);
    return bestDistance;
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

function renderInventoryLogPrice(oldPrice, newPrice) {
  const oldValue = Number(oldPrice || 0);
  const newValue = Number(newPrice || 0);

  if (oldValue === newValue) {
    return `<span class="inventory-log-change"><span class="new-value">${formatCurrency(newValue)}</span></span>`;
  }

  return `
    <span class="inventory-log-change">
      <span class="old-value">${formatCurrency(oldValue)}</span>
      <span class="change-arrow">→</span>
      <span class="new-value">${formatCurrency(newValue)}</span>
    </span>
  `;
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

function scheduleHistorySearchRender(type, immediate = false) {
  const normalizedType = type === "expense" ? "expense" : "income";
  if (historySearchRenderTimers[normalizedType]) {
    window.clearTimeout(historySearchRenderTimers[normalizedType]);
    historySearchRenderTimers[normalizedType] = null;
  }

  if (immediate) {
    renderHistorySearchResults(normalizedType);
    return;
  }

  historySearchRenderTimers[normalizedType] = window.setTimeout(() => {
    historySearchRenderTimers[normalizedType] = null;
    renderHistorySearchResults(normalizedType);
  }, IS_IOS_DEVICE ? 220 : 120);
}

function renderHistorySearchResults(type) {
  const store = getActiveStore();
  if (!store) return;

  const isIncome = type === "income";
  const range = getDateRange();
  const filter = isIncome ? els.incomeHistoryFilter : els.expenseHistoryFilter;
  const search = isIncome ? els.incomeHistorySearch : els.expenseHistorySearch;
  const count = isIncome ? els.incomeEntryCount : els.expenseEntryCount;
  const total = isIncome ? els.incomeHistoryTotal : els.expenseHistoryTotal;
  const table = isIncome ? els.incomeEntryTable : els.expenseEntryTable;

  const entries = store.entries
    .filter((entry) => {
      if (entry.date < range.start || entry.date > range.end) return false;
      if (isIncome) return entry.type === "income" && !entry.orderId;
      return entry.type === "expense";
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  const filteredEntries = filterEntriesBySearch(filterEntriesByCategory(entries, filter?.value), search?.value);

  count.textContent = `${filteredEntries.length} dòng`;
  total.innerHTML = `
    <span class="report-name">Tổng cộng</span>
    <span class="report-amount">${formatCurrency(
      sumEntries(filteredEntries.filter((entry) => !isCancelledEntry(entry)))
    )}</span>
  `;
  renderEntryTable(table, store, filteredEntries);
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

  const suggestions = [...notes.values()].sort((a, b) => a.localeCompare(b, "vi"));
  const type = container === els.expenseHistorySearchSuggestions ? "expense" : "income";
  historySearchSuggestionCache[type] = suggestions.map((note) => ({
    note,
    normalized: normalizeSearchText(note)
  }));

  container.innerHTML = suggestions
    .map((note) => `<option value="${escapeHtml(note)}"></option>`)
    .join("");

  const input = type === "income" ? els.incomeHistorySearch : els.expenseHistorySearch;
  if (IS_IOS_DEVICE && document.activeElement === input) {
    renderIosHistorySuggestions(type);
  }
}

function configureIosHistorySearch() {
  if (!IS_IOS_DEVICE) return;

  document.body.classList.add("is-ios-device");
  [
    [els.incomeHistorySearch, els.incomeIosHistorySuggestions],
    [els.expenseHistorySearch, els.expenseIosHistorySuggestions]
  ].forEach(([input, suggestions]) => {
    if (!input || !suggestions) return;
    input.removeAttribute("list");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", suggestions.id);
    input.setAttribute("aria-expanded", "false");
  });
}

function renderIosHistorySuggestions(type) {
  if (!IS_IOS_DEVICE) return;

  const normalizedType = type === "expense" ? "expense" : "income";
  const input = normalizedType === "income" ? els.incomeHistorySearch : els.expenseHistorySearch;
  const container =
    normalizedType === "income" ? els.incomeIosHistorySuggestions : els.expenseIosHistorySuggestions;
  if (!input || !container) return;

  const query = normalizeSearchText(input.value);
  if (!query) {
    hideIosHistorySuggestions(normalizedType);
    return;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const prefixMatches = [];
  const otherMatches = [];
  historySearchSuggestionCache[normalizedType].forEach((suggestion) => {
    if (!terms.every((term) => suggestion.normalized.includes(term))) return;
    if (suggestion.normalized.startsWith(query)) {
      prefixMatches.push(suggestion);
    } else {
      otherMatches.push(suggestion);
    }
  });
  const matches = [...prefixMatches, ...otherMatches].slice(0, 20);

  if (!matches.length) {
    hideIosHistorySuggestions(normalizedType);
    return;
  }

  container.innerHTML = matches
    .map(
      ({ note }) =>
        `<button class="ios-history-suggestion" type="button" role="option" data-ios-history-suggestion data-history-type="${normalizedType}">${escapeHtml(note)}</button>`
    )
    .join("");
  container.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function hideIosHistorySuggestions(type) {
  if (!IS_IOS_DEVICE) return;

  const normalizedType = type === "expense" ? "expense" : "income";
  const input = normalizedType === "income" ? els.incomeHistorySearch : els.expenseHistorySearch;
  const container =
    normalizedType === "income" ? els.incomeIosHistorySuggestions : els.expenseIosHistorySuggestions;
  if (!container) return;

  container.hidden = true;
  container.innerHTML = "";
  input?.setAttribute("aria-expanded", "false");
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
  setMobileCashFlowPanel(type, "history");
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
        <tr class="${cancelled ? "entry-cancelled" : ""}" data-entry-id="${escapeHtml(entry.id)}">
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

initAuthentication();

