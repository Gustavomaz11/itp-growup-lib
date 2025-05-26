import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';

import html2canvas from 'html2canvas';

// —————————————————————————————————————————————————————————————————————————————————
// 1) ESTILOS E FUNÇÕES PARA O SPINNER
// —————————————————————————————————————————————————————————————————————————————————
// Adiciona estilo do spinner + porcentagem
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  #loadingSpinner {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(255,255,255,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    z-index: 9999;
  }
  #loadingSpinner .spinner {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #007bff;
    border-radius: 50%;
    width: 60px; height: 60px;
    animation: spin 1s linear infinite;
  }
  #loadingSpinner .percentage {
    margin-top: 12px;
    font-size: 16px;
    font-weight: bold;
    color: #007bff;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

// Exibe o overlay com spinner e texto de 0%
function showLoadingSpinner() {
  if (!document.getElementById('loadingSpinner')) {
    const overlay = document.createElement('div');
    overlay.id = 'loadingSpinner';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <div class="percentage">0%</div>
    `;
    document.body.appendChild(overlay);
  }
}

// Atualiza o texto de porcentagem (ex: 45%)
function updateLoadingSpinner(percent) {
  const overlay = document.getElementById('loadingSpinner');
  if (overlay) {
    const txt = overlay.querySelector('.percentage');
    if (txt) txt.textContent = `${Math.min(Math.max(percent, 0), 100)}%`;
  }
}

// Remove o overlay
function hideLoadingSpinner() {
  const overlay = document.getElementById('loadingSpinner');
  if (overlay) overlay.remove();
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

function processarDadosAgregado(dados, campoGroup, campoValor, tipo) {
  const countMap = new Map();
  const sumMap = new Map();

  dados.forEach((item) => {
    const key = item[campoGroup];
    if (key == null) return;
    const val = parseFloat(item[campoValor]) || 0;
    countMap.set(key, (countMap.get(key) || 0) + 1);
    sumMap.set(key, (sumMap.get(key) || 0) + val);
  });

  // mantém ordem de aparição
  const labels = Array.from(
    new Set(dados.map((item) => item[campoGroup]).filter((v) => v != null)),
  );

  const valores = labels.map((label) => {
    if (tipo === 'sum') return sumMap.get(label);
    if (tipo === 'mean') return sumMap.get(label) / countMap.get(label);
    return countMap.get(label);
  });

  return { labels, valores };
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
  aggregationType = 'count', // 'count' | 'sum' | 'mean'
  valueField = null, // campo numérico para sum/mean
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

    if (aggregationType === 'count') {
      // comportamento original de count
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
    } else {
      // sum ou mean
      if (!valueField) {
        throw new Error(
          'valueField obrigatório quando aggregationType for "sum" ou "mean"',
        );
      }
      ({ labels, valores } = processarDadosAgregado(
        dadosFiltrados,
        parametro_busca,
        valueField,
        aggregationType,
      ));
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
            backgroundColor: Array.isArray(backgroundColor)
              ? backgroundColor.slice(0, labels.length)
              : backgroundColor || 'rgba(0,0,0,0.1)',
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
                  fillStyle: Array.isArray(ds.backgroundColor)
                    ? ds.backgroundColor[i] || 'rgba(0,0,0,0.1)'
                    : ds.backgroundColor || 'rgba(0,0,0,0.1)',
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
    grafico._parametro_busca = parametro_busca;

    // Registramos também o callback para uso posterior
    const total = dadosFiltrados.length;
    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
      callback,
      aggregationType,
      valueField,
      ultimoTotal: total,
    });

    // Notifica callback
    if (callback) {
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

// Modificação na função toggleFiltro para atualizar KPIs também
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
  atualizarTodosOsKPIs(); // Nova linha para atualizar KPIs
}

function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach((entry) => {
    const {
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
      callback,
      renderizar, // Suporte a gráficos que possuem renderização personalizada
    } = entry;

    if (renderizar) {
      // Caso o gráfico possua um método de renderização, chamamos ele diretamente
      renderizar();
    } else {
      // Lógica padrão para gráficos criados com `criarGrafico`
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

      // Chamamos o callback se ele existir
      if (callback) {
        const total = dadosFiltrados.length;
        const totalAnterior = entry.ultimoTotal || total;

        // Calculamos a variação percentual se possível
        let variacaoTexto = null;
        if (totalAnterior > 0) {
          const variacao = ((total - totalAnterior) / totalAnterior) * 100;
          variacaoTexto = `${variacao > 0 ? '+' : ''}${variacao.toFixed(2)}%`;
        }

        // Armazenamos o total atual para comparações futuras
        entry.ultimoTotal = total;

        callback({ total, variacaoTexto });
      }
    }
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
 * ex: "prioridade_atendimento" → "Prioridade Atendimento"
 */

/**
 * Cria e injeta o botão “Gerar Relatório” no container indicado.
 * @param {Array<Object>} dadosOriginais – seu array completo de dados.
 * @param {HTMLElement} containerEl – elemento onde o botão será inserido.
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
 * Humaniza um texto: replace underscores, capitaliza iniciais
 */
function humanize(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Calcula estatísticas para cada categoria de um gráfico com validação robusta de dados
 */
function calcularEstatisticasGrafico(dados, categoryField) {
  // Verificação de segurança para evitar erros quando dados estão vazios
  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return {
      anoRecente: null,
      anoAnterior: null,
      statsPorCategoria: [],
    };
  }

  // 1) Detecta campo de data com verificação de segurança
  const dateField = dados[0]
    ? Object.keys(dados[0]).find(
        (f) =>
          dados[0][f] &&
          typeof dados[0][f] === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(dados[0][f]),
      )
    : null;

  if (!dateField) {
    return {
      anoRecente: null,
      anoAnterior: null,
      statsPorCategoria: [],
    };
  }

  // 2) Conta ocorrências por ESCALA year|month|category com validação
  const counts = {};
  dados.forEach((item) => {
    if (!item || !item[dateField]) return;

    const dt = item[dateField];
    const year = dt.slice(0, 4);
    const month = dt.slice(5, 7);
    const cat = item[categoryField] || '—';
    const key = `${year}|${month}|${cat}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  // 3) Descobre anos e categorias
  const anos = Array.from(
    new Set(Object.keys(counts).map((k) => k.split('|')[0])),
  ).sort();

  if (anos.length < 2) {
    return {
      anoRecente: anos.length > 0 ? anos[anos.length - 1] : null,
      anoAnterior: null,
      statsPorCategoria: [],
    };
  }

  const anoRec = anos[anos.length - 1];
  const anoAnt = anos[anos.length - 2];
  const categorias = Array.from(
    new Set(Object.keys(counts).map((k) => k.split('|')[2])),
  );

  // 4) Monta statsPorCategoria
  const statsPorCategoria = categorias.map((cat) => {
    let totalRec = 0,
      totalAnt = 0;
    const variacaoMeses = [];
    const variacaoMensal = [];

    // Primeiro calcula year-to-year e coleta totais mensais
    const totaisMesRec = [],
      totaisMesAnt = [];
    ordemMeses.forEach((nome, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const rec = counts[`${anoRec}|${mm}|${cat}`] || 0;
      const ant = counts[`${anoAnt}|${mm}|${cat}`] || 0;
      totaisMesRec.push(rec);
      totaisMesAnt.push(ant);
      totalRec += rec;
      totalAnt += ant;

      // variação ano-a-ano por mês:
      const vYA = ant ? ((rec - ant) / ant) * 100 : 0;
      variacaoMeses.push({ mes: nome, variacao: vYA });
    });

    // variação total ano-a-ano
    const vAno = totalAnt ? ((totalRec - totalAnt) / totalAnt) * 100 : 0;

    // agora variação mensal dentro de anoRec
    for (let i = 0; i < ordemMeses.length; i++) {
      const nome = ordemMeses[i];
      if (i === 0) {
        variacaoMensal.push({ mes: nome, variacao: 0 });
      } else {
        const atual = totaisMesRec[i];
        const antes = totaisMesRec[i - 1];
        const vM = antes ? ((atual - antes) / antes) * 100 : 0;
        variacaoMensal.push({ mes: nome, variacao: vM });
      }
    }

    return {
      categoria: cat,
      variacaoAno: vAno,
      variacaoMeses, // ano-a-ano, por mês
      variacaoMensal, // mês-a-mês dentro de anoRec
    };
  });

  return { anoRecente: anoRec, anoAnterior: anoAnt, statsPorCategoria };
}

/**
 * Gera um relatório PDF com verificações robustas para evitar erros
 */

async function gerarRelatorio(dadosOriginais) {
  showLoadingSpinner();
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let cursorY = 40;

    // --- Cabeçalho ---
    doc.setFontSize(18);
    doc.text('Relatório de Projeções e Resultados', 40, cursorY);
    cursorY += 25;
    doc.setDrawColor(0, 0, 0);
    doc.line(40, cursorY, 555, cursorY);
    cursorY += 20;
    doc.setFontSize(11);
    doc.text(
      'Este relatório apresenta os resultados atuais e as projeções baseadas nos dados.',
      40,
      cursorY,
    );
    cursorY += 30;

    // Verificações de segurança para todosOsGraficos
    if (
      !todosOsGraficos ||
      !Array.isArray(todosOsGraficos) ||
      todosOsGraficos.length === 0
    ) {
      doc.text(
        'Não há gráficos disponíveis para inclusão no relatório.',
        40,
        cursorY,
      );
      doc.save('Relatorio_Visual_Sem_Graficos.pdf');
      return;
    }

    const entries = todosOsGraficos.filter(
      (entry) =>
        entry && entry.grafico && entry.dadosOriginais && entry.parametro_busca,
    );

    if (entries.length === 0) {
      doc.text(
        'Não foram encontrados gráficos válidos para o relatório.',
        40,
        cursorY,
      );
      doc.save('Relatorio_Visual_Sem_Graficos.pdf');
      return;
    }

    const total = entries.length;
    let tarefas = [];

    // Prepara as imagens e estatísticas com validação
    for (const entry of entries) {
      try {
        if (
          !entry.grafico ||
          typeof entry.grafico.toBase64Image !== 'function'
        ) {
          continue;
        }

        const imgData = entry.grafico.toBase64Image();
        const imgW = 515;
        const imgH = (entry.grafico.height / entry.grafico.width) * imgW;

        const stats = calcularEstatisticasGrafico(
          entry.dadosOriginais || [],
          entry.parametro_busca || '',
        );

        tarefas.push({ grafico: entry.grafico, imgData, imgW, imgH, stats });
      } catch (err) {
        console.error('Erro ao processar gráfico:', err);
        // Continuamos com os outros gráficos em caso de erro
      }
    }

    // Se depois da validação não sobrar nenhum gráfico válido
    if (tarefas.length === 0) {
      doc.text(
        'Os gráficos disponíveis não puderam ser processados corretamente.',
        40,
        cursorY,
      );
      doc.save('Relatorio_Visual_Sem_Dados.pdf');
      return;
    }

    for (let i = 0; i < tarefas.length; i++) {
      const { grafico, imgData, imgW, imgH, stats } = tarefas[i];

      // Validação de segurança para grafico
      if (
        !grafico ||
        !grafico.data ||
        !grafico.data.labels ||
        !grafico.data.datasets ||
        !grafico.data.datasets[0] ||
        !grafico.data.datasets[0].data
      ) {
        updateLoadingSpinner(Math.round(((i + 1) / total) * 100));
        continue;
      }

      // paginação
      if (cursorY + imgH > 780) {
        doc.addPage();
        cursorY = 40;
      }

      // gráfico
      try {
        doc.addImage(imgData, 'PNG', 40, cursorY, imgW, imgH);
        cursorY += imgH + 10;
      } catch (err) {
        console.error('Erro ao adicionar imagem:', err);
        doc.text('Erro ao gerar imagem do gráfico', 40, cursorY);
        cursorY += 20;
      }

      // tabela de valores
      const labels = grafico.data.labels || [];
      const valores = grafico.data.datasets[0].data || [];
      doc.setFontSize(11);
      labels.forEach((lab, j) => {
        if (cursorY > 780) {
          doc.addPage();
          cursorY = 40;
        }
        doc.text(`${lab}: ${valores[j]} atendimentos`, 40, cursorY);
        cursorY += 14;
      });
      cursorY += 10;

      const labelGraf = grafico.data.datasets[0].label || '';
      if (labelGraf === 'SLA') {
        // SLA ano-a-ano por bin
        if (
          stats &&
          stats.statsPorCategoria &&
          Array.isArray(stats.statsPorCategoria)
        ) {
          doc.setFontSize(12);
          doc.text('SLA – Variação Ano a Ano por Faixa de Tempo:', 40, cursorY);
          cursorY += 18;

          stats.statsPorCategoria.forEach((bin) => {
            if (!bin || typeof bin.categoria !== 'string') return;

            if (cursorY > 780) {
              doc.addPage();
              cursorY = 40;
            }

            // Extrai o trecho com validação
            let trecho = '';
            const match = bin.categoria.match(/> *([^<]+)/);
            if (match && match[1]) {
              trecho = match[1];
            } else {
              trecho = bin.categoria;
            }

            doc.setFontSize(11);
            doc.text(
              `> ${trecho.trim()}: ${bin.variacaoAno.toFixed(2)}%`,
              60,
              cursorY,
            );
            cursorY += 14;
          });
          cursorY += 20;
        }

        updateLoadingSpinner(Math.round(((i + 1) / total) * 100));
        continue;
      }

      // Verificações para estatísticas
      if (
        !stats ||
        !stats.statsPorCategoria ||
        !Array.isArray(stats.statsPorCategoria)
      ) {
        updateLoadingSpinner(Math.round(((i + 1) / total) * 100));
        continue;
      }

      // bloco: variação ano-a-ano total
      if (stats.anoAnterior && stats.anoRecente) {
        if (cursorY > 760) {
          doc.addPage();
          cursorY = 40;
        }
        doc.setFontSize(12);
        doc.text(
          `Variação Ano a Ano (${stats.anoAnterior} → ${stats.anoRecente}):`,
          40,
          cursorY,
        );
        cursorY += 18;

        stats.statsPorCategoria.forEach((cat) => {
          if (!cat || typeof cat.categoria !== 'string') return;

          if (cursorY > 780) {
            doc.addPage();
            cursorY = 40;
          }
          doc.setFontSize(11);
          doc.text(
            `${cat.categoria}: ${cat.variacaoAno.toFixed(2)}%`,
            60,
            cursorY,
          );
          cursorY += 14;
        });
        cursorY += 20;

        // bloco: variação mês-a-mês ano-a-ano
        if (cursorY > 760) {
          doc.addPage();
          cursorY = 40;
        }
        doc.setFontSize(12);
        doc.text(
          `Variação Mês a Mês (${stats.anoAnterior} → ${stats.anoRecente}):`,
          40,
          cursorY,
        );
        cursorY += 18;

        stats.statsPorCategoria.forEach((cat) => {
          if (!cat || !cat.variacaoMeses || !Array.isArray(cat.variacaoMeses))
            return;

          if (cursorY > 780) {
            doc.addPage();
            cursorY = 40;
          }
          doc.setFontSize(11);
          doc.text(`Categoria ${cat.categoria}:`, 60, cursorY);
          cursorY += 14;

          cat.variacaoMeses.forEach((m) => {
            if (!m || typeof m.mes !== 'string') return;

            if (cursorY > 780) {
              doc.addPage();
              cursorY = 40;
            }
            doc.text(`   ${m.mes}: ${m.variacao.toFixed(2)}%`, 80, cursorY);
            cursorY += 14;
          });
          cursorY += 10;
        });
        cursorY += 20;

        // bloco: variação mês-a-mês (relativo ao mês anterior)
        if (cursorY > 760) {
          doc.addPage();
          cursorY = 40;
        }
        doc.setFontSize(12);
        doc.text(
          `Variação em Relação ao Mês Anterior (${stats.anoRecente}):`,
          40,
          cursorY,
        );
        cursorY += 18;

        stats.statsPorCategoria.forEach((cat) => {
          if (!cat || !cat.variacaoMensal || !Array.isArray(cat.variacaoMensal))
            return;

          if (cursorY > 780) {
            doc.addPage();
            cursorY = 40;
          }
          doc.setFontSize(11);
          doc.text(`Categoria ${cat.categoria}:`, 60, cursorY);
          cursorY += 14;

          cat.variacaoMensal.forEach((m) => {
            if (!m || typeof m.mes !== 'string') return;

            if (cursorY > 780) {
              doc.addPage();
              cursorY = 40;
            }
            doc.text(`   ${m.mes}: ${m.variacao.toFixed(2)}%`, 80, cursorY);
            cursorY += 14;
          });
          cursorY += 10;
        });
        cursorY += 20;
      }

      updateLoadingSpinner(Math.round(((i + 1) / total) * 100));
    }

    doc.save('Relatorio_Visual_Completo.pdf');
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    // Mostra mensagem de erro na página
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '10px';
    errorDiv.style.margin = '10px 0';
    errorDiv.style.border = '1px solid red';
    errorDiv.textContent = `Erro ao gerar relatório: ${error.message}. Tente novamente mais tarde.`;
    document.body.appendChild(errorDiv);

    // Remove após 10 segundos
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
  } finally {
    hideLoadingSpinner();
  }
}

