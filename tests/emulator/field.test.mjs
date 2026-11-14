import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDocFromServer, setDoc, writeBatch, serverTimestamp, terminate } from "firebase/firestore";
import { FirestoreField } from "../../.aot/app/adapters/firestore-field.js";
import { firestore } from "../../.aot/app/adapters/cloud-save.js";
import { FIELD_DAY_MS, fieldCycle, reduceField } from "../../.aot/app/domain/field.js";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
const project = "demo-wildwoods";
assert.equal(process.env.GCLOUD_PROJECT ?? project,project);
for (const name of ["FIREBASE_AUTH_EMULATOR_HOST","FIRESTORE_EMULATOR_HOST"]) assert.match(process.env[name]??"",/^(127\.0\.0\.1|localhost):\d+$/);
const apps=[];
const admin=initializeAdminApp({projectId:project},randomUUID()), adminDb=adminFirestore(admin);
after(async()=>{for(const c of apps){await terminate(c.db);await deleteApp(c.app);}await adminDb.terminate();await deleteAdminApp(admin);});
async function client(credentials){
 const app=initializeApp({apiKey:"demo-key",projectId:project,authDomain:`${project}.firebaseapp.com`},randomUUID());
 const auth=getAuth(app);connectAuthEmulator(auth,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});
 const db=firestore(app,true);if(credentials) await signInWithEmailAndPassword(auth,credentials.email,credentials.password);else await signInAnonymously(auth);const uid=auth.currentUser.uid;
 const result={app,auth,db,uid,field:new FirestoreField(app,uid,()=>auth.currentUser?.uid??"",true)};apps.push(result);return result;
}
const denied=e=>e?.code==="permission-denied";
test("field ledger protects cycle, ingredients, immutable receipts and account privacy",async()=>{
 const a=await client(),b=await client();const first=await a.field.load();
 assert.equal(first.state.revision,0);assert.ok(Math.abs(first.now-Date.now())<60000);
 await a.field.execute({type:"gather",node:"herb"},"herb-request-0001");
 const herbReplay=await a.field.execute({type:"gather",node:"herb"},"herb-request-0001");assert.equal(herbReplay.state.inventory.herb,2);
 const sap=await a.field.execute({type:"gather",node:"sap"},"sap-request-00001");assert.equal(sap.state.inventory.sap,2);
 const crafted=await a.field.execute({type:"craft"},"craft-request-001");assert.equal(crafted.state.inventory.lantern,1);
 const replay=await a.field.execute({type:"craft"},"craft-request-001");assert.equal(replay.state.revision,crafted.state.revision);
 await assert.rejects(a.field.execute({type:"treasure"},"craft-request-001"),/reutilizado/);
 const restored=await a.field.execute({type:"restore"},"restore-request-1");assert.equal(restored.state.restored,true);
 const again=await a.field.execute({type:"gather",node:"herb"},"herb-request-0002");assert.equal(again.state.inventory.herb,0);
 const treasure=await a.field.execute({type:"treasure"},"treasure-req-0001");assert.equal(treasure.state.inventory.crystal,1);
 const one=await a.field.execute({type:"treasure"},"treasure-req-0002");assert.equal(one.state.inventory.crystal,1);
 await assert.rejects(getDocFromServer(doc(b.db,"users",a.uid,"field","state")),denied);
 await assert.rejects(setDoc(doc(a.db,"users",a.uid,"field_receipts","craft-request-001"),{}),denied);
 const stateRef=doc(a.db,"users",a.uid,"field","state"), saved=(await getDocFromServer(stateRef)).data();
 await assert.rejects(setDoc(stateRef,{...saved,state:{...saved.state,inventory:{...saved.state.inventory,herb:99}},updatedAt:serverTimestamp()}),denied);
 // Even an atomic receipt cannot authorize tomorrow's collection.
 const cycle=fieldCycle(treasure.now)+1,next=reduceField(treasure.state,{type:"gather",node:"herb"},cycle),op="future-request-01",action={type:"gather",node:"herb"};
 const batch=writeBatch(a.db);batch.set(stateRef,{state:next,updatedAt:serverTimestamp(),cycleStart:cycle*FIELD_DAY_MS,operationId:op,action});
 batch.set(doc(a.db,"users",a.uid,"field_receipts",op),{action,stateRevision:next.revision,createdAt:serverTimestamp()});
 await assert.rejects(batch.commit(),denied);
});
test("concurrent clients cannot gather the same node twice",async()=>{
 const a=await client();
 const credentials={email:`${randomUUID()}@example.invalid`,password:randomUUID()};
 await linkWithCredential(a.auth.currentUser,EmailAuthProvider.credential(credentials.email,credentials.password));
 const b=await client(credentials);assert.equal(b.uid,a.uid);
 const prepared=await Promise.all([a.field.load(),b.field.load()]);assert.ok(prepared.every(r=>r.state.revision===0));
 const [x,y]=await Promise.all([a.field.execute({type:"gather",node:"crystal"},"parallel-field-01"),b.field.execute({type:"gather",node:"crystal"},"parallel-field-02")]);
 assert.equal(x.state.inventory.crystal,2);assert.equal(y.state.inventory.crystal,2);
 const final=await a.field.load();assert.equal(final.state.inventory.crystal,2);assert.equal(final.state.revision,1);
 // Simulate a previously collected cycle with Admin SDK, restricted above to demo emulators.
 await adminDb.doc(`users/${a.uid}/field/state`).update({"state.claims.crystal":fieldCycle(final.now)-1});
 const renewed=await b.field.execute({type:"gather",node:"crystal"},"renewed-field-01");assert.equal(renewed.state.inventory.crystal,4);assert.equal(renewed.state.revision,2);
});
