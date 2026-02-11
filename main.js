import { io } from "socket.io-client";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "";
let token = localStorage.getItem("ck_token") || "";
let me = null;

let socket = null;
let servers = [];
let currentServerId = null;
let currentChannelId = null;

const $ = (s) => document.querySelector(s);

function toast(msg, bad=false){
  let t = $("#toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast hidden";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove("hidden","ok","bad");
  t.classList.add(bad ? "bad":"ok");
  setTimeout(()=>t.classList.add("hidden"), 2400);
}

async function api(path, opts = {}){
  const headers = { "Content-Type":"application/json", ...(opts.headers||{}) };
  if(token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data?.error || data?.message || "REQUEST_FAILED");
  return data;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function uiLogin(){
  $("#app").innerHTML = `
    <div class="shell">
      <div class="card">
        <h1>ChatKick</h1>
        <p class="muted">تسجيل دخول بكود يُرسل للإيميل (بدون كلمة مرور)</p>

        <div class="grid">
          <input id="email" placeholder="البريد الإلكتروني" />
          <div class="row">
            <button id="request">إرسال الكود</button>
            <button class="ghost" id="clear">مسح</button>
          </div>

          <input id="code" placeholder="أدخل الكود (6 أرقام)" inputmode="numeric" />
          <button id="verify">تأكيد الدخول</button>

          <p class="hint">
            ✅ إذا لم تضبط SMTP: ستجد الكود مطبوعًا في كونسول السيرفر (وضع DEV).<br/>
            ✨ بعد الدخول: جرّب أوامر البوت: <b>/مساعدة</b>
          </p>
        </div>
      </div>
    </div>
  `;

  $("#clear").onclick = () => { $("#email").value=""; $("#code").value=""; };

  $("#request").onclick = async () => {
    const email = $("#email").value.trim();
    if(!email) return toast("اكتب الإيميل أولاً", true);
    try{
      await api("/auth/request-code", { method:"POST", body: JSON.stringify({ email }) });
      toast("تم إرسال الكود ✅ (تحقق من بريدك أو كونسول السيرفر)");
    }catch(e){ toast("تعذر الإرسال: " + e.message, true); }
  };

  $("#verify").onclick = async () => {
    const email = $("#email").value.trim();
    const code = $("#code").value.trim();
    if(!email || !code) return toast("أدخل الإيميل والكود", true);
    try{
      const data = await api("/auth/verify-code", { method:"POST", body: JSON.stringify({ email, code }) });
      token = data.token;
      me = data.user;
      localStorage.setItem("ck_token", token);
      toast("تم تسجيل الدخول ✅");
      await boot();
    }catch(e){ toast("فشل التحقق: " + e.message, true); }
  };
}

function uiApp(){
  $("#app").innerHTML = `
  <div class="layout">
    <aside class="rail">
      <div class="brand">CK</div>
      <div id="srvList" class="srvList"></div>
      <button id="newSrv" class="fab">＋</button>
    </aside>

    <aside class="left">
      <div class="me">
        <div class="who">
          <div class="name">${escapeHtml(me?.name || "")}</div>
          <div class="sub">Lvl ${me?.level || 1} · ⭐ ${me?.points || 0}</div>
        </div>
        <button id="logout" class="ghost">خروج</button>
      </div>

      <div class="section">
        <div class="title">القنوات</div>
        <div id="chList" class="list"></div>
      </div>

      <div class="section">
        <div class="title">الأصدقاء</div>
        <div class="friendRow">
          <input id="friendEmail" placeholder="أضف صديق بالإيميل" />
          <button id="addFriend">إرسال</button>
        </div>
        <div style="height:10px"></div>
        <div id="friendsBox" class="list"></div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div id="roomTitle" class="roomTitle">اختر قناة</div>
        <div class="hint">أوامر: /مساعدة · /نقاط · /رتبتي · /توب</div>
      </header>

      <section id="messages" class="messages"></section>

      <footer class="composer">
        <input id="msg" placeholder="اكتب رسالة… (/مساعدة)" />
        <button id="send">إرسال</button>
      </footer>
    </main>
  </div>
  `;

  $("#logout").onclick = () => {
    localStorage.removeItem("ck_token");
    token = ""; me = null;
    socket?.disconnect();
    uiLogin();
  };

  $("#newSrv").onclick = async () => {
    const name = prompt("اسم السيرفر؟");
    if(!name) return;
    try{
      await api("/servers", { method:"POST", body: JSON.stringify({ name }) });
      await refreshServers();
      toast("تم إنشاء السيرفر ✅");
    }catch(e){ toast("تعذر الإنشاء: " + e.message, true); }
  };

  $("#addFriend").onclick = async () => {
    const email = $("#friendEmail").value.trim();
    if(!email) return;
    try{
      await api("/friends/request", { method:"POST", body: JSON.stringify({ email }) });
      $("#friendEmail").value = "";
      await refreshFriends();
      toast("تم إرسال الطلب ✅");
    }catch(e){ toast("تعذر الإرسال: " + e.message, true); }
  };

  $("#send").onclick = sendMsg;
  $("#msg").addEventListener("keydown", (e) => { if(e.key === "Enter") sendMsg(); });
}

function renderServers(){
  const box = $("#srvList");
  box.innerHTML = "";
  for(const s of servers){
    const btn = document.createElement("button");
    btn.className = "srv";
    btn.textContent = (s.name || "S").slice(0,2);
    btn.title = s.name;
    btn.onclick = () => selectServer(s.id);
    box.appendChild(btn);
  }
}

function renderChannels(server){
  const box = $("#chList");
  box.innerHTML = "";
  for(const ch of (server.channels || [])){
    const b = document.createElement("button");
    b.className = "item" + (ch.id === currentChannelId ? " active":"");
    b.textContent = "# " + ch.name;
    b.onclick = () => openChannel(ch.id, ch.name);
    box.appendChild(b);
  }
}

function addMessage(m){
  const box = $("#messages");
  const mine = m.user?.id === me?.id;
  const wrap = document.createElement("div");
  wrap.className = "msg" + (mine ? " mine":"");
  wrap.innerHTML = `
    <div class="meta">${escapeHtml(m.user?.name || "؟")} · <span>${new Date(m.createdAt).toLocaleTimeString("ar-SA")}</span></div>
    <div class="bubble">${escapeHtml(m.content || "")}</div>
  `;
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

function openChannel(channelId, channelName){
  currentChannelId = channelId;
  $("#roomTitle").textContent = "# " + channelName;
  $("#messages").innerHTML = "";
  // mark active
  const srv = servers.find(s => s.id === currentServerId);
  if(srv) renderChannels(srv);
  socket.emit("channel:join", { channelId });
}

function sendMsg(){
  const input = $("#msg");
  const content = input.value.trim();
  if(!content || !currentChannelId) return;
  input.value = "";
  socket.emit("message:send", { channelId: currentChannelId, content }, (ack)=>{
    if(ack && ack.ok === false) toast("تعذر الإرسال: " + (ack.error||""), true);
  });
}

async function refreshServers(){
  const data = await api("/servers");
  servers = data.servers || [];
  if(!currentServerId && servers[0]) currentServerId = servers[0].id;
  renderServers();
  if(currentServerId){
    const srv = servers.find(s => s.id === currentServerId);
    if(srv){
      renderChannels(srv);
      if(!currentChannelId && srv.channels?.[0]) openChannel(srv.channels[0].id, srv.channels[0].name);
    }
  }
}

async function refreshFriends(){
  const data = await api("/friends");
  const box = $("#friendsBox");
  box.innerHTML = "";

  const titleA = document.createElement("div");
  titleA.className = "title";
  titleA.textContent = "الأصدقاء";
  box.appendChild(titleA);

  for(const f of (data.friends || [])){
    const it = document.createElement("div");
    it.className = "item";
    it.textContent = f.name + " — " + f.email;
    box.appendChild(it);
  }

  const titleB = document.createElement("div");
  titleB.className = "title";
  titleB.textContent = "طلبات واردة";
  box.appendChild(titleB);

  for(const inc of (data.incoming || [])){
    const it = document.createElement("button");
    it.className = "item";
    it.textContent = "قبول: " + inc.user.name + " — " + inc.user.email;
    it.onclick = async ()=>{
      try{
        await api("/friends/accept", { method:"POST", body: JSON.stringify({ id: inc.id }) });
        await refreshFriends();
        toast("تم قبول الطلب ✅");
      }catch(e){ toast("تعذر القبول: " + e.message, true); }
    };
    box.appendChild(it);
  }
}

async function selectServer(serverId){
  currentServerId = serverId;
  currentChannelId = null;
  const srv = servers.find(s => s.id === serverId);
  if(!srv) return;
  renderChannels(srv);
  if(srv.channels?.[0]) openChannel(srv.channels[0].id, srv.channels[0].name);
}

async function boot(){
  // Load me
  const m = await api("/me");
  me = m.user;

  uiApp();

  // Socket connect
  socket?.disconnect();
  socket = io(API, { auth: { token } });
  socket.on("connect_error", (e)=>toast("Socket: " + e.message, true));
  socket.on("channel:history", (arr)=>{ (arr||[]).forEach(addMessage); });
  socket.on("message:new", (m)=>addMessage(m));

  await refreshServers();
  await refreshFriends();
}

(async function start(){
  if(!token) return uiLogin();
  try{
    await boot();
  }catch(e){
    localStorage.removeItem("ck_token");
    token = "";
    uiLogin();
  }
})();
