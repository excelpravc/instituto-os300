/**
 * ==================================================================================
 * SISTEMA INSTITUTO OS 300
 * Front-end - Lógica JavaScript (ES6+) adaptado para Firebase
 * ==================================================================================
 * Responsável por:
 *  - Navegação entre telas (SPA)
 *  - Comunicação com Firebase Firestore e Storage
 *  - Validações, máscaras e preenchimento automático de campos
 *  - Loading, Toasts e Modal de confirmação
 *  - Inicialização e atualização das DataTables
 *  - Dashboard com Chart.js (KPIs + 6 gráficos)
 *  - Controle de Presença (chamada em lote)
 *  - CRUD completo de Alunos, Modalidades, Professores, Usuários
 *  - Importação de planilhas (SheetJS) e exportação de Relatórios (PDF/Excel)
 * ==================================================================================
 */

/* ==================================================================================
 * 1. CONFIGURAÇÃO DO FIREBASE
 * ================================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  updateDoc, deleteDoc, query, where, orderBy, addDoc,
  serverTimestamp, Timestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ⚠️ SUBSTITUA PELAS SUAS CHAVES DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDfK9H7eThdB34vNMKqsT2sqec9MLoEtg",
  authDomain: "instituto-os300.firebaseapp.com",
  projectId: "instituto-os300",
  storageBucket: "instituto-os300.firebasestorage.app",
  messagingSenderId: "399635589328",
  appId: "1:399635589328:web:0f9fe0709b6a0e15b056d5",
  measurementId: "G-TKMJTH3LY7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/* ==================================================================================
 * 2. ESTADO GLOBAL E CONSTANTES
 * ================================================================================== */
const USUARIO_LOGADO = 'Sistema';
let CACHE_ALUNOS = [];
let CACHE_MODALIDADES = [];
let CACHE_PROFESSORES = [];
const GRAFICOS = {};
let RESOLVER_MODAL_CONFIRMACAO = null;
let ULTIMO_DASHBOARD_DADOS = null;

const CORES = {
  verde: '#52D094',
  verdeEscuro: '#3fae79',
  azul: '#1f4287',
  azulClaro: '#5b8fd6',
  vermelho: '#e5484d',
  textoSecundario: '#a1a1a6',
  borda: '#2c2c2e',
  paleta: ['#52D094', '#1f4287', '#e5484d', '#f2b632', '#5b8fd6', '#a15be5', '#e55ba1', '#5be5c9', '#c9e55b', '#e58c5b']
};

const DATATABLES_PT_BR = {
  emptyTable: 'Nenhum registro encontrado',
  info: 'Mostrando de _START_ até _END_ de _TOTAL_ registros',
  infoEmpty: 'Mostrando 0 até 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros no total)',
  lengthMenu: '_MENU_ registros por página',
  loadingRecords: 'Carregando...',
  processing: 'Processando...',
  search: 'Pesquisar:',
  zeroRecords: 'Nenhum registro encontrado',
  paginate: { next: 'Próximo', previous: 'Anterior', first: 'Primeiro', last: 'Último' }
};

/* ==================================================================================
 * 3. LOADING OVERLAY
 * ================================================================================== */
const mostrarLoading = (texto = 'Carregando...') => {
  document.getElementById('loadingTexto').textContent = texto;
  document.getElementById('loadingOverlay').classList.remove('hidden');
};

const esconderLoading = () => {
  document.getElementById('loadingOverlay').classList.add('hidden');
};

/* ==================================================================================
 * 4. TOASTS (MENSAGENS DE SUCESSO / ERRO / INFO)
 * ================================================================================== */
const ICONES_TOAST = {
  sucesso: 'fa-circle-check',
  erro: 'fa-circle-exclamation',
  info: 'fa-circle-info'
};

const exibirToast = (mensagem, tipo = 'sucesso', duracaoMs = 4000) => {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="fa-solid ${ICONES_TOAST[tipo] || ICONES_TOAST.info}"></i><span>${mensagem}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, duracaoMs);
};

/* ==================================================================================
 * 5. MODAL DE CONFIRMAÇÃO GENÉRICO
 * ================================================================================== */
const confirmarAcao = (titulo = 'Confirmar ação', texto = 'Tem certeza que deseja continuar?') => {
  document.getElementById('modalConfirmacaoTitulo').textContent = titulo;
  document.getElementById('modalConfirmacaoTexto').textContent = texto;
  document.getElementById('modalConfirmacao').classList.remove('hidden');
  return new Promise((resolve) => {
    RESOLVER_MODAL_CONFIRMACAO = resolve;
  });
};

const configurarModalConfirmacao = () => {
  document.getElementById('btnModalConfirmar').addEventListener('click', () => {
    document.getElementById('modalConfirmacao').classList.add('hidden');
    if (RESOLVER_MODAL_CONFIRMACAO) RESOLVER_MODAL_CONFIRMACAO(true);
    RESOLVER_MODAL_CONFIRMACAO = null;
  });
  document.getElementById('btnModalCancelar').addEventListener('click', () => {
    document.getElementById('modalConfirmacao').classList.add('hidden');
    if (RESOLVER_MODAL_CONFIRMACAO) RESOLVER_MODAL_CONFIRMACAO(false);
    RESOLVER_MODAL_CONFIRMACAO = null;
  });
};

/* ==================================================================================
 * 6. NAVEGAÇÃO ENTRE TELAS / SIDEBAR
 * ================================================================================== */
const trocarTela = (idTela) => {
  document.querySelectorAll('.tela').forEach((tela) => tela.classList.remove('ativa'));
  document.querySelectorAll('.menu-item[data-tela]').forEach((item) => item.classList.remove('ativo'));
  document.getElementById(idTela).classList.add('ativa');
  const itemMenu = document.querySelector(`.menu-item[data-tela="${idTela}"]`);
  if (itemMenu) itemMenu.classList.add('ativo');
  document.getElementById('sidebar').classList.remove('aberta');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (idTela === 'telaDashboard') {
    carregarDashboard();
  } else if (idTela === 'telaPresenca') {
    popularSelectsModalidade();
    document.getElementById('presencaModalidade').value = '';
    document.getElementById('presencaProfessor').value = '';
    document.getElementById('presencaData').value = paraInputDate(new Date());
    document.getElementById('corpoTabelaPresenca').innerHTML = '';
    document.getElementById('checkboxSelecionarTodos').checked = false;
    document.getElementById('presencaStatusFiltro').value = '';
  } else if (idTela === 'telaAlunos') {
    carregarAlunos();
    limparFormAluno();
  } else if (idTela === 'telaModalidades') {
    carregarModalidades();
    limparFormModalidade();
  } else if (idTela === 'telaProfessores') {
    carregarProfessores();
    limparFormProfessor();
  } else if (idTela === 'telaConfiguracoes') {
    carregarConfiguracoes();
    carregarUsuarios();
  }
};

const configurarNavegacao = () => {
  document.querySelectorAll('.menu-item[data-tela]').forEach((item) => {
    item.addEventListener('click', (evento) => {
      evento.preventDefault();
      trocarTela(item.dataset.tela);
    });
  });
  document.getElementById('btnMenuMobile').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('aberta');
  });
};

/* ==================================================================================
 * 7. MÁSCARAS DE CAMPOS
 * ================================================================================== */
const aplicarMascaraCPF = (valor) => {
  return String(valor).replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const aplicarMascaraTelefoneFixo = (valor) => {
  return String(valor).replace(/\D/g, '').slice(0, 10)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const aplicarMascaraCelular = (valor) => {
  return String(valor).replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const aplicarMascaraCEP = (valor) => {
  return String(valor).replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
};

const configurarMascaras = () => {
  const vincular = (id, funcaoMascara) => {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    elemento.addEventListener('input', () => {
      elemento.value = funcaoMascara(elemento.value);
    });
  };
  vincular('alunoCPF', aplicarMascaraCPF);
  vincular('responsavelCPF', aplicarMascaraCPF);
  vincular('alunoTelefone', aplicarMascaraTelefoneFixo);
  vincular('responsavelTelefone', aplicarMascaraTelefoneFixo);
  vincular('emerg1Telefone', aplicarMascaraTelefoneFixo);
  vincular('emerg2Telefone', aplicarMascaraTelefoneFixo);
  vincular('emerg3Telefone', aplicarMascaraTelefoneFixo);
  vincular('alunoCelular', aplicarMascaraCelular);
  vincular('responsavelCelular', aplicarMascaraCelular);
  vincular('alunoCEP', aplicarMascaraCEP);
  vincular('professorTelefone', aplicarMascaraCelular);
};

const configurarNavegacaoPorEnter = () => {
  document.querySelectorAll('form').forEach((formulario) => {
    const campos = Array.from(formulario.querySelectorAll(
      'input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]), select, textarea'
    ));
    campos.forEach((campo, indice) => {
      if (campo.tagName === 'TEXTAREA') return;
      campo.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        const proximoCampo = campos.slice(indice + 1).find((c) => !c.disabled && !c.readOnly);
        if (proximoCampo) {
          proximoCampo.focus();
        } else {
          campo.blur();
        }
      });
    });
  });
};

/* ==================================================================================
 * 8. UTILITÁRIOS DE DATA / FORMATAÇÃO
 * ================================================================================== */
const paraInputDate = (valorData) => {
  if (!valorData) return '';
  if (typeof valorData === 'string') {
    const partesBR = valorData.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (partesBR) {
      const [, dia, mes, ano] = partesBR;
      return `${ano}-${mes}-${dia}`;
    }
  }
  const data = new Date(valorData);
  if (isNaN(data.getTime())) return '';
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const formatarDataBRLocal = (valorData) => {
  if (!valorData) return '';
  const data = new Date(valorData);
  if (isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR');
};

const calcularIdadeLocal = (dataNascimento) => {
  if (!dataNascimento) return '';
  const nascimento = new Date(dataNascimento);
  if (isNaN(nascimento.getTime())) return '';
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth() - nascimento.getMonth();
  if (mesAtual < 0 || (mesAtual === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
};

const normalizarDataParaEnvio = (valorData) => {
  if (!valorData) return '';
  if (valorData instanceof Date) return paraInputDate(valorData);
  return valorData;
};

const debounce = (funcao, atrasoMs = 300) => {
  let temporizador = null;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcao(...args), atrasoMs);
  };
};

/* ==================================================================================
 * 9. DATATABLES — HELPER DE RENDERIZAÇÃO
 * ================================================================================== */
const popularDataTable = (idTabela, htmlLinhas, colunaOrdenacao = 0) => {
  if ($.fn.DataTable.isDataTable('#' + idTabela)) {
    $('#' + idTabela).DataTable().destroy();
  }
  document.querySelector('#' + idTabela + ' tbody').innerHTML = htmlLinhas || '';
  $('#' + idTabela).DataTable({
    responsive: true,
    language: DATATABLES_PT_BR,
    pageLength: 10,
    order: [[colunaOrdenacao, 'asc']],
    lengthMenu: [10, 25, 50, 100]
  });
};

const vincularPesquisaInstantanea = (idInput, idTabela) => {
  const campo = document.getElementById(idInput);
  if (!campo) return;
  campo.addEventListener('input', debounce(() => {
    if ($.fn.DataTable.isDataTable('#' + idTabela)) {
      $('#' + idTabela).DataTable().search(campo.value).draw();
    }
  }, 250));
};

/* ==================================================================================
 * 10. BADGES DE STATUS
 * ================================================================================== */
const renderizarBadgeStatus = (status) => {
  const chave = String(status || '').toLowerCase();
  const mapaClasses = {
    ativo: 'badge-ativo',
    inativo: 'badge-inativo',
    transferido: 'badge-transferido',
    desistente: 'badge-desistente',
    presente: 'badge-presente',
    falta: 'badge-falta'
  };
  const classe = mapaClasses[chave] || 'badge-inativo';
  return `<span class="badge ${classe}">${status || '-'}</span>`;
};

const renderizarFotoTabela = (fotoURL) => {
  if (fotoURL) {
    return `<img class="foto-tabela" src="${fotoURL}" alt="Foto">`;
  }
  return `<i class="fa-solid fa-circle-user" style="font-size:28px;color:var(--cor-texto-terciario);"></i>`;
};

/* ==================================================================================
 * 11. INICIALIZAÇÃO GERAL DO SISTEMA
 * ================================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  iniciarSistema();
});

const executarComSeguranca = (nomeEtapa, funcao) => {
  try {
    funcao();
  } catch (erro) {
    console.error(`[ERRO DE INICIALIZAÇÃO] Falha em "${nomeEtapa}":`, erro);
  }
};

const iniciarSistema = async () => {
  console.log('[SISTEMA] Iniciando Instituto Os 300...');
  
  executarComSeguranca('configurarNavegacao', configurarNavegacao);
  executarComSeguranca('configurarModalConfirmacao', configurarModalConfirmacao);
  executarComSeguranca('configurarMascaras', configurarMascaras);
  executarComSeguranca('configurarFormularioAluno', configurarFormularioAluno);
  executarComSeguranca('configurarModalAluno', configurarModalAluno);
  executarComSeguranca('configurarFormularioModalidade', configurarFormularioModalidade);
  executarComSeguranca('configurarModalModalidade', configurarModalModalidade);
  executarComSeguranca('configurarFormularioProfessor', configurarFormularioProfessor);
  executarComSeguranca('configurarModalProfessor', configurarModalProfessor);
  executarComSeguranca('configurarTelaPresenca', configurarTelaPresenca);
  executarComSeguranca('configurarTelaRelatorios', configurarTelaRelatorios);
  executarComSeguranca('configurarTelaConfiguracoes', configurarTelaConfiguracoes);
  executarComSeguranca('configurarNavegacaoPorEnter', configurarNavegacaoPorEnter);
  executarComSeguranca('configurarKpisClicaveis', configurarKpisClicaveis);
  executarComSeguranca('configurarFiltrosDashboard', configurarFiltrosDashboard);
  executarComSeguranca('vincularPesquisaInstantanea (tabelaAlunos)', () => vincularPesquisaInstantanea('pesquisaAlunos', 'tabelaAlunos'));
  executarComSeguranca('vincularPesquisaInstantanea (tabelaAlunosLista)', () => vincularPesquisaInstantanea('pesquisaAlunosLista', 'tabelaAlunosLista'));
  executarComSeguranca('vincularPesquisaInstantanea (tabelaModalidades)', () => vincularPesquisaInstantanea('pesquisaModalidades', 'tabelaModalidades'));
  executarComSeguranca('vincularPesquisaInstantanea (tabelaProfessores)', () => vincularPesquisaInstantanea('pesquisaProfessores', 'tabelaProfessores'));
  executarComSeguranca('vincularImportacaoModalidades', () => {
    document.getElementById('inputImportarModalidades').addEventListener('change', importarPlanilhaModalidades);
});

executarComSeguranca('vincularImportacaoProfessores', () => {
    document.getElementById('inputImportarProfessores').addEventListener('change', importarPlanilhaProfessores);
});
  
  executarComSeguranca('datas padrão', () => {
    const hojeISO = paraInputDate(new Date());
    document.getElementById('presencaData').value = hojeISO;
    document.getElementById('relatorioDataDiaria').value = hojeISO;
    document.getElementById('filtroDataInicial').value = hojeISO.slice(0, 8) + '01';
    document.getElementById('filtroDataFinal').value = hojeISO;
  });
  
  executarComSeguranca('configurarUploadLogoInstituto', configurarUploadLogoInstituto);

  try {
    await Promise.all([carregarModalidades(), carregarProfessores()]);
  } catch (erro) {
    console.error('[ERRO DE INICIALIZAÇÃO] Falha ao carregar Modalidades/Professores:', erro);
  }
  
  try {
    await Promise.all([
      carregarAlunos(),
      carregarDashboard(),
      carregarUsuarios(),
      carregarConfiguracoes(),
      carregarLogoInstituto()
    ]);
  } catch (erro) {
    console.error('[ERRO DE INICIALIZAÇÃO] Falha ao carregar dados iniciais:', erro);
  }
};

/* ==================================================================================
 * 11.5 LOGO DO INSTITUTO (SIDEBAR)
 * ================================================================================== */
const carregarLogoInstituto = async () => {
  try {
    const docRef = doc(db, 'configuracoes', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const dados = docSnap.data();
      if (dados.LogoURL) {
        document.getElementById('sidebarLogoPreview').src = dados.LogoURL;
      }
    }
  } catch (erro) {
    console.error('Erro ao carregar logo:', erro);
  }
};

const configurarUploadLogoInstituto = () => {
  document.getElementById('sidebarLogoUploadCirculo').addEventListener('click', () => {
    document.getElementById('sidebarLogoArquivo').click();
  });
  
  document.getElementById('sidebarLogoArquivo').addEventListener('change', async (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    
    try {
      mostrarLoading('Enviando logo...');
      const storageRef = ref(storage, `logos/instituto-logo-${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, arquivo);
      const url = await getDownloadURL(snapshot.ref);
      
      const docRef = doc(db, 'configuracoes', 'global');
      await setDoc(docRef, { LogoURL: url }, { merge: true });
      
      document.getElementById('sidebarLogoPreview').src = url;
      exibirToast('Logo atualizada com sucesso.', 'sucesso');
    } catch (erro) {
      exibirToast('Erro ao enviar logo: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
      evento.target.value = '';
    }
  });
};

/* ==================================================================================
 * 12. MÓDULO DASHBOARD
 * ================================================================================== */
const obterFiltrosDashboard = () => ({
  dataInicial: document.getElementById('filtroDataInicial').value,
  dataFinal: document.getElementById('filtroDataFinal').value,
  modalidade: document.getElementById('filtroModalidade').value,
  professor: document.getElementById('filtroProfessor').value,
  sexo: document.getElementById('filtroSexo').value,
  faixaEtariaMin: document.getElementById('filtroIdadeMin').value,
  faixaEtariaMax: document.getElementById('filtroIdadeMax').value
});

const carregarDashboard = async (mostrarCarregamento = true) => {
  if (mostrarCarregamento) mostrarLoading('Atualizando dashboard...');
  
  try {
    const filtros = obterFiltrosDashboard();
    
    // Buscar dados do Firestore
    const alunosSnap = await getDocs(collection(db, 'alunos'));
    const alunos = alunosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const presencasSnap = await getDocs(collection(db, 'presencas'));
    let presencas = presencasSnap.docs.map(doc => doc.data());
    
    // Aplicar filtros
    if (filtros.dataInicial) {
      presencas = presencas.filter(p => p.Data >= filtros.dataInicial);
    }
    if (filtros.dataFinal) {
      presencas = presencas.filter(p => p.Data <= filtros.dataFinal);
    }
    if (filtros.modalidade) {
      presencas = presencas.filter(p => p.Modalidade === filtros.modalidade);
    }
    if (filtros.professor) {
      presencas = presencas.filter(p => p.Professor === filtros.professor);
    }
    
    // Filtrar alunos por sexo e faixa etária
    let alunosFiltrados = alunos;
    if (filtros.sexo) {
      alunosFiltrados = alunosFiltrados.filter(a => a.Sexo === filtros.sexo);
    }
    if (filtros.faixaEtariaMin) {
      alunosFiltrados = alunosFiltrados.filter(a => a.Idade >= Number(filtros.faixaEtariaMin));
    }
    if (filtros.faixaEtariaMax) {
      alunosFiltrados = alunosFiltrados.filter(a => a.Idade <= Number(filtros.faixaEtariaMax));
    }
    
    // KPIs
    const totalPresentes = presencas.filter(p => p.Status === 'Presente').length;
    const totalFaltas = presencas.filter(p => p.Status === 'Falta').length;
    const frequenciaMedia = presencas.length > 0 ? ((totalPresentes / presencas.length) * 100).toFixed(1) : '0.0';
    
    const kpis = {
      totalAlunos: alunosFiltrados.length,
      totalModalidades: CACHE_MODALIDADES.length,
      presencasHoje: totalPresentes,
      faltasHoje: totalFaltas,
      frequenciaMedia: frequenciaMedia + '%'
    };
    
    // Rankings
    const faltasPorAluno = {};
    const presencasPorAluno = {};
    presencas.forEach(p => {
      const chave = p.MatriculaAluno + '|' + p.NomeAluno;
      if (p.Status === 'Falta') faltasPorAluno[chave] = (faltasPorAluno[chave] || 0) + 1;
      if (p.Status === 'Presente') presencasPorAluno[chave] = (presencasPorAluno[chave] || 0) + 1;
    });
    
    const topFaltas = Object.entries(faltasPorAluno)
      .map(([chave, total]) => ({ nome: chave.split('|')[1], total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    const topPresencas = Object.entries(presencasPorAluno)
      .map(([chave, total]) => ({ nome: chave.split('|')[1], total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    // Distribuição por sexo
    const distribuicaoSexo = { Masculino: 0, Feminino: 0 };
    alunosFiltrados.forEach(a => {
      if (a.Sexo === 'Masculino') distribuicaoSexo.Masculino++;
      else if (a.Sexo === 'Feminino') distribuicaoSexo.Feminino++;
    });
    
    // Distribuição por modalidade
    const distribuicaoModalidade = {};
    alunosFiltrados.forEach(a => {
      [a.Modalidade1, a.Modalidade2].forEach(mod => {
        if (mod) distribuicaoModalidade[mod] = (distribuicaoModalidade[mod] || 0) + 1;
      });
    });
    
    // Presença diária
    const presencaDiariaMap = {};
    presencas.forEach(p => {
      if (!presencaDiariaMap[p.Data]) presencaDiariaMap[p.Data] = { presentes: 0, faltas: 0 };
      if (p.Status === 'Presente') presencaDiariaMap[p.Data].presentes++;
      if (p.Status === 'Falta') presencaDiariaMap[p.Data].faltas++;
    });
    const presencaDiaria = Object.entries(presencaDiariaMap)
      .map(([data, valores]) => ({ data, presentes: valores.presentes, faltas: valores.faltas }))
      .sort((a, b) => a.data.localeCompare(b.data));
    
    // Presença mensal
    const presencaMensalMap = {};
    presencas.forEach(p => {
      const mes = p.Data.substring(0, 7);
      if (!presencaMensalMap[mes]) presencaMensalMap[mes] = { presentes: 0, faltas: 0 };
      if (p.Status === 'Presente') presencaMensalMap[mes].presentes++;
      if (p.Status === 'Falta') presencaMensalMap[mes].faltas++;
    });
    const presencaMensal = Object.entries(presencaMensalMap)
      .map(([mes, valores]) => ({ mes, presentes: valores.presentes, faltas: valores.faltas }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
    
    ULTIMO_DASHBOARD_DADOS = { kpis, topFaltas, topPresencas, distribuicaoSexo, distribuicaoModalidade, presencaDiaria, presencaMensal };
    atualizarKPIs(kpis);
    atualizarGraficos(ULTIMO_DASHBOARD_DADOS);
  } catch (erro) {
    console.error('Erro ao carregar dashboard:', erro);
    exibirToast('Erro ao carregar dashboard: ' + erro.message, 'erro');
  } finally {
    if (mostrarCarregamento) esconderLoading();
  }
};

/* ==================================================================================
 * 12.5 MODAIS DE DETALHE DOS KPIs
 * ================================================================================== */
const renderizarTabelaModalKpi = (cabecalho, linhas) => {
  document.getElementById('modalKpiCabecalhoTabela').innerHTML =
    '<tr>' + cabecalho.map((c) => `<th>${c}</th>`).join('') + '</tr>';
  document.getElementById('modalKpiCorpoTabela').innerHTML = linhas.length
    ? linhas.map((linha) => '<tr>' + linha.map((valor) => `<td>${valor}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${cabecalho.length}" style="text-align:center;color:var(--cor-texto-terciario);padding:20px;">Nenhum registro encontrado</td></tr>`;
};

const abrirModalKpiComTitulo = (titulo) => {
  document.getElementById('modalKpiTitulo').innerHTML = `<i class="fa-solid fa-list"></i> ${titulo}`;
  document.getElementById('modalKpiDetalhe').classList.remove('hidden');
};

const fecharModalKpi = () => {
  document.getElementById('modalKpiDetalhe').classList.add('hidden');
};

const abrirKpiAlunos = () => {
  const cabecalho = ['Matrícula', 'Nome', 'Idade', 'Sexo', 'Modalidade', 'Status'];
  const linhas = CACHE_ALUNOS.map((aluno) => [
    aluno.id || aluno.Matricula,
    aluno.Nome,
    aluno.Idade,
    aluno.Sexo || '-',
    [aluno.Modalidade1, aluno.Modalidade2].filter(Boolean).join(', '),
    renderizarBadgeStatus(aluno.Status)
  ]);
  renderizarTabelaModalKpi(cabecalho, linhas);
  abrirModalKpiComTitulo('Total de Alunos');
};

const abrirKpiModalidades = () => {
  const cabecalho = ['Código', 'Nome', 'Professor', 'Dias', 'Horários', 'Status'];
  const linhas = CACHE_MODALIDADES.map((modalidade) => [
    modalidade.id || modalidade.Codigo,
    modalidade.Nome,
    modalidade.Professor,
    modalidade.Dias,
    modalidade.Horarios,
    renderizarBadgeStatus(modalidade.Status)
  ]);
  renderizarTabelaModalKpi(cabecalho, linhas);
  abrirModalKpiComTitulo('Modalidades Cadastradas');
};

const abrirKpiPresencasOuFaltasHoje = async (statusDesejado, titulo) => {
  const filtros = obterFiltrosDashboard();
  const presencasSnap = await getDocs(collection(db, 'presencas'));
  let presencas = presencasSnap.docs.map(doc => doc.data());
  
  if (filtros.dataInicial) presencas = presencas.filter(p => p.Data >= filtros.dataInicial);
  if (filtros.dataFinal) presencas = presencas.filter(p => p.Data <= filtros.dataFinal);
  if (filtros.modalidade) presencas = presencas.filter(p => p.Modalidade === filtros.modalidade);
  if (filtros.professor) presencas = presencas.filter(p => p.Professor === filtros.professor);
  
  const registrosFiltrados = presencas.filter(p => p.Status === statusDesejado);
  
  const tituloComFiltro = titulo +
    (filtros.modalidade ? ` — ${filtros.modalidade}` : '') +
    (filtros.professor ? ` — Prof. ${filtros.professor}` : '');
  
  const cabecalho = ['Matrícula', 'Nome', 'Modalidade', 'Professor', 'Observação'];
  const linhas = registrosFiltrados.map((registro) => [
    registro.MatriculaAluno,
    registro.NomeAluno,
    registro.Modalidade,
    registro.Professor || '-',
    registro.Observacao || '-'
  ]);
  
  renderizarTabelaModalKpi(cabecalho, linhas);
  abrirModalKpiComTitulo(tituloComFiltro);
};

const abrirKpiFrequencia = () => {
  if (!ULTIMO_DASHBOARD_DADOS) return;
  const { kpis } = ULTIMO_DASHBOARD_DADOS;
  const cabecalho = ['Indicador', 'Valor'];
  const linhas = [
    ['Total de Alunos (no filtro atual)', kpis.totalAlunos],
    ['Total de Modalidades', kpis.totalModalidades],
    ['Presenças no Período', kpis.presencasHoje],
    ['Faltas no Período', kpis.faltasHoje],
    ['Frequência Média (período filtrado)', kpis.frequenciaMedia]
  ];
  renderizarTabelaModalKpi(cabecalho, linhas);
  abrirModalKpiComTitulo('Frequência Média — Resumo');
};

const configurarKpisClicaveis = () => {
  document.getElementById('btnFecharModalKpi').addEventListener('click', fecharModalKpi);
  document.getElementById('kpiTotalAlunos').closest('.kpi-card').addEventListener('click', abrirKpiAlunos);
  document.getElementById('kpiTotalModalidades').closest('.kpi-card').addEventListener('click', abrirKpiModalidades);
  document.getElementById('kpiPresencasHoje').closest('.kpi-card').addEventListener('click', () =>
    abrirKpiPresencasOuFaltasHoje('Presente', 'Presenças no Período')
  );
  document.getElementById('kpiFaltasHoje').closest('.kpi-card').addEventListener('click', () =>
    abrirKpiPresencasOuFaltasHoje('Falta', 'Faltas no Período')
  );
  document.getElementById('kpiFrequenciaMedia').closest('.kpi-card').addEventListener('click', abrirKpiFrequencia);
};

const atualizarKPIs = (kpis) => {
  document.getElementById('kpiTotalAlunos').textContent = kpis.totalAlunos;
  document.getElementById('kpiTotalModalidades').textContent = kpis.totalModalidades;
  document.getElementById('kpiPresencasHoje').textContent = kpis.presencasHoje;
  document.getElementById('kpiFaltasHoje').textContent = kpis.faltasHoje;
  document.getElementById('kpiFrequenciaMedia').textContent = kpis.frequenciaMedia;
};

const desenharGrafico = (idCanvas, configuracao) => {
  if (GRAFICOS[idCanvas]) GRAFICOS[idCanvas].destroy();
  const contexto = document.getElementById(idCanvas).getContext('2d');
  GRAFICOS[idCanvas] = new Chart(contexto, configuracao);
};

const opcoesEixoDarkMode = () => ({
  ticks: { color: CORES.textoSecundario, font: { size: 11 } },
  grid: { color: CORES.borda }
});

const atualizarGraficos = (dados) => {
  desenharGrafico('graficoTopFaltas', {
    type: 'bar',
    data: {
      labels: dados.topFaltas.map((f) => f.nome),
      datasets: [{ label: 'Faltas', data: dados.topFaltas.map((f) => f.total), backgroundColor: CORES.vermelho, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: opcoesEixoDarkMode(), y: opcoesEixoDarkMode() }
    }
  });
  
  desenharGrafico('graficoTopPresencas', {
    type: 'bar',
    data: {
      labels: dados.topPresencas.map((p) => p.nome),
      datasets: [{ label: 'Presenças', data: dados.topPresencas.map((p) => p.total), backgroundColor: CORES.verde, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: opcoesEixoDarkMode(), y: opcoesEixoDarkMode() }
    }
  });
  
  const sexoLabels = Object.keys(dados.distribuicaoSexo);
  desenharGrafico('graficoDistribuicaoSexo', {
    type: 'doughnut',
    data: {
      labels: sexoLabels,
      datasets: [{ data: sexoLabels.map((s) => dados.distribuicaoSexo[s]), backgroundColor: [CORES.azulClaro, CORES.vermelho] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CORES.textoSecundario } } }
    }
  });
  
  const modalidadeLabels = Object.keys(dados.distribuicaoModalidade);
  desenharGrafico('graficoDistribuicaoModalidade', {
    type: 'pie',
    data: {
      labels: modalidadeLabels,
      datasets: [{ data: modalidadeLabels.map((m) => dados.distribuicaoModalidade[m]), backgroundColor: CORES.paleta }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CORES.textoSecundario, boxWidth: 12 } } }
    }
  });
  
  desenharGrafico('graficoPresencaDiaria', {
    type: 'line',
    data: {
      labels: dados.presencaDiaria.map((p) => p.data),
      datasets: [
        { label: 'Presentes', data: dados.presencaDiaria.map((p) => p.presentes), borderColor: CORES.verde, backgroundColor: 'rgba(82,208,148,0.15)', tension: 0.35, fill: true },
        { label: 'Faltas', data: dados.presencaDiaria.map((p) => p.faltas), borderColor: CORES.vermelho, backgroundColor: 'rgba(229,72,77,0.12)', tension: 0.35, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CORES.textoSecundario } } },
      scales: { x: opcoesEixoDarkMode(), y: opcoesEixoDarkMode() }
    }
  });
  
  desenharGrafico('graficoPresencaMensal', {
    type: 'line',
    data: {
      labels: dados.presencaMensal.map((p) => p.mes),
      datasets: [
        { label: 'Presentes', data: dados.presencaMensal.map((p) => p.presentes), borderColor: CORES.azulClaro, backgroundColor: 'rgba(91,143,214,0.15)', tension: 0.35, fill: true },
        { label: 'Faltas', data: dados.presencaMensal.map((p) => p.faltas), borderColor: CORES.vermelho, backgroundColor: 'rgba(229,72,77,0.12)', tension: 0.35, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CORES.textoSecundario } } },
      scales: { x: opcoesEixoDarkMode(), y: opcoesEixoDarkMode() }
    }
  });
};

const configurarFiltrosDashboard = () => {
  document.getElementById('btnAplicarFiltrosDashboard').addEventListener('click', () => {
    carregarDashboard();
  });
};

/* ==================================================================================
 * 13. SELECTS GLOBAIS (MODALIDADES / PROFESSORES)
 * ================================================================================== */
const carregarModalidades = async () => {
  try {
    const snap = await getDocs(collection(db, 'modalidades'));
    CACHE_MODALIDADES = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    popularSelectsModalidade();
    renderizarTabelaModalidades();
  } catch (erro) {
    console.error('Erro ao carregar modalidades:', erro);
  }
};

const carregarProfessores = async () => {
  try {
    const snap = await getDocs(collection(db, 'professores'));
    CACHE_PROFESSORES = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    popularSelectsProfessor();
    renderizarTabelaProfessores();
  } catch (erro) {
    console.error('Erro ao carregar professores:', erro);
  }
};

const popularSelectsModalidade = () => {
  const idsComTodos = ['filtroModalidade', 'relatorioModalidade'];
  const idsSemTodos = ['presencaModalidade', 'alunoModalidade1', 'alunoModalidade2', 'modalAlunoModalidade1', 'modalAlunoModalidade2'];
  const ativas = CACHE_MODALIDADES.filter((m) => m.Status === 'Ativo' || !m.Status);
  
  idsComTodos.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Todas</option>' + ativas.map((m) => `<option value="${m.Nome}">${m.Nome}</option>`).join('');
    select.value = valorAtual;
  });
  
  idsSemTodos.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>' + ativas.map((m) => `<option value="${m.Nome}">${m.Nome}</option>`).join('');
    select.value = valorAtual;
  });
};

