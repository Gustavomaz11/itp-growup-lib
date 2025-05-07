import Chart from 'chart.js/auto';
function adicionarEstilosGlobais() {
  if (document.getElementById('global-grafico-tabela-css')) return;
  const s = document.createElement('style');
  s.id = 'global-grafico-tabela-css';
  s.textContent = `
    /* … já vinha aqui seu .chart-card, .table-card, .control-bar … */

    /* time-filter-bar */
    .time-filter-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 12px;
    }
    .time-filter-bar .year-btn,
    .time-filter-bar select {
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid #ccc;
      background: #fafafa;
      cursor: pointer;
    }
    .time-filter-bar .year-btn.active {
      background: #007bff;
      color: #fff;
      border-color: #0056b3;
    }
  `;
  document.head.appendChild(s);
}

/** Estado compartilhado de filtros (chart + table) */
export const filtrosAtuais = {};

/** Armazena todas as instâncias de tabela criadas */
const todasAsTabelas = [];

/** Armazena todas as instâncias de gráfico (já existe) */
let todosOsGraficos = [];

// Ordem fixa de meses para garantir Janeiro→Dezembro
const ordemMeses = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// Cache para converter “MM” → nome do mês
const cacheMeses = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

// --- funções de filtro e totalização ---

function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) return dadosOriginais;
  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([param, vals]) => {
      // filtro de duração
      if (param.endsWith('_duracao')) {
        const [campoInicio, campoFim] = param.split('_duracao')[0].split('|');
        const ini = Date.parse(item[campoInicio]);
        const fim = Date.parse(item[campoFim]);
        if (isNaN(ini) || isNaN(fim) || fim < ini) return false;
        const diffMin = (fim - ini) / 60000;
        // verifique se diffMin cai em algum bin cujo label esteja em vals
        return vals.some((label) => {
          const bin = binsGlobais().find((b) => b.label === label);
          return bin && diffMin >= bin.min && diffMin < bin.max;
        });
      }
      // filtro normal (inclui data)
      let v = item[param];
      if (param.includes('data') && v) {
        const m = v.slice(5, 7);
        v = cacheMeses[m];
      }
      return vals.includes(v);
    }),
  );
}

function calcularTotal(dadosOriginais, callback) {
  const total = getDadosAtuais(dadosOriginais).length;
  if (callback) callback(total);
  return total;
}

// --- processamento de dados com ordenação condicional ---

function processarDados(dados, parametro_busca) {
  const isDateTime = (v) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v);
  const contagem = new Map();

  dados.forEach((item) => {
    let chave = item[parametro_busca];
    if (!chave) return;
    if (isDateTime(chave)) {
      const m = chave.slice(5, 7);
      chave = cacheMeses[m];
    }
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });

  let labels = Array.from(contagem.keys());
  let valores = labels.map((l) => contagem.get(l));

  const todosSaoMeses = labels.every((l) => ordemMeses.includes(l));
  if (todosSaoMeses) {
    labels = ordemMeses.filter((m) => contagem.has(m));
    valores = labels.map((m) => contagem.get(m));
  }

  return { labels, valores };
}

// --- bins globais para duração ---

function binsGlobais() {
  return [
    { label: '< 30 minutos', min: 0, max: 30 },
    { label: '> 30m < 45m', min: 30, max: 45 },
    { label: '> 45m < 60m', min: 45, max: 60 },
    { label: '> 1h < 24h', min: 60, max: 1440 },
    { label: '> 24h < 48h', min: 1440, max: 2880 },
    { label: '> 48h < 72h', min: 2880, max: 4320 },
    { label: '> 72h < 5d', min: 4320, max: 7200 }, // até 5 dias
    { label: '> 5 dias', min: 7200, max: Infinity },
  ];
}

// --- processamento de durações de atendimento em bins com filtro e ocultação de zero ---

function processarDuracaoAtendimentos(dados, campoInicio, campoFim) {
  const bins = binsGlobais();
  const contagem = bins.map(() => 0);

  dados.forEach((item) => {
    const ini = Date.parse(item[campoInicio]);
    const fim = Date.parse(item[campoFim]);
    if (isNaN(ini) || isNaN(fim) || fim < ini) return;
    const diffMin = (fim - ini) / 60000;
    for (let i = 0; i < bins.length; i++) {
      if (diffMin >= bins[i].min && diffMin < bins[i].max) {
        contagem[i]++;
        break;
      }
    }
  });

  // aplica filtro de duração, se existir
  const durKey = `${campoInicio}|${campoFim}_duracao`;
  const filtroDur = filtrosAtuais[durKey];

  const labels = [],
    valores = [];
  bins.forEach((b, i) => {
    if (contagem[i] > 0 && (!filtroDur || filtroDur.includes(b.label))) {
      labels.push(b.label);
      valores.push(contagem[i]);
    }
  });

  return { labels, valores };
}

