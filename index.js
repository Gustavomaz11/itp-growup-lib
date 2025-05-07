import Chart from 'chart.js/auto';

// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar filtros gerais e de duração
var todosOsGraficos = []; // Lista de gráficos

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
  return dadosOriginais.filter(
    (item) =>
      !Object.entries(filtrosAtuais).some(([param, vals]) => {
        let v = item[param];
        if (v && /^\\d{4}-\\d{2}-\\d{2} /.test(v)) {
          const m = v.slice(5, 7);
          v = cacheMeses[m];
        }
        return !vals.includes(v);
      }),
  );
}

function calcularTotal(dadosOriginais, callback) {
  const total = getDadosAtuais(dadosOriginais).length;
  if (callback) callback(total);
  return total;
}

// --- processamento de dados condicional ---

function processarDados(dados, parametro_busca) {
  const isDateTime = (v) =>
    /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(v);
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

  const labels = [];
  const valores = [];
  for (let [k, v] of contagem.entries()) {
    labels.push(k);
    valores.push(v);
  }

  return { labels, valores };
}

function binsGlobais() {
  return [
    { label: '< 30 min', min: 0, max: 30 },
    { label: '30–45 min', min: 30, max: 45 },
    { label: '45–60 min', min: 45, max: 60 },
    { label: '> 60 min', min: 60, max: Infinity },
  ];
}

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

  const durKey = `${campoInicio}|${campoFim}_duracao`;
  const filtroDur = filtrosAtuais[durKey];
  const labels = [];
  const valores = [];
  bins.forEach((b, i) => {
    if (contagem[i] > 0 && (!filtroDur || filtroDur.includes(b.label))) {
      labels.push(b.label);
      valores.push(contagem[i]);
    }
  });

  return { labels, valores };
}

// --- criação e atualização de gráficos ---

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
  const dadosOriginais = [...obj];
  let tipoAtual = tipoInicial;
  let grafico;

  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let labels, valores;

    if (porDuracao === false) {
      ({ labels, valores } = processarDuracaoAtendimentos(
        dadosFiltrados,
        parametro_busca,
        parametro_busca_fim,
      ));
    } else {
      ({ labels, valores } = processarDados(dadosFiltrados, parametro_busca));
    }

    const config = {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: chave,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: true,
            labels: {
              generateLabels: (chart) => {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map((lab, i) => ({
                  text: lab,
                  fillStyle: ds.backgroundColor[i],
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                }));
              },
            },
            onClick: (_, item) => {
              const val = grafico.data.labels[item.index];
              if (porDuracao === false) {
                toggleFiltro(
                  dadosOriginais,
                  `${parametro_busca}|${parametro_busca_fim}_duracao`,
                  val,
                );
              } else {
                toggleFiltro(dadosOriginais, parametro_busca, val);
              }
              aplicarFiltrosTabela();
              atualizarTodosOsGraficos();
            },
          },
        },
        scales:
          tipoAtual === 'bar' || tipoAtual === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : undefined,
      },
    };

    if (grafico) {
      grafico.destroy();
      todosOsGraficos = todosOsGraficos.filter((g) => g.grafico !== grafico);
    }

    grafico = new Chart(ctx, config);
    calcularTotal(dadosOriginais, (total) => {
      grafico.total = total;
      if (callback) callback({ total, variacaoTexto: null });
    });

    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
    });
  }

  renderizar();

  // seletor de tipo
  const tipos = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
  const sel = document.createElement('select');
  sel.style.margin = '8px';
  tipos.forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.text = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === tipoAtual) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    tipoAtual = sel.value;
    renderizar();
  });
  ctx.canvas.parentNode.insertBefore(sel, ctx.canvas.nextSibling);
}

function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];
  const idx = filtrosAtuais[parametro].indexOf(valor);
  if (idx === -1) filtrosAtuais[parametro].push(valor);
  else {
    filtrosAtuais[parametro].splice(idx, 1);
    if (filtrosAtuais[parametro].length === 0) delete filtrosAtuais[parametro];
  }
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
    let labels, valores;
    if (porDuracao === false) {
      ({ labels, valores } = processarDuracaoAtendimentos(
        dadosFiltrados,
        parametro_busca,
        parametro_busca_fim,
      ));
    } else {
      ({ labels, valores } = processarDados(dadosFiltrados, parametro_busca));
    }
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  });
}

// Se precisar de botões de mês na interface
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  ordemMeses.forEach((mes) => {
    const btn = document.createElement('button');
    btn.innerText = mes;
    btn.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      aplicarFiltrosTabela();
      atualizarTodosOsGraficos();
    };
    document.body.appendChild(btn);
  });
}

// ─━━━ INÍCIO: DataTable integrado ━━━━

// Configurações padrão para DataTable
const CONFIG_TABLE = {
  itemsPerPage: 50,
  maxRenderedPages: 5,
  currentPage: 1,
  totalPages: 1,
  virtualRowHeight: 35,
  debounceTime: 200,
  chunkSize: 1000,
};

