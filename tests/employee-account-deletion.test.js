const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {deleteManagedEmployees}=require('../functions/employee-account-deletion');
const {createDeletionFixture}=require('../scripts/employee-deletion-fixture');
const employees=[{uid:'a',displayName:'An'},{uid:'b',displayName:'Bình'}];
const remove=(fixture,uids,extra={})=>deleteManagedEmployees({...fixture,uids,...extra});

test('admin deletes selected Auth accounts and profiles, preserving all business history',async()=>{
  const fixture=createDeletionFixture(employees),original=structuredClone(fixture.business);
  assert.deepEqual(await remove(fixture,['b','a','a']),{deletedUids:['b','a'],failed:[]});
  assert.equal(fixture.accounts.size,0);assert.equal(fixture.profiles.size,0);assert.deepEqual(fixture.business,original);
  assert.deepEqual(fixture.calls.slice(0,2),[['revoke','b'],['revoke','a']]);
});
test('rejects non-admin callers, invalid selections and deleting oneself before any mutation',async()=>{
  for(const [uids,extra,code] of [[['a'],{actor:{isAdmin:false,uid:'a'}},'FORBIDDEN'],[['a'],{actor:{isAdmin:'true',uid:'admin'}},'FORBIDDEN'],[['admin'],{},'CANNOT_DELETE_SELF'],[[],{},'INVALID_EMPLOYEE_SELECTION'],[['a','bad/id'],{},'INVALID_EMPLOYEE_SELECTION'],[Array(51).fill('a'),{},'INVALID_EMPLOYEE_SELECTION'],[[' a'],{},'INVALID_EMPLOYEE_SELECTION']]){
    const fixture=createDeletionFixture(employees);
    await assert.rejects(remove(fixture,uids,extra),error=>error.message===code);
    assert.deepEqual(fixture.calls,[]);assert.equal(fixture.profiles.get('a').active,true);
  }
});
test('preflights the whole selection and protects profile admins and Auth custom-claim admins',async()=>{
  for(const mode of ['profile','claim']){
    const fixture=createDeletionFixture(employees);
    if(mode==='profile')fixture.profiles.get('b').role='admin';else fixture.accounts.get('b').customClaims.admin=true;
    await assert.rejects(remove(fixture,['a','b']),/CANNOT_DELETE_ADMIN/);
    assert.deepEqual(fixture.calls,[]);assert.equal(fixture.profiles.get('a').active,true);
  }
});
test('fresh transaction role checks prevent deleting an account promoted after preflight',async()=>{
  const fixture=createDeletionFixture(employees);fixture.beforeTransaction=()=>{fixture.profiles.get('b').role='admin';};
  await assert.rejects(remove(fixture,['a','b']),/CANNOT_DELETE_ADMIN/);
  assert.deepEqual(fixture.calls,[]);assert.equal(fixture.profiles.get('a').active,true);
});
test('cannot delete an unrecognized Auth account without an employee profile',async()=>{
  const fixture=createDeletionFixture(employees);fixture.profiles.delete('b');
  await assert.rejects(remove(fixture,['a','b']),/EMPLOYEE_NOT_FOUND/);assert.deepEqual(fixture.calls,[]);
});
test('missing Auth account and repeated successful deletion are retry-safe',async()=>{
  const fixture=createDeletionFixture(employees);fixture.accounts.delete('a');
  assert.deepEqual(await remove(fixture,['a']),{deletedUids:['a'],failed:[]});
  assert.deepEqual(await remove(fixture,['a']),{deletedUids:['a'],failed:[]});assert.equal(fixture.profiles.has('b'),true);
});
test('partial Auth failure keeps failed employees revoked and retries without business data loss',async()=>{
  const fixture=createDeletionFixture(employees),original=structuredClone(fixture.business);fixture.authFailures.add('b');
  const result=await remove(fixture,['a','b']);assert.deepEqual(result.deletedUids,['a']);assert.deepEqual(result.failed,[{uid:'b',code:'auth/internal-error'}]);
  assert.equal(fixture.profiles.get('b').active,false);assert.equal(fixture.profiles.get('b').deletionPending,true);assert.equal(fixture.accounts.has('b'),true);
  fixture.authFailures.clear();assert.deepEqual(await remove(fixture,['b']),{deletedUids:['b'],failed:[]});assert.deepEqual(fixture.business,original);
});
test('profile deletion failure after Auth deletion is recoverable',async()=>{
  const fixture=createDeletionFixture(employees);fixture.profileFailures.add('a');
  assert.equal((await remove(fixture,['a'])).failed.length,1);assert.equal(fixture.accounts.has('a'),false);assert.equal(fixture.profiles.get('a').active,false);
  fixture.profileFailures.clear();assert.deepEqual(await remove(fixture,['a']),{deletedUids:['a'],failed:[]});
});
test('endpoint authorizes before delete, prevents reactivation and UI keeps destructive action explicit',()=>{
  const root=path.resolve(__dirname,'..'),server=fs.readFileSync(path.join(root,'functions/index.js'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const endpoint=server.slice(server.indexOf('exports.manageEmployeeAccounts'),server.indexOf('exports.getEmployeeState'));
  assert.ok(endpoint.indexOf('await requireFirebaseAdmin(req)')<endpoint.indexOf('if (action === "delete")'));
  assert.match(server,/fresh\.data\(\)\?\.deletionPending === true/);assert.match(app,/window\.confirm\(`Xóa vĩnh viễn/);
  assert.match(app,/if \(!isAdminUser\(\) \|\| employeeManagerState\.deleting\) return/);assert.match(html,/id="deleteSelectedEmployees"[^>]*disabled/);
});
