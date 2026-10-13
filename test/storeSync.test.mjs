import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const copy=v=>JSON.parse(JSON.stringify(v))
const key='liftcycle-state-v3',dirty=key+':unsynced'
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}}
const snapshot=()=>({schemaVersion:3,unit:'lb',library:[],plan:{name:'PPL',startDate:'2026-09-20',weeks:6,days:[],splits:[]},cycles:[],activeCycleId:null,history:[],draft:null})
const server={state:snapshot(),updated_at:'2026-10-13T20:00:00.000Z'}
let sequence=0,beforeWrite=null,reads=0,writes=0
const events={};const timers=[];const channels=[]
const client={
 auth:{getSession:async()=>({data:{session:{user:{id:'owner',email:'test@example.com'}}},error:null}),onAuthStateChange(){},},
 channel(){const channel={on(event,filter,callback){this.callback=callback;return this},subscribe(){return this}};channels.push(channel);return channel},removeChannel(){},
 from(){let fields=null,mode='read',expected=null;const request={
 select(){return request},eq(k,v){if(k==='updated_at')expected=v;return request},update(v){fields=v;mode='update';return request},insert(v){fields=v;mode='insert';return request},
 async maybeSingle(){
 if(mode==='read'){reads++;return {data:copy(server),error:null}}
 if(beforeWrite){const action=beforeWrite;beforeWrite=null;action()}
 if(mode==='insert')return {data:null,error:{code:'23505'}}
 if(expected!==server.updated_at)return {data:null,error:null}
 writes++;server.state=copy(fields.state);server.updated_at=`2026-10-13T20:00:${String(++sequence).padStart(2,'0')}.000Z`
 return {data:{updated_at:server.updated_at},error:null}
 },single(){return request.maybeSingle()}
 };return request}
}
globalThis.__syncTestClient=client
const bundled=await build({entryPoints:['test/fixtures/storeSyncHarness.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake-cloud',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'mock',namespace:'sync'}));b.onLoad({filter:/.*/,namespace:'sync'},()=>({contents:'export const supabase=globalThis.__syncTestClient'}))}}]})
const {useLiftStore,createPinia,setActivePinia}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
globalThis.window={clearTimeout(){},setTimeout:cb=>{timers.push(cb);return timers.length},setInterval(){},addEventListener:(event,cb)=>{events[event]=cb}}
globalThis.document={visibilityState:'visible',addEventListener:(event,cb)=>{events[event]=cb}}
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true})
const device=()=>{const storage=memory();globalThis.localStorage=storage;setActivePinia(createPinia());const store=useLiftStore();store.hydrateLocal();return {store,storage}}
const use=d=>{globalThis.localStorage=d.storage;return d.store}

test('store automatically merges laptop/phone writes, survives reload and recovers legacy conflicts',async()=>{
 const laptop=device();await use(laptop).setSession()
 const phone=device();await use(phone).setSession()
 use(laptop).state.rhythm.daily['2026-10-13']={walk:true};await laptop.store.pushCloud()
 use(phone).state.rhythm.daily['2026-10-13']={read:true};await phone.store.pushCloud()
 assert.deepEqual(server.state.rhythm.daily['2026-10-13'],{walk:true,read:true})
 assert.equal(phone.store.syncStatus,'synced');assert.equal(phone.storage.getItem(dirty),null)
 await use(laptop).pullCloudOrSeed();assert.equal(laptop.store.state.rhythm.daily['2026-10-13'].read,true)
 // Realtime can arrive while this device has pending edits, without a blocking conflict.
 use(phone).state.rhythm.daily['2026-10-13'].water=1
 use(laptop).state.rhythm.daily['2026-10-13'].read=false;await laptop.store.pushCloud()
 use(phone);channels[1].callback({new:copy(server)})
 assert.equal(phone.store.state.rhythm.daily['2026-10-13'].water,1)
 assert.equal(phone.store.state.rhythm.daily['2026-10-13'].read,false)
 await phone.store.pushCloud()
 // Pending offline edits survive a new Pinia store and retain their shared ancestor.
 use(phone).state.rhythm.daily['2026-10-13'].water=3
 navigator.onLine=false;const offlineWrites=writes;await phone.store.pushCloud();assert.equal(writes,offlineWrites);assert.equal(phone.store.syncStatus,'offline');navigator.onLine=true
 use(laptop).state.rhythm.daily['2026-10-13'].walk=false;await laptop.store.pushCloud()
 globalThis.localStorage=phone.storage;setActivePinia(createPinia());const reloaded=useLiftStore();reloaded.hydrateLocal();await reloaded.setSession()
 assert.deepEqual(server.state.rhythm.daily['2026-10-13'],{walk:false,read:false,water:3})
 assert.equal(reloaded.syncStatus,'synced');assert.ok(phone.storage.getItem(key+':cloud-base'))
 // Editing during an in-flight write remains dirty and is uploaded in the next pass.
 reloaded.state.rhythm.daily['2026-10-13'].water=4
 beforeWrite=()=>{reloaded.state.rhythm.daily['2026-10-13'].water=5}
 await reloaded.pushCloud();assert.equal(phone.storage.getItem(dirty),'1')
 await reloaded.pushCloud();assert.equal(server.state.rhythm.daily['2026-10-13'].water,5)
 // Clean polling never writes or loops on normalization.
 const previousWrites=writes;await reloaded.pullCloudOrSeed();await reloaded.pushCloud();assert.equal(writes,previousWrites)
 // A pre-upgrade cache with dirty edits and no baseline reconciles automatically.
 const legacy=device(),old=snapshot();old.history=[{id:'offline-workout',date:'2026-10-12',name:'Pull',unit:'lb',notes:'Offline notes',exercises:[]}]
 legacy.storage.setItem(key,JSON.stringify(old));legacy.storage.setItem(dirty,'1');legacy.store.hydrateLocal();await legacy.store.setSession()
 assert.ok(server.state.history.some(w=>w.id==='offline-workout'))
 assert.equal(legacy.store.syncStatus,'synced');assert.equal(legacy.storage.getItem(dirty),null)
 assert.ok(legacy.storage.getItem(key+':before-auto-merge'))
 assert.ok(events.online && events.focus && events.visibilitychange);assert.ok(reads>0)
})