// Estado interno do DataTable
let dtDadosOriginais = [];
let dtDadosFiltrados = [];
let dtColunas = [];
let dtContainers = {};

// Cria DataTable e inicializa virtualização e filtros
export async function criarDataTable(
  selector,
  dados,
  colunas = ['cliente', 'servico', 'prioridade'],
) {
  dtDadosOriginais = dados;
  dtDadosFiltrados = [...dados];
  dtColunas = colunas;
  dtContainers = configurarTabelaVirtualizada(selector);

  adicionarEstilosTabela();
  await processarDadosEmChunksTabela(dtDadosFiltrados);
  atualizarAlturaVirtualTabela();
  renderizarLinhasVisiveisTabela();
  atualizarPaginacaoTabela();
  atualizarInfoTabela();
}

// Configura estrutura da tabela virtualizada
function configurarTabelaVirtualizada(selector) {
  const tableContainer = document.querySelector(selector);
  tableContainer.innerHTML = '';

  const headerContainer = document.createElement('div');
  headerContainer.className = 'table-header';
  const headerTable = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  dtColunas.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col;
    th.dataset.coluna = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  headerTable.appendChild(thead);
  headerContainer.appendChild(headerTable);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'table-content';
  contentContainer.id = 'virtual-scroll-container';

  const virtualHeight = document.createElement('div');
  virtualHeight.className = 'virtual-height';
  virtualHeight.id = 'virtual-height';

  const contentTable = document.createElement('table');
  contentTable.id = 'data-table';
  const contentTbody = document.createElement('tbody');
  contentTbody.id = 'data-tbody';
  contentTable.appendChild(contentTbody);

  contentContainer.appendChild(virtualHeight);
  contentContainer.appendChild(contentTable);

  const paginationContainer = document.createElement('div');
  paginationContainer.id = 'pagination';
  paginationContainer.className = 'pagination-controls';

  const infoContainer = document.createElement('div');
  infoContainer.id = 'table-info';
  infoContainer.className = 'table-info';

  tableContainer.appendChild(infoContainer);
  tableContainer.appendChild(headerContainer);
  tableContainer.appendChild(contentContainer);
  tableContainer.appendChild(paginationContainer);

  configurarEventosTabela();
  return {
    headerTable,
    contentTable,
    contentTbody,
    contentContainer,
    virtualHeight,
    paginationContainer,
    infoContainer,
  };
}

// Processa dados em chunks para não bloquear UI
function processarDadosEmChunksTabela(dados) {
  return new Promise((resolve) => {
    const processarChunk = (start) => {
      const end = Math.min(start + CONFIG_TABLE.chunkSize, dados.length);
      // nada específico aqui, apenas percorrer dados
      for (let i = start; i < end; i++); // iteração vazia

      const progresso = Math.round((end / dados.length) * 100);
      atualizarIndicadorProgressoTabela(progresso);

      if (end < dados.length) requestAnimationFrame(() => processarChunk(end));
      else resolve();
    };
    requestAnimationFrame(() => processarChunk(0));
  });
}

// Atualiza barra de progresso do processamento
function atualizarIndicadorProgressoTabela(percentual) {
  let progressBar = document.getElementById('progress-bar');
  if (!progressBar) {
    const container = document.createElement('div');
    container.className = 'progress-container';
    container.innerHTML = `<div class=\"progress-text\">Processando dados: <span id=\"progress-percent\">0</span>%</div><div class=\"progress-bar-container\"><div id=\"progress-bar\" class=\"progress-bar\"></div></div>`;
    dtContainers.infoContainer.appendChild(container);
    progressBar = document.getElementById('progress-bar');
  }
  progressBar.style.width = `${percentual}%`;
  const pct = document.getElementById('progress-percent');
  if (pct) pct.textContent = percentual;
  if (percentual >= 100)
    setTimeout(() => {
      const c = document.querySelector('.progress-container');
      if (c) c.remove();
    }, 500);
}

// Renderiza somente linhas visíveis
function renderizarLinhasVisiveisTabela() {
  const { contentContainer, virtualHeight } = dtContainers;
  const tbody = document.getElementById('data-tbody');
  if (!contentContainer || !virtualHeight || !tbody) return;

  const scrollTop = contentContainer.scrollTop;
  const viewH = contentContainer.clientHeight;
  const startIdx = Math.floor(scrollTop / CONFIG_TABLE.virtualRowHeight);
  const visibleCount = Math.ceil(viewH / CONFIG_TABLE.virtualRowHeight) + 5;
  const endIdx = Math.min(startIdx + visibleCount, dtDadosFiltrados.length);

  virtualHeight.style.height = `${
    dtDadosFiltrados.length * CONFIG_TABLE.virtualRowHeight
  }px`;
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (let i = startIdx; i < endIdx; i++) {
    const tr = document.createElement('tr');
    tr.style.position = 'absolute';
    tr.style.top = `${i * CONFIG_TABLE.virtualRowHeight}px`;
    dtColunas.forEach((col) => {
      const td = document.createElement('td');
      td.textContent = dtDadosFiltrados[i][col];
      td.className = 'celula-clicavel';
      td.dataset.coluna = col;
      td.dataset.valor = dtDadosFiltrados[i][col];
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

// Atualiza altura virtual
function atualizarAlturaVirtualTabela() {
  dtContainers.virtualHeight.style.height = `${
    dtDadosFiltrados.length * CONFIG_TABLE.virtualRowHeight
  }px`;
}

// Navegação entre páginas (posiciona scroll)
function navegarParaPagina(pagina) {
  if (pagina < 1 || pagina > CONFIG_TABLE.totalPages) return;
  CONFIG_TABLE.currentPage = pagina;
  dtContainers.contentContainer.scrollTop =
    (pagina - 1) * CONFIG_TABLE.itemsPerPage * CONFIG_TABLE.virtualRowHeight;
}

// Atualiza controles de paginação
function atualizarPaginacaoTabela() {
  const pc = dtContainers.paginationContainer;
  if (!pc) return;
  pc.innerHTML = '';
  CONFIG_TABLE.totalPages = Math.ceil(
    dtDadosFiltrados.length / CONFIG_TABLE.itemsPerPage,
  );
  if (CONFIG_TABLE.totalPages <= 1) return;

  const frag = document.createDocumentFragment();
  const prev = document.createElement('button');
  prev.textContent = '« Anterior';
  prev.disabled = CONFIG_TABLE.currentPage === 1;
  prev.addEventListener('click', () =>
    navegarParaPagina(CONFIG_TABLE.currentPage - 1),
  );
  frag.appendChild(prev);

  let startPage = Math.max(
    1,
    CONFIG_TABLE.currentPage - Math.floor(CONFIG_TABLE.maxRenderedPages / 2),
  );
  let endPage = Math.min(
    CONFIG_TABLE.totalPages,
    startPage + CONFIG_TABLE.maxRenderedPages - 1,
  );
  if (endPage - startPage < CONFIG_TABLE.maxRenderedPages - 1)
    startPage = Math.max(1, endPage - CONFIG_TABLE.maxRenderedPages + 1);

  for (let p = startPage; p <= endPage; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.disabled = p === CONFIG_TABLE.currentPage;
    btn.addEventListener('click', () => navegarParaPagina(p));
    frag.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = 'Próximo »';
  next.disabled = CONFIG_TABLE.currentPage === CONFIG_TABLE.totalPages;
  next.addEventListener('click', () =>
    navegarParaPagina(CONFIG_TABLE.currentPage + 1),
  );
  frag.appendChild(next);

  pc.appendChild(frag);
}

// Configura eventos de filtro na tabela
function configurarEventosTabela() {
  document.addEventListener('click', (event) => {
    const t = event.target;
    if (t.classList.contains('celula-clicavel')) {
      const col = t.dataset.coluna;
      const val = t.dataset.valor;
      if (!filtrosAtuais[col] || !filtrosAtuais[col].includes(val))
        filtrosAtuais[col] = [val];
      else delete filtrosAtuais[col];
      aplicarFiltrosTabela();
      atualizarTodosOsGraficos();
    }
    if (t.id === 'resetFiltroTabela') {
      Object.keys(filtrosAtuais).forEach((k) => delete filtrosAtuais[k]);
      aplicarFiltrosTabela();
      atualizarTodosOsGraficos();
    }
  });
}

// Aplica filtros globais na tabela
function aplicarFiltrosTabela() {
  if (Object.keys(filtrosAtuais).length === 0)
    dtDadosFiltrados = [...dtDadosOriginais];
  else
    dtDadosFiltrados = dtDadosOriginais.filter((item) =>
      Object.entries(filtrosAtuais).every(([col, vals]) =>
        vals.includes(item[col]),
      ),
    );
  atualizarAlturaVirtualTabela();
  renderizarLinhasVisiveisTabela();
  atualizarPaginacaoTabela();
  atualizarInfoTabela();
}

// Atualiza informações da tabela
function atualizarInfoTabela() {
  const infoCon = dtContainers.infoContainer;
  if (!infoCon) return;
  const total = dtDadosOriginais.length;
  const filt = dtDadosFiltrados.length;
  infoCon.textContent = Object.keys(filtrosAtuais).length
    ? `Mostrando ${filt} de ${total} registros>`
    : `Total: ${total} registros`;
}

// Adiciona estilos básicos para DataTable
function adicionarEstilosTabela() {
  if (document.getElementById('estilos-data-table')) return;
  const style = document.createElement('style');
  style.id = 'estilos-data-table';
  style.textContent = `
    .table-header table { width: 100%; border-collapse: collapse; }
    .table-content { position: relative; overflow-y: auto; height: 400px; }
    .virtual-height { width: 1px; opacity: 0; }
    #data-table { position: absolute; top: 0; left: 0; width: 100%; border-collapse: collapse; }
    .celula-clicavel { cursor: pointer; }
    #pagination { margin-top: 8px; }
    .table-info { margin-bottom: 8px; }
  `;
  document.head.appendChild(style);
}
// ─━━━ FIM: DataTable integrado ━━━━
