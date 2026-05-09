// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCX1dbo5MuiCziGntDyYCTjIrnyVydnT-A",
  authDomain: "earn-bd-fa67e.firebaseapp.com",
  projectId: "earn-bd-fa67e",
  storageBucket: "earn-bd-fa67e.firebasestorage.app",
  messagingSenderId: "1086130368979",
  appId: "1:1086130368979:web:408e492855fb6aa22b3f26",
  measurementId: "G-7H92BGX7G9"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.db = firebase.firestore();
window.auth = firebase.auth();
const db = window.db;
const auth = window.auth;

// --- Smart Referral Capture ---
(function() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('eb_pending_ref', ref.trim());
  }
})();

// Global State
let S = {
  user: null,
  plans: []
};

// Auth Observer
// Auth Observer
function checkAuth(requireAuth = true) {
  // Load from cache first
  const cache = localStorage.getItem('eb_user_cache');
  if (cache) {
    try {
      S.user = JSON.parse(cache);
      updateUI();
    } catch(e) { console.error("Cache parse error", e); }
  }

  let isSyncStarted = false;
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("User logged in:", user.uid);
      db.collection('users').doc(user.uid).onSnapshot(async (doc) => {
        if (doc.exists) {
          S.user = doc.data();
          localStorage.setItem('eb_user_cache', JSON.stringify(S.user));
          updateUI();
          
          // Ensure background sync and listeners only start once per session
          if (!isSyncStarted) {
            isSyncStarted = true;
            autoSyncReferrals(); // Initial sync
            
            // Real-time Referral Listener (Sub-collection)
            db.collection('users').doc(user.uid).collection('referrals').onSnapshot(() => {
               updateUI(); 
            });

            // NEW: Instant Referral Ping Listener
            listenForPings(S.user);

            // Periodic background sync (every 30 seconds)
            setInterval(autoSyncReferrals, 30000);
          }
        } else {
          // DO NOT auto-repair on signup page (wait for registration to finish)
          if (window.location.pathname.includes('signup.html')) {
            console.log("On signup page, skipping auto-repair...");
            return;
          }

          console.error("User document not found! Attempting auto-repair...");
          try {
            // Auto-repair missing document
            const phone = user.email ? user.email.split('@')[0] : 'N/A';
            const name = user.displayName || (phone !== 'N/A' ? 'User ' + phone.slice(-4) : 'New User');
            
            const userData = {
              uid: user.uid,
              name: name,
              phone: phone,
              bal: 0,
              plan: null,
              ref_code: genRefCode(),
              referred_by: null,
              created_at: firebase.firestore.FieldValue.serverTimestamp(),
              is_repaired: true
            };
            
            await db.collection('users').doc(user.uid).set(userData);
            console.log("Account auto-repaired successfully.");
          } catch (repairErr) {
            console.error("Auto-repair failed:", repairErr);
            if (requireAuth) {
              document.body.innerHTML = `<div style="padding:40px; text-align:center; font-family:sans-serif;">
                <h2 style="color:#e11d48">Account Error</h2>
                <p>We couldn't initialize your account automatically. Please try logging out and in again.</p>
                <button onclick="doLogout()" style="padding:10px 20px; background:#2563eb; color:white; border:none; border-radius:8px;">Logout</button>
              </div>`;
            }
          }
        }
      }, (err) => {
        console.error("Firestore Snapshot Error:", err);
      });

      if (!requireAuth && (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html'))) {
        window.location.href = 'dashboard.html';
      }
    } else {
      localStorage.removeItem('eb_user_cache');
      S.user = null;
      if (requireAuth && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('signup.html')) {
        window.location.href = 'login.html';
      }
    }
  });
}

