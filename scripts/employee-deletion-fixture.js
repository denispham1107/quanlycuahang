// Isolated Firebase-like fixture. No live Firebase credentials or network calls.
const assert=require('node:assert/strict');
function createDeletionFixture(employees) {
  const profiles=new Map(employees.map(employee=>[employee.uid,{role:'employee',active:true,storeId:'a',permissions:{},...structuredClone(employee)}]));
  const accounts=new Map(employees.map(employee=>[employee.uid,{uid:employee.uid,email:employee.email||employee.uid+'@example.test',customClaims:{}}]));
  const authFailures=new Set(),profileFailures=new Set(),calls=[];
  const business={entries:[{id:'old-entry',createdByUid:employees[0]?.uid,amount:10000}],orders:[{id:'old-order',createdByUid:employees[0]?.uid}],activity:[{actorUid:employees[0]?.uid}]};
  const snapshot=uid=>({exists:profiles.has(uid),data:()=>structuredClone(profiles.get(uid))});
  const db={collection(name){assert.equal(name,'users');return {doc(uid){return {uid,get:async()=>snapshot(uid),delete:async()=>{calls.push(['profile-delete',uid]);if(profileFailures.has(uid))throw new Error('PROFILE_DELETE_FAILED');profiles.delete(uid);}};}};},
    async runTransaction(callback){const writes=[];if(fixture.beforeTransaction)fixture.beforeTransaction();await callback({get:async ref=>snapshot(ref.uid),set(ref,value,options){assert.deepEqual(options,{merge:true});writes.push([ref.uid,value]);}});for(const [uid,value] of writes){calls.push(['revoke',uid]);profiles.set(uid,{...profiles.get(uid),...value});}}
  };
  const auth={async getUser(uid){if(!accounts.has(uid))throw Object.assign(new Error('missing'),{code:'auth/user-not-found'});return structuredClone(accounts.get(uid));},async deleteUser(uid){calls.push(['auth-delete',uid]);if(authFailures.has(uid))throw Object.assign(new Error('unavailable'),{code:'auth/internal-error'});if(!accounts.delete(uid))throw Object.assign(new Error('missing'),{code:'auth/user-not-found'});}};
  const fixture={profiles,accounts,authFailures,profileFailures,calls,business,db,auth,serverTimestamp:()=> '2026-10-08T08:00:00Z',actor:{isAdmin:true,uid:'admin'}};
  fixture.list=()=>({stores:[{id:'a',name:'Cửa hàng kiểm thử'}],employees:[...profiles].filter(([,profile])=>profile.role==='employee').map(([uid,profile])=>({...profile,uid,email:accounts.get(uid)?.email||''}))});
  return fixture;
}
module.exports={createDeletionFixture};