const popularSelectsProfessor = () => {
  const idsComTodos = ['filtroProfessor'];
  const idsSemTodos = ['modalidadeProfessor', 'modalModalidadeProfessor'];
  const ativos = CACHE_PROFESSORES.filter((p) => p.Status === 'Ativo' || !p.Status);
  
  idsComTodos.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Todos</option>' + ativos.map((p) => `<option value="${p.Nome}">${p.Nome}</option>`).join('');
    select.value = valorAtual;
  });
  
  idsSemTodos.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>' + ativos.map((p) => `<option value="${p.Nome}">${p.Nome}</option>`).join('');
    select.value = valorAtual;
  });
};

/* ==================================================================================
 * 13.5 GERADOR DE MATRÍCULA NUMÉRICA SEQUENCIAL
 * ================================================================================== */
const obterProximaMatricula = async () => {
  const contadorRef = doc(db, 'contadores', 'alunos');
  const proximoValor = await runTransaction(db, async (transacao) => {
    const contadorSnap = await transacao.get(contadorRef);
    const valorAtual = contadorSnap.exists() ? Number(contadorSnap.data().Valor || 0) : 0;
    const proximo = valorAtual + 1;
    transacao.set(contadorRef, { Valor: proximo }, { merge: true });
    return proximo;
  });
  return proximoValor;
};

/* ==================================================================================
 * 14. MÓDULO ALUNOS
 * ================================================================================== */
const carregarAlunos = async () => {
  try {
    const snap = await getDocs(collection(db, 'alunos'));
    CACHE_ALUNOS = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarTabelaAlunos();
    renderizarTabelaAlunosLista();
    popularSelectRelatorioAluno();
  } catch (erro) {
    console.error('Erro ao carregar alunos:', erro);
  }
};