function updateUI() {
  if (!S.user) return;
  
  // Dashboard Elements
  const uName = document.getElementById('uName') || document.getElementById('uname');
  const uBal = document.getElementById('hBal');
  const uAvt = document.getElementById('avt');
  const uBalLarge = document.getElementById('hBalLarge');
  
  if (uName) uName.textContent = S.user.name || 'User';
  if (uBal) uBal.textContent = S.user.bal || 0;
  if (uBalLarge) uBalLarge.textContent = S.user.bal || 0;
  if (uAvt) uAvt.textContent = (S.user.name || 'U')[0].toUpperCase();

  // Dashboard Stats
  const sRef = document.getElementById('sRef') || document.getElementById('rTotal');
  const sPlanName = document.getElementById('sPlanName');
  const sDays = document.getElementById('sDays');
  const sWdCnt = document.getElementById('sWdCnt');
  const hToday = document.getElementById('hToday');
  const hRef = document.getElementById('hRef') || document.getElementById('rEarn');
  const hPlan = document.getElementById('hPlan');
  const hWd = document.getElementById('hWd');

  if (sRef) sRef.textContent = S.user.refCount || 0;
  if (sPlanName) sPlanName.textContent = S.user.plan || 'নেই';
  if (sDays) {
    let days = S.user.plan_days || 0;
    if (days === 0 && S.user.active_plans && S.user.active_plans.length > 0) {
      days = S.user.active_plans[0].rem !== undefined ? S.user.active_plans[0].rem : S.user.active_plans[0].days;
    }
    sDays.textContent = days;
  }
  if (sWdCnt) sWdCnt.textContent = S.user.wdCount || 0;
  if (hToday) hToday.textContent = S.user.todayEarn || 0;
  if (hRef) hRef.textContent = S.user.refEarn || 0;
  if (hPlan) hPlan.textContent = S.user.planEarn || 0;
  if (hWd) hWd.textContent = S.user.wdTotal || 0;
  
  // Profile Elements
  const pName = document.getElementById('pName');
  const pPhone = document.getElementById('pPhone');
  const pAvt = document.getElementById('pAvt');
  const pCode = document.getElementById('pCode') || document.getElementById('myCode');
  
  if (pName) pName.textContent = S.user.name || 'User';
  if (pPhone) pPhone.textContent = S.user.phone || 'N/A';
  if (pCode) pCode.textContent = S.user.ref_code || '---';
  if (pAvt && S.user.name) pAvt.textContent = S.user.name[0].toUpperCase();

  // Recent Activity (if on dashboard)
  if (document.getElementById('recentActivity')) renderRecentActivity();

  // --- One-time Repair for Days Remaining ---
  try {
    if (!canCollect() && S.user && S.user.active_plans && Array.isArray(S.user.active_plans) && S.user.last_collect) {
      let last;
      if (S.user.last_collect.seconds) last = new Date(S.user.last_collect.seconds * 1000);
      else if (S.user.last_collect.toDate) last = S.user.last_collect.toDate();
      else last = new Date(S.user.last_collect);

      let needsRepair = false;
      const repairedPlans = S.user.active_plans.map(p => {
        let pStart;
        if (p.start?.seconds) pStart = new Date(p.start.seconds * 1000);
        else if (p.start?.toDate) pStart = p.start.toDate();
        else pStart = new Date(p.start || Date.now());

        if ((p.rem === undefined || p.rem === p.days) && last > pStart) {
          needsRepair = true;
          return { ...p, rem: (p.rem || p.days) - 1 };
        }
        if (p.rem !== undefined && p.rem < p.days && last < pStart) {
          needsRepair = true;
          return { ...p, rem: p.days };
        }
        return p;
      });

      if (needsRepair && auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).update({
          active_plans: repairedPlans
        }).catch(e => console.error("Repair failed", e));
      }
    }
  } catch (err) { console.warn("Repair logic skipped", err); }
}

