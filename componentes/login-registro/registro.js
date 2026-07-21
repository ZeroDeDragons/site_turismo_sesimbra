import { ChamarServidor } from '../../serviços/api.js';

// ───────────────────────────────────────────────────────────
// ESTADO
// ───────────────────────────────────────────────────────────
let etapaAtual = 1;
const TOTAL_ETAPAS = 2;

const dados = {
  email: '',
  password: '',
  primeiroNome: '',
  ultimoNome: '',
  dataNascimento: ''
};

// ───────────────────────────────────────────────────────────
// REFERÊNCIAS AOS ELEMENTOS DO HTML
// ───────────────────────────────────────────────────────────
const btnAvancar = document.getElementById('btnAvancar');
const btnVoltar = document.getElementById('btnVoltar');
const erroBox = document.getElementById('registro-erro');
const erroTexto = document.getElementById('registro-erro-texto');

// ───────────────────────────────────────────────────────────
// FUNÇÕES DE INTERFACE
// ───────────────────────────────────────────────────────────
function mostrarErro(mensagem) {
  erroTexto.textContent = message || mensagem;
  erroBox.classList.add('is-visible');
}

function esconderErro() {
  erroBox.classList.remove('is-visible');
}

function atualizarInterface() {
  document.querySelectorAll('.form-step').forEach((secao) => {
    const numero = Number(secao.dataset.step);
    secao.classList.toggle('is-active', numero === etapaAtual);
  });

  document.querySelectorAll('.step-circle').forEach((circulo) => {
    const numero = Number(circulo.dataset.stepCircle);
    circulo.classList.toggle('is-active', numero === etapaAtual);
    circulo.classList.toggle('is-done', numero < etapaAtual);
  });

  document.querySelectorAll('.step-line').forEach((linha, indice) => {
    linha.classList.toggle('is-done', indice + 2 <= etapaAtual);
  });

  btnVoltar.style.display = etapaAtual === 1 ? 'none' : 'inline-flex';

  btnAvancar.firstChild.textContent =
    etapaAtual === TOTAL_ETAPAS ? 'Criar conta ' : 'Continuar ';
}

// ───────────────────────────────────────────────────────────
// VALIDAÇÃO
// ───────────────────────────────────────────────────────────
function validarEtapa1() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmarPassword = document.getElementById('confirmPassword').value;

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) {
    mostrarErro('Introduz um email válido.');
    return false;
  }
  if (password.length < 6) {
    mostrarErro('A senha precisa de pelo menos 6 caracteres.');
    return false;
  }
  if (password !== confirmarPassword) {
    mostrarErro('As senhas não coincidem.');
    return false;
  }

  dados.email = email;
  dados.password = password;
  return true;
}

// Verifica idade mínima de 13 anos (ajusta se precisares de outra regra)
function validarEtapa2() {
  const primeiroNome = document.getElementById('primeiroNome').value.trim();
  const ultimoNome = document.getElementById('ultimoNome').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value;

  if (!primeiroNome || !ultimoNome) {
    mostrarErro('Preenche o primeiro e o último nome.');
    return false;
  }
  if (!dataNascimento) {
    mostrarErro('Indica a tua data de nascimento.');
    return false;
  }

  const idadeMinimaData = new Date();
  idadeMinimaData.setFullYear(idadeMinimaData.getFullYear() - 13);
  if (new Date(dataNascimento) > idadeMinimaData) {
    mostrarErro('É preciso ter pelo menos 13 anos para criar conta.');
    return false;
  }

  dados.primeiroNome = primeiroNome;
  dados.ultimoNome = ultimoNome;
  dados.dataNascimento = dataNascimento;
  return true;
}

// ───────────────────────────────────────────────────────────
// CHAMADA AO SERVIDOR
// ───────────────────────────────────────────────────────────
async function criarConta() {
  btnAvancar.classList.add('is-loading');
  try {
    await ChamarServidor('registro-criar-conta', {
      method: 'POST',
      body: {
        email: dados.email,
        password: dados.password,
        primeiroNome: dados.primeiroNome,
        ultimoNome: dados.ultimoNome,
        dataNascimento: dados.dataNascimento
      }
    });
    return true;
  } catch (erro) {
    mostrarErro(erro.message || 'Não foi possível criar a conta.');
    return false;
  } finally {
    btnAvancar.classList.remove('is-loading');
  }
}

// ───────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ───────────────────────────────────────────────────────────
btnAvancar.addEventListener('click', async () => {
  esconderErro();

  if (etapaAtual === 1) {
    if (!validarEtapa1()) return;
    etapaAtual = 2;
    atualizarInterface();
    return;
  }

  if (etapaAtual === 2) {
    if (!validarEtapa2()) return;
    const sucesso = await criarConta();
    if (!sucesso) return;
    
    // Sucesso absoluto: manda para o login direto
    window.location.href = 'login.html';
  }
});

btnVoltar.addEventListener('click', () => {
  esconderErro();
  if (etapaAtual > 1) {
    etapaAtual -= 1;
    atualizarInterface();
  }
});

atualizarInterface();


// ───────────────────────────────────────────────────────────
// MOSTRA/OCULTA PASSWORD
// ───────────────────────────────────────────────────────────
document.querySelectorAll('.field__toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
    var input = document.getElementById(btn.dataset.toggle);
    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.icon-eye-off').style.display = isHidden ? 'none' : 'block';
    btn.querySelector('.icon-eye').style.display = isHidden ? 'block' : 'none';
    });
});