// --- criação e atualização de gráficos ---

/**
 * @param ctx                  contexto do canvas
 * @param tipoInicial          'bar'|'pie'|...
 * @param parametro_busca      campo de início (data ou outro)
 * @param backgroundColor      array de cores
 * @param chave                rótulo do dataset
 * @param obj                  array de objetos com dados
 * @param callback             função({ total, variacaoTexto })
 * @param porDuracao           true=normal / false=histograma de duração
 * @param parametro_busca_fim  campo de fim se porDuracao=false
 */
export function criarGrafico(
  ctx,
  tipoInicial,
  parametro_busca,
  backgroundColor,
  chave,
  obj,
  callback,
  porDuracao = true,
  parametro_busca_fim = null,
) {
  // 1) Injeta estilos (só na 1ª vez)
  adicionarEstilosGlobais();

  // 2) Detecta campo de data (assume ISO-YYYY-MM-DD)
  const dadosOriginais = Array.isArray(obj) ? [...obj] : obj.slice();
  const isoDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(v);
  const dateFields = Object.keys(dadosOriginais[0] || {}).filter((k) =>
    dadosOriginais.every((o) => isoDate(o[k])),
  );
  const dataField = dateFields[0] || 'data'; // ajuste se precisar

  // 3) Estado local
  let tipoAtual = tipoInicial;
  let grafico;
  let lastLabels = [];
  let lastValores = [];

  let selectedYear = null;
  let periodMode = 'Mensal'; // 'Mensal' ou 'Trimestral'

  // 4) Monta card + time-filter-bar
  const wrapper = ctx.canvas.parentNode;
  wrapper.classList.add('chart-card');

  // time-filter bar
  const tfb = document.createElement('div');
  tfb.classList.add('time-filter-bar');
  wrapper.prepend(tfb);

  // --- Botão “Todos” + anos dinâmicos ---
  const anos = Array.from(
    new Set(dadosOriginais.map((o) => new Date(o[dataField]).getFullYear())),
  ).sort();
  const btnTodos = document.createElement('button');
  btnTodos.textContent = 'Todos';
  btnTodos.classList.add('year-btn', 'active');
  tfb.appendChild(btnTodos);

  function atualizarBotoesAno() {
    tfb.querySelectorAll('.year-btn').forEach((b) => {
      const ano = b.textContent !== 'Todos' && +b.textContent;
      b.classList.toggle(
        'active',
        (b.textContent === 'Todos' && selectedYear === null) ||
          ano === selectedYear,
      );
    });
  }

  btnTodos.addEventListener('click', () => {
    selectedYear = null;
    atualizarBotoesAno();
    renderizar();
  });

  anos.forEach((ano) => {
    const b = document.createElement('button');
    b.textContent = String(ano);
    b.classList.add('year-btn');
    tfb.appendChild(b);
    b.addEventListener('click', () => {
      selectedYear = ano;
      atualizarBotoesAno();
      renderizar();
    });
  });

  // --- Select de periodicidade ---
  const selPeriodo = document.createElement('select');
  ['Mensal', 'Trimestral'].forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    selPeriodo.appendChild(o);
  });
  selPeriodo.value = periodMode;
  selPeriodo.addEventListener('change', () => {
    periodMode = selPeriodo.value;
    // ao trocar o modo, reseta seleções específicas
    selMes.value = '';
    selTrim.value = '1';
    renderizar();
  });
  tfb.appendChild(selPeriodo);

  // --- Select de Mês ---
  const selMes = document.createElement('select');
  const optTodosMes = new Option('Todos', '');
  selMes.appendChild(optTodosMes);
  ordemMeses.forEach((m) => {
    selMes.appendChild(new Option(m, m));
  });
  selMes.addEventListener('change', renderizar);
  tfb.appendChild(selMes);

  // --- Select de Trimestre ---
  const selTrim = document.createElement('select');
  ['1º Trimestre', '2º Trimestre', '3º Trimestre'].forEach((t, i) => {
    const opt = new Option(t, String(i + 1));
    selTrim.appendChild(opt);
  });
  selTrim.addEventListener('change', renderizar);
  tfb.appendChild(selTrim);

  // ajusta visibilidade inicial
  function atualizarControlesPeriodo() {
    selMes.style.display = periodMode === 'Mensal' ? '' : 'none';
    selTrim.style.display = periodMode === 'Trimestral' ? '' : 'none';
  }
  atualizarControlesPeriodo();
  selPeriodo.addEventListener('change', atualizarControlesPeriodo);

  // 5) Cria resto dos controles (tipo de gráfico + Ver tabela)…
  const controls = document.createElement('div');
  controls.classList.add('control-bar');
  wrapper.insertBefore(controls, ctx.canvas);
  // … aqui entra exatamente seu select de tipo e botão “Ver tabela” …

  // 6) Função de render / re-render
  function renderizar() {
    // 6.1) Filtra data por ano/mês/trimestre
    let base = dadosOriginais.filter((item) => {
      const d = new Date(item[dataField]);
      if (selectedYear && d.getFullYear() !== selectedYear) return false;
      if (periodMode === 'Mensal' && selMes.value) {
        return ordemMeses[d.getMonth()] === selMes.value;
      }
      if (periodMode === 'Trimestral') {
        const q = +selTrim.value;
        const m = d.getMonth() + 1;
        return Math.ceil(m / 3) === q;
      }
      return true;
    });

    // 6.2) Aplica filtrosAtuais (legenda/tabela)
    const filtrados = getDadosAtuais(base);

    // 6.3) Processa os dados e atualiza o Chart.js
    let labels, valores;
    if (!porDuracao) {
      ({ labels, valores } = processarDuracaoAtendimentos(
        filtrados,
        parametro_busca,
        parametro_busca_fim,
      ));
    } else {
      ({ labels, valores } = processarDados(filtrados, parametro_busca));
    }
    lastLabels = labels;
    lastValores = valores;

    if (grafico) {
      grafico.destroy();
      todosOsGraficos = todosOsGraficos.filter((g) => g.grafico !== grafico);
    }
    grafico = new Chart(ctx, {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: chave,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
          },
        ],
      },
      options: {
        /* … sua configuração de legend.onClick chamando toggleFiltro … */
      },
    });
    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
    });
    if (callback) callback({ total: filtrados.length });
  }

  // 7) Primeiro render
  renderizar();
}

