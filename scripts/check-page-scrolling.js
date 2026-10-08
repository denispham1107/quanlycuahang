const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const layers=['closingPosModal','quickEntryModal','bulkCashPage','salesCatalogPage','customersPage','employeeManagerPage','activityHistoryPage','closingBookPage','inventoryModal','inventoryHistoryModal','editInventoryModal','exportInventoryModal','editInventoryLogModal','salesOrderDetailModal','orderDiscountModal','salesCustomerCatalogModal','customerHistoryModal','memberTierModal','editEntryModal','aiChatModal'];
async function main() {
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,args:['--disable-features=OverlayScrollbar,OverlayScrollbars'],...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try {
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
      await page.route('**/*',route=> {
        const url=new URL(route.request().url());if(url.hostname!=='scroll.test')return route.abort();
        if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
      });
      await page.goto('http://scroll.test/');
      await page.evaluate(()=> {
        const stamp=new Date().toISOString(),date=stamp.slice(0,10),month=date.slice(0,7);
        const inventory=Array.from({length:30},(_,i)=>({id:'stock'+i,name:'Hàng hóa '+i,groupName:'Nhóm hàng',quantity:10,lastPrice:10000,salePrice:20000,totalCost:100000,updatedAt:date}));
        const entries=Array.from({length:30},(_,i)=>({id:'entry'+i,type:i%2?'expense':'income',note:'Khoản '+i,amount:20000,categoryId:i%2?'e':'i',date,createdAt:stamp}));
        const customers=Array.from({length:30},(_,i)=>({id:'customer'+i,name:'Khách '+i,phone:'090000'+String(i).padStart(4,'0'),memberTier:'Thường',createdAt:stamp}));
        const orders=[{id:'order0',date,createdAt:stamp,customerName:'Khách 0',customerPhone:customers[0].phone,total:20000,items:inventory.map(item=>({name:item.name,quantity:1,price:20000,total:20000}))}];
        const shift=ClosingBookCore.emptyShift();for(const type of ['income','expense'])shift[type]=Array.from({length:12},(_,i)=>({id:type+i,note:'Khoản '+type+' '+i,amount:10000,categoryId:type==='income'?'i':'e',createdAt:stamp}));
        state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Kiểm thử cuộn',categories:{income:[{id:'i',name:'Mục Thu'}],expense:[{id:'e',name:'Mục Chi'}]},entries,inventory,inventoryLogs:[{id:'log0',type:'purchase',date,name:'Hàng hóa 0',groupName:'Nhóm hàng',quantity:10,price:10000,total:100000}],customers,orders,closingMonths:[{month,days:[{date:month+'-01',updatedAt:stamp,shifts:[shift]}]}]}]});
        authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin-test'};
        cloudStore.enabled=false;loadEmployeeAccounts=async()=>{};
        els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
        window.scrollTo(0,150);
      });
      const cases=[
        ['Thu','quickEntryModal',"openQuickEntryModal('income')","closeQuickEntryModal()"],
        ['Chi','quickEntryModal',"openQuickEntryModal('expense')","closeQuickEntryModal()"],
        ['Thu từ danh sách','bulkCashPage',"openQuickEntryModal('income');openBulkCashPage()","hideBulkCashPage({restoreFocus:false});closeQuickEntryModal()"],
        ['Chi từ danh sách','bulkCashPage',"openQuickEntryModal('expense');openBulkCashPage()","hideBulkCashPage({restoreFocus:false});closeQuickEntryModal()"],
        ['Bán hàng','quickEntryModal',"openSalesOrderModal(getActiveStore());for(let i=0;i<8;i++)addSalesItemRow()","closeQuickEntryModal()"],
        ['Nhập hàng','quickEntryModal',"openPurchaseOrderModal(getActiveStore());for(let i=0;i<8;i++)addPurchaseItemRow()","closeQuickEntryModal()"],
        ['Nhập từ danh sách','quickEntryModal',"openBulkPurchaseModal(getActiveStore())","closeQuickEntryModal()"],
        ['Mục lục hàng hóa','salesCatalogPage',"openSalesOrderModal(getActiveStore());openSalesCatalogPage(els.salesItems.querySelector('.sales-item-row'))","hideSalesCatalogPage({restoreFocus:false});closeQuickEntryModal()"],
        ['Khách hàng','customersPage',"openCustomersPage()","hideCustomersPage({restoreFocus:false})"],
        ['Quản lý nhân viên','employeeManagerPage',"openEmployeeManagerPage()","hideEmployeeManagerPage({restoreFocus:false})"],
        ['Lịch sử hoạt động','activityHistoryPage',"openActivityHistoryPage()","hideActivityHistoryPage({restoreFocus:false})"],
        ['Chốt sổ','closingBookPage',"openClosingBookPage()","hideClosingBookPage({force:true})"],
        ['Kiểm kê','closingBookPage',"openClosingBookPage();openClosingBookAudit()","hideClosingBookPage({force:true})"],
        ['Chuyển POS','closingPosModal',"openClosingBookPage();openClosingPosModal()","closeClosingPosModal();hideClosingBookPage({force:true})"],
        ['Chi tiết Thu','closingBookPage',"openClosingBookPage();openClosingBookDetails('income')","hideClosingBookPage({force:true})"],
        ['Chi tiết Chi','closingBookPage',"openClosingBookPage();openClosingBookDetails('expense')","hideClosingBookPage({force:true})"],
        ['Kho hàng','inventoryModal',"openInventoryModal()","closeInventoryModal()"],
        ['Lịch sử kho','inventoryHistoryModal',"openInventoryModal();openInventoryHistoryModal()","closeInventoryHistoryModal();closeInventoryModal()"],
        ['Sửa hàng','editInventoryModal',"openInventoryModal();openEditInventoryModal('stock0')","closeEditInventoryModal();closeInventoryModal()"],
        ['Xuất kho','exportInventoryModal',"openInventoryModal();openExportInventoryModal('stock0')","closeExportInventoryModal();closeInventoryModal()"],
        ['Sửa lịch sử kho','editInventoryLogModal',"openEditInventoryLogModal('log0')","closeEditInventoryLogModal()"],
        ['Chi tiết đơn bán','salesOrderDetailModal',"openSalesOrderDetail('order0')","closeSalesOrderDetailModal()"],
        ['Chiết khấu','orderDiscountModal',"openSalesOrderModal(getActiveStore());openOrderDiscountModal()","closeOrderDiscountModal();closeQuickEntryModal()"],
        ['Chọn khách','salesCustomerCatalogModal',"openSalesOrderModal(getActiveStore());openSalesCustomerCatalogModal()","closeSalesCustomerCatalogModal();closeQuickEntryModal()"],
        ['Lịch sử khách','customerHistoryModal',"openCustomersPage();openCustomerHistory('customer0')","closeCustomerHistoryModal();hideCustomersPage({restoreFocus:false})"],
        ['Gói thành viên','memberTierModal',"openCustomersPage();openMemberTierInfo('customer0')","closeMemberTierModal();hideCustomersPage({restoreFocus:false})"],
        ['Sửa khoản','editEntryModal',"openEditEntryModal(getActiveStore(),getActiveStore().entries[0])","closeEditEntryModal()"],
        ['ChatGPT AI','aiChatModal',"openAIChat()","closeAIChat()"]
      ];
      const covered=new Set();
      for(const [name,id,open,close] of cases) {
        await page.evaluate(code=>eval(code),open);
        assert.equal(await page.locator('#'+id).isVisible(),true,`${name} opens`);
        const snapshot=await page.evaluate(()=>({root:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY,y:scrollY,width:document.documentElement.clientWidth,viewport:innerWidth}));
        assert.equal(snapshot.root,'hidden',`${name}: root must not create a second scrollbar at ${width}x${height}`);
        assert.equal(snapshot.body,'hidden',`${name}: background body is locked`);
        assert.equal(snapshot.width,snapshot.viewport,`${name}: no outer scrollbar gutter`);
        const unlockedParents=await page.evaluate(({id,layers})=>layers.filter(other=>other!==id&&!document.getElementById(other).hidden&&getComputedStyle(document.getElementById(other)).overflowY!=='hidden'),{id,layers});
        assert.deepEqual(unlockedParents,[],`${name}: covered parent pages must not add scrollbars`);
        await page.mouse.move(width-20,height/2);await page.mouse.wheel(0,400);await page.waitForTimeout(30);
        assert.equal(await page.evaluate(()=>scrollY),snapshot.y,`${name}: wheel does not scroll the background`);
        const owner=await page.evaluate(id=> {
          const layer=document.getElementById(id);
          const scrollable=[layer,...layer.querySelectorAll('*')].find(node=> {
            const style=getComputedStyle(node),rect=node.getBoundingClientRect();
            return !node.closest('[hidden], [inert]')&&!['TEXTAREA','SELECT'].includes(node.tagName)&&['auto','scroll'].includes(style.overflowY)&&node.scrollHeight>node.clientHeight+5&&rect.width>0&&rect.height>0;
          });
          if(!scrollable)return null;
          scrollable.dataset.scrollTestOwner='true';scrollable.scrollTop=0;
          const rect=scrollable.getBoundingClientRect();
          return {x:Math.min(innerWidth-3,rect.right-8),y:Math.min(innerHeight-3,Math.max(3,rect.top+Math.min(rect.height/2,80))),id:scrollable.id,className:scrollable.className,clientHeight:scrollable.clientHeight,scrollHeight:scrollable.scrollHeight};
        },id);
        if(owner) {
          await page.mouse.move(owner.x,owner.y);await page.mouse.wheel(0,400);await page.waitForTimeout(60);
          assert.ok(await page.locator('[data-scroll-test-owner]').evaluate(node=>node.scrollTop)>0,`${name}: long content remains wheel-scrollable at ${width}x${height}: ${JSON.stringify(owner)}`);
          await page.locator('[data-scroll-test-owner]').evaluate(node=>delete node.dataset.scrollTestOwner);
          assert.equal(await page.evaluate(()=>scrollY),snapshot.y,`${name}: content scrolling still leaves the background stationary`);
        }
        await page.evaluate(ids=>ids.forEach(id=>{if(!document.getElementById(id).hidden)window.__scrollCovered=(window.__scrollCovered||[]).concat(id);}),layers);
        if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900&&['Chốt sổ','Chi tiết Chi','Nhập từ danh sách','Kho hàng'].includes(name))await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`single-scroll-${id}-${width}.png`)});
        await page.evaluate(code=>eval(code),close);
        await page.evaluate(()=>window.history.replaceState({},'','/'));
        assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden',`${name}: closing the last layer restores document scrolling`);
      }
      // A child close must keep the parent scroll lock; Back must release it only at the last layer.
      await page.evaluate(()=>{openInventoryModal();openInventoryHistoryModal();closeInventoryHistoryModal();});
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');
      await page.locator('#closeInventory').click();assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');
      await page.evaluate(()=>openClosingBookPage());await page.goBack();await page.waitForFunction(()=>closingBook.page.hidden);
      assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden','Browser Back restores scrolling');
      await page.evaluate(()=>showLoginScreen());assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden','Login also owns scrolling');
      for(const id of await page.evaluate(()=>window.__scrollCovered))covered.add(id);
      assert.deepEqual(layers.filter(id=>!covered.has(id)),[],'Every page/modal opening surface is covered');
      assert.deepEqual(errors,[]);await page.close();console.log(`${cases.length} page/modal flows, nested close, Back and login scrolling ${width}x${height}: OK`);
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
