import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
      // ── novo suporte a ano ───────────────────────────────────────────────
      if (param.endsWith('_ano')) {
        const campo = param.replace('_ano', '');
        const ano = item[campo]?.slice(0, 4);
        return ano && vals.includes(ano);
      }
      // ─────────────────────────────────────────────────────────────────────

      // filtro de duração...
      if (param.endsWith('_duracao')) {
        /* ... */
      }
      // filtro normal (inclui data para mês)...
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
  // Cópia imutável dos dados originais
  const dadosOriginais = Array.isArray(obj) ? [...obj] : obj.slice();
  let tipoAtual = tipoInicial;
  let grafico;
  let lastLabels = [];
  let lastValores = [];

  const wrapper = ctx.canvas.parentNode; // container do <canvas>

  //
  // ——— CONTROLES DE PERÍODO (ANO / MÊS / TRIMESTRE) ———
  //

  // 1) Detecta automaticamente o campo de data no JSON
  const dateField = Object.keys(dadosOriginais[0] || {}).find((field) =>
    dadosOriginais.every(
      (item) =>
        typeof item[field] === 'string' &&
        /^\d{4}-\d{2}-\d{2}/.test(item[field]),
    ),
  );

  if (dateField) {
    const periodDiv = document.createElement('div');
    Object.assign(periodDiv.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
    });

    // 1.1) Botão "Todos" para resetar filtro de ano
    const btnAll = document.createElement('button');
    btnAll.textContent = 'Todos';
    btnAll.style.cursor = 'pointer';
    btnAll.addEventListener('click', () => {
      delete filtrosAtuais[`${dateField}_ano`];
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(btnAll);

    // 1.2) Botões de ANO dinamicamente extraídos do JSON
    const anos = Array.from(
      new Set(dadosOriginais.map((item) => item[dateField].slice(0, 4))),
    );
    anos.forEach((ano) => {
      const btn = document.createElement('button');
      btn.textContent = ano;
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => {
        delete filtrosAtuais[`${dateField}_ano`];
        filtrosAtuais[`${dateField}_ano`] = [ano];
        atualizarTodosOsGraficos();
      });
      periodDiv.appendChild(btn);
    });

    // 2) Select MENSAL (usa dateField e respeita filtro de ano)
    const selMes = document.createElement('select');
    selMes.appendChild(new Option('Todos meses', ''));
    ordemMeses.forEach((mes) => selMes.appendChild(new Option(mes, mes)));
    selMes.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) {
        delete filtrosAtuais[dateField];
      } else {
        filtrosAtuais[dateField] = [val];
      }
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(selMes);

    // 3) Select TRIMESTRAL (usa dateField e respeita filtro de ano)
    const selTri = document.createElement('select');
    selTri.appendChild(new Option('Todos trimestres', ''));
    const quarters = [
      ['1º', ['Janeiro', 'Fevereiro', 'Março']],
      ['2º', ['Abril', 'Maio', 'Junho']],
      ['3º', ['Julho', 'Agosto', 'Setembro']],
      ['4º', ['Outubro', 'Novembro', 'Dezembro']],
    ];
    quarters.forEach(([label, meses]) => {
      const opt = new Option(label, label);
      opt.dataset.meses = meses.join(',');
      selTri.appendChild(opt);
    });
    selTri.addEventListener('change', (e) => {
      const meses = e.target.selectedOptions[0].dataset.meses;
      if (!meses) {
        delete filtrosAtuais[dateField];
      } else {
        filtrosAtuais[dateField] = meses.split(',');
      }
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(selTri);

    // Insere os controles de período no topo
    wrapper.insertBefore(periodDiv, wrapper.firstChild);
  }

  //
  // ——— FUNÇÃO QUE (RE)DESENHA O GRÁFICO ———
  //
  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let labels, valores;

    if (porDuracao === false) {
      if (!parametro_busca_fim) {
        throw new Error(
          'parametro_busca_fim obrigatório quando porDuracao=false',
        );
      }
      ({ labels, valores } = processarDuracaoAtendimentos(
        dadosFiltrados,
        parametro_busca,
        parametro_busca_fim,
      ));
    } else {
      ({ labels, valores } = processarDados(dadosFiltrados, parametro_busca));
    }

    lastLabels = labels;
    lastValores = valores;

    // Se já existia, destrói e remove do registro
    if (grafico) {
      grafico.destroy();
      const idx = todosOsGraficos.findIndex((g) => g.grafico === grafico);
      if (idx > -1) todosOsGraficos.splice(idx, 1);
    }

    // Configuração do Chart.js
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
        responsive: true,
        scales:
          tipoAtual === 'bar' || tipoAtual === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : undefined,
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
              toggleFiltro(
                parametro_busca,
                porDuracao
                  ? val
                  : `${parametro_busca}|${parametro_busca_fim}_duracao:${val}`,
              );
              atualizarTodosOsGraficos();
            },
          },
        },
      },
    };

    // Cria e registra o gráfico
    grafico = new Chart(ctx, config);
    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
    });

    // Notifica callback
    if (callback) {
      const total = getDadosAtuais(dadosOriginais).length;
      callback({ total, variacaoTexto: null });
    }
  }

  // primeiro render
  renderizar();

  //
  // ——— CONTROLES VISUAIS (tipo de gráfico e tabela) ———
  //
  const controls = document.createElement('div');
  Object.assign(controls.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  });

  // select de tipos
  const tipos = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
  const sel = document.createElement('select');
  Object.assign(sel.style, {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer',
  });
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
  controls.appendChild(sel);

  // botão de alternar tabela
  const btn = document.createElement('button');
  btn.textContent = 'Ver tabela';
  Object.assign(btn.style, {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer',
    background: '#f9f9f9',
  });
  controls.appendChild(btn);
  wrapper.insertBefore(controls, ctx.canvas);

  // container da tabela (inicialmente escondido)
  const tableContainer = document.createElement('div');
  tableContainer.style.display = 'none';
  wrapper.appendChild(tableContainer);

  // estado de visibilidade da tabela
  let tabelaVisivel = false;
  btn.addEventListener('click', () => {
    tabelaVisivel = !tabelaVisivel;
    if (tabelaVisivel) {
      ctx.canvas.style.display = 'none';
      tableContainer.style.display = 'block';
      btn.textContent = 'Ver gráfico';
      tableContainer.innerHTML = '';
      const tbl = document.createElement('table');
      Object.assign(tbl.style, {
        width: '100%',
        borderCollapse: 'collapse',
      });
      const thead = document.createElement('thead');
      const thr = document.createElement('tr');
      [parametro_busca, 'Valor'].forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        Object.assign(th.style, {
          border: '1px solid #ddd',
          padding: '8px',
          background: '#f5f5f5',
          textAlign: 'left',
        });
        thr.appendChild(th);
      });
      thead.appendChild(thr);
      tbl.appendChild(thead);
      const tb = document.createElement('tbody');
      lastLabels.forEach((lab, i) => {
        const tr = document.createElement('tr');
        [lab, lastValores[i]].forEach((txt) => {
          const td = document.createElement('td');
          td.textContent = txt;
          Object.assign(td.style, {
            border: '1px solid #ddd',
            padding: '8px',
          });
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      tableContainer.appendChild(tbl);
    } else {
      tableContainer.style.display = 'none';
      ctx.canvas.style.display = 'block';
      btn.textContent = 'Ver tabela';
    }
  });
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

/**
 * Função utilitária para humanizar nomes de campos:
 * ex: "data_solicitacao" → "Data Solicitação"
 */
function humanize(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Cria e injeta o botão “Gerar Relatório” no container indicado.
 * @param {Array<Object>} dadosOriginais
 * @param {HTMLElement} containerEl
 */
export function criarBotaoGerarRelatorio(dadosOriginais, containerEl) {
  const btn = document.createElement('button');
  btn.textContent = 'Gerar Relatório';
  Object.assign(btn.style, {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    background: '#007bff',
    color: '#fff',
    cursor: 'pointer',
    margin: '8px 0',
  });
  btn.addEventListener('click', () => gerarRelatorio(dadosOriginais));
  containerEl.appendChild(btn);
  return btn;
}

/**
 * Gera o PDF: faz resumo dinâmico de todos os campos,
 * captura imagens dos gráficos, monta cabeçalho,
 * tabela com colunas dinâmicas e textos “humanos”.
 * @param {Array<Object>} dadosOriginais
 */
async function gerarRelatorio(dadosOriginais) {
  const dadosAtuais = getDadosAtuais(dadosOriginais);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Cabeçalho
  doc.setFontSize(16);
  doc.text('Relatório de Dados', 40, 50);
  doc.setFontSize(11);
  doc.text(
    'Este documento apresenta os dados conforme visualizados na tela, ' +
      'incluindo o resumo geral, os gráficos e a tabela resultante da filtragem atual.',
    40,
    70,
    { maxWidth: 515 },
  );
  doc.text(`Emissão: ${new Date().toLocaleString()}`, 40, 95);

  let cursorY = 125;

  // Resumo dinâmico
  if (dadosAtuais.length) {
    const keys = Object.keys(dadosAtuais[0]);
    const dateKey = keys.find((k) => /data|date/i.test(k)) || keys[0];
    const anos = Array.from(
      new Set(dadosAtuais.map((i) => new Date(i[dateKey]).getFullYear())),
    ).sort();
    const total = dadosAtuais.length;

    const resumos = keys
      .filter((k) => k !== dateKey)
      .map((k) => {
        const vals = dadosAtuais.map((i) => i[k]).filter((v) => v != null);
        const nums = vals.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
        if (nums.length === vals.length) {
          const media = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(
            2,
          );
          return `Média de ${humanize(k)}: ${media}`;
        } else {
          const cnt = vals.reduce((acc, v) => {
            const s = String(v);
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {});
          return `${humanize(k)}: ${Object.entries(cnt)
            .map(([v, c]) => `${v} (${c})`)
            .join(', ')}`;
        }
      });

    const textoResumo =
      `Durante os anos de ${anos[0]} e ${anos[anos.length - 1]}, ` +
      `foram exibidos ${total} registros. Resumo por campo: ${resumos.join(
        '; ',
      )}.`;

    doc.setFontSize(12);
    doc.text(textoResumo, 40, cursorY, { maxWidth: 515 });
    cursorY += 30; // <– corrigido de “thirty” para 30
  } else {
    doc.setFontSize(12);
    doc.text('Nenhum dado a exibir para o resumo.', 40, cursorY);
    cursorY += 20;
  }

  // Captura de imagens dos gráficos
  const canvases = document.querySelectorAll('canvas.meu-grafico');
  for (let c of canvases) {
    const bmp = await html2canvas(c, { backgroundColor: '#fff' });
    const img = bmp.toDataURL('image/png');
    const pageW = doc.internal.pageSize.getWidth() - 80;
    const scale = pageW / bmp.width;
    const imgH = bmp.height * scale;
    doc.addImage(img, 'PNG', 40, cursorY, pageW, imgH);
    cursorY += imgH + 20;
    if (cursorY > 760) {
      doc.addPage();
      cursorY = 40;
    }
  }

  // Tabela dinâmica
  if (dadosAtuais.length) {
    const keys = Object.keys(dadosAtuais[0]);
    const cols = keys.map(humanize);
    const pageW = doc.internal.pageSize.getWidth() - 80;
    const colW = pageW / cols.length;

    // cabeçalho
    doc.setFontSize(10);
    doc.setFillColor(230);
    cols.forEach((t, i) => {
      const x = 40 + i * colW;
      doc.rect(x, cursorY, colW, 20, 'F');
      doc.text(t, x + 4, cursorY + 14);
    });
    cursorY += 25;

    // linhas
    dadosAtuais.forEach((item) => {
      if (cursorY > 780) {
        doc.addPage();
        cursorY = 40;
      }
      keys.forEach((k, i) => {
        const x = 40 + i * colW;
        const txt = item[k] != null ? String(item[k]) : '';
        doc.text(txt, x + 4, cursorY);
      });
      cursorY += 18;
    });

    // observação final
    if (cursorY + 40 < 800) {
      doc.setFontSize(11);
      doc.text(
        `Observação: mostrados ${dadosAtuais.length} registros conforme filtros aplicados.`,
        40,
        cursorY + 30,
        { maxWidth: 515 },
      );
    }
  }

  // Abre o PDF em nova aba
  const blob = doc.output('blob');
  window.open(URL.createObjectURL(blob), '_blank');
}
