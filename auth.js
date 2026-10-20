/* Rubber Duck Dojo · accounts (Firebase Auth) + progress sync (Firestore). Loaded on every page; does nothing unless configured for this host. */
(function(){"use strict";
if(window.DojoAuth)return;
const C=window.DOJO_AUTH_CFG||{},ON=!!window.DOJO_AUTH_ON;
const HINT='rdd-auth-v1',META='rdd-sync-t';
const PAGE=location.pathname.split('/').pop()||'index.html';
const SYNC=/^(dsa-|rx-untangled|rdd-cinema)/;
const LS=window.localStorage;
const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
const J=(k,d)=>{try{const v=LS.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const put=(k,v)=>{try{rawSet.call(LS,k,JSON.stringify(v))}catch(e){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function safeNext(n){n=String(n||'');return /^[\w-]+\.html([?#][^\s]*)?$/.test(n)&&!/^login\.html/.test(n)?n:'index.html'}

/* ───── SDK loader ───── */
let loadP=null;
function script(src){return new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>bad(new Error('load '+src));document.head.appendChild(s)})}
function load(){if(loadP)return loadP;
  loadP=(async()=>{
    if(!(window.firebase&&window.firebase.auth)){const b=C.sdk;await script(b+'firebase-app-compat.js');await Promise.all([script(b+'firebase-auth-compat.js'),script(b+'firebase-firestore-compat.js')])}
    const fb=window.firebase;if(!fb.apps.length)fb.initializeApp(C.firebase);
    const auth=fb.auth();try{await auth.setPersistence(fb.auth.Auth.Persistence.LOCAL)}catch(e){}
    return {fb,auth,db:fb.firestore()}})();
  return loadP}

/* ───── progress sync ───── */
const meta=J(META,{});let dirty=new Set(),timer=0,cur=null,lastSync=0,syncing=false,syncErr='';
function stamp(k){meta[k]=Date.now();put(META,meta)}
if(ON){Storage.prototype.setItem=function(k,v){const r=rawSet.call(this,k,v);if(this===LS&&SYNC.test(k)){stamp(k);dirty.add(k);schedule()}return r};
Storage.prototype.removeItem=function(k){const r=rawRemove.call(this,k);if(this===LS&&SYNC.test(k)){stamp(k);dirty.add(k);schedule()}return r};}
function schedule(){if(!cur)return;clearTimeout(timer);timer=setTimeout(push,4000)}
function localKeys(){const out=[];for(let i=0;i<LS.length;i++){const k=LS.key(i);if(SYNC.test(k))out.push(k)}return out}
async function push(){if(!cur||!dirty.size)return;const {fb,db}=await load();const ks=[...dirty];dirty=new Set();
  const p={};let size=0;
  for(const k of ks){const v=LS.getItem(k);if(v===null)p[k]=fb.firestore.FieldValue.delete();else{size+=v.length;if(size>850000&&k==='dsa-ide-v1')continue;p[k]={v,t:meta[k]||Date.now()}}}
  try{syncing=true;paint();await db.collection('users').doc(cur.uid).set({p,updatedAt:fb.firestore.FieldValue.serverTimestamp()},{merge:true});lastSync=Date.now();syncErr=''}
  catch(e){ks.forEach(k=>dirty.add(k));syncErr=errText(e);console.warn('sync',e)}
  finally{syncing=false;paint()}}
async function pull(user){const {fb,db}=await load();const ref=db.collection('users').doc(user.uid);
  let snap;try{snap=await ref.get()}catch(e){syncErr=errText(e);paint();return}
  const data=snap.exists?snap.data():{};const cloud=data.p||{};let changed=false;
  for(const k in cloud){if(!SYNC.test(k))continue;const c=cloud[k];if(!c||typeof c.v!=='string')continue;const lt=meta[k]||0,lv=LS.getItem(k);
    if(lv===null||c.t>lt){if(lv!==c.v){window.__dojoQuiet=true;try{rawSet.call(LS,k,c.v)}finally{window.__dojoQuiet=false}changed=true}meta[k]=c.t}}
  put(META,meta);
  for(const k of localKeys())if(!(k in cloud)||(meta[k]||0)>(cloud[k].t||0))dirty.add(k);
  const profile={name:user.displayName||'',email:user.email||'',photo:user.photoURL||'',provider:(user.providerData[0]||{}).providerId||'password'};
  try{await ref.set({profile,lastSeen:fb.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){}
  await push();lastSync=Date.now();paint();
  const flag='rdd-synced-'+user.uid;
  if(changed&&!sessionStorage.getItem(flag)){sessionStorage.setItem(flag,'1');toast('Progress synced from your account. Refreshing…');setTimeout(()=>location.reload(),900)}else sessionStorage.setItem(flag,'1')}
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')push()});
addEventListener('pagehide',()=>{push()});

/* ───── errors ───── */
const ERR={'auth/invalid-email':'That email address doesn’t look right.','auth/user-disabled':'This account has been disabled.','auth/user-not-found':'No account with that email. Create one instead?','auth/wrong-password':'Email or password is incorrect.','auth/invalid-credential':'Email or password is incorrect.','auth/invalid-login-credentials':'Email or password is incorrect.','auth/email-already-in-use':'An account with this email already exists. Sign in instead, or use “Continue with Google” if you signed up that way.','auth/weak-password':'Use at least 8 characters.','auth/too-many-requests':'Too many attempts. Wait a minute and try again.','auth/network-request-failed':'Network error. Check your connection.','auth/popup-blocked':'Your browser blocked the sign-in window.','auth/unauthorized-domain':'This website isn’t authorised in Firebase yet (Authentication → Settings → Authorized domains).','auth/operation-not-allowed':'This sign-in method is turned off in the Firebase console.','auth/requires-recent-login':'For safety, sign out and sign in again, then retry.','auth/account-exists-with-different-credential':'This email already uses a different sign-in method. Try email + password.','auth/missing-password':'Enter your password.','auth/internal-error':'Something went wrong. Please try again.','permission-denied':'Sync is blocked by Firestore rules (see setup steps).','unavailable':'Offline. Progress will sync when you’re back online.'};
function errText(e){return(e&&ERR[e.code])||(e&&e.message)||'Something went wrong.'}

/* ───── account chip ───── */
let chip,menu;
function css(){if(document.getElementById('dojo-auth-css'))return;const s=document.createElement('style');s.id='dojo-auth-css';s.textContent=`
.da-chip{position:fixed;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:61;height:44px;min-width:44px;border-radius:999px;border:2px solid #161A33;background:var(--surface,#fff);color:var(--ink,#161A33);box-shadow:3px 3px 0 #161A33;display:flex;align-items:center;gap:8px;padding:0 12px 0 3px;font:800 13.5px var(--body,system-ui,sans-serif);cursor:pointer}
.da-chip img,.da-av{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none;display:grid;place-items:center;background:#FFD24A;color:#161A33;font:800 15px var(--display,system-ui)}
.da-chip .da-dot{width:8px;height:8px;border-radius:50%;background:#139E80;flex:none}
.da-chip .da-dot.busy{background:#E89A1C}.da-chip .da-dot.err{background:#DB3D6E}
@media (max-width:640px){.da-chip{padding:0 3px}.da-chip .da-nm,.da-chip .da-dot{display:none}}
.da-menu{position:fixed;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(68px + env(safe-area-inset-bottom,0px));z-index:62;width:min(300px,calc(100vw - 28px));background:var(--surface,#fff);color:var(--ink,#161A33);border:2px solid #161A33;border-radius:16px;box-shadow:5px 5px 0 #161A33;padding:14px;display:grid;gap:10px;font:14.5px/1.45 var(--body,system-ui,sans-serif)}
.da-menu[hidden]{display:none}
.da-me{display:flex;gap:10px;align-items:center;min-width:0}.da-me div{min-width:0}.da-me b{display:block;font:800 16px var(--display,system-ui)}.da-me small{display:block;color:var(--ink-3,#6E749B);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.da-st{font-size:13px;color:var(--ink-2,#4A4F6E);background:var(--paper,#F4F6FB);border-radius:10px;padding:7px 10px}
.da-st.err{color:#B4204F;background:#FBE1E9}
.da-btn{border:1.5px solid #161A33;background:var(--surface,#fff);color:var(--ink,#161A33);border-radius:10px;padding:8px 12px;font:800 14px var(--body,system-ui);cursor:pointer;text-align:center;text-decoration:none}
.da-btn.pri{background:#161A33;color:#fff}
.da-btn.danger{border-color:#DB3D6E;color:#B4204F;background:transparent;font-weight:700;font-size:13px;border-style:dashed}
.da-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:1200;background:#161A33;color:#fff;border-radius:12px;padding:10px 16px;font:700 14px var(--body,system-ui);box-shadow:0 10px 30px rgba(0,0,0,.25)}
@media print{.da-chip,.da-menu{display:none!important}}`;document.head.appendChild(s)}
function toast(t){css();const d=document.createElement('div');d.className='da-toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200)}
function initials(u){const n=(u.displayName||u.email||'?').trim();return n.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
function avatar(u,cls){return u.photoURL?`<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" class="${cls||''}">`:`<span class="da-av">${esc(initials(u))}</span>`}
function ago(t){if(!t)return'not yet';const s=Math.round((Date.now()-t)/1000);return s<10?'just now':s<60?s+' s ago':Math.round(s/60)+' min ago'}
function mountChip(){css();if(chip)return;chip=document.createElement('button');chip.type='button';chip.className='da-chip';chip.setAttribute('aria-haspopup','dialog');
  menu=document.createElement('div');menu.className='da-menu';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Your account');
  document.body.append(chip,menu);
  chip.onclick=()=>{menu.hidden=!menu.hidden;paint();if(!menu.hidden){const b=menu.querySelector('button,a');if(b)b.focus()}};
  document.addEventListener('click',e=>{const path=e.composedPath?e.composedPath():[e.target];if(!menu.hidden&&!path.includes(menu)&&!path.includes(chip))menu.hidden=true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;chip.focus()}});
  menu.addEventListener('click',onMenu);paint()}
function paint(){if(!chip)return;const h=J(HINT,null);
  if(cur){const st=syncErr?'err':syncing?'busy':'';chip.innerHTML=`${avatar(cur)}<span class="da-nm">${esc((cur.displayName||cur.email||'').split(/[\s@]/)[0])}</span><span class="da-dot ${st}" title="${st==='err'?'Sync problem':'Synced'}"></span>`;chip.setAttribute('aria-label','Account: '+(cur.displayName||cur.email));
    if(!menu.hidden)menu.innerHTML=`<div class="da-me">${avatar(cur)}<div><b>${esc(cur.displayName||'Your account')}</b><small>${esc(cur.email||'')}</small></div></div>
      <div class="da-st${syncErr?' err':''}">${syncErr?esc(syncErr):syncing?'Syncing your progress…':'☁️ Progress synced '+ago(lastSync)+'. It follows you to any device you sign in on.'}</div>
      ${cur.emailVerified||(cur.providerData[0]||{}).providerId!=='password'?'':'<button type="button" class="da-btn" data-a="verify">Resend verification email</button>'}
      <button type="button" class="da-btn pri" data-a="out">Sign out</button><button type="button" class="da-btn danger" data-a="del">Delete account</button>`}
  else if(h&&h.guest){chip.innerHTML=`<span class="da-av">👤</span><span class="da-nm">Guest</span>`;chip.setAttribute('aria-label','Guest: sign in');
    if(!menu.hidden)menu.innerHTML=`<div class="da-me"><span class="da-av">👤</span><div><b>You’re a guest</b><small>Progress stays on this device only.</small></div></div>
      <a class="da-btn pri" href="login.html?next=${encodeURIComponent(PAGE)}">Sign in or create account</a>`}}
async function onMenu(e){const b=e.target.closest('[data-a]');if(!b)return;const {auth,db}=await load();
  if(b.dataset.a==='out'){await push();put(HINT,null);try{rawRemove.call(LS,HINT)}catch(_){}await auth.signOut();location.href='login.html'}
  else if(b.dataset.a==='verify'){try{await auth.currentUser.sendEmailVerification();toast('Verification email sent.')}catch(err){toast(errText(err))}}
  else if(b.dataset.a==='del'){if(!confirm('Delete your account and the progress saved in it? Progress on this device stays. This can’t be undone.'))return;
    try{const u=auth.currentUser;await db.collection('users').doc(u.uid).delete().catch(()=>{});await u.delete();try{rawRemove.call(LS,HINT)}catch(_){}toast('Account deleted.');setTimeout(()=>location.href='login.html',900)}
    catch(err){toast(errText(err))}}}

/* ───── boot ───── */
async function boot(){
  if(!ON)return;
  const h=J(HINT,null);
  if(PAGE==='login.html')return; // login page drives its own flow
  if(h&&h.guest&&C.allowGuest&&!h.uid){mountChip();return}
  let auth;try{({auth}=await load())}catch(e){console.warn('auth sdk',e);if(h&&h.uid){mountChip()}return}
  auth.onAuthStateChanged(u=>{
    if(u){cur=u;put(HINT,{uid:u.uid,name:u.displayName||'',email:u.email||'',photo:u.photoURL||''});mountChip();pull(u)}
    else{cur=null;try{rawRemove.call(LS,HINT)}catch(_){}
      if(C.requireLogin)location.replace('login.html?next='+encodeURIComponent(PAGE+location.search+location.hash))}})}
window.DojoAuth={load,on:ON,cfg:C,errText,safeNext,hintKey:HINT,setHint:v=>put(HINT,v),clearHint:()=>{try{rawRemove.call(LS,HINT)}catch(_){}},user:()=>cur,push};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