function toggleFiltro(parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];
  const idx = filtrosAtuais[parametro].indexOf(valor);
  if (idx === -1) filtrosAtuais[parametro].push(valor);
  else {
    filtrosAtuais[parametro].splice(idx, 1);
    if (filtrosAtuais[parametro].length === 0) delete filtrosAtuais[parametro];
  }

  // atualiza tudo
  atualizarTodosOsGraficos();
  atualizarTodasAsTabelas();
}

function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach((entry) => {
    const {
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
    } = entry;
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    const { labels, valores } = porDuracao
      ? processarDados(dadosFiltrados, parametro_busca)
      : processarDuracaoAtendimentos(
          dadosFiltrados,
          parametro_busca,
          parametro_busca_fim,
        );
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  });
}

// Se precisar de botões de mês na interface, mantém igual
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  ordemMeses.forEach((mes) => {
    const btn = document.createElement('button');
    btn.innerText = mes;
    btn.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
    };
    document.body.appendChild(btn);
  });
}

/**
 * Inicializa uma data table virtualizada dentro de `containerEl`.
 * @param {HTMLElement} containerEl  Elemento que conterá a tabela.
 * @param {Array<Object>} obj        Array de objetos (mesmos que você passaria ao criarGrafico).
 * @param {Array<string>} colunas    Nome das propriedades a exibir como colunas.
 * @param {Object} options           Configurações (itensPorPágina, alturaLinha, etc).
 */
