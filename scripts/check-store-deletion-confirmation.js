const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
 try{for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]){
  const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:platform==='android'?'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})}),errors=[],dialogs=[];let answer=null;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message(),initial:d.defaultValue()});if(d.type()==='prompt'){if(answer===null)await d.dismiss();else await d.accept(answer);}else await d.accept();});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='store.test')return route.abort();if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});});
  await page.goto('http://store.test/');await page.evaluate(()=>{
   state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cù Lao Petshop',entries:[]},{id:'b',name:'Cửa hàng khác',entries:[]}]});authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};cloudStore.enabled=false;
   els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('stores');render();window.__saves=0;saveAndRender=()=>{window.__saves++;render();};window.__before=JSON.stringify(state);
  });
  for(answer of [null,'','sai tên','cù lao petshop','Cu Lao Petshop','Cù Lao Petshop ']){
   await page.locator('#deleteStore').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)===window.__before),true);assert.equal(await page.evaluate(()=>window.__saves),0);
  }
  assert.equal(dialogs.filter(d=>d.type==='prompt').length,6);assert.ok(dialogs.filter(d=>d.type==='prompt').every(d=>d.initial===''&&d.message.includes('Cù Lao Petshop')));assert.equal(dialogs.filter(d=>d.type==='alert').length,5);
  answer='Cù Lao Petshop';await page.locator('#deleteStore').click();assert.equal(await page.evaluate(()=>window.__saves),1);assert.deepEqual(await page.evaluate(()=>state.stores.map(s=>s.id)),['b']);assert.equal(await page.evaluate(()=>state.activeStoreId),'b');
  assert.deepEqual(errors,[]);await page.close();console.log(`Store deletion ${platform} ${width}x${height}: native blank prompt, cancel/wrong names unchanged, exact name only OK`);
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
