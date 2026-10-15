const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { setup, samePixels } = require('./check-desktop-trade-colors');

const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
async function snapshot(page) {
  return page.locator('#quickEntryForm').evaluate(form => [...form.querySelectorAll('*')].map(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return { id: e.id, rect: [r.x,r.y,r.width,r.height], font: [s.fontSize,s.fontWeight,s.lineHeight],
      paint: e.closest('#openBulkCashPage') ? null : [s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow] };
  }));
}
async function main() {
  const browser = await chromium.launch({headless:true, executablePath:process.env.BULK_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    for (const [width,height,mobile] of [[320,700,true],[375,812,true],[430,900,true],[667,375,true],[375,400,true],[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false]]) {
      for (const type of ['income','expense']) {
        const pages = [];
        for (const old of [true,false]) {
          const p = await browser.newPage({viewport:{width,height}, ...(mobile ? {isMobile:true,hasTouch:true,userAgent:mobileUA} : {})});
          await p.clock.setFixedTime(new Date('2026-10-15T12:00:00'));
          await setup(p,old);
          await p.evaluate(type => {
            window.testWrites = 0;
            saveStateToCloud = () => { window.testWrites++; };
            getActiveStore().categories[type] = [{id:'test-category',name:'Mục thử'}];
            activateTab(type); render(); openQuickEntryModal(type);
          },type);
          await p.locator('#quickEntryNote').fill('Nội dung nháp');
          await p.waitForTimeout(150);
          pages.push(p);
        }
        const [before,page] = pages;
        assert.deepEqual(await snapshot(page),await snapshot(before),`${type} ${width}: geometry, fonts and other paints unchanged`);
        if (mobile) {
          const paint = await page.locator('#openBulkCashPage').evaluate(e => {
            const s=getComputedStyle(e),r=e.getBoundingClientRect();
            const range=document.createRange();range.selectNodeContents(e);
            return {bg:s.backgroundImage,color:s.color,border:s.borderTopColor,width:r.width,height:r.height,lines:range.getClientRects().length,overflow:e.scrollWidth>e.clientWidth};
          });
          assert.ok(paint.bg.includes('rgb(238, 232, 251)') && paint.bg.includes('rgb(226, 234, 250)'));
          assert.equal(paint.color,'rgb(91, 79, 139)');
          assert.equal(paint.border,'rgb(206, 199, 233)');
          assert.ok(paint.height >= 44 && !paint.overflow);
          await page.locator('#openBulkCashPage').focus();
          assert.equal(await page.locator('#openBulkCashPage').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
          await page.locator('#openBulkCashPage').press('Enter');
          assert.equal(await page.locator('#bulkCashPage').isVisible(),true);
          assert.equal(await page.locator('#bulkCashPage').getAttribute('data-type'),type);
          await page.locator('#closeBulkCashPage').click();
          await page.waitForFunction(()=>document.querySelector('#bulkCashPage').hidden);
          assert.equal(await page.locator('#quickEntryNote').inputValue(),'Nội dung nháp');
          if(width===375 && height===812) await page.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-soft-button-${type}.png`});
        } else {
          assert.ok(samePixels(await before.locator('#quickEntryForm').screenshot(),await page.locator('#quickEntryForm').screenshot()),`${type} ${width}: desktop pixels unchanged`);
        }
        assert.equal(await page.evaluate(()=>window.testWrites),0);
        for(const p of pages) await p.close();
        console.log(`${type} ${width}x${height}: approved paint/scope, layout, draft and no writes OK`);
      }
    }
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
