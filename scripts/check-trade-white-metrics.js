const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{chromium}=require('playwright');
const {setup,filterStyles,geometry,samePixels}=require('./check-desktop-trade-colors');
const {PNG}=require('pngjs');
function pixelsSame(a,b){if(samePixels(a,b))return true;const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;let changed=0,rounded=0;for(let i=0;i<x.data.length;i+=4){let delta=0;for(let j=0;j<4;j++)delta=Math.max(delta,Math.abs(x.data[i+j]-y.data[i+j]));if(delta>5)return false;if(delta>2)rounded++;if(delta)changed++;}return rounded<=4&&changed<x.width*x.height*.01;}
const paint=page=>page.locator('[data-tab-panel="overview"] .metric').first().evaluate(e=>{const s=getComputedStyle(e);return ['backgroundColor','backgroundImage','borderColor','borderWidth','borderRadius','boxShadow','padding','minHeight'].map(p=>s[p]);});
async function prepare(page,old=false){await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(page,old);await page.evaluate(()=>{window.__writes=0;saveStateToCloud=async()=>{window.__writes++};render();scrollTo(0,0)});}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[800,900],[1024,900],[1280,900],[1440,1000],[1920,1000],[320,700],[375,900],[430,900],[667,375],[375,400]]){
  if(process.env.WHITE_METRIC_WIDTH&&width!==Number(process.env.WHITE_METRIC_WIDTH))continue;
  const mobile=width<700,options={viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})};
  const before=await browser.newPage(options);await prepare(before,true);const base={};
  for(const tab of ['sales','purchase','overview','income','expense']){await before.evaluate(t=>{activateTab(t);render();scrollTo(0,0)},tab);base[tab]={pixels:await before.screenshot({animations:'disabled'}),values:await before.locator('#desktopInsights').textContent(),filter:mobile?null:{pixels:await before.locator('#desktopFilterRail').screenshot(),paint:await filterStyles(before),geometry:await geometry(before,['#desktopFilterRail'])}};}
  await before.close();
  const page=await browser.newPage(options),errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page);const overviewPaint=await paint(page);
  for(const tab of ['sales','purchase','overview','income','expense']){
   await page.evaluate(t=>{activateTab(t);render();scrollTo(0,0)},tab);
   assert.equal(await page.locator('#desktopInsights').textContent(),base[tab].values,'All metric labels and values unchanged');
   if(mobile||!['sales','purchase'].includes(tab)){const pixels=await page.screenshot({animations:'disabled'});if(!pixelsSame(pixels,base[tab].pixels)&&process.env.WHITE_METRIC_SHOTS){fs.writeFileSync(path.join(process.env.WHITE_METRIC_SHOTS,`white-before-${tab}-${width}.png`),base[tab].pixels);fs.writeFileSync(path.join(process.env.WHITE_METRIC_SHOTS,`white-after-${tab}-${width}.png`),pixels);}assert.ok(pixelsSame(pixels,base[tab].pixels),`${tab} ${width}: unaffected view pixel-identical (minor raster rounding only)`);}
   else{
    if(process.env.WHITE_METRIC_SHOTS)await page.screenshot({path:path.join(process.env.WHITE_METRIC_SHOTS,`white-${tab}-${width}.png`),animations:'disabled'});
    assert.deepEqual(await filterStyles(page),base[tab].filter.paint);assert.deepEqual(await geometry(page,['#desktopFilterRail']),base[tab].filter.geometry);assert.ok(samePixels(await page.locator('#desktopFilterRail').screenshot(),base[tab].filter.pixels),'Filter pixels unchanged');
    const cards=await page.locator('#desktopInsights .desktop-insight').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),v=e.querySelector('strong'),label=e.querySelector(':scope > div > span'),vs=getComputedStyle(v),ls=getComputedStyle(label),r=e.getBoundingClientRect(),b=v.getBoundingClientRect();return {paint:['backgroundColor','backgroundImage','borderColor','borderWidth','borderRadius','boxShadow','padding','minHeight'].map(p=>s[p]),icon:getComputedStyle(e.querySelector('.desktop-insight-icon')).display,labelFont:ls.fontSize,labelColor:ls.color,valueMargin:vs.marginTop,fit:b.right<=r.right&&v.scrollWidth<=v.clientWidth+1};}));
    assert.equal(cards.length,4);for(const card of cards){assert.deepEqual(card.paint,overviewPaint,'Metric surfaces match Overview exactly');assert.equal(card.icon,'none');assert.equal(card.labelFont,'13px');assert.equal(card.labelColor,'rgb(83, 102, 134)');assert.equal(card.valueMargin,'21px');assert.ok(card.fit);}
    if(process.env.WHITE_METRIC_SHOTS)await page.screenshot({path:path.join(process.env.WHITE_METRIC_SHOTS,`white-${tab}-${width}.png`),animations:'disabled'});
    await page.evaluate(()=>{document.querySelectorAll('#desktopInsights strong').forEach(e=>e.textContent='999.999.999.999.999 ₫')});assert.ok(await page.locator('#desktopInsights strong').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'Large values fit');
   }
  }
  assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(errors,[]);await page.close();console.log(`${mobile?'Mobile':'Desktop'} ${width}x${height}: white Overview metrics, hidden icons, preserved data/filter/other views OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
