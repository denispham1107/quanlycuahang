const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../app.js'),'utf8');
function createCloudHarness({state={stores:[]},read=async()=>snapshot({stores:[{id:'remote'}]})}={}) {
 const timers=new Map(),listeners=[],messages=[],writes=[],events={};let next=0;
 const doc={onSnapshot:(_options,next,error)=>{const l={next,error,closed:false};listeners.push(l);return()=>l.closed=true},set:v=>{writes.push(v);return Promise.resolve()}};
 const db={collection:()=>({doc:()=>doc})};
 const window={setTimeout:(f,ms)=>{timers.set(++next,{f,ms});return next},clearTimeout:id=>timers.delete(id),firebase:{apps:[],initializeApp:()=>({}),firestore:()=>db},CloudSyncCore:{readDocument:(...args)=>read(...args)}};
 const context={window,document:{hidden:false,addEventListener:(name,fn)=>events[name]=fn,querySelector:()=>null},navigator:{onLine:true},Date,console:{warn:()=>{},error:()=>{}},cloudStore:{},cloudSyncGeneration:0,cloudMutationVersion:0,employeeLoadAttempt:0,pendingAdminCloudWrites:new Set(),authState:{ready:true,user:{uid:'u'},profile:{role:'admin'}},state,els:{appShell:{hidden:false}},getFirebaseConfig:()=>({projectId:'test',apiKey:'test'}),getConfiguredFirestore:()=>db,getFirestorePath:()=>({collection:'data',document:'shared'}),normalizeState:v=>v,saveStateToCache:()=>{++context.cloudMutationVersion;},render:()=>{},updateSyncStatus:(...v)=>messages.push(v),showAuthProblem:()=>{},isEmployeeUser:()=>false,loadEmployeeState:async()=>true};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function stopCloudStorage()'),source.indexOf('function applyRoleAccess()')),context);vm.runInContext(source.slice(source.indexOf('function initCloudStorage()'),source.indexOf('function getEmployeeFunctionUrl(')),context);
 return{context,timers,listeners,messages,writes,events,fire(ms){const selected=[...timers].find(([,t])=>t.ms===ms);if(!selected)throw Error('timer missing '+ms);timers.delete(selected[0]);return selected[1].f()}};
}
function snapshot(state,{cached=false,revision='2026-10-14T00:00:00Z'}={}){return{exists:true,metadata:{fromCache:cached},data:()=>({state,updatedAt:revision})}}
module.exports={createCloudHarness,snapshot};
