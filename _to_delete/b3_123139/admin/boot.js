/* ============================================================
   boot.js — sign in, load the office, then start the application.

   app.js and agent.js are only imported once there is a session and
   the data is in hand, so no screen can ever render half-empty while
   a query is still in flight.
   ============================================================ */
import { sb, currentUser, signIn, signOut, readable } from './supa.js';
import { DB, hydrate, onError } from './store.js';

const $ = s => document.querySelector(s);
const gate = $('#gate'), app = $('#app'), form = $('#gateform'), msg = $('#g-msg');

let started = false;
async function start(user){
  if(started) return;
  msg.textContent = 'Loading the office…';
  try{
    await hydrate();
  }catch(err){
    msg.textContent = readable(err);
    return;
  }
  started = true;
  gate.hidden = true;
  app.hidden = false;
  $('#whoami').textContent = user.email || '';
  await import('./app.js');
  await import('./agent.js');

  /* A failed write must never pass silently: the screen says so and
     reloads from the database so nothing on it is a lie. */
  onError((what) => {
    const t = document.getElementById('toast') || (() => {
      const d = document.createElement('div'); d.id='toast'; document.body.appendChild(d); return d;
    })();
    t.className = 'bad show';
    t.textContent = what + '. The screen has been refreshed from the database.';
    setTimeout(()=>t.classList.remove('show'), 6000);
    import('./app.js').then(m => m.refresh && m.refresh());
  });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#g-go');
  btn.disabled = true; msg.textContent = 'Signing in…';
  try{
    const user = await signIn($('#g-e').value.trim(), $('#g-p').value);
    await start(user);
  }catch(err){
    msg.textContent = readable(err);
  }finally{ btn.disabled = false; }
});

document.addEventListener('click', e => {
  if(e.target.closest('#signout')){
    signOut().then(()=>location.reload());
  }
});

/* already signed in from last time? go straight in */
const user = await currentUser();
if(user) await start(user);
else { gate.hidden = false; $('#g-e').focus(); }

/* if the session is ended elsewhere, do not leave a live screen behind */
sb.auth.onAuthStateChange((event) => {
  if(event === 'SIGNED_OUT' && started) location.reload();
});