const renderizarTabelaAlunosLista = () => {
  const linhas = CACHE_ALUNOS.map((aluno) => `
    <tr>
      <td>${renderizarFotoTabela(aluno.FotoURL)}</td>
      <td>${aluno.id || aluno.Matricula}</td>
      <td>${aluno.Nome}</td>
      <td>${aluno.Idade}</td>
      <td>${aluno.Sexo || '-'}</td>
      <td>${[aluno.Modalidade1, aluno.Modalidade2].filter(Boolean).join(', ')}</td>
      <td>${renderizarBadgeStatus(aluno.Status)}</td>
      <td>
        <button class="btn-icone acao-editar-aluno-modal" data-matricula="${aluno.id || aluno.Matricula}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icone acao-excluir acao-excluir-aluno-lista" data-matricula="${aluno.id || aluno.Matricula}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  popularDataTable('tabelaAlunosLista', linhas, 2);
};

const renderizarTabelaAlunos = () => {
  const linhas = CACHE_ALUNOS.map((aluno) => `
    <tr>
      <td>${renderizarFotoTabela(aluno.FotoURL)}</td>
      <td>${aluno.id || aluno.Matricula}</td>
      <td>${aluno.Nome}</td>
      <td>${aluno.Idade}</td>
      <td>${aluno.Sexo || '-'}</td>
      <td>${[aluno.Modalidade1, aluno.Modalidade2].filter(Boolean).join(', ')}</td>
      <td>${renderizarBadgeStatus(aluno.Status)}</td>
      <td>
        <button class="btn-icone acao-editar-aluno" data-matricula="${aluno.id || aluno.Matricula}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icone acao-excluir acao-excluir-aluno" data-matricula="${aluno.id || aluno.Matricula}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  popularDataTable('tabelaAlunos', linhas, 2);
};

const popularSelectRelatorioAluno = () => {
  const select = document.getElementById('relatorioAlunoMatricula');
  select.innerHTML = '<option value="">Selecione...</option>' +
    CACHE_ALUNOS.map((a) => `<option value="${a.id || a.Matricula}">${a.id || a.Matricula} - ${a.Nome}</option>`).join('');
};

const limparFormAluno = () => {
  document.getElementById('formAluno').reset();
  document.getElementById('alunoMatricula').value = '';
  document.getElementById('alunoFoto').value = '';
  document.getElementById('alunoFotoPreview').src = '';
  document.getElementById('alunoIdade').value = '';
};

const preencherFormAluno = (aluno) => {
  document.getElementById('alunoMatricula').value = aluno.id || aluno.Matricula;
  document.getElementById('alunoFoto').value = aluno.FotoURL || '';
  document.getElementById('alunoFotoPreview').src = aluno.FotoURL || '';
  document.getElementById('alunoNome').value = aluno.Nome || '';
  document.getElementById('alunoNascimento').value = paraInputDate(aluno.Nascimento);
  document.getElementById('alunoIdade').value = aluno.Idade || '';
  document.getElementById('alunoCPF').value = aluno.CPF || '';
  document.getElementById('alunoRG').value = aluno.RG || '';
  document.getElementById('alunoSexo').value = aluno.Sexo || '';
  document.getElementById('alunoEstadoCivil').value = aluno.EstadoCivil || '';
  document.getElementById('alunoNaturalidade').value = aluno.Naturalidade || '';
  document.getElementById('alunoTelefone').value = aluno.Telefone || '';
  document.getElementById('alunoCelular').value = aluno.Celular || '';
  document.getElementById('alunoEmail').value = aluno.Email || '';
  document.getElementById('alunoCEP').value = aluno.CEP || '';
  document.getElementById('alunoEndereco').value = aluno.Endereco || '';
  document.getElementById('alunoNumero').value = aluno.Numero || '';
  document.getElementById('alunoComplemento').value = aluno.Complemento || '';
  document.getElementById('alunoBairro').value = aluno.Bairro || '';
  document.getElementById('alunoCidade').value = aluno.Cidade || '';
  document.getElementById('alunoEstado').value = aluno.Estado || '';
  document.getElementById('alunoTipoSanguineo').value = aluno.TipoSanguineo || '';
  document.getElementById('alunoAlergias').value = aluno.Alergias || '';
  document.getElementById('alunoMedicamentos').value = aluno.Medicamentos || '';
  document.getElementById('alunoCondicaoMedica').value = aluno.CondicaoMedica || '';
  document.getElementById('alunoDeficiencia').value = aluno.Deficiencia || '';
  document.getElementById('alunoAtividadeFisica').value = aluno.AtividadeFisica || '';
  document.getElementById('alunoRestricoes').value = aluno.Restricoes || '';
  document.getElementById('alunoObservacoesSaude').value = aluno.ObservacoesSaude || '';
  document.getElementById('responsavelNome').value = aluno.ResponsavelNome || '';
  document.getElementById('responsavelParentesco').value = aluno.ResponsavelParentesco || '';
  document.getElementById('responsavelCPF').value = aluno.ResponsavelCPF || '';
  document.getElementById('responsavelTelefone').value = aluno.ResponsavelTelefone || '';
  document.getElementById('responsavelCelular').value = aluno.ResponsavelCelular || '';
  document.getElementById('responsavelEmail').value = aluno.ResponsavelEmail || '';
  document.getElementById('emerg1Nome').value = aluno.Emerg1Nome || '';
  document.getElementById('emerg1Telefone').value = aluno.Emerg1Telefone || '';
  document.getElementById('emerg1Parentesco').value = aluno.Emerg1Parentesco || '';
  document.getElementById('emerg2Nome').value = aluno.Emerg2Nome || '';
  document.getElementById('emerg2Telefone').value = aluno.Emerg2Telefone || '';
  document.getElementById('emerg2Parentesco').value = aluno.Emerg2Parentesco || '';
  document.getElementById('emerg3Nome').value = aluno.Emerg3Nome || '';
  document.getElementById('emerg3Telefone').value = aluno.Emerg3Telefone || '';
  document.getElementById('emerg3Parentesco').value = aluno.Emerg3Parentesco || '';
  document.getElementById('autorizaImagem').checked = aluno.AutorizaImagem === true;
  document.getElementById('autorizaSaidaDesacompanhado').checked = aluno.AutorizaSaidaDesacompanhado === true;
  document.getElementById('autorizaEventos').checked = aluno.AutorizaEventos === true;
  document.getElementById('alunoModalidade1').value = aluno.Modalidade1 || '';
  document.getElementById('alunoModalidade2').value = aluno.Modalidade2 || '';
  document.getElementById('alunoDataMatricula').value = paraInputDate(aluno.DataMatricula);
  document.getElementById('alunoStatus').value = aluno.Status || 'Ativo';
  trocarTela('telaAlunos');
  document.getElementById('formAluno').scrollIntoView({ behavior: 'smooth' });
};

const coletarDadosFormAluno = () => ({
  Foto: document.getElementById('alunoFoto').value,
  Nome: document.getElementById('alunoNome').value.trim(),
  Nascimento: normalizarDataParaEnvio(document.getElementById('alunoNascimento').value),
  CPF: document.getElementById('alunoCPF').value.trim(),
  RG: document.getElementById('alunoRG').value.trim(),
  Sexo: document.getElementById('alunoSexo').value,
  EstadoCivil: document.getElementById('alunoEstadoCivil').value,
  Naturalidade: document.getElementById('alunoNaturalidade').value.trim(),
  Telefone: document.getElementById('alunoTelefone').value.trim(),
  Celular: document.getElementById('alunoCelular').value.trim(),
  Email: document.getElementById('alunoEmail').value.trim(),
  CEP: document.getElementById('alunoCEP').value.trim(),
  Endereco: document.getElementById('alunoEndereco').value.trim(),
  Numero: document.getElementById('alunoNumero').value.trim(),
  Complemento: document.getElementById('alunoComplemento').value.trim(),
  Bairro: document.getElementById('alunoBairro').value.trim(),
  Cidade: document.getElementById('alunoCidade').value.trim(),
  Estado: document.getElementById('alunoEstado').value.trim().toUpperCase(),
  TipoSanguineo: document.getElementById('alunoTipoSanguineo').value,
  Alergias: document.getElementById('alunoAlergias').value.trim(),
  Medicamentos: document.getElementById('alunoMedicamentos').value.trim(),
  CondicaoMedica: document.getElementById('alunoCondicaoMedica').value.trim(),
  Deficiencia: document.getElementById('alunoDeficiencia').value.trim(),
  AtividadeFisica: document.getElementById('alunoAtividadeFisica').value.trim(),
  Restricoes: document.getElementById('alunoRestricoes').value.trim(),
  ObservacoesSaude: document.getElementById('alunoObservacoesSaude').value.trim(),
  ResponsavelNome: document.getElementById('responsavelNome').value.trim(),
  ResponsavelParentesco: document.getElementById('responsavelParentesco').value.trim(),
  ResponsavelCPF: document.getElementById('responsavelCPF').value.trim(),
  ResponsavelTelefone: document.getElementById('responsavelTelefone').value.trim(),
  ResponsavelCelular: document.getElementById('responsavelCelular').value.trim(),
  ResponsavelEmail: document.getElementById('responsavelEmail').value.trim(),
  Emerg1Nome: document.getElementById('emerg1Nome').value.trim(),
  Emerg1Telefone: document.getElementById('emerg1Telefone').value.trim(),
  Emerg1Parentesco: document.getElementById('emerg1Parentesco').value.trim(),
  Emerg2Nome: document.getElementById('emerg2Nome').value.trim(),
  Emerg2Telefone: document.getElementById('emerg2Telefone').value.trim(),
  Emerg2Parentesco: document.getElementById('emerg2Parentesco').value.trim(),
  Emerg3Nome: document.getElementById('emerg3Nome').value.trim(),
  Emerg3Telefone: document.getElementById('emerg3Telefone').value.trim(),
  Emerg3Parentesco: document.getElementById('emerg3Parentesco').value.trim(),
  AutorizaImagem: document.getElementById('autorizaImagem').checked,
  AutorizaSaidaDesacompanhado: document.getElementById('autorizaSaidaDesacompanhado').checked,
  AutorizaEventos: document.getElementById('autorizaEventos').checked,
  Modalidade1: document.getElementById('alunoModalidade1').value,
  Modalidade2: document.getElementById('alunoModalidade2').value,
  DataMatricula: normalizarDataParaEnvio(document.getElementById('alunoDataMatricula').value),
  Status: document.getElementById('alunoStatus').value
});

const configurarFormularioAluno = () => {
  document.getElementById('alunoNascimento').addEventListener('change', (evento) => {
    document.getElementById('alunoIdade').value = calcularIdadeLocal(evento.target.value);
  });
  
  const processarArquivoFoto = (arquivo) => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      document.getElementById('alunoFoto').value = leitor.result;
      document.getElementById('alunoFotoPreview').src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  };
  
  document.getElementById('avatarUploadCirculo').addEventListener('click', () => {
    document.getElementById('alunoFotoArquivo').click();
  });
  
  document.getElementById('btnAvatarTirarFoto').addEventListener('click', () => {
    document.getElementById('alunoFotoCamera').click();
  });
  
  document.getElementById('btnAvatarGaleria').addEventListener('click', () => {
    document.getElementById('alunoFotoArquivo').click();
  });
  
  document.getElementById('alunoFotoCamera').addEventListener('change', (evento) => {
    processarArquivoFoto(evento.target.files[0]);
  });
  
  document.getElementById('alunoFotoArquivo').addEventListener('change', (evento) => {
    processarArquivoFoto(evento.target.files[0]);
  });
  
  document.getElementById('alunoCEP').addEventListener('blur', async () => {
    const cepLimpo = document.getElementById('alunoCEP').value.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dadosCep = await resposta.json();
      if (dadosCep.erro) return;
      document.getElementById('alunoEndereco').value = dadosCep.logradouro || '';
      document.getElementById('alunoBairro').value = dadosCep.bairro || '';
      document.getElementById('alunoCidade').value = dadosCep.localidade || '';
      document.getElementById('alunoEstado').value = dadosCep.uf || '';
    } catch (erro) {
      // Falha silenciosa
    }
  });
  
  document.getElementById('formAluno').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const matricula = document.getElementById('alunoMatricula').value;
    const dados = coletarDadosFormAluno();
    
    try {
      mostrarLoading(matricula ? 'Atualizando aluno...' : 'Cadastrando aluno...');
      
      // Upload da foto se houver
      let fotoURL = dados.Foto;
      if (dados.Foto && dados.Foto.startsWith('data:')) {
        const response = await fetch(dados.Foto);
        const blob = await response.blob();
        const storageRef = ref(storage, `fotos/${matricula || 'novo'}-${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, blob);
        fotoURL = await getDownloadURL(snapshot.ref);
      }
      
      const { Foto, ...dadosSemFotoBase64 } = dados;
      const alunoData = { ...dadosSemFotoBase64, FotoURL: fotoURL };
      
      if (matricula) {
        await updateDoc(doc(db, 'alunos', matricula), alunoData);
        exibirToast('Aluno atualizado com sucesso.', 'sucesso');
      } else {
        const novaMatricula = await obterProximaMatricula();
        await setDoc(doc(db, 'alunos', String(novaMatricula)), alunoData);
        exibirToast('Aluno cadastrado com sucesso. Matrícula: ' + novaMatricula, 'sucesso');
      }
      
      limparFormAluno();
      await carregarAlunos();
      popularSelectsModalidade();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao salvar aluno: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  document.getElementById('btnLimparFormAluno').addEventListener('click', limparFormAluno);
  
  $(document).on('click', '.acao-editar-aluno', async function () {
    const matricula = $(this).data('matricula');
    const aluno = CACHE_ALUNOS.find(a => (a.id || a.Matricula) === matricula);
    if (aluno) preencherFormAluno(aluno);
  });
  
  $(document).on('click', '.acao-excluir-aluno', async function () {
    const matricula = $(this).data('matricula');
    const confirmado = await confirmarAcao('Excluir aluno', `Deseja realmente excluir o aluno de matrícula ${matricula}? Esta ação não pode ser desfeita.`);
    if (!confirmado) return;
    
    try {
      mostrarLoading('Excluindo aluno...');
      await deleteDoc(doc(db, 'alunos', matricula));
      exibirToast('Aluno excluído com sucesso.', 'sucesso');
      await carregarAlunos();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao excluir aluno: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  document.getElementById('inputImportarAlunos').addEventListener('change', importarPlanilhaAlunos);
};

/* ==================================================================================
 * 14.5 MODAL DE ALUNO (CRIAÇÃO/EDIÇÃO A PARTIR DA TELA "ALUNOS")
 * ================================================================================== */
const limparFormModalAluno = () => {
  document.getElementById('formModalAluno').reset();
  document.getElementById('modalAlunoMatricula').value = '';
  document.getElementById('modalAlunoFoto').value = '';
  document.getElementById('modalAlunoFotoPreview').src = '';
  document.getElementById('modalAlunoIdade').value = '';
};

const abrirModalAluno = () => {
  document.getElementById('modalFormAluno').classList.remove('hidden');
};

const fecharModalAluno = () => {
  document.getElementById('modalFormAluno').classList.add('hidden');
  limparFormModalAluno();
};

const preencherFormModalAluno = (aluno) => {
  document.getElementById('modalAlunoMatricula').value = aluno.id || aluno.Matricula;
  document.getElementById('modalAlunoFoto').value = aluno.FotoURL || '';
  document.getElementById('modalAlunoFotoPreview').src = aluno.FotoURL || '';
  document.getElementById('modalAlunoNome').value = aluno.Nome || '';
  document.getElementById('modalAlunoNascimento').value = paraInputDate(aluno.Nascimento);
  document.getElementById('modalAlunoIdade').value = aluno.Idade || '';
  document.getElementById('modalAlunoCPF').value = aluno.CPF || '';
  document.getElementById('modalAlunoRG').value = aluno.RG || '';
  document.getElementById('modalAlunoSexo').value = aluno.Sexo || '';
  document.getElementById('modalAlunoEstadoCivil').value = aluno.EstadoCivil || '';
  document.getElementById('modalAlunoNaturalidade').value = aluno.Naturalidade || '';
  document.getElementById('modalAlunoTelefone').value = aluno.Telefone || '';
  document.getElementById('modalAlunoCelular').value = aluno.Celular || '';
  document.getElementById('modalAlunoEmail').value = aluno.Email || '';
  document.getElementById('modalAlunoCEP').value = aluno.CEP || '';
  document.getElementById('modalAlunoEndereco').value = aluno.Endereco || '';
  document.getElementById('modalAlunoNumero').value = aluno.Numero || '';
  document.getElementById('modalAlunoComplemento').value = aluno.Complemento || '';
  document.getElementById('modalAlunoBairro').value = aluno.Bairro || '';
  document.getElementById('modalAlunoCidade').value = aluno.Cidade || '';
  document.getElementById('modalAlunoEstado').value = aluno.Estado || '';
  document.getElementById('modalAlunoTipoSanguineo').value = aluno.TipoSanguineo || '';
  document.getElementById('modalAlunoAlergias').value = aluno.Alergias || '';
  document.getElementById('modalAlunoMedicamentos').value = aluno.Medicamentos || '';
  document.getElementById('modalAlunoCondicaoMedica').value = aluno.CondicaoMedica || '';
  document.getElementById('modalAlunoDeficiencia').value = aluno.Deficiencia || '';
  document.getElementById('modalAlunoAtividadeFisica').value = aluno.AtividadeFisica || '';
  document.getElementById('modalAlunoRestricoes').value = aluno.Restricoes || '';
  document.getElementById('modalAlunoObservacoesSaude').value = aluno.ObservacoesSaude || '';
  document.getElementById('modalResponsavelNome').value = aluno.ResponsavelNome || '';
  document.getElementById('modalResponsavelParentesco').value = aluno.ResponsavelParentesco || '';
  document.getElementById('modalResponsavelCPF').value = aluno.ResponsavelCPF || '';
  document.getElementById('modalResponsavelTelefone').value = aluno.ResponsavelTelefone || '';
  document.getElementById('modalResponsavelCelular').value = aluno.ResponsavelCelular || '';
  document.getElementById('modalResponsavelEmail').value = aluno.ResponsavelEmail || '';
  document.getElementById('modalEmerg1Nome').value = aluno.Emerg1Nome || '';
  document.getElementById('modalEmerg1Telefone').value = aluno.Emerg1Telefone || '';
  document.getElementById('modalEmerg1Parentesco').value = aluno.Emerg1Parentesco || '';
  document.getElementById('modalEmerg2Nome').value = aluno.Emerg2Nome || '';
  document.getElementById('modalEmerg2Telefone').value = aluno.Emerg2Telefone || '';
  document.getElementById('modalEmerg2Parentesco').value = aluno.Emerg2Parentesco || '';
  document.getElementById('modalEmerg3Nome').value = aluno.Emerg3Nome || '';
  document.getElementById('modalEmerg3Telefone').value = aluno.Emerg3Telefone || '';
  document.getElementById('modalEmerg3Parentesco').value = aluno.Emerg3Parentesco || '';
  document.getElementById('modalAutorizaImagem').checked = aluno.AutorizaImagem === true;
  document.getElementById('modalAutorizaSaidaDesacompanhado').checked = aluno.AutorizaSaidaDesacompanhado === true;
  document.getElementById('modalAutorizaEventos').checked = aluno.AutorizaEventos === true;
  document.getElementById('modalAlunoModalidade1').value = aluno.Modalidade1 || '';
  document.getElementById('modalAlunoModalidade2').value = aluno.Modalidade2 || '';
  document.getElementById('modalAlunoDataMatricula').value = paraInputDate(aluno.DataMatricula);
  document.getElementById('modalAlunoStatus').value = aluno.Status || 'Ativo';
  document.getElementById('modalFormAlunoTitulo').textContent = 'Editar Aluno';
  abrirModalAluno();
};

const coletarDadosFormModalAluno = () => ({
  Foto: document.getElementById('modalAlunoFoto').value,
  Nome: document.getElementById('modalAlunoNome').value.trim(),
  Nascimento: normalizarDataParaEnvio(document.getElementById('modalAlunoNascimento').value),
  CPF: document.getElementById('modalAlunoCPF').value.trim(),
  RG: document.getElementById('modalAlunoRG').value.trim(),
  Sexo: document.getElementById('modalAlunoSexo').value,
  EstadoCivil: document.getElementById('modalAlunoEstadoCivil').value,
  Naturalidade: document.getElementById('modalAlunoNaturalidade').value.trim(),
  Telefone: document.getElementById('modalAlunoTelefone').value.trim(),
  Celular: document.getElementById('modalAlunoCelular').value.trim(),
  Email: document.getElementById('modalAlunoEmail').value.trim(),
  CEP: document.getElementById('modalAlunoCEP').value.trim(),
  Endereco: document.getElementById('modalAlunoEndereco').value.trim(),
  Numero: document.getElementById('modalAlunoNumero').value.trim(),
  Complemento: document.getElementById('modalAlunoComplemento').value.trim(),
  Bairro: document.getElementById('modalAlunoBairro').value.trim(),
  Cidade: document.getElementById('modalAlunoCidade').value.trim(),
  Estado: document.getElementById('modalAlunoEstado').value.trim().toUpperCase(),
  TipoSanguineo: document.getElementById('modalAlunoTipoSanguineo').value,
  Alergias: document.getElementById('modalAlunoAlergias').value.trim(),
  Medicamentos: document.getElementById('modalAlunoMedicamentos').value.trim(),
  CondicaoMedica: document.getElementById('modalAlunoCondicaoMedica').value.trim(),
  Deficiencia: document.getElementById('modalAlunoDeficiencia').value.trim(),
  AtividadeFisica: document.getElementById('modalAlunoAtividadeFisica').value.trim(),
  Restricoes: document.getElementById('modalAlunoRestricoes').value.trim(),
  ObservacoesSaude: document.getElementById('modalAlunoObservacoesSaude').value.trim(),
  ResponsavelNome: document.getElementById('modalResponsavelNome').value.trim(),
  ResponsavelParentesco: document.getElementById('modalResponsavelParentesco').value.trim(),
  ResponsavelCPF: document.getElementById('modalResponsavelCPF').value.trim(),
  ResponsavelTelefone: document.getElementById('modalResponsavelTelefone').value.trim(),
  ResponsavelCelular: document.getElementById('modalResponsavelCelular').value.trim(),
  ResponsavelEmail: document.getElementById('modalResponsavelEmail').value.trim(),
  Emerg1Nome: document.getElementById('modalEmerg1Nome').value.trim(),
  Emerg1Telefone: document.getElementById('modalEmerg1Telefone').value.trim(),
  Emerg1Parentesco: document.getElementById('modalEmerg1Parentesco').value.trim(),
  Emerg2Nome: document.getElementById('modalEmerg2Nome').value.trim(),
  Emerg2Telefone: document.getElementById('modalEmerg2Telefone').value.trim(),
  Emerg2Parentesco: document.getElementById('modalEmerg2Parentesco').value.trim(),
  Emerg3Nome: document.getElementById('modalEmerg3Nome').value.trim(),
  Emerg3Telefone: document.getElementById('modalEmerg3Telefone').value.trim(),
  Emerg3Parentesco: document.getElementById('modalEmerg3Parentesco').value.trim(),
  AutorizaImagem: document.getElementById('modalAutorizaImagem').checked,
  AutorizaSaidaDesacompanhado: document.getElementById('modalAutorizaSaidaDesacompanhado').checked,
  AutorizaEventos: document.getElementById('modalAutorizaEventos').checked,
  Modalidade1: document.getElementById('modalAlunoModalidade1').value,
  Modalidade2: document.getElementById('modalAlunoModalidade2').value,
  DataMatricula: normalizarDataParaEnvio(document.getElementById('modalAlunoDataMatricula').value),
  Status: document.getElementById('modalAlunoStatus').value
});

const configurarModalAluno = () => {
  const vincularMascaraModal = (id, funcaoMascara) => {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    elemento.addEventListener('input', () => { elemento.value = funcaoMascara(elemento.value); });
  };
  
  vincularMascaraModal('modalAlunoCPF', aplicarMascaraCPF);
  vincularMascaraModal('modalResponsavelCPF', aplicarMascaraCPF);
  vincularMascaraModal('modalAlunoTelefone', aplicarMascaraTelefoneFixo);
  vincularMascaraModal('modalResponsavelTelefone', aplicarMascaraTelefoneFixo);
  vincularMascaraModal('modalEmerg1Telefone', aplicarMascaraTelefoneFixo);
  vincularMascaraModal('modalEmerg2Telefone', aplicarMascaraTelefoneFixo);
  vincularMascaraModal('modalEmerg3Telefone', aplicarMascaraTelefoneFixo);
  vincularMascaraModal('modalAlunoCelular', aplicarMascaraCelular);
  vincularMascaraModal('modalResponsavelCelular', aplicarMascaraCelular);
  vincularMascaraModal('modalAlunoCEP', aplicarMascaraCEP);
  
  document.getElementById('modalAlunoNascimento').addEventListener('change', (evento) => {
    document.getElementById('modalAlunoIdade').value = calcularIdadeLocal(evento.target.value);
  });
  
  const processarArquivoFotoModal = (arquivo) => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      document.getElementById('modalAlunoFoto').value = leitor.result;
      document.getElementById('modalAlunoFotoPreview').src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  };
  
  document.getElementById('modalAvatarUploadCirculo').addEventListener('click', () => {
    document.getElementById('modalAlunoFotoArquivo').click();
  });
  
  document.getElementById('modalBtnAvatarTirarFoto').addEventListener('click', () => {
    document.getElementById('modalAlunoFotoCamera').click();
  });
  
  document.getElementById('modalBtnAvatarGaleria').addEventListener('click', () => {
    document.getElementById('modalAlunoFotoArquivo').click();
  });
  
  document.getElementById('modalAlunoFotoCamera').addEventListener('change', (evento) => {
    processarArquivoFotoModal(evento.target.files[0]);
  });
  
  document.getElementById('modalAlunoFotoArquivo').addEventListener('change', (evento) => {
    processarArquivoFotoModal(evento.target.files[0]);
  });
  
  document.getElementById('modalAlunoCEP').addEventListener('blur', async () => {
    const cepLimpo = document.getElementById('modalAlunoCEP').value.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dadosCep = await resposta.json();
      if (dadosCep.erro) return;
      document.getElementById('modalAlunoEndereco').value = dadosCep.logradouro || '';
      document.getElementById('modalAlunoBairro').value = dadosCep.bairro || '';
      document.getElementById('modalAlunoCidade').value = dadosCep.localidade || '';
      document.getElementById('modalAlunoEstado').value = dadosCep.uf || '';
    } catch (erro) {
      // Falha silenciosa
    }
  });
  
  document.getElementById('btnFecharModalAluno').addEventListener('click', fecharModalAluno);
  document.getElementById('btnCancelarModalAluno').addEventListener('click', fecharModalAluno);
  
  document.getElementById('formModalAluno').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    
    const camposObrigatoriosModal = [
      { id: 'modalAlunoNome', rotulo: 'Nome' },
      { id: 'modalAlunoNascimento', rotulo: 'Nascimento' },
      { id: 'modalAlunoSexo', rotulo: 'Sexo' },
      { id: 'modalAlunoModalidade1', rotulo: '1ª Modalidade' }
    ];
    
    const campoFaltando = camposObrigatoriosModal.find((c) => !document.getElementById(c.id).value);
    if (campoFaltando) {
      exibirToast('Preencha o campo obrigatório: ' + campoFaltando.rotulo, 'erro');
      document.getElementById(campoFaltando.id).focus();
      return;
    }
    
    const matricula = document.getElementById('modalAlunoMatricula').value;
    const dados = coletarDadosFormModalAluno();
    
    try {
      mostrarLoading(matricula ? 'Atualizando aluno...' : 'Cadastrando aluno...');
      
      let fotoURL = dados.Foto;
      if (dados.Foto && dados.Foto.startsWith('data:')) {
        const response = await fetch(dados.Foto);
        const blob = await response.blob();
        const storageRef = ref(storage, `fotos/${matricula || 'novo'}-${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, blob);
        fotoURL = await getDownloadURL(snapshot.ref);
      }
      
      const alunoData = { ...dados, FotoURL: fotoURL };
      
      if (matricula) {
        await updateDoc(doc(db, 'alunos', matricula), alunoData);
        exibirToast('Aluno atualizado com sucesso.', 'sucesso');
      } else {
        const docRef = await addDoc(collection(db, 'alunos'), alunoData);
        exibirToast('Aluno cadastrado com sucesso.', 'sucesso');
      }
      
      fecharModalAluno();
      await carregarAlunos();
      popularSelectsModalidade();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao salvar aluno: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  $(document).on('click', '.acao-editar-aluno-modal', async function () {
    const matricula = $(this).data('matricula');
    const aluno = CACHE_ALUNOS.find(a => (a.id || a.Matricula) === matricula);
    if (aluno) preencherFormModalAluno(aluno);
  });
  
  $(document).on('click', '.acao-excluir-aluno-lista', async function () {
    const matricula = $(this).data('matricula');
    const confirmado = await confirmarAcao('Excluir aluno', `Deseja realmente excluir o aluno de matrícula ${matricula}? Esta ação não pode ser desfeita.`);
    if (!confirmado) return;
    
    try {
      mostrarLoading('Excluindo aluno...');
      await deleteDoc(doc(db, 'alunos', matricula));
      exibirToast('Aluno excluído com sucesso.', 'sucesso');
      await carregarAlunos();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao excluir aluno: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};

/* ==================================================================================
 * 15. IMPORTAÇÃO DE ALUNOS VIA PLANILHA (SheetJS)
 * ================================================================================== */
const MAPA_COLUNAS_IMPORTACAO = {
  Nome: ['Nome', 'Aluno', 'Nome do Aluno'],
  Nascimento: ['Nascimento', 'Data de Nascimento', 'DataNascimento'],
  CPF: ['CPF'],
  RG: ['RG'],
  Sexo: ['Sexo'],
  Telefone: ['Telefone', 'Fone'],
  Celular: ['Celular', 'WhatsApp'],
  Email: ['Email', 'E-mail'],
  CEP: ['CEP'],
  Endereco: ['Endereco', 'Endereço', 'Logradouro'],
  Numero: ['Numero', 'Número'],
  Bairro: ['Bairro'],
  Cidade: ['Cidade'],
  Estado: ['Estado', 'UF'],
  Modalidade1: ['Modalidade1', 'Modalidade', '1ª Modalidade'],
  Modalidade2: ['Modalidade2', '2ª Modalidade'],
  Status: ['Status']
};

const localizarValorLinha = (linha, chavesPossiveis) => {
  for (const chave of chavesPossiveis) {
    if (linha[chave] !== undefined && linha[chave] !== null && linha[chave] !== '') {
      return linha[chave];
    }
  }
  return '';
};

const mapearLinhaImportacao = (linha) => {
  const objeto = {};
  Object.keys(MAPA_COLUNAS_IMPORTACAO).forEach((campo) => {
    objeto[campo] = localizarValorLinha(linha, MAPA_COLUNAS_IMPORTACAO[campo]);
  });
  
  if (objeto.Nascimento instanceof Date) {
    objeto.Nascimento = paraInputDate(objeto.Nascimento);
  } else if (typeof objeto.Nascimento === 'number') {
    const dataConvertida = XLSX.SSF.parse_date_code(objeto.Nascimento);
    objeto.Nascimento = dataConvertida
      ? `${dataConvertida.y}-${String(dataConvertida.m).padStart(2, '0')}-${String(dataConvertida.d).padStart(2, '0')}`
      : '';
  }
  
  objeto.Status = objeto.Status || 'Ativo';
  return objeto;
};

const importarPlanilhaAlunos = async (evento) => {
  const arquivo = evento.target.files[0];
  if (!arquivo) return;
  
  mostrarLoading('Lendo planilha...');
  
  try {
    const bufferArquivo = await arquivo.arrayBuffer();
    const pastaTrabalho = XLSX.read(bufferArquivo, { type: 'array', cellDates: true });
    const primeiraAba = pastaTrabalho.Sheets[pastaTrabalho.SheetNames[0]];
    const linhasBrutas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });
    
    if (linhasBrutas.length === 0) {
      exibirToast('A planilha selecionada está vazia.', 'erro');
      return;
    }
    
    const alunosNormalizados = linhasBrutas.map(mapearLinhaImportacao).filter((a) => a.Nome);
    mostrarLoading(`Importando ${alunosNormalizados.length} alunos...`);
    
    let importados = 0;
    let ignorados = 0;
    
    for (const aluno of alunosNormalizados) {
      try {
        await addDoc(collection(db, 'alunos'), aluno);
        importados++;
      } catch (erro) {
        ignorados++;
      }
    }
    
    exibirToast(`Importação concluída: ${importados} importados, ${ignorados} ignorados.`, 'sucesso');
    await carregarAlunos();
    await carregarDashboard(false);
  } catch (erro) {
    exibirToast('Erro ao ler a planilha: ' + erro.message, 'erro');
  } finally {
    esconderLoading();
    evento.target.value = '';
  }
};

/* ==================================================================================
 * 16. MÓDULO MODALIDADES
 * ================================================================================== */
const renderizarTabelaModalidades = () => {
  const linhas = CACHE_MODALIDADES.map((modalidade) => `
    <tr>
      <td>${modalidade.id || modalidade.Codigo}</td>
      <td>${modalidade.Nome}</td>
      <td>${modalidade.Professor}</td>
      <td>${modalidade.Dias}</td>
      <td>${modalidade.Horarios}</td>
      <td>${renderizarBadgeStatus(modalidade.Status)}</td>
      <td>
        <button class="btn-icone acao-editar-modalidade" data-codigo="${modalidade.id || modalidade.Codigo}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icone acao-excluir acao-excluir-modalidade" data-codigo="${modalidade.id || modalidade.Codigo}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  popularDataTable('tabelaModalidades', linhas, 1);
};

const limparFormModalidade = () => {
  document.getElementById('formModalidade').reset();
  document.getElementById('modalidadeCodigo').value = '';
  document.getElementById('modalidadeCodigoExibicao').value = '';
};

const coletarDadosFormModalidade = () => ({
  Nome: document.getElementById('modalidadeNome').value.trim(),
  Professor: document.getElementById('modalidadeProfessor').value,
  Dias: document.getElementById('modalidadeDias').value.trim(),
  Horarios: document.getElementById('modalidadeHorarios').value.trim(),
  FaixaEtaria: document.getElementById('modalidadeFaixaEtaria').value.trim(),
  MaxAlunos: document.getElementById('modalidadeMaxAlunos').value,
  Local: document.getElementById('modalidadeLocal').value.trim(),
  Descricao: document.getElementById('modalidadeDescricao').value.trim(),
  Status: document.getElementById('modalidadeStatus').value
});

const configurarFormularioModalidade = () => {
  document.getElementById('formModalidade').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const codigo = document.getElementById('modalidadeCodigo').value;
    const dados = coletarDadosFormModalidade();
    
    try {
      mostrarLoading(codigo ? 'Atualizando modalidade...' : 'Cadastrando modalidade...');
      
      if (codigo) {
        await updateDoc(doc(db, 'modalidades', codigo), dados);
        exibirToast('Modalidade atualizada com sucesso.', 'sucesso');
      } else {
        await addDoc(collection(db, 'modalidades'), dados);
        exibirToast('Modalidade cadastrada com sucesso.', 'sucesso');
      }
      
      limparFormModalidade();
      await carregarModalidades();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao salvar modalidade: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  document.getElementById('btnLimparFormModalidade').addEventListener('click', limparFormModalidade);
  
  $(document).on('click', '.acao-editar-modalidade', function () {
    const codigo = $(this).data('codigo');
    const modalidade = CACHE_MODALIDADES.find((m) => (m.id || m.Codigo) === codigo);
    if (!modalidade) return;
    preencherFormModalModalidade(modalidade);
  });
  
  $(document).on('click', '.acao-excluir-modalidade', async function () {
    const codigo = $(this).data('codigo');
    const modalidade = CACHE_MODALIDADES.find((m) => (m.id || m.Codigo) === codigo);
    const nomeExibicao = modalidade ? modalidade.Nome : codigo;
    const confirmado = await confirmarAcao('Excluir modalidade', `Deseja realmente excluir a modalidade "${nomeExibicao}"?`);
    if (!confirmado) return;
    
    try {
      mostrarLoading('Excluindo modalidade...');
      await deleteDoc(doc(db, 'modalidades', codigo));
      exibirToast('Modalidade excluída com sucesso.', 'sucesso');
      await carregarModalidades();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao excluir modalidade: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};

/* ==================================================================================
 * 16.5 MODAL DE MODALIDADE (EDIÇÃO)
 * ================================================================================== */
const limparFormModalModalidade = () => {
  document.getElementById('formModalModalidade').reset();
  document.getElementById('modalModalidadeCodigo').value = '';
  document.getElementById('modalModalidadeCodigoExibicao').value = '';
};

const abrirModalModalidade = () => {
  document.getElementById('modalFormModalidade').classList.remove('hidden');
};

const fecharModalModalidade = () => {
  document.getElementById('modalFormModalidade').classList.add('hidden');
  limparFormModalModalidade();
};

const preencherFormModalModalidade = (modalidade) => {
  document.getElementById('modalModalidadeCodigo').value = modalidade.id || modalidade.Codigo;
  document.getElementById('modalModalidadeCodigoExibicao').value = modalidade.id || modalidade.Codigo;
  document.getElementById('modalModalidadeNome').value = modalidade.Nome || '';
  document.getElementById('modalModalidadeProfessor').value = modalidade.Professor || '';
  document.getElementById('modalModalidadeDias').value = modalidade.Dias || '';
  document.getElementById('modalModalidadeHorarios').value = modalidade.Horarios || '';
  document.getElementById('modalModalidadeFaixaEtaria').value = modalidade.FaixaEtaria || '';
  document.getElementById('modalModalidadeMaxAlunos').value = modalidade.MaxAlunos || '';
  document.getElementById('modalModalidadeLocal').value = modalidade.Local || '';
  document.getElementById('modalModalidadeDescricao').value = modalidade.Descricao || '';
  document.getElementById('modalModalidadeStatus').value = modalidade.Status || 'Ativo';
  document.getElementById('modalFormModalidadeTitulo').innerHTML =
    '<i class="fa-solid fa-people-group"></i> Editar Modalidade — ' + modalidade.Nome;
  abrirModalModalidade();
};

const coletarDadosFormModalModalidade = () => ({
  Nome: document.getElementById('modalModalidadeNome').value.trim(),
  Professor: document.getElementById('modalModalidadeProfessor').value,
  Dias: document.getElementById('modalModalidadeDias').value.trim(),
  Horarios: document.getElementById('modalModalidadeHorarios').value.trim(),
  FaixaEtaria: document.getElementById('modalModalidadeFaixaEtaria').value.trim(),
  MaxAlunos: document.getElementById('modalModalidadeMaxAlunos').value,
  Local: document.getElementById('modalModalidadeLocal').value.trim(),
  Descricao: document.getElementById('modalModalidadeDescricao').value.trim(),
  Status: document.getElementById('modalModalidadeStatus').value
});

const configurarModalModalidade = () => {
  document.getElementById('btnFecharModalModalidade').addEventListener('click', fecharModalModalidade);
  document.getElementById('btnCancelarModalModalidade').addEventListener('click', fecharModalModalidade);
  
  document.getElementById('formModalModalidade').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const codigo = document.getElementById('modalModalidadeCodigo').value;
    const dados = coletarDadosFormModalModalidade();
    
    try {
      mostrarLoading('Atualizando modalidade...');
      await updateDoc(doc(db, 'modalidades', codigo), dados);
      exibirToast('Modalidade atualizada com sucesso.', 'sucesso');
      fecharModalModalidade();
      await carregarModalidades();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao atualizar modalidade: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};

/* ==================================================================================
 * 17. MÓDULO PROFESSORES
 * ================================================================================== */
const renderizarTabelaProfessores = () => {
  if (!CACHE_PROFESSORES || CACHE_PROFESSORES.length === 0) {
    popularDataTable('tabelaProfessores', '', 0);
    return;
  }
  
  const linhas = CACHE_PROFESSORES.map((professor) => `
    <tr>
      <td>${professor.Nome || '-'}</td>
      <td>${professor.Telefone || '-'}</td>
      <td>${professor.Email || '-'}</td>
      <td>${professor.Especialidade || '-'}</td>
      <td>${renderizarBadgeStatus(professor.Status)}</td>
      <td>
        <button class="btn-icone acao-editar-professor" data-id="${professor.id || professor.ID}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icone acao-excluir acao-excluir-professor" data-id="${professor.id || professor.ID}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  popularDataTable('tabelaProfessores', linhas, 0);
};

const limparFormProfessor = () => {
  document.getElementById('formProfessor').reset();
  document.getElementById('professorId').value = '';
};

const coletarDadosFormProfessor = () => ({
  Nome: document.getElementById('professorNome').value.trim(),
  Telefone: document.getElementById('professorTelefone').value.trim(),
  Email: document.getElementById('professorEmail').value.trim(),
  Especialidade: document.getElementById('professorEspecialidade').value.trim(),
  Modalidades: document.getElementById('professorModalidades').value.trim(),
  Status: document.getElementById('professorStatus').value
});

const configurarFormularioProfessor = () => {
  document.getElementById('formProfessor').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const id = document.getElementById('professorId').value;
    const dados = coletarDadosFormProfessor();
    
    try {
      mostrarLoading(id ? 'Atualizando professor...' : 'Cadastrando professor...');
      
      if (id) {
        await updateDoc(doc(db, 'professores', id), dados);
        exibirToast('Professor atualizado com sucesso.', 'sucesso');
      } else {
        await addDoc(collection(db, 'professores'), dados);
        exibirToast('Professor cadastrado com sucesso.', 'sucesso');
      }
      
      limparFormProfessor();
      await carregarProfessores();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao salvar professor: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  document.getElementById('btnLimparFormProfessor').addEventListener('click', limparFormProfessor);
  
  $(document).on('click', '.acao-editar-professor', function () {
    const id = $(this).data('id');
    const professor = CACHE_PROFESSORES.find((p) => (p.id || p.ID) === id);
    if (!professor) return;
    preencherFormModalProfessor(professor);
  });
  
  $(document).on('click', '.acao-excluir-professor', async function () {
    const id = $(this).data('id');
    const professor = CACHE_PROFESSORES.find((p) => (p.id || p.ID) === id);
    const nomeExibicao = professor ? professor.Nome : id;
    const confirmado = await confirmarAcao('Excluir professor', `Deseja realmente excluir o professor "${nomeExibicao}"?`);
    if (!confirmado) return;
    
    try {
      mostrarLoading('Excluindo professor...');
      await deleteDoc(doc(db, 'professores', id));
      exibirToast('Professor excluído com sucesso.', 'sucesso');
      await carregarProfessores();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao excluir professor: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};

/* ==================================================================================
 * 17.5 MODAL DE PROFESSOR (EDIÇÃO)
 * ================================================================================== */
const limparFormModalProfessor = () => {
  document.getElementById('formModalProfessor').reset();
  document.getElementById('modalProfessorId').value = '';
};

const abrirModalProfessor = () => {
  document.getElementById('modalFormProfessor').classList.remove('hidden');
};

const fecharModalProfessor = () => {
  document.getElementById('modalFormProfessor').classList.add('hidden');
  limparFormModalProfessor();
};

const preencherFormModalProfessor = (professor) => {
  document.getElementById('modalProfessorId').value = professor.id || professor.ID;
  document.getElementById('modalProfessorNome').value = professor.Nome || '';
  document.getElementById('modalProfessorTelefone').value = professor.Telefone || '';
  document.getElementById('modalProfessorEmail').value = professor.Email || '';
  document.getElementById('modalProfessorEspecialidade').value = professor.Especialidade || '';
  document.getElementById('modalProfessorModalidades').value = professor.Modalidades || '';
  document.getElementById('modalProfessorStatus').value = professor.Status || 'Ativo';
  document.getElementById('modalFormProfessorTitulo').innerHTML =
    '<i class="fa-solid fa-chalkboard-user"></i> Editar Professor — ' + professor.Nome;
  abrirModalProfessor();
};

const coletarDadosFormModalProfessor = () => ({
  Nome: document.getElementById('modalProfessorNome').value.trim(),
  Telefone: document.getElementById('modalProfessorTelefone').value.trim(),
  Email: document.getElementById('modalProfessorEmail').value.trim(),
  Especialidade: document.getElementById('modalProfessorEspecialidade').value.trim(),
  Modalidades: document.getElementById('modalProfessorModalidades').value.trim(),
  Status: document.getElementById('modalProfessorStatus').value
});

const configurarModalProfessor = () => {
  document.getElementById('btnFecharModalProfessor').addEventListener('click', fecharModalProfessor);
  document.getElementById('btnCancelarModalProfessor').addEventListener('click', fecharModalProfessor);
  
  document.getElementById('formModalProfessor').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const id = document.getElementById('modalProfessorId').value;
    const dados = coletarDadosFormModalProfessor();
    
    try {
      mostrarLoading('Atualizando professor...');
      await updateDoc(doc(db, 'professores', id), dados);
      exibirToast('Professor atualizado com sucesso.', 'sucesso');
      fecharModalProfessor();
      await carregarProfessores();
      await carregarDashboard(false);
    } catch (erro) {
      exibirToast('Erro ao atualizar professor: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};

/* ==================================================================================
 * 18. MÓDULO CONTROLE DE PRESENÇA
 * ================================================================================== */
const configurarTelaPresenca = () => {
  document.getElementById('presencaModalidade').addEventListener('change', (evento) => {
    const modalidade = CACHE_MODALIDADES.find((m) => m.Nome === evento.target.value);
    document.getElementById('presencaProfessor').value = modalidade ? modalidade.Professor : '';
  });
  
  document.getElementById('presencaStatusFiltro').addEventListener('change', aplicarFiltroStatusPresenca);
  document.getElementById('btnBuscarPresenca').addEventListener('click', buscarPresenca);
  
  document.getElementById('checkboxSelecionarTodos').addEventListener('change', (evento) => {
    document.querySelectorAll('#corpoTabelaPresenca .checkbox-presenca').forEach((checkbox) => {
      checkbox.checked = evento.target.checked;
      atualizarBadgeLinhaPresenca(checkbox);
    });
  });
  
  document.getElementById('btnMarcarTodos').addEventListener('click', () => {
    document.querySelectorAll('#corpoTabelaPresenca .checkbox-presenca').forEach((checkbox) => {
      checkbox.checked = true;
      atualizarBadgeLinhaPresenca(checkbox);
    });
    document.getElementById('checkboxSelecionarTodos').checked = true;
  });
  
  document.getElementById('btnDesmarcarTodos').addEventListener('click', () => {
    document.querySelectorAll('#corpoTabelaPresenca .checkbox-presenca').forEach((checkbox) => {
      checkbox.checked = false;
      atualizarBadgeLinhaPresenca(checkbox);
    });
    document.getElementById('checkboxSelecionarTodos').checked = false;
  });
  
  document.getElementById('btnSalvarPresenca').addEventListener('click', salvarChamada);
  document.getElementById('btnImprimirPresenca').addEventListener('click', () => window.print());
  
  document.getElementById('btnExportarPdfPresenca').addEventListener('click', async () => {
    const data = document.getElementById('presencaData').value;
    if (!data) { exibirToast('Selecione uma data para exportar.', 'erro'); return; }
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnExportarExcelPresenca').addEventListener('click', async () => {
    exibirToast('Funcionalidade de Excel em desenvolvimento.', 'info');
  });
};

const buscarPresenca = async () => {
  const modalidade = document.getElementById('presencaModalidade').value;
  const data = document.getElementById('presencaData').value;
  
  if (!modalidade || !data) {
    exibirToast('Selecione a modalidade e a data para buscar.', 'erro');
    return;
  }
  
  try {
    mostrarLoading('Buscando alunos...');
    
    const alunosSnap = await getDocs(collection(db, 'alunos'));
    const alunos = alunosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(a => (a.Modalidade1 === modalidade || a.Modalidade2 === modalidade) && a.Status === 'Ativo');
    
    const presencasSnap = await getDocs(collection(db, 'presencas'));
    const presencas = presencasSnap.docs.map(doc => doc.data())
      .filter(p => p.Modalidade === modalidade && p.Data === data);
    
    const alunosComStatus = alunos.map(aluno => {
      const registroExistente = presencas.find(p => p.MatriculaAluno === (aluno.id || aluno.Matricula));
      return {
        Matricula: aluno.id || aluno.Matricula,
        FotoURL: aluno.FotoURL,
        Nome: aluno.Nome,
        Modalidade: modalidade,
        Status: registroExistente ? registroExistente.Status : '',
        Observacao: registroExistente ? registroExistente.Observacao : ''
      };
    });
    
    renderizarLinhasPresenca(alunosComStatus);
    
    if (alunosComStatus.length === 0) {
      exibirToast('Nenhum aluno ativo encontrado para esta modalidade.', 'info');
    }
  } catch (erro) {
    exibirToast('Erro ao buscar presença: ' + erro.message, 'erro');
  } finally {
    esconderLoading();
  }
};

const renderizarLinhasPresenca = (alunos) => {
  const corpo = document.getElementById('corpoTabelaPresenca');
  const jaMarcadoComoPresente = (status) => String(status || '').trim().toLowerCase() === 'presente';
  
  corpo.innerHTML = alunos.map((aluno) => `
    <tr data-matricula="${aluno.Matricula}" data-nome="${aluno.Nome}">
      <td><input type="checkbox" class="checkbox-presenca" ${jaMarcadoComoPresente(aluno.Status) ? 'checked' : ''}></td>
      <td>${renderizarFotoTabela(aluno.FotoURL)}</td>
      <td>${aluno.Matricula}</td>
      <td>${aluno.Nome}</td>
      <td>${aluno.Modalidade}</td>
      <td class="celula-status-presenca">${renderizarBadgeStatus(jaMarcadoComoPresente(aluno.Status) ? 'Presente' : 'Falta')}</td>
      <td><input type="text" class="observacao-presenca" value="${aluno.Observacao || ''}" placeholder="Observação"></td>
      <td><button type="button" class="btn-icone btn-limpar-linha-presenca" title="Limpar linha"><i class="fa-solid fa-eraser"></i></button></td>
    </tr>
  `).join('');
  
  document.getElementById('checkboxSelecionarTodos').checked = false;
  
  corpo.querySelectorAll('.checkbox-presenca').forEach((checkbox) => {
    checkbox.addEventListener('change', () => atualizarBadgeLinhaPresenca(checkbox));
  });
  
  corpo.querySelectorAll('.btn-limpar-linha-presenca').forEach((botao) => {
    botao.addEventListener('click', (evento) => {
      const linha = evento.target.closest('tr');
      linha.querySelector('.checkbox-presenca').checked = false;
      linha.querySelector('.observacao-presenca').value = '';
      atualizarBadgeLinhaPresenca(linha.querySelector('.checkbox-presenca'));
    });
  });
  
  aplicarFiltroStatusPresenca();
};

const aplicarFiltroStatusPresenca = () => {
  const statusSelecionado = document.getElementById('presencaStatusFiltro').value;
  document.querySelectorAll('#corpoTabelaPresenca tr').forEach((linha) => {
    const checkbox = linha.querySelector('.checkbox-presenca');
    if (!checkbox) return;
    const statusLinha = checkbox.checked ? 'Presente' : 'Falta';
    linha.style.display = (!statusSelecionado || statusSelecionado === statusLinha) ? '' : 'none';
  });
};

const atualizarBadgeLinhaPresenca = (checkbox) => {
  const linha = checkbox.closest('tr');
  const celulaStatus = linha.querySelector('.celula-status-presenca');
  celulaStatus.innerHTML = renderizarBadgeStatus(checkbox.checked ? 'Presente' : 'Falta');
  aplicarFiltroStatusPresenca();
};

let SALVANDO_PRESENCA = false;

const salvarChamada = async () => {
  if (SALVANDO_PRESENCA) return;
  
  const modalidade = document.getElementById('presencaModalidade').value;
  const data = document.getElementById('presencaData').value;
  const professor = document.getElementById('presencaProfessor').value;
  const linhas = document.querySelectorAll('#corpoTabelaPresenca tr');
  
  if (linhas.length === 0) {
    exibirToast('Nenhum registro para salvar. Realize uma busca primeiro.', 'erro');
    return;
  }
  
  const registrosPorMatricula = new Map();
  Array.from(linhas).forEach((linha) => {
    registrosPorMatricula.set(linha.dataset.matricula, {
      Matricula: linha.dataset.matricula,
      Nome: linha.dataset.nome,
      Status: linha.querySelector('.checkbox-presenca').checked ? 'Presente' : 'Falta',
      Observacao: linha.querySelector('.observacao-presenca').value.trim()
    });
  });
  
  const registros = Array.from(registrosPorMatricula.values());
  const botaoSalvar = document.getElementById('btnSalvarPresenca');
  SALVANDO_PRESENCA = true;
  botaoSalvar.disabled = true;
  botaoSalvar.classList.add('btn-desabilitado');
  
  try {
    mostrarLoading('Salvando chamada...');
    
    for (const registro of registros) {
      const docRef = await addDoc(collection(db, 'presencas'), {
        Data: data,
        MatriculaAluno: registro.Matricula,
        NomeAluno: registro.Nome,
        Modalidade: modalidade,
        Professor: professor,
        Status: registro.Status,
        Observacao: registro.Observacao,
        Usuario: USUARIO_LOGADO,
        DataHoraRegistro: serverTimestamp()
      });
    }
    
    exibirToast('Presença registrada com sucesso.', 'sucesso');
    await carregarDashboard(false);
  } catch (erro) {
    exibirToast('Erro ao salvar presença: ' + erro.message, 'erro');
  } finally {
    SALVANDO_PRESENCA = false;
    botaoSalvar.disabled = false;
    botaoSalvar.classList.remove('btn-desabilitado');
    esconderLoading();
  }
};

/* ==================================================================================
 * 19. MÓDULO RELATÓRIOS
 * ================================================================================== */
const configurarTelaRelatorios = () => {
  document.getElementById('btnRelatorioListaAlunos').addEventListener('click', async () => {
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioPresencaDiaria').addEventListener('click', async () => {
    const data = document.getElementById('relatorioDataDiaria').value;
    if (!data) { exibirToast('Selecione uma data.', 'erro'); return; }
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioPresencaMensal').addEventListener('click', async () => {
    const mesAno = document.getElementById('relatorioMesAno').value;
    if (!mesAno) { exibirToast('Selecione o mês/ano.', 'erro'); return; }
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioPresencaModalidade').addEventListener('click', async () => {
    const modalidade = document.getElementById('relatorioModalidade').value;
    if (!modalidade) { exibirToast('Selecione uma modalidade.', 'erro'); return; }
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioRankingFaltas').addEventListener('click', async () => {
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioRankingPresencas').addEventListener('click', async () => {
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnRelatorioFichaAluno').addEventListener('click', async () => {
    const matricula = document.getElementById('relatorioAlunoMatricula').value;
    if (!matricula) { exibirToast('Selecione um aluno.', 'erro'); return; }
    exibirToast('Funcionalidade de PDF em desenvolvimento.', 'info');
  });
  
  document.getElementById('btnExportarExcel').addEventListener('click', async () => {
    exibirToast('Funcionalidade de Excel em desenvolvimento.', 'info');
  });
};

/* ==================================================================================
 * 20. MÓDULO CONFIGURAÇÕES / USUÁRIOS / LOGS
 * ================================================================================== */
const carregarConfiguracoes = async () => {
  try {
    const docRef = doc(db, 'configuracoes', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const configs = docSnap.data();
      if (configs.NomeInstituto) document.getElementById('configNomeInstituto').value = configs.NomeInstituto;
      if (configs.Telefone) document.getElementById('configTelefone').value = configs.Telefone;
      if (configs.Email) document.getElementById('configEmail').value = configs.Email;
    }
  } catch (erro) {
    console.error('Erro ao carregar configurações:', erro);
  }
};

const carregarUsuarios = async () => {
  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    const usuarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const linhas = usuarios.map((usuario) => `
      <tr>
        <td>${usuario.Nome}</td>
        <td>${usuario.Email}</td>
        <td>${usuario.Perfil}</td>
        <td>${renderizarBadgeStatus(usuario.Status)}</td>
      </tr>
    `).join('');
    popularDataTable('tabelaUsuarios', linhas, 0);
  } catch (erro) {
    console.error('Erro ao carregar usuários:', erro);
  }
};

const configurarTelaConfiguracoes = () => {
  document.getElementById('btnSalvarUsuario').addEventListener('click', async () => {
    const dados = {
      Nome: document.getElementById('usuarioNome').value.trim(),
      Email: document.getElementById('usuarioEmail').value.trim(),
      Senha: document.getElementById('usuarioSenha').value,
      Perfil: document.getElementById('usuarioPerfil').value,
      Status: 'Ativo'
    };
    
    if (!dados.Nome || !dados.Email || !dados.Perfil) {
      exibirToast('Preencha nome, e-mail e perfil do usuário.', 'erro');
      return;
    }
    
    try {
      mostrarLoading('Salvando usuário...');
      await addDoc(collection(db, 'usuarios'), dados);
      exibirToast('Usuário cadastrado com sucesso.', 'sucesso');
      document.getElementById('usuarioNome').value = '';
      document.getElementById('usuarioEmail').value = '';
      document.getElementById('usuarioSenha').value = '';
      await carregarUsuarios();
    } catch (erro) {
      exibirToast('Erro ao salvar usuário: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
  
  document.getElementById('btnSalvarConfiguracoes').addEventListener('click', async () => {
    const configs = {
      NomeInstituto: document.getElementById('configNomeInstituto').value.trim(),
      Telefone: document.getElementById('configTelefone').value.trim(),
      Email: document.getElementById('configEmail').value.trim()
    };
    
    try {
      mostrarLoading('Salvando configurações...');
      const docRef = doc(db, 'configuracoes', 'global');
      await setDoc(docRef, configs, { merge: true });
      exibirToast('Configurações salvas com sucesso.', 'sucesso');
    } catch (erro) {
      exibirToast('Erro ao salvar configurações: ' + erro.message, 'erro');
    } finally {
      esconderLoading();
    }
  });
};
/* ==================================================================================
 * 21. IMPORTAÇÃO DE MODALIDADES VIA PLANILHA (SheetJS)
 * ================================================================================== */
const MAPA_COLUNAS_IMPORTACAO_MODALIDADES = {
    Nome: ['Nome', 'Modalidade', 'Nome da Modalidade'],
    Professor: ['Professor', 'Instrutor'],
    Dias: ['Dias', 'Dias da Semana'],
    Horarios: ['Horarios', 'Horários', 'Horario'],
    FaixaEtaria: ['FaixaEtaria', 'Faixa Etária', 'Idade'],
    MaxAlunos: ['MaxAlunos', 'Max Alunos', 'Máximo de Alunos'],
    Local: ['Local', 'Localização'],
    Descricao: ['Descricao', 'Descrição'],
    Status: ['Status']
};

const importarPlanilhaModalidades = async (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    
    mostrarLoading('Lendo planilha...');
    
    try {
        const bufferArquivo = await arquivo.arrayBuffer();
        const pastaTrabalho = XLSX.read(bufferArquivo, { type: 'array', cellDates: true });
        const primeiraAba = pastaTrabalho.Sheets[pastaTrabalho.SheetNames[0]];
        const linhasBrutas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });
        
        if (linhasBrutas.length === 0) {
            exibirToast('A planilha selecionada está vazia.', 'erro');
            return;
        }
        
        const modalidadesNormalizadas = linhasBrutas.map(linha => {
            const objeto = {};
            Object.keys(MAPA_COLUNAS_IMPORTACAO_MODALIDADES).forEach(campo => {
                for (const chave of MAPA_COLUNAS_IMPORTACAO_MODALIDADES[campo]) {
                    if (linha[chave] !== undefined && linha[chave] !== null && linha[chave] !== '') {
                        objeto[campo] = linha[chave];
                        break;
                    }
                }
            });
            objeto.Status = objeto.Status || 'Ativo';
            return objeto;
        }).filter(m => m.Nome);
        
        mostrarLoading(`Importando ${modalidadesNormalizadas.length} modalidades...`);
        
        let importados = 0;
        let ignorados = 0;
        
        for (const modalidade of modalidadesNormalizadas) {
            try {
                await addDoc(collection(db, 'modalidades'), modalidade);
                importados++;
            } catch (erro) {
                ignorados++;
            }
        }
        
        exibirToast(`Importação concluída: ${importados} importados, ${ignorados} ignorados.`, 'sucesso');
        await carregarModalidades();
        await carregarDashboard(false);
    } catch (erro) {
        exibirToast('Erro ao ler a planilha: ' + erro.message, 'erro');
    } finally {
        esconderLoading();
        evento.target.value = '';
    }
};

/* ==================================================================================
 * 22. IMPORTAÇÃO DE PROFESSORES VIA PLANILHA (SheetJS)
 * ================================================================================== */
const MAPA_COLUNAS_IMPORTACAO_PROFESSORES = {
    Nome: ['Nome', 'Professor', 'Nome do Professor'],
    Telefone: ['Telefone', 'Fone', 'Celular'],
    Email: ['Email', 'E-mail'],
    Especialidade: ['Especialidade', 'Área', 'Disciplina'],
    Modalidades: ['Modalidades', 'Modalidade'],
    Status: ['Status']
};

const importarPlanilhaProfessores = async (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    
    mostrarLoading('Lendo planilha...');
    
    try {
        const bufferArquivo = await arquivo.arrayBuffer();
        const pastaTrabalho = XLSX.read(bufferArquivo, { type: 'array', cellDates: true });
        const primeiraAba = pastaTrabalho.Sheets[pastaTrabalho.SheetNames[0]];
        const linhasBrutas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });
        
        if (linhasBrutas.length === 0) {
            exibirToast('A planilha selecionada está vazia.', 'erro');
            return;
        }
        
        const professoresNormalizados = linhasBrutas.map(linha => {
            const objeto = {};
            Object.keys(MAPA_COLUNAS_IMPORTACAO_PROFESSORES).forEach(campo => {
                for (const chave of MAPA_COLUNAS_IMPORTACAO_PROFESSORES[campo]) {
                    if (linha[chave] !== undefined && linha[chave] !== null && linha[chave] !== '') {
                        objeto[campo] = linha[chave];
                        break;
                    }
                }
            });
            objeto.Status = objeto.Status || 'Ativo';
            return objeto;
        }).filter(p => p.Nome);
        
        mostrarLoading(`Importando ${professoresNormalizados.length} professores...`);
        
        let importados = 0;
        let ignorados = 0;
        
        for (const professor of professoresNormalizados) {
            try {
                await addDoc(collection(db, 'professores'), professor);
                importados++;
            } catch (erro) {
                ignorados++;
            }
        }
        
        exibirToast(`Importação concluída: ${importados} importados, ${ignorados} ignorados.`, 'sucesso');
        await carregarProfessores();
        await carregarDashboard(false);
    } catch (erro) {
        exibirToast('Erro ao ler a planilha: ' + erro.message, 'erro');
    } finally {
        esconderLoading();
        evento.target.value = '';
    }
};
