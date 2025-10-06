// frontend/public/app.js
// Simple frontend using Supabase client for auth, file uploads, and DB operations

(async function(){
  const root = document.getElementById('root');

  // Use Render / Vercel env vars in production, or fallback for local testing
  const SUPABASE_URL = window.SUPABASE_URL || "https://rddniuxeegugosmktlak.supabase.co";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZG5pdXhlZWd1Z29zbWt0bGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODE2MTMsImV4cCI6MjA3NDY1NzYxM30.Ec75_p5i0AT-HLIb1-8wxDMgMQvr5_89F1Tek6hAQSI";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    root.innerHTML = `
      <div style="padding:20px">
        <h3>Supabase keys not configured</h3>
        <p>Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in Render environment variables or use fallback locally.</p>
      </div>`;
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function showMessage(msg){ alert(msg); }

  function el(html){ const d=document.createElement('div'); d.innerHTML=html; return d.firstElementChild; }

  // --- Login / Signup ---
  function renderLogin(){
    root.innerHTML = '';
    const c = el(`
      <div class="content">
        <div class="card" style="max-width:480px;margin:24px auto">
          <h2>Login / Signup</h2>
          <input id="email" placeholder="Email" style="width:100%;padding:8px"/>
          <input id="password" placeholder="Password" type="password" style="width:100%;padding:8px;margin-top:8px"/>
          <div style="margin-top:8px">
            <button id="login" class="btn">Login</button>
            <button id="signup" class="btn">Signup</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(c);

    c.querySelector('#login').onclick = async ()=>{
      const email = c.querySelector('#email').value;
      const password = c.querySelector('#password').value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) return showMessage('Login error: '+error.message);
      showMain();
    };

    c.querySelector('#signup').onclick = async ()=>{
      const email = c.querySelector('#email').value;
      const password = c.querySelector('#password').value;
      const { error } = await supabase.auth.signUp({ email, password });
      if(error) return showMessage('Signup error: '+error.message);
      alert('Check your email to confirm sign-up. Then login.');
    };
  }

  // --- Main App ---
  async function showMain(){
    const current = (await supabase.auth.getSession()).data?.session?.user;
    if(!current){ renderLogin(); return; }

    root.innerHTML = '';
    const top = el('<div class="topbar"><div>Job Hunter</div><div><span class="notification-dot"></span> <button id="logout" class="btn">Logout</button></div></div>');
    const content = el('<div class="content"></div>');
    root.appendChild(top); root.appendChild(content);
    top.querySelector('#logout').onclick = async ()=>{ await supabase.auth.signOut(); renderLogin(); };

    const nav = el(`
      <div style="margin:12px 0">
        <button id="bStatus" class="btn">Status</button>
        <button id="bUser" class="btn">User</button>
        <button id="bPosition" class="btn">Position</button>
        <button id="bActivate" class="btn">Activate</button>
      </div>
    `);
    content.appendChild(nav);
    const panel = el('<div id="panel"></div>');
    content.appendChild(panel);

    nav.querySelector('#bStatus').onclick = ()=>renderStatus(panel);
    nav.querySelector('#bUser').onclick = ()=>renderUser(panel);
    nav.querySelector('#bPosition').onclick = ()=>renderPosition(panel);
    nav.querySelector('#bActivate').onclick = ()=>renderActivate(panel);
    renderStatus(panel);
  }

  // --- Other render functions ---
  async function renderStatus(container){
    container.innerHTML = '<div class="card"><h3>Status / Notifications</h3><div id="list">Loading...</div></div>';
    const listEl = container.querySelector('#list');
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false });
    if(error){ listEl.innerText = 'Error loading notifications: '+error.message; return; }
    if(!data || data.length===0){ listEl.innerHTML = '<p>No notifications yet.</p>'; return; }

    listEl.innerHTML = data.map(n=>`
      <div class="notification-item">
        <strong>${n.company || '—'}</strong> — ${n.position || '—'}
        <span style="float:right">${n.status}</span>
        <div>${n.message || ''}</div>
        <div><a target="_blank" href="${n.job_url || '#'}">Job link</a></div>
      </div>
    `).join('');
  }

  async function renderUser(container){
    container.innerHTML = '<div class="card"><h3>User Profile & CVs</h3><div id="userarea">Loading...</div></div>';
    const area = container.querySelector('#userarea');
    const { data:profile } = await supabase.auth.getUser();
    area.innerHTML = `
      <div><label>Full name</label><input id="fullname" style="width:100%"/></div>
      <div style="margin-top:8px"><label>Phone</label><input id="phone" style="width:100%"/></div>
      <div style="margin-top:12px">
        <h4>Upload CV</h4>
        <input type="file" id="cvfile"/>
        <button id="uploadcv" class="btn">Upload CV</button>
      </div>
      <div style="margin-top:12px">
        <h4>Create CV from text</h4>
        <textarea id="cvtext" style="width:100%;height:120px"></textarea>
        <button id="savecv" class="btn">Save CV</button>
      </div>
    `;
    area.querySelector('#uploadcv').onclick = async ()=>{
      const f = area.querySelector('#cvfile').files[0];
      if(!f) return alert('Choose file');
      const user = (await supabase.auth.getUser()).data.user;
      const path = user.id + '/cvs/' + Date.now() + '_' + f.name;
      const { error } = await supabase.storage.from('cvs').upload(path, f);
      if(error) return alert('Upload error: '+error.message);
      await supabase.from('cvs').insert([{ user_id: user.id, name: f.name, content: '', file_path: path }]);
      alert('Uploaded. File path saved.');
    };
    area.querySelector('#savecv').onclick = async ()=>{
      const text = area.querySelector('#cvtext').value;
      if(!text) return alert('Write something first');
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('cvs').insert([{ user_id: user.id, name: 'Text CV '+Date.now(), content: text }]);
      alert('CV saved.');
    };
  }

  async function renderPosition(container){
    container.innerHTML = '<div class="card"><h3>Position Filters</h3><div id="pos">Loading...</div></div>';
    const pos = container.querySelector('#pos');
    pos.innerHTML = `
      <div><input id="pname" placeholder="Position name" style="width:100%"/></div>
      <div><input id="pcity" placeholder="City" style="width:100%;margin-top:8px"/></div>
      <div style="margin-top:8px"><button id="savefilters" class="btn">Save filters</button></div>
    `;
    pos.querySelector('#savefilters').onclick = async ()=>{
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('positions').insert([{ user_id: user.id, position_name: pos.querySelector('#pname').value, city: pos.querySelector('#pcity').value }]);
      alert('Filters saved.');
    };
  }

  async function renderActivate(container){
    container.innerHTML = '<div class="card"><h3>Activate</h3><div><button id="runAuto" class="btn">Apply Now (Auto)</button> <button id="runStep" class="btn">Apply Now (Step)</button></div><div style="margin-top:12px"><h4>Apply link manually</h4><input id="joblink" placeholder="Paste job link" style="width:100%"/><button id="applylink" class="btn">Apply</button></div></div>';
    container.querySelector('#runAuto').onclick = async ()=>{
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('applications').insert([{ user_id: user.id, status: 'applied', company: 'MockCorp', job_url: 'https://example.com' }]);
      alert('Applied (mock).');
    };
    container.querySelector('#applylink').onclick = async ()=>{
      const link = container.querySelector('#joblink').value;
      if(!link) return alert('Paste link');
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('applications').insert([{ user_id: user.id, status: 'applied', company: 'ManualCorp', job_url: link }]);
      alert('Manual apply simulated.');
    };
  }

  const session = await supabase.auth.getSession();
  if(session?.data?.session?.user) { showMain(); } else { renderLogin(); }

})();
