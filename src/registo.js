let currentStep = 1;

function showError(msg){
  const el = document.getElementById('errorMsg');
  document.getElementById('errorText').textContent = msg;
  el.classList.add('show');
}
function hideError(){
  document.getElementById('errorMsg').classList.remove('show');
}

function setStep(n){
  document.querySelectorAll('.step-page').forEach(p => p.classList.remove('active'));
  document.getElementById('page'+n).classList.add('active');
  for(let i=1;i<=3;i++){
    const dot = document.getElementById('stepDot'+i);
    const num = document.getElementById('stepNum'+i);
    dot.classList.remove('active','done');
    if(i < n){
      dot.classList.add('done');
      num.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if(i===n){
      dot.classList.add('active');
      num.textContent=i;
    } else {
      num.textContent=i;
    }
  }
  currentStep = n;
  hideError();
}

/* password strength */
const pwdInput = document.getElementById('password');
const pwdStrength = document.getElementById('pwdStrength');
const strengthLabel = document.getElementById('strengthLabel');

pwdInput.addEventListener('input',()=>{
  const v = pwdInput.value;
  if(!v){ pwdStrength.classList.remove('visible'); return; }
  pwdStrength.classList.add('visible');
  let score=0;
  if(v.length>=8) score++;
  if(/[A-Z]/.test(v)) score++;
  if(/[0-9]/.test(v)) score++;
  if(/[^A-Za-z0-9]/.test(v)) score++;
  pwdStrength.className='pwd-strength visible strength-'+score;
  const labels=['','Fraca','Razoável','Boa','Forte'];
  strengthLabel.textContent=labels[score]||'';
});

/* confirm password */
const confirmInput = document.getElementById('confirmPassword');
const confirmStatus = document.getElementById('confirmStatus');
const confirmHint = document.getElementById('confirmHint');

confirmInput.addEventListener('input',()=>{
  if(!confirmInput.value) return;
  if(confirmInput.value===pwdInput.value){
    confirmInput.className='form-input valid';
    confirmStatus.className='input-status show ok';
    confirmStatus.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    confirmHint.className='field-hint show ok';
    confirmHint.textContent='As palavras-passe coincidem.';
  } else {
    confirmInput.className='form-input invalid';
    confirmStatus.className='input-status show err';
    confirmStatus.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    confirmHint.className='field-hint show err';
    confirmHint.textContent='As palavras-passe não coincidem.';
  }
});

/* email validation */
const emailInput = document.getElementById('email');
const emailStatus = document.getElementById('emailStatus');
const emailHint = document.getElementById('emailHint');

emailInput.addEventListener('blur',()=>{
  const v = emailInput.value.trim();
  if(!v) return;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(valid){
    emailInput.className='form-input valid';
    emailStatus.className='input-status show ok';
    emailStatus.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    emailHint.classList.remove('show');
  } else {
    emailInput.className='form-input invalid';
    emailStatus.className='input-status show err';
    emailStatus.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    emailHint.className='field-hint show err';
    emailHint.textContent='Introduz um email válido.';
  }
});

/* password toggles */
function setupToggle(btnId, inputId, iconId){
  const btn=document.getElementById(btnId);
  const inp=document.getElementById(inputId);
  const ico=document.getElementById(iconId);
  const eyeOpen=`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  const eyeClosed=`<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  btn.addEventListener('click',()=>{
    const show=inp.type==='password';
    inp.type=show?'text':'password';
    ico.innerHTML=show?eyeClosed:eyeOpen;
  });
}
setupToggle('togglePwd1','password','eyeIcon1');
setupToggle('togglePwd2','confirmPassword','eyeIcon2');

/* navigation */
document.getElementById('next1').addEventListener('click',()=>{
  const fn=document.getElementById('firstName').value.trim();
  const ln=document.getElementById('lastName').value.trim();
  if(!fn||!ln){ showError('Por favor, introduz o teu nome e apelido.'); return; }
  setStep(2);
});

document.getElementById('back2').addEventListener('click',()=>setStep(1));

document.getElementById('next2').addEventListener('click',()=>{
  const em=document.getElementById('email').value.trim();
  const pw=document.getElementById('password').value;
  const cp=document.getElementById('confirmPassword').value;
  if(!em||!pw||!cp){ showError('Preenche todos os campos obrigatórios.'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ showError('Introduz um email válido.'); return; }
  if(pw.length<6){ showError('A palavra-passe deve ter pelo menos 6 caracteres.'); return; }
  if(pw!==cp){ showError('As palavras-passe não coincidem.'); return; }
  setStep(3);
});

document.getElementById('back3').addEventListener('click',()=>setStep(2));

document.getElementById('submitBtn').addEventListener('click',()=>{
  const terms=document.getElementById('terms').checked;
  if(!terms){ showError('Deves aceitar os Termos de Utilização para continuar.'); return; }

  const btn=document.getElementById('submitBtn');
  btn.classList.add('loading');
  btn.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> A criar…`;

  setTimeout(()=>{
    document.getElementById('panelContent').style.display='none';
    document.getElementById('successScreen').classList.add('show');
  },1800);
});