/**
 * Cria um gráfico de bolhas que reage aos filtros aplicados.
 * @param {HTMLElement} ctx - Contexto do canvas onde o gráfico será renderizado.
 * @param {string} eixoX - Campo do eixo X.
 * @param {string} eixoY - Campo do eixo Y.
 * @param {string} raio - Campo que define o tamanho das bolhas.
 * @param {Array} dadosOriginais - Dados de entrada para o gráfico.
 * @param {Array<string>} cores - Array de cores para as bolhas.
 */
export function criarGraficoBolha(
  ctx,
  eixoX,
  eixoY,
  raio,
  dadosOriginais,
  cores,
) {
  const dadosOriginaisCopy = [...dadosOriginais]; // Mantém os dados originais imutáveis
  let grafico;

  // Converte strings para números com base na contagem de ocorrências
  function converterParaNumeros(dados, campo) {
    const contagem = {};
    let contador = 1;

    dados.forEach((item) => {
      const valor = item[campo];
      if (!(valor in contagem)) {
        contagem[valor] = contador++;
      }
    });

    return (valor) => contagem[valor] || 0;
  }

  function renderizarBolhas() {
    const dadosFiltrados = getDadosAtuais(dadosOriginaisCopy);

    // Verifica se os campos são strings e os converte se necessário
    const isXString = dadosFiltrados.some((item) =>
      isNaN(parseFloat(item[eixoX])),
    );
    const isYString = dadosFiltrados.some((item) =>
      isNaN(parseFloat(item[eixoY])),
    );
    const isRaioString = dadosFiltrados.some((item) =>
      isNaN(parseFloat(item[raio])),
    );

    const xConverter = isXString
      ? converterParaNumeros(dadosFiltrados, eixoX)
      : (v) => parseFloat(v) || 0;
    const yConverter = isYString
      ? converterParaNumeros(dadosFiltrados, eixoY)
      : (v) => parseFloat(v) || 0;
    const raioConverter = isRaioString
      ? converterParaNumeros(dadosFiltrados, raio)
      : (v) => parseFloat(v) || 5;

    // Processa os dados para criar os pontos do gráfico
    const dadosGrafico = dadosFiltrados.map((item, index) => ({
      x: xConverter(item[eixoX]),
      y: yConverter(item[eixoY]),
      r: raioConverter(item[raio]),
      backgroundColor: cores[index % cores.length], // Cicla pelas cores fornecidas
    }));

    if (grafico) {
      // Atualiza o gráfico existente
      grafico.data.datasets[0].data = dadosGrafico;
      grafico.update();
    } else {
      // Configuração inicial do gráfico de bolhas
      const config = {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: `Gráfico de Bolhas (${eixoX}, ${eixoY}, ${raio})`,
              data: dadosGrafico,
              backgroundColor: dadosGrafico.map((d) => d.backgroundColor),
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: {
              title: {
                display: true,
                text: eixoX,
              },
              beginAtZero: true,
            },
            y: {
              title: {
                display: true,
                text: eixoY,
              },
              beginAtZero: true,
            },
          },
        },
      };

      // Cria o gráfico
      grafico = new Chart(ctx, config);
    }
  }

  // Renderiza pela primeira vez
  renderizarBolhas();

  // Registra o gráfico para reagir a atualizações globais
  todosOsGraficos.push({
    grafico,
    renderizar: renderizarBolhas, // Define o método de renderização para atualizações
  });
}

/**
 * Cria um gráfico misto (barra + linha) que reage a filtros globais.
 * @param {HTMLCanvasElement} ctx - Contexto do canvas onde será renderizado.
 * @param {string} eixoX - Campo para o eixo X (string ou número).
 * @param {string} eixoY - Campo para o eixo Y (números).
 * @param {Array<Object>} obj - Array de dados originais.
 * @param {string} titulo - Título do gráfico.
 */
export function criarGraficoMisto(ctx, obj, titulo = '') {
  const dadosOriginais = Array.isArray(obj) ? [...obj] : obj.slice();
  let grafico;

  function obterMesAno(dataStr) {
    const data = new Date(dataStr);
    if (isNaN(data)) return null;
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(
      2,
      '0',
    )}`; // Ex: "2023-01"
  }

  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);

    const contagemAtendimentosMensal = {};
    const contagemExcelentesMensal = {};

    dadosFiltrados.forEach((item) => {
      const dataResolucao = new Date(item.data_resolucao);
      if (isNaN(dataResolucao.getTime())) {
        return;
      }

      const mesIndex = dataResolucao.getMonth();
      const nomeMes = ordemMeses[mesIndex];

      if (!contagemAtendimentosMensal[nomeMes]) {
        contagemAtendimentosMensal[nomeMes] = 0;
      }
      if (!contagemExcelentesMensal[nomeMes]) {
        contagemExcelentesMensal[nomeMes] = 0;
      }

      contagemAtendimentosMensal[nomeMes]++;

      if (item.nota === 'Excelente') {
        contagemExcelentesMensal[nomeMes]++;
      }
    });

    const labels = ordemMeses;
    const dadosBarra = labels.map(
      (mes) => contagemAtendimentosMensal[mes] || 0,
    );
    const dadosLinha = labels.map((mes) => contagemExcelentesMensal[mes] || 0);

    // Definir as cores das barras com transparência (RGBA)
    const barColors = [
      'rgba(255, 99, 132, 0.7)', // Vermelho com 70% de opacidade
      'rgba(153, 102, 255, 0.7)', // Roxo com 70% de opacidade (exemplo de RGB para roxo)
      'rgba(54, 162, 235, 0.7)', // Azul com 70% de opacidade
      'rgba(255, 205, 86, 0.7)', // Amarelo com 70% de opacidade
      'rgba(139, 69, 19, 0.7)', // Marrom com 70% de opacidade (exemplo de RGB para marrom)
      'rgba(75, 192, 192, 0.7)', // Verde com 70% de opacidade
      'rgba(255, 99, 132, 0.7)', // Repete Vermelho
      'rgba(153, 102, 255, 0.7)', // Repete Roxo
      'rgba(54, 162, 235, 0.7)', // Repete Azul
      'rgba(255, 205, 86, 0.7)', // Repete Amarelo
      'rgba(139, 69, 19, 0.7)', // Repete Marrom
      'rgba(75, 192, 192, 0.7)', // Repete Verde
    ];

    if (grafico) {
      grafico.destroy();
    }

    grafico = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            // Dataset de barras (definido primeiro)
            type: 'bar',
            label: 'Total de atendimentos',
            data: dadosBarra,
            backgroundColor: barColors, // Usar cores RGBA transparentes
            borderColor: barColors.map((color) => color.replace('0.7', '1')), // Borda opaca (opcional)
            borderWidth: 1,
          },
          {
            // Dataset de linha (definido depois, será renderizado por cima)
            type: 'line',
            label: 'Notas "Excelente"',
            data: dadosLinha,
            borderColor: 'rgba(255, 99, 132, 1)', // Cor da linha opaca
            backgroundColor: 'rgba(255, 99, 132, 0.3)', // Área abaixo da linha (opcionalmente transparente)
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: !!titulo,
            text: titulo,
          },
          legend: {
            position: 'top',
          },
        },
        scales: {
          x: {
            // Configurações do eixo X
          },
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  } // Primeiro render

  renderizar(); // Registra para reagir a filtros globais (se aplicável)

  todosOsGraficos.push({
    grafico,
    dadosOriginais,
    renderizar,
  });
}
