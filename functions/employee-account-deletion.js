"use strict";
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function deleteManagedEmployees({uids,actor,db,auth,serverTimestamp}){
  if(actor?.isAdmin!==true||!actor.uid)fail("FORBIDDEN",403);
  if(!Array.isArray(uids)||!uids.length||uids.length>50||uids.some(uid=>typeof uid!=="string"||!uid||uid.trim()!==uid||uid.length>128||uid.includes('/')))fail("INVALID_EMPLOYEE_SELECTION");
  const ids=[...new Set(uids)];
  if(ids.includes(actor.uid))fail("CANNOT_DELETE_SELF",403);
  // Validate the whole selection before revoking or deleting any account.
  const targets=await Promise.all(ids.map(async uid=>{
    const ref=db.collection("users").doc(uid);
    const [profile,user]=await Promise.all([ref.get(),auth.getUser(uid).catch(error=>{if(error.code==="auth/user-not-found")return null;throw error;})]);
    if(user?.customClaims?.admin===true)fail("CANNOT_DELETE_ADMIN",403);
    if(profile.exists&&profile.data()?.role!=="employee")fail("CANNOT_DELETE_ADMIN",403);
    if(!profile.exists&&user)fail("EMPLOYEE_NOT_FOUND",404);
    return {uid,ref};
  }));
  await db.runTransaction(async transaction=>{
    const snapshots=await Promise.all(targets.map(target=>transaction.get(target.ref)));
    snapshots.forEach(snapshot=>{if(snapshot.exists&&snapshot.data()?.role!=="employee")fail("CANNOT_DELETE_ADMIN",403);});
    targets.forEach((target,index)=>{
      if(snapshots[index].exists)transaction.set(target.ref,{active:false,deletionPending:true,deletionRequestedBy:actor.uid,updatedAt:serverTimestamp()},{merge:true});
    });
  });
  const deletedUids=[],failed=[];
  // Small concurrent batches keep the endpoint bounded without broad Auth bulk deletes.
  for(let offset=0;offset<targets.length;offset+=5){
    await Promise.all(targets.slice(offset,offset+5).map(async target=>{
      try{
        await auth.deleteUser(target.uid).catch(error=>{if(error.code!=="auth/user-not-found")throw error;});
        await target.ref.delete();
        deletedUids.push(target.uid);
      }catch(error){failed.push({uid:target.uid,code:String(error.code||error.message||"DELETE_FAILED").slice(0,100)});}
    }));
  }
  return {deletedUids,failed};
}
module.exports={deleteManagedEmployees};
