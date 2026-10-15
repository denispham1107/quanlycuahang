const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup,filterStyles,geometry,samePixels}=require('./check-desktop-trade-colors');
function pixelsSame(a,b){if(samePixels(a,b))return true;const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;let n=0;for(let i=0;i<x.data.length;i+=4){let d=0;for(let j=0;j<4;j++)d=Math.max(d,Math.abs(x.data[i+j]-y.data[i+j]));if(d>2)return false;if(d)n++;}return n<x.width*x.height*.01;}
async function prepare(page,old=false){await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(page,old);await page.evaluate(()=>{
 const s=getActiveStore(),old=new Date(today+'T12:00:00');old.setDate(old.getDate()-1);const previous=toDateInputValue(old);
 const order=(id,date,total,items,status)=>({id,date,total,createdAt:date+'T12:00:00',customerName:'Khách thử',items,status});
 s.orders=[order('a',today,100000,[{name:'Hàng A',groupName:'Hàng hóa',quantity:3,price:20000,total:60000},{name:'Dịch vụ',groupName:'Dịch vụ',itemType:'service',quantity:2,price:20000,total:40000}]),order('b',today,50000,[{name:'Hàng B',groupName:'Hàng hóa',quantity:1.5,price:33333,total:50000}]),order('c',today,999000,[{name:'Hàng A',quantity:50,total:999000}],'cancelled'),order('old',previous,17000,[{name:'Hàng cũ',quantity:7,total:17000}])];
 s.draftOrders=[{id:'draft',date:today,total:900000,items:[{name:'Hàng nháp',quantity:90,price:10000,total:900000}]}];
 window.__writes=0;saveStateToCloud=async()=>{window.__writes++;return true;};render();activateTab('sales');scrollTo(0,0);
});}
const readMobile=page=>page.evaluate(()=>[els.mobileSalesReportTotal.textContent,els.mobileSalesReportCount.textContent,els.mobileSalesCancelledCount.textContent,els.mobileSalesGoodsCount.textContent].map(s=>s.replace(/\s/g,' ')));
const readDesktop=async page=>(await page.locator('#desktopInsights strong').allTextContents()).map(s=>s.replace(/\s/g,' '));
async function layoutCheck(page,mobile){const errors=await page.evaluate(mobile=>{
 const root=document.querySelector(mobile?'.mobile-sales-report':'#desktopInsights'),r=root.getBoundingClientRect(),errors=[];
 const nodes=mobile?root.querySelectorAll('.mobile-sales-report-stat, .mobile-sales-report-stat span, .mobile-sales-report-stat strong'):root.querySelectorAll('.desktop-insight,.desktop-insight div,.desktop-insight strong');
 for(const e of nodes){const b=e.getBoundingClientRect();if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1||e.scrollWidth>e.clientWidth+1)errors.push(e.id||e.className||e.tagName);}
 if(!mobile){const cards=[...root.children].map(e=>e.getBoundingClientRect());if(cards.length!==4||Math.abs(cards[2].top-cards[3].top)>1||cards[3].left<cards[2].right)errors.push('cancelled must sit right of goods');}
 return errors;
},mobile);assert.deepEqual(errors,[],'all labels and values fit without clipping');}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1280,900],[1440,1000],[1920,1000]]){
  if(process.env.SALES_OVERVIEW_WIDTH&&width!==Number(process.env.SALES_OVERVIEW_WIDTH))continue;
  const mobile=width<700,options={viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})};
  const before=await browser.newPage(options);await prepare(before,true);const baseFilter=mobile?null:{paint:await filterStyles(before),geometry:await geometry(before,['#desktopFilterRail']),pixels:await before.locator('#desktopFilterRail').screenshot()};
  const others={};for(const tab of ['purchase','expense']){await before.evaluate(tab=>{activateTab(tab);render();scrollTo(0,0)},tab);others[tab]=await before.screenshot({animations:'disabled'});}await before.close();
  const page=await browser.newPage(options),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());await prepare(page);const actual=mobile?await readMobile(page):await readDesktop(page);
  assert.deepEqual(actual,mobile?['150.000 ₫','2 đơn','1 đơn','6,5']:['150.000 ₫','2','6,5','1']);await layoutCheck(page,mobile);
  if(!mobile){assert.deepEqual(await filterStyles(page),baseFilter.paint);assert.deepEqual(await geometry(page,['#desktopFilterRail']),baseFilter.geometry);assert.ok(pixelsSame(await page.locator('#desktopFilterRail').screenshot(),baseFilter.pixels),'left filter unchanged');}
  if(process.env.SALES_OVERVIEW_SHOTS)await page.screenshot({path:path.join(process.env.SALES_OVERVIEW_SHOTS,`sales-overview-${width}-${height}.png`),animations:'disabled'});
  await page.evaluate(()=>{els.rangeMode.value='yesterday';applyRangeModeFilter({type:'change'});});assert.deepEqual(mobile?await readMobile(page):await readDesktop(page),mobile?['17.000 ₫','1 đơn','0 đơn','7']:['17.000 ₫','1','7','0']);
  await page.evaluate(()=>{const s=normalizeState({activeStoreId:'other',stores:[{id:'other',name:'Cửa hàng khác',orders:[{date:today,total:8000,items:[{name:'Khác',quantity:4}]}]}]}).stores[0];state.stores.push(s);state.activeStoreId='other';els.rangeMode.value='today';applyRangeModeFilter({type:'change'});});assert.deepEqual(mobile?await readMobile(page):await readDesktop(page),mobile?['8.000 ₫','1 đơn','0 đơn','4']:['8.000 ₫','1','4','0']);
  await page.evaluate(()=>{getActiveStore().orders=[];render();});assert.deepEqual(mobile?await readMobile(page):await readDesktop(page),mobile?['0 ₫','0 đơn','0 đơn','0']:['0 ₫','0','0','0']);
  await page.evaluate(()=>{getActiveStore().orders=[{date:today,total:999000,status:'cancelled',items:[{quantity:500}]}];render();});assert.deepEqual(mobile?await readMobile(page):await readDesktop(page),mobile?['0 ₫','0 đơn','1 đơn','0']:['0 ₫','0','0','1']);
  await page.evaluate(()=>{getActiveStore().orders=[{date:today,total:99999999999999,items:[{name:'Số lớn',quantity:9999999999999.5}]}];render();});await layoutCheck(page,mobile);
  await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{sales:{view:true,create:false}}};state.activeStoreId='test';render();});assert.deepEqual(mobile?await readMobile(page):await readDesktop(page),mobile?['150.000 ₫','2 đơn','1 đơn','6,5']:['150.000 ₫','2','6,5','1']);assert.equal(await page.locator('#quickEntryButton').isVisible(),false);
  await page.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};render();});for(const tab of ['purchase','expense']){await page.evaluate(tab=>{activateTab(tab);render();scrollTo(0,0);document.activeElement?.blur()},tab);await page.mouse.move(0,0);const actual=await page.screenshot({animations:'disabled'});if(!pixelsSame(actual,others[tab])&&process.env.SALES_OVERVIEW_SHOTS){fs.writeFileSync(path.join(process.env.SALES_OVERVIEW_SHOTS,`sales-other-${tab}-before-${width}.png`),others[tab]);fs.writeFileSync(path.join(process.env.SALES_OVERVIEW_SHOTS,`sales-other-${tab}-after-${width}.png`),actual);}assert.ok(pixelsSame(actual,others[tab]),`${tab} unchanged`);}
  assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(errors,[]);await page.close();console.log(`${mobile?'Mobile':'Desktop'} ${width}x${height}: correct live totals/counts, cancellation, units, range/store changes, empty/large values, employee view and preserved filters/other tabs OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
