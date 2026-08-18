// no-alibi 회원 인증 + cin — 공용 모듈 (매직링크 로그인)
// 정적 사이트에서 Supabase로 로그인/잔액 표시. 피드백·좋아요 스크립트는 window.NOALIBI.supa 재사용.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL = 'https://fdbqilofjmrcqzhcivlg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFpbG9mam1yY3F6aGNpdmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTk2ODYsImV4cCI6MjEwMjYzNTY4Nn0.YyHEcwHGLggZ7nSqY6MjIV0fUg4QiwTKHfbR8UOZYiQ';

const supa = createClient(SUPA_URL, SUPA_KEY);
window.NOALIBI = { supa, user: null, profile: null };

const KO = (document.documentElement.lang || 'ko') !== 'en';
const T = KO ? {
  login: '로그인', logout: '로그아웃', send: '로그인 링크 받기',
  title: 'no-alibi 로그인 · 가입', desc: '이메일로 로그인 링크를 보내드려요. 비밀번호 없이 클릭 한 번이면 돼요. cin 포인트가 이 계정에 쌓입니다.',
  ph: '이메일 주소', sending: '보내는 중…', sent: '메일함(스팸함도)을 확인하세요 — 로그인 링크를 보냈어요.',
  err: '전송 실패 — 잠시 후 다시 시도해주세요.', invalid: '올바른 이메일을 입력해주세요.', close: '닫기'
} : {
  login: 'Log in', logout: 'Log out', send: 'Send login link',
  title: 'no-alibi login · sign up', desc: 'We email you a login link — one click, no password. Your cin points accrue to this account.',
  ph: 'Email address', sending: 'Sending…', sent: 'Check your inbox (and spam) — we sent a login link.',
  err: 'Failed — please try again shortly.', invalid: 'Enter a valid email.', close: 'Close'
};

// ── 헤더 위젯 ──
function mountWidget() {
  const nav = document.querySelector('header.subnav nav');
  if (!nav) return null;
  const w = document.createElement('span');
  w.className = 'authbar';
  nav.appendChild(w);
  return w;
}
const widget = mountWidget();

async function refresh() {
  const { data: { session } } = await supa.auth.getSession();
  const user = session && session.user;
  window.NOALIBI.user = user || null;
  window.NOALIBI.profile = null;
  if (!widget) return;
  widget.innerHTML = '';
  if (user) {
    let bal = 0, name = (user.email || '').split('@')[0];
    try {
      const { data } = await supa.from('profiles').select('cin_balance, display_name').eq('id', user.id).maybeSingle();
      if (data) { bal = data.cin_balance; if (data.display_name) name = data.display_name; window.NOALIBI.profile = data; }
    } catch (e) {}
    const cin = document.createElement('span');
    cin.className = 'auth-cin';
    cin.textContent = 'cin ' + bal;
    cin.title = name;
    const out = document.createElement('button');
    out.type = 'button'; out.className = 'auth-btn'; out.textContent = T.logout;
    out.addEventListener('click', async () => { await supa.auth.signOut(); });
    widget.append(cin, out);
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user, balance: bal } }));
  } else {
    const inb = document.createElement('button');
    inb.type = 'button'; inb.className = 'auth-btn'; inb.textContent = T.login;
    inb.addEventListener('click', openModal);
    widget.append(inb);
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user: null } }));
  }
}

// ── 로그인 모달 ──
let overlay = null;
function openModal() {
  if (overlay) { overlay.remove(); overlay = null; }
  overlay = document.createElement('div');
  overlay.className = 'auth-modal';
  overlay.innerHTML =
    '<div class="auth-box">' +
    '<button class="auth-x" aria-label="' + T.close + '">×</button>' +
    '<h3>' + T.title + '</h3>' +
    '<p>' + T.desc + '</p>' +
    '<form class="auth-form"><input type="email" required placeholder="' + T.ph + '" autocomplete="email">' +
    '<button type="submit" class="auth-send">' + T.send + '</button></form>' +
    '<p class="auth-status" aria-live="polite"></p>' +
    '</div>';
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
    const email = input.value.trim();
    if (!email || email.indexOf('@') < 1) { status.textContent = T.invalid; return; }
    sendBtn.disabled = true; status.classList.remove('ok'); status.textContent = T.sending;
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) { status.textContent = T.err; sendBtn.disabled = false; }
    else { status.classList.add('ok'); status.textContent = T.sent; }
  });
}
function closeModal() { if (overlay) { overlay.remove(); overlay = null; } }

supa.auth.onAuthStateChange(() => { refresh(); closeModal(); });
refresh();