async function renderRecentActivity() {
  const cont = document.getElementById('recentActivity');
  if(!cont) return;
  try {
    const uid = auth.currentUser.uid;
    const [hSnap, wSnap] = await Promise.all([
      db.collection('history').where('uid', '==', uid).limit(10).get(),
      db.collection('withdraws').where('uid', '==', uid).limit(10).get()
    ]);

    let items = [];
    hSnap.forEach(doc => {
      const d = doc.data();
      items.push({ 
        ...d, 
        icon: d.type_sub === 'refer' ? '👥' : (d.type_sub === 'plan' ? '📦' : '💰'),
        color: 'var(--green)',
        prefix: '+'
      });
    });
    wSnap.forEach(doc => {
      const d = doc.data();
      const statusText = d.status === 'pending' ? '(Pending)' : (d.status === 'success' ? '(Success)' : '(Rejected)');
      items.push({ 
        ...d, 
        msg: `Withdraw Request ${statusText}`,
        icon: '💸',
        color: 'var(--red)',
        prefix: '-'
      });
    });

    // Sort by timestamp (newest first)
    items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    
    // Take top 6
    const topItems = items.slice(0, 6);

    if(topItems.length === 0) {
      cont.innerHTML = `<div class="empty-ico">📄</div><div class="empty-txt">এখনো কোনো কার্যক্রম নেই</div>`;
      cont.classList.add('empty');
      return;
    }

    cont.classList.remove('empty');
    cont.innerHTML = topItems.map(d => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:36px; height:36px; background:var(--b50); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px;">${d.icon}</div>
          <div>
            <div style="font-weight:700; font-size:13px; color:var(--text);">${d.msg}</div>
            <div style="font-size:10px; color:var(--t3);">${d.date}</div>
          </div>
        </div>
        <div style="font-weight:800; font-size:14px; color:${d.color};">${d.prefix}৳${d.amt}</div>
      </div>
    `).join('');
  } catch(e) { console.error("Recent Activity Error:", e); }
}

function confirmModal(title, msg) {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:20000; padding:20px; box-sizing:border-box;";
    m.innerHTML = `
      <div class="card" style="width:100%; max-width:340px; padding:24px; text-align:center; animation: pop .3s cubic-bezier(0.34, 1.56, 0.64, 1);">
        <div style="font-size:24px; margin-bottom:12px;">💡</div>
        <div style="font-family:'Baloo Da 2',cursive; font-size:20px; font-weight:800; color:var(--text); margin-bottom:8px;">${title}</div>
        <div style="font-size:14px; color:var(--t3); margin-bottom:24px; line-height:1.6;">${msg}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <button id="mCancel" class="btn" style="background:var(--b50); color:var(--b700); border:1px solid var(--b100);">না</button>
          <button id="mOk" class="btn btn-primary">হ্যাঁ, কিনুন</button>
        </div>
      </div>
      <style>@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
    `;
    document.body.appendChild(m);
    m.querySelector('#mCancel').onclick = () => { m.remove(); resolve(false); };
    m.querySelector('#mOk').onclick = () => { m.remove(); resolve(true); };
  });
}

function alertModal(title, msg) {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:20000; padding:20px; box-sizing:border-box;";
    m.innerHTML = `
      <div class="card" style="width:100%; max-width:340px; padding:24px; text-align:center; animation: pop .3s cubic-bezier(0.34, 1.56, 0.64, 1);">
        <div style="font-size:32px; margin-bottom:12px;">✅</div>
        <div style="font-family:'Baloo Da 2',cursive; font-size:20px; font-weight:800; color:var(--text); margin-bottom:8px;">${title}</div>
        <div style="font-size:14px; color:var(--t3); margin-bottom:24px; line-height:1.6;">${msg}</div>
        <button id="mOk" class="btn btn-primary" style="width:100%;">ঠিক আছে</button>
      </div>
      <style>@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
    `;
    document.body.appendChild(m);
    m.querySelector('#mOk').onclick = () => { m.remove(); resolve(true); };
  });
}

async function autoSyncReferrals() {
  if (!S.user || !auth.currentUser || !S.user.phone) return;
  const uid = auth.currentUser.uid;
  const myPhone = S.user.phone.trim();
  const myCode = S.user.ref_code || 'EB-NONE';
  const pNoZero = myPhone.startsWith('0') ? myPhone.substring(1) : myPhone;
  const pWithZero = myPhone.startsWith('0') ? myPhone : ('0' + myPhone);
  
  try {
    const queries = [
      db.collection('users').where('referred_by', '==', myCode).get(),
      db.collection('users').where('referred_by', '==', myCode.toLowerCase()).get(),
      db.collection('users').where('referred_by', '==', myCode.toUpperCase()).get(),
      db.collection('users').where('referred_by', '==', pNoZero).get(),
      db.collection('users').where('referred_by', '==', '0' + pNoZero).get()
    ];
    const results = await Promise.all(queries);
    let found = [];
    results.forEach(s => s.forEach(d => found.push(d.data())));
    const unique = found.filter((v, i, a) => a.findIndex(t => t.uid === v.uid) === i && v.uid !== uid);

    if (unique.length > 0) {
      let newCount = 0;
      for (const u of unique) {
        const check = await db.collection('users').doc(uid).collection('referrals').doc(u.uid).get();
        if (!check.exists) {
          await db.collection('users').doc(uid).collection('referrals').doc(u.uid).set({
            uid: u.uid, name: u.name, phone: u.phone, created_at: u.created_at || firebase.firestore.FieldValue.serverTimestamp()
          });
          newCount++;
        }
      }
      if (newCount > 0) {
        await db.collection('users').doc(uid).update({
          refCount: firebase.firestore.FieldValue.increment(newCount)
        });
        console.log(`Auto-Sync: Added ${newCount} referrals`);
      }
    }
  } catch(e) { console.error("Auto-Sync Error:", e); }
}

function changeName() {
  const newName = prompt("আপনার নতুন নাম দিন:", S.user.name);
  if (newName && newName.trim() !== "" && newName !== S.user.name) {
    db.collection('users').doc(auth.currentUser.uid).update({
      name: newName.trim()
    }).then(() => {
      alert("✅ নাম সফলভাবে পরিবর্তন করা হয়েছে!");
    }).catch(e => {
      alert("❌ ভুল হয়েছে: " + e.message);
    });
  }
}

function genRefCode() {
  return 'EB-' + Math.floor(100000 + Math.random() * 900000);
}

function toast(msg) {
  const t = document.createElement('div');
  t.id = "toast-msg";
  t.style = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:12px 24px; border-radius:50px; font-size:14px; z-index:10000; box-shadow:0 10px 25px rgba(0,0,0,0.2); backdrop-filter:blur(5px); transition: all 0.3s ease; animation: slideUp 0.3s ease;";
  t.textContent = msg;
  
  // Style for animation
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `@keyframes slideUp { from { bottom: 0; opacity: 0; } to { bottom: 80px; opacity: 1; } }`;
    document.head.appendChild(s);
  }

  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.bottom = '60px';
    setTimeout(() => t.remove(), 300)
  }, 3000);
}

function doLogout() {
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}

async function listenForPings(me) {
   if (!me || !me.ref_code || !auth.currentUser) return;
   const myCode = me.ref_code;
   const myPhone = me.phone || 'NONE';

   console.log("Listening for Referral Pings for:", myCode);

   // Listen for pings sent to ME
   db.collection('referral_pings').where('to', 'in', [myCode, myPhone, myCode.toLowerCase(), myCode.toUpperCase()])
     .onSnapshot(async (snap) => {
        if (snap.empty) return;

        for (const change of snap.docChanges()) {
           if (change.type === 'added') {
              const ping = change.doc.data();
              const pingId = change.doc.id;

              // Immediately delete to prevent other listeners from processing
              await db.collection('referral_pings').doc(pingId).delete().catch(()=>{});

              try {
                 const myRefCol = db.collection('users').doc(auth.currentUser.uid).collection('referrals');
                 const check = await myRefCol.doc(ping.from_uid).get();
                 
                 if (!check.exists) {
                    await myRefCol.doc(ping.from_uid).set({
                       uid: ping.from_uid,
                       name: ping.from_name,
                       phone: ping.from_phone,
                       created_at: ping.time || firebase.firestore.FieldValue.serverTimestamp()
                    });
                    await db.collection('users').doc(auth.currentUser.uid).update({
                       refCount: firebase.firestore.FieldValue.increment(1)
                    });
                    toast(`🎉 অভিনন্দন! ${ping.from_name} আপনার রেফারে জয়েন করেছে!`);
                 }
              } catch (e) { console.error("Ping process error:", e); }
           }
        }
     }, (err) => console.error("Ping listener error:", err));
}

function canCollect() {
  if (!S.user || !S.user.last_collect) return true;
  let last;
  if (S.user.last_collect.seconds) last = new Date(S.user.last_collect.seconds * 1000);
  else if (S.user.last_collect.toDate) last = S.user.last_collect.toDate();
  else last = new Date(S.user.last_collect);
  
  const now = new Date();
  const diff = now - last;
  return diff >= 24 * 60 * 60 * 1000;
}

async function collectDaily() {
  if (!canCollect()) {
    toast("⏳ ২৪ ঘণ্টা পূর্ণ হয়নি!");
    return;
  }
  const amt = S.user.plan_daily || 0;
  if (amt <= 0) {
    toast("❌ আপনার কোনো একটিভ প্ল্যান নেই");
    return;
  }

  try {
    const uid = auth.currentUser.uid;
    const batch = db.batch();
    const userRef = db.collection('users').doc(uid);
    
    // --- New logic to update active_plans array ---
    let activePlans = S.user.active_plans || [];
    let newPlanDaily = 0;
    
    const updatedPlans = activePlans.map(p => {
      const remaining = (p.rem || p.days) - 1;
      if (remaining > 0) {
        newPlanDaily += p.daily;
        return { ...p, rem: remaining };
      }
      return null; // Expired
    }).filter(p => p !== null);

    batch.update(userRef, {
      bal: firebase.firestore.FieldValue.increment(amt),
      last_collect: firebase.firestore.FieldValue.serverTimestamp(),
      planEarn: firebase.firestore.FieldValue.increment(amt),
      todayEarn: amt,
      active_plans: updatedPlans,
      plan_daily: newPlanDaily,
      plan: updatedPlans.length > 0 ? updatedPlans[0].name : null // Update main plan name if needed
    });

    // Add to history
    const histRef = db.collection('history').doc();
    batch.set(histRef, {
      uid, amt, msg: "দৈনিক ইনকাম সংগ্রহীত", type_sub: "plan", 
      date: new Date().toLocaleString('bn-BD'), timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    toast(`✅ ৳${amt} ব্যালেন্সে যোগ হয়েছে!`);
    
    // Manual local update to avoid waiting for snapshot
    S.user.active_plans = updatedPlans;
    S.user.plan_daily = newPlanDaily;
    updateUI();
  } catch(e) {
    console.error(e);
    toast("❌ ভুল হয়েছে: " + e.message);
  }
}
function canPlay(gameType) {
  const field = 'last_' + gameType;
  if (!S.user || !S.user[field]) return true;
  let last;
  if (S.user[field].seconds) last = new Date(S.user[field].seconds * 1000);
  else if (S.user[field].toDate) last = S.user[field].toDate();
  else last = new Date(S.user[field]);
  
  const now = new Date();
  const diff = now - last;
  return diff >= 24 * 60 * 60 * 1000;
}

async function rewardGame(amt, type) {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const field = 'last_' + type;
  
  try {
    const batch = db.batch();
    const userRef = db.collection('users').doc(uid);
    batch.update(userRef, {
      bal: firebase.firestore.FieldValue.increment(amt),
      [field]: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const histRef = db.collection('history').doc();
    batch.set(histRef, {
      uid, amt, msg: `গেম বোনাস (${type})`, type_sub: "game",
      date: new Date().toLocaleString('bn-BD'), timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    // Manual local update for instant UI feedback
    if (S.user) {
      S.user.bal = (S.user.bal || 0) + amt;
      updateUI();
    }
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
}

async function resetGameLimit(gameType) {
  if (!auth.currentUser) return;
  const field = 'last_' + gameType;
  
  toast("⏳ লিমিট রিসেট হচ্ছে...");
  
  try {
    // Reset the last play timestamp in Firestore
    await db.collection('users').doc(auth.currentUser.uid).update({
      [field]: null
    });
    
    // Simple alert to ensure user knows it worked
    toast("✅ লিমিট সফলভাবে রিসেট হয়েছে!");
    setTimeout(() => window.location.reload(), 1500);
  } catch(e) {
    console.error("Reset Error:", e);
    toast("❌ রিসেট করতে সমস্যা হয়েছে");
  }
}
