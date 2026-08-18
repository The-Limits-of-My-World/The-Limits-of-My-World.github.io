// no-alibi 회원 인증 + cin — 공용 모듈 (매직링크 로그인)
// 버튼을 먼저 mount하고 Supabase는 동적 로드(안정 CDN 폴백) → 로드 실패해도 버튼은 뜨고 콘솔에 원인 기록.
const SUPA_URL = 'https://fdbqilofjmrcqzhcivlg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFpbG9mam1yY3F6aGNpdmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTk2ODYsImV4cCI6MjEwMjYzNTY4Nn0.YyHEcwHGLggZ7nSqY6MjIV0fUg4QiwTKHfbR8UOZYiQ';

let _readyResolve;
window.NOALIBI = {
  supa: null, user: null, profile: null,
  login: () => openModal(),
  ready: new Promise((r) => { _readyResolve = r; })
};
let supa = null;

const KO = (document.documentElement.lang || 'ko') !== 'en';
const T = KO ? {
  login: '로그인', logout: '로그아웃', send: '로그인 링크 받기',
  title: 'no-alibi 로그인 · 가입', desc: '이메일로 로그인 링크를 보내드려요. 비밀번호 없이 클릭 한 번이면 돼요. cin 포인트가 이 계정에 쌓입니다.',
  ph: '이메일 주소', sending: '보내는 중…', sent: '메일함(스팸함도)을 확인하세요 — 로그인 링크를 보냈어요.',
  err: '전송 실패 — 잠시 후 다시 시도해주세요.', invalid: '올바른 이메일을 입력해주세요.',
  loading: '로그인 모듈을 불러오는 중… 잠시 후 다시 눌러주세요.', close: '닫기'
} : {
  login: 'Log in', logout: 'Log out', send: 'Send login link',
  title: 'no-alibi login · sign up', desc: 'We email you a login link — one click, no password. Your cin points accrue to this account.',
  ph: 'Email address', sending: 'Sending…', sent: 'Check your inbox (and spam) — we sent a login link.',
  err: 'Failed — please try again shortly.', invalid: 'Enter a valid email.',
  loading: 'Loading login module… try again in a moment.', close: 'Close'
};

// ── 위젯 mount (즉시, Supabase와 무관) ──
function mountWidget() {
  const host = document.querySelector('header.subnav nav')
    || document.querySelector('.subnav nav')
    || document.querySelector('.subnav');
  const w = document.createElement('span');
  w.className = 'authbar';
  if (host) host.appendChild(w);
  else { w.classList.add('authbar-fixed'); document.body.appendChild(w); }
  return w;
}
const widget = mountWidget();

function renderLoggedOut() {
  widget.innerHTML = '';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'auth-btn'; b.textContent = T.login;
  b.addEventListener('click', openModal);
  widget.appendChild(b);
}
function renderLoggedIn(bal, name) {
  widget.innerHTML = '';
  const cin = document.createElement('span');
  cin.className = 'auth-cin'; cin.textContent = 'cin ' + bal; cin.title = name || '';
  const out = document.createElement('button');
  out.type = 'button'; out.className = 'auth-btn'; out.textContent = T.logout;
  out.addEventListener('click', async () => { if (supa) await supa.auth.signOut(); });
  widget.append(cin, out);
}
renderLoggedOut(); // 로그인 버튼 즉시 표시

// ── 로그인 모달 ──
let overlay = null;
function openModal() {
  closeModal();
  overlay = document.createElement('div');
  overlay.className = 'auth-modal';
  overlay.innerHTML =
    '<div class="auth-box">' +
    '<button class="auth-x" aria-label="' + T.close + '">×</button>' +
    '<h3>' + T.title + '</h3><p>' + T.desc + '</p>' +
    '<form class="auth-form"><input type="email" required placeholder="' + T.ph + '" autocomplete="email">' +
    '<button type="submit" class="auth-send">' + T.send + '</button></form>' +
    '<p class="auth-status" aria-live="polite"></p></div>';
  document.body.appendChild(overlay);
  const form = overlay.querySelector('.auth-form');
  const input = overlay.querySelector('input');
  const status = overlay.querySelector('.auth-status');
  const sendBtn = overlay.querySelector('.auth-send');
  overlay.querySelector('.auth-x').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  setTimeout(() => input.focus(), 50);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supa) { status.textContent = T.loading; return; }
    const email = input.value.trim();
    if (!email || email.indexOf('@') < 1) { status.textContent = T.invalid; return; }
    sendBtn.disabled = true; status.classList.remove('ok'); status.textContent = T.sending;
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) { status.textContent = T.err; sendBtn.disabled = false; console.error('[noalibi] signInWithOtp', error); }
    else { status.classList.add('ok'); status.textContent = T.sent; }
  });
}
function closeModal() { if (overlay) { overlay.remove(); overlay = null; } }

async function refresh() {
  if (!supa) return;
  const { data: { session } } = await supa.auth.getSession();
  const user = session && session.user;
  window.NOALIBI.user = user || null;
  window.NOALIBI.profile = null;
  if (user) {
    let bal = 0, name = (user.email || '').split('@')[0];
    try {
      const { data } = await supa.from('profiles').select('cin_balance, display_name').eq('id', user.id).maybeSingle();
      if (data) { bal = data.cin_balance; if (data.display_name) name = data.display_name; window.NOALIBI.profile = data; }
    } catch (e) { console.warn('[noalibi] profile fetch', e); }
    renderLoggedIn(bal, name);
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user, balance: bal } }));
  } else {
    renderLoggedOut();
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user: null } }));
  }
}

// ── Supabase 동적 로드 (CDN 폴백) ──
(async () => {
  const CDNS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
    'https://esm.sh/@supabase/supabase-js@2'
  ];
  let createClient = null;
  for (const url of CDNS) {
    try { const m = await import(url); createClient = m.createClient || (m.default && m.default.createClient); if (createClient) break; }
    catch (e) { console.warn('[noalibi] supabase load fail:', url, e); }
  }
  if (!createClient) { console.error('[noalibi] Supabase 모듈 로드 실패 — 로그인 비활성'); return; }
  supa = createClient(SUPA_URL, SUPA_KEY);
  window.NOALIBI.supa = supa;
  supa.auth.onAuthStateChange(() => { refresh(); closeModal(); });
  document.addEventListener('noalibi-refresh', () => refresh());
  if (_readyResolve) _readyResolve(supa);
  refresh();
  console.log('[noalibi] auth ready');
})();