export function criarDataTable(containerEl, obj, colunas, options = {}) {
  // 1) mescla options com defaults
  const CONFIG = Object.assign(
    {
      itemsPerPage: 50,
      virtualRowHeight: 35,
      debounceTime: 200,
      // … outros defaults que você quiser
    },
    options,
  );

  // 2) estado interno da tabela
  let dadosOriginaisTabela = obj;
  let dadosFiltradosTabela = [...dadosOriginaisTabela];
  let totalPages = 1;
  let currentPage = 1;

  // 3) monta DOM (header fixo, container scroll, <tbody> vazio, botão reset, info, etc)
  const { headerEl, scrollEl, tbodyEl, infoEl, paginationEl } =
    montarEstruturaTabela(containerEl, colunas);

  // 4) funções internas:

  function renderizarLinhas() {
    // usa getDadosAtuais para filtrar
    dadosFiltradosTabela = getDadosAtuais(dadosOriginaisTabela);
    totalPages = Math.ceil(dadosFiltradosTabela.length / CONFIG.itemsPerPage);

    // calcula slice de currentPage se você quiser paginação real,
    // ou apenas virtual scroll puro — aqui exemplifico paginação real:
    const start = (currentPage - 1) * CONFIG.itemsPerPage;
    const pageData = dadosFiltradosTabela.slice(
      start,
      start + CONFIG.itemsPerPage,
    );

    // limpa tbody e preenche
    tbodyEl.innerHTML = '';
    pageData.forEach((item) => {
      const tr = document.createElement('tr');
      colunas.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = item[col];
        td.dataset.coluna = col;
        td.dataset.valor = item[col];
        td.classList.add('celula-clicavel');
        tr.appendChild(td);
      });
      tbodyEl.appendChild(tr);
    });

    atualizarInfo();
    atualizarPaginacao();
  }

  function atualizarInfo() {
    const total = dadosOriginaisTabela.length;
    const filtrados = dadosFiltradosTabela.length;
    if (Object.keys(filtrosAtuais).length > 0) {
      infoEl.textContent = `Mostrando ${filtrados} de ${total} registros`;
    } else {
      infoEl.textContent = `Total: ${total} registros`;
    }
  }

  function atualizarPaginacao() {
    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;
    for (let p = 1; p <= totalPages; p++) {
      const btn = document.createElement('button');
      btn.textContent = p;
      if (p === currentPage) btn.disabled = true;
      btn.addEventListener('click', () => {
        currentPage = p;
        renderizarLinhas();
      });
      paginationEl.appendChild(btn);
    }
  }

  // 5) eventos de clique em célula para filtro
  containerEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('celula-clicavel')) {
      const coluna = e.target.dataset.coluna;
      const valor = e.target.dataset.valor;
      toggleFiltro(coluna, valor);
      // toggleFiltro já chama renderizarLinhas e atualizarTodosOsGrafficos
    }
  });

  // 6) registra esta instância para atualizações globais
  todasAsTabelas.push({ render: renderizarLinhas });

  // 7) dispara o primeiro render
  renderizarLinhas();
}

// chama todas as tabelas quando toggleFiltro for usado
function atualizarTodasAsTabelas() {
  todasAsTabelas.forEach((t) => t.render());
}

// —––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// helpers de DOM da tabela
// (extraia/adapte do seu script.js original: montarEstruturaTabela,
// adicionarEstilos, etc.)
// —––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

function montarEstruturaTabela(containerEl, colunas) {
  // Limpa container e cria header, scroll, tbody, info, paginação…
  containerEl.innerHTML = '';
  adicionarEstilosTabela(); // injeta CSS se ainda não existir

  const infoEl = document.createElement('div');
  infoEl.className = 'table-info';
  containerEl.appendChild(infoEl);

  const headerEl = document.createElement('div');
  headerEl.className = 'table-header';
  const headerTable = document.createElement('table');
  const headerRow = document.createElement('tr');
  colunas.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    th.dataset.coluna = c;
    headerRow.appendChild(th);
  });
  headerTable.appendChild(headerRow);
  headerEl.appendChild(headerTable);

  const scrollEl = document.createElement('div');
  scrollEl.className = 'table-content';
  const table = document.createElement('table');
  const tbodyEl = document.createElement('tbody');
  table.appendChild(tbodyEl);
  scrollEl.appendChild(table);

  const paginationEl = document.createElement('div');
  paginationEl.className = 'pagination-controls';

  containerEl.appendChild(headerEl);
  containerEl.appendChild(scrollEl);
  containerEl.appendChild(paginationEl);

  return { headerEl, scrollEl, tbodyEl, infoEl, paginationEl };
}

function adicionarEstilosTabela() {
  if (document.getElementById('virtual-table-styles')) return;
  const style = document.createElement('style');
  style.id = 'virtual-table-styles';
  style.textContent = `
    /* Copie/adapte todo o CSS do seu script.js aqui */
    .table-header { /* … */ }
    .celula-clicavel { cursor: pointer; }
    .table-info { /* … */ }
    .pagination-controls { /* … */ }
  `;
  document.head.appendChild(style);
}
