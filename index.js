import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';


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

function updateLoadingSpinner(percent) {
  const overlay = document.getElementById('loadingSpinner');
  if (overlay) {
    const txt = overlay.querySelector('.percentage');
    if (txt) txt.textContent = `${Math.min(Math.max(percent, 0), 100)}%`;
  }
}

function hideLoadingSpinner() {
  const overlay = document.getElementById('loadingSpinner');
  if (overlay) overlay.remove();
}

export const filtrosAtuais = {};

const todasAsTabelas = [];

let todosOsGraficos = [];

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



function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) return dadosOriginais;

  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([param, vals]) => {
    
      if (param.endsWith('_ano')) {
        const campo = param.replace('_ano', '');
        const ano = item[campo]?.slice(0, 4);
        return ano && vals.includes(ano);
      }


      if (param.endsWith('_duracao')) {
        /* ... */
      }
      
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


  const labels = Array.from(
    new Set(dados.map((item) => item[campoGroup]).filter((v) => v != null)),
  );

  const valores = labels.map((label) => {
    if (tipo === 'sum') return sumMap.get(label) ?? 0;
    if (tipo === 'mean') {
      const count = countMap.get(label) ?? 0;
      return count > 0 ? (sumMap.get(label) ?? 0) / count : 0;
    }
    return countMap.get(label) ?? 0;
  });

  return { labels, valores };
}



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



function binsGlobais() {
  return [
    { label: '< 30 minutos', min: 0, max: 30 },
    { label: '> 30m < 45m', min: 30, max: 45 },
    { label: '> 45m < 60m', min: 45, max: 60 },
    { label: '> 1h < 24h', min: 60, max: 1440 },
    { label: '> 24h < 48h', min: 1440, max: 2880 },
    { label: '> 48h < 72h', min: 2880, max: 4320 },
    { label: '> 72h < 5d', min: 4320, max: 7200 }, 
    { label: '> 5 dias', min: 7200, max: Infinity },
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



/**
 * @param ctx                  contexto do canvas
 * @param tipoInicial          'bar'|'pie'|...
 * @param parametro_busca      campo de início
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

  const dadosOriginais = Array.isArray(obj) ? [...obj] : obj.slice();
  let grafico = null;
  let lastLabels = [];
  let lastValores = [];
  let tipoAtual = tipoInicial;
  const wrapper = ctx.canvas.parentNode;


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


    const btnAll = document.createElement('button');
    btnAll.textContent = 'Todos';
    btnAll.style.cursor = 'pointer';
    btnAll.addEventListener('click', () => {
      delete filtrosAtuais[`${dateField}_ano`];
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(btnAll);


    const anos = Array.from(
      new Set(dadosOriginais.map((item) => item[dateField].slice(0, 4))),
    );
    anos.forEach((ano) => {
      const btn = document.createElement('button');
      btn.textContent = ano;
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => {
        filtrosAtuais[`${dateField}_ano`] = [ano];
        atualizarTodosOsGraficos();
      });
      periodDiv.appendChild(btn);
    });

    const selMes = document.createElement('select');
    selMes.appendChild(new Option('Todos meses', ''));
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
    ordemMeses.forEach((mes) => selMes.appendChild(new Option(mes, mes)));
    selMes.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) delete filtrosAtuais[dateField];
      else filtrosAtuais[dateField] = [val];
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(selMes);

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
      if (!meses) delete filtrosAtuais[dateField];
      else filtrosAtuais[dateField] = meses.split(',');
      atualizarTodosOsGraficos();
    });
    periodDiv.appendChild(selTri);

    wrapper.insertBefore(periodDiv, wrapper.firstChild);
  }

  function renderizar() {

    const durKey = `${parametro_busca}|${parametro_busca_fim}_duracao`;
    const clickHandler = (val) => {
      const chaveFiltro = porDuracao ? parametro_busca : durKey;
      toggleFiltro(chaveFiltro, val);
      atualizarTodosOsGraficos();
    };


    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let labels, valores;

    if (aggregationType === 'count') {
      if (!porDuracao) {
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
    } else if (aggregationType === 'sum' || aggregationType === 'mean') {
      if (!valueField) {
        throw new Error(
          'valueField obrigatório para aggregationType "sum" ou "mean"',
        );
      }
      ({ labels, valores } = processarDadosAgregado(
        dadosFiltrados,
        parametro_busca,
        valueField,
        aggregationType,
      ));
    } else {
      throw new Error('aggregationType deve ser "count", "sum" ou "mean"');
    }


    lastLabels = labels;
    lastValores = valores;

    if (grafico) {
      grafico.data.labels = labels;
      grafico.data.datasets[0].data = valores;
      grafico.update();
    } else {
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
              onClick: function (_, item, legend) {
                const val = legend.chart.data.labels[item.index];
                clickHandler(val);
              },
            },
          },
          onClick: function (e, elements) {
            if (elements.length) {
              const idx = elements[0].index;
              const val = this.data.labels[idx];
              clickHandler(val);
            }
          },
        },
      };

      grafico = new Chart(ctx, config);
      grafico._parametro_busca = parametro_busca;

      todosOsGraficos.push({
        grafico,
        dadosOriginais,
        parametro_busca,
        porDuracao,
        parametro_busca_fim,
        callback,
        aggregationType,
        valueField,
        renderizar,
        ultimoTotal: dadosFiltrados.length,
      });
    }


    if (typeof callback === 'function') {
      callback({ total: dadosFiltrados.length, variacaoTexto: null });
    }
  }


  renderizar();

  const controls = document.createElement('div');
  Object.assign(controls.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  });

  const tipos = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
  const sel = document.createElement('select');
  Object.assign(sel.style, {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer',
  });
  tipos.forEach((t) => {
    const o = new Option(t.charAt(0).toUpperCase() + t.slice(1), t);
    if (t === tipoAtual) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    tipoAtual = sel.value;
    renderizar();
  });
  controls.appendChild(sel);

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

  const tableContainer = document.createElement('div');
  tableContainer.style.display = 'none';
  wrapper.appendChild(tableContainer);

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
      callback,
      aggregationType,
      valueField,
      renderizar, 
    } = entry;

    if (typeof renderizar === 'function') {
      renderizar();
      return;
    }

    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let labels, valores;

    if (aggregationType === 'count') {
      if (porDuracao === false) {
        ({ labels, valores } = processarDuracaoAtendimentos(
          dadosFiltrados,
          parametro_busca,
          parametro_busca_fim,
        ));
      } else {
        ({ labels, valores } = processarDados(dadosFiltrados, parametro_busca));
      }
    } else if (aggregationType === 'sum' || aggregationType === 'mean') {
      ({ labels, valores } = processarDadosAgregado(
        dadosFiltrados,
        parametro_busca,
        valueField,
        aggregationType,
      ));
    }

    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();

    if (callback) {
      const total = dadosFiltrados.length;
      const totalAnterior = entry.ultimoTotal || total;
      let variacaoTexto = null;
      if (totalAnterior > 0) {
        const variacao = ((total - totalAnterior) / totalAnterior) * 100;
        variacaoTexto = `${variacao > 0 ? '+' : ''}${variacao.toFixed(2)}%`;
      }
      entry.ultimoTotal = total;
      callback({ total, variacaoTexto });
    }
  });
}

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
 * @param {HTMLElement} containerEl  Elemento que conterá a tabela.
 * @param {Array<Object>} obj        Array de objetos.
 * @param {Array<string>} colunas    Nome das propriedades a exibir como colunas.
 * @param {Object} options           Configurações.
 */
export function criarDataTable(containerEl, obj, colunas, options = {}) {

  const CONFIG = Object.assign(
    {
      itemsPerPage: 50,
      virtualRowHeight: 35,
      debounceTime: 200,
    },
    options,
  );

 
  let dadosOriginaisTabela = obj;
  let dadosFiltradosTabela = [...dadosOriginaisTabela];
  let totalPages = 1;
  let currentPage = 1;

  const { headerEl, scrollEl, tbodyEl, infoEl, paginationEl } =
    montarEstruturaTabela(containerEl, colunas);

  function renderizarLinhas() {
    dadosFiltradosTabela = getDadosAtuais(dadosOriginaisTabela);
    totalPages = Math.ceil(dadosFiltradosTabela.length / CONFIG.itemsPerPage);

    const start = (currentPage - 1) * CONFIG.itemsPerPage;
    const pageData = dadosFiltradosTabela.slice(
      start,
      start + CONFIG.itemsPerPage,
    );

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

    function criarBotao(text, page, opts = {}) {
      const btn = document.createElement('button');
      btn.textContent = text;
      if (opts.disabled) btn.disabled = true;
      if (opts.active) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentPage = page;
        renderizarLinhas();
      });
      return btn;
    }

    function criarElipse() {
      const span = document.createElement('span');
      span.className = 'page-ellipsis';
      span.textContent = '...';
      return span;
    }


    paginationEl.appendChild(
      criarBotao('⟨', currentPage - 1, { disabled: currentPage === 1 }),
    );

    let pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages = [1, 2, 3, 4, 5, '...', totalPages];
      } else if (currentPage >= totalPages - 3) {
        pages = [
          1,
          '...',
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      } else {
        pages = [
          1,
          '...',
          currentPage - 1,
          currentPage,
          currentPage + 1,
          '...',
          totalPages,
        ];
      }
    }

    pages.forEach((p) => {
      if (p === '...') {
        paginationEl.appendChild(criarElipse());
      } else {
        paginationEl.appendChild(
          criarBotao(p, p, { active: currentPage === p }),
        );
      }
    });

    paginationEl.appendChild(
      criarBotao('⟩', currentPage + 1, {
        disabled: currentPage === totalPages,
      }),
    );
  }


  containerEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('celula-clicavel')) {
      const coluna = e.target.dataset.coluna;
      const valor = e.target.dataset.valor;
      toggleFiltro(coluna, valor);
    }
  });

  todasAsTabelas.push({ render: renderizarLinhas });

  renderizarLinhas();
}

function atualizarTodasAsTabelas() {
  todasAsTabelas.forEach((t) => t.render());
}


function montarEstruturaTabela(containerEl, colunas) {
  containerEl.innerHTML = '';
  adicionarEstilosTabela();

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
    /* ---- Tabela Virtualizada ---- */
    .table-header,
    .table-content table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      box-shadow: 0 2px 8px rgba(40, 50, 80, 0.03);
      border-radius: 12px 12px 0 0;
      overflow: hidden;
    }
    .table-header th, .table-content th {
      background: #f7fafd;
      color: #183153;
      font-weight: 600;
      padding: 14px 10px;
      border-bottom: 1px solid #e3e9f5;
      text-align: left;
      font-size: 1rem;
    }
    .table-content td {
      padding: 12px 10px;
      border-bottom: 1px solid #f1f2fa;
      font-size: 0.98rem;
      color: #444;
      background: #fff;
      transition: background 0.2s;
    }
    .table-content tr:nth-child(even) td {
      background: #f7fafd;
    }
    .table-content tr:hover td {
      background: #e7f0fa !important;
    }
    .celula-clicavel {
      cursor: pointer;
      transition: box-shadow 0.2s;
    }
    .celula-clicavel:hover {
      background: #e6f7ff !important;
      box-shadow: 0 0 2px #50a7e6;
    }
    .table-info {
      font-size: 0.97rem;
      color: #555;
      padding: 6px 0 10px 0;
    }
    .pagination-controls {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 4px;
      margin: 14px 0 4px 0;
    }
    .pagination-controls button {
      min-width: 32px;
      height: 32px;
      background: #f7fafd;
      border: 1px solid #dde7f7;
      color: #2877c5;
      font-weight: 600;
      font-size: 1rem;
      border-radius: 6px;
      margin: 0 2px;
      cursor: pointer;
      transition: background 0.2s, border 0.2s;
    }
    .pagination-controls button:disabled {
      background: #2877c5;
      color: #fff;
      border-color: #2877c5;
      cursor: default;
      font-weight: bold;
    }
    @media (max-width: 650px) {
      .table-header th, .table-content td {
        font-size: 0.88rem;
        padding: 8px 6px;
      }
      .pagination-controls button {
        min-width: 24px;
        height: 28px;
        font-size: 0.92rem;
      }
    }
    .pagination-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin: 18px 0 12px 0;
      user-select: none;
    }
    .pagination-controls button, .pagination-controls .page-ellipsis {
      border: none;
      outline: none;
      min-width: 36px;
      height: 36px;
      background: #fff;
      color: #2877c5;
      font-size: 1rem;
      border-radius: 8px;
      margin: 0 1px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      box-shadow: none;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pagination-controls button[disabled] {
      color: #c9cfd8 !important;
      background: #fff;
      cursor: default;
    }

    .pagination-controls .active-page {
      background: #2877c5 !important;
      color: #fff !important;
      font-weight: 700;
    }

    .pagination-controls .page-ellipsis {
      background: none !important;
      color: #b4bfd3;
      cursor: default;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

async function gerarRelatorio(dadosOriginais) {
  showLoadingSpinner();
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let cursorY = 40;

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
      }
    }

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

      if (cursorY + imgH > 780) {
        doc.addPage();
        cursorY = 40;
      }

      try {
        doc.addImage(imgData, 'PNG', 40, cursorY, imgW, imgH);
        cursorY += imgH + 10;
      } catch (err) {
        console.error('Erro ao adicionar imagem:', err);
        doc.text('Erro ao gerar imagem do gráfico', 40, cursorY);
        cursorY += 20;
      }

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
      if (
        !stats ||
        !stats.statsPorCategoria ||
        !Array.isArray(stats.statsPorCategoria)
      ) {
        updateLoadingSpinner(Math.round(((i + 1) / total) * 100));
        continue;
      }

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
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '10px';
    errorDiv.style.margin = '10px 0';
    errorDiv.style.border = '1px solid red';
    errorDiv.textContent = `Erro ao gerar relatório: ${error.message}. Tente novamente mais tarde.`;
    document.body.appendChild(errorDiv);

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
 * @param {Array<Object>} dadosOriginais – array completo de dados.
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

function calcularEstatisticasGrafico(dados, categoryField) {
  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return {
      anoRecente: null,
      anoAnterior: null,
      statsPorCategoria: [],
    };
  }

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


  const statsPorCategoria = categorias.map((cat) => {
    let totalRec = 0,
      totalAnt = 0;
    const variacaoMeses = [];
    const variacaoMensal = [];

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

      const vYA = ant ? ((rec - ant) / ant) * 100 : 0;
      variacaoMeses.push({ mes: nome, variacao: vYA });
    });

    const vAno = totalAnt ? ((totalRec - totalAnt) / totalAnt) * 100 : 0;

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
 * @param {HTMLElement} ctx - Contexto do canvas.
 * @param {string} eixoX - eixo X .
 * @param {string} eixoY -  eixo Y.
 * @param {string} raio - Campo do tamanho da bolha (agrupador ou numérico).
 * @param {Array} dadosOriginais - Dados de entrada.
 * @param {Array<string>} cores - Array de cores para as bolhas.
 * @param {string} aggregationType - "count" (padrão), "sum" ou "mean"
 * @param {string} valueField - Campo numérico a ser somado ou mediado (para sum/mean)
 */
export function criarGraficoBolha(
  ctx,
  eixoX,
  eixoY,
  raio,
  dadosOriginais,
  cores,
  aggregationType = 'count',
  valueField = null,
) {
  const dadosOriginaisCopy = [...dadosOriginais];
  let grafico;

  function agruparDados(dados) {
    const grupoMap = new Map();
    dados.forEach((item) => {
      const chave =
        String(item[eixoX]) +
        '|' +
        String(item[eixoY]) +
        '|' +
        String(item[raio]);
      const valNum =
        aggregationType === 'count'
          ? 1
          : parseFloat(valueField ? item[valueField] : item[raio]);
      if (!grupoMap.has(chave)) {
        grupoMap.set(chave, {
          x: item[eixoX],
          y: item[eixoY],
          r: item[raio],
          count: 0,
          sum: 0,
        });
      }
      const obj = grupoMap.get(chave);
      obj.count += 1;
      obj.sum += isNaN(valNum) ? 0 : valNum;
    });

    const result = [];
    for (const [_, v] of grupoMap) {
      result.push({
        x: isNaN(parseFloat(v.x)) ? v.x : parseFloat(v.x),
        y: isNaN(parseFloat(v.y)) ? v.y : parseFloat(v.y),
        r:
          aggregationType === 'count'
            ? v.count * 6 
            : aggregationType === 'sum'
            ? v.sum
            : v.count > 0
            ? v.sum / v.count
            : 0,
      });
    }
    return result;
  }

  function converterParaNumeros(array, campo) {
    const mapa = {};
    let idx = 1;
    array.forEach((item) => {
      if (!(item[campo] in mapa)) mapa[item[campo]] = idx++;
    });
    return (v) => mapa[v] || 0;
  }

  function renderizarBolhas() {
    const dadosFiltrados = getDadosAtuais(dadosOriginaisCopy);
    let dadosGrafico = agruparDados(dadosFiltrados);

    const xIsString = dadosGrafico.some((d) => isNaN(d.x));
    const yIsString = dadosGrafico.some((d) => isNaN(d.y));
    const rIsString = dadosGrafico.some((d) => isNaN(d.r));

    let xConverter, yConverter, rConverter;
    if (xIsString) xConverter = converterParaNumeros(dadosGrafico, 'x');
    if (yIsString) yConverter = converterParaNumeros(dadosGrafico, 'y');
    if (rIsString) rConverter = converterParaNumeros(dadosGrafico, 'r');

    dadosGrafico = dadosGrafico.map((d, i) => ({
      x: xIsString ? xConverter(d.x) : d.x,
      y: yIsString ? yConverter(d.y) : d.y,
      r: rIsString ? rConverter(d.r) : d.r,
      backgroundColor: cores[i % cores.length],
      label: `${d.x} | ${d.y} | ${d.r}`,
    }));

    if (grafico) {
      grafico.data.datasets[0].data = dadosGrafico;
      grafico.data.datasets[0].backgroundColor = dadosGrafico.map(
        (d) => d.backgroundColor,
      );
      grafico.update();
    } else {
      const config = {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: `Bolha (${eixoX}, ${eixoY}, ${raio}) [${aggregationType}]`,
              data: dadosGrafico,
              backgroundColor: dadosGrafico.map((d) => d.backgroundColor),
              parsing: false,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: {
              title: { display: true, text: eixoX },
              beginAtZero: true,
            },
            y: {
              title: { display: true, text: eixoY },
              beginAtZero: true,
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (context) {
                  const d = context.raw;
                  return (
                    `${eixoX}: ${d.x}, ` +
                    `${eixoY}: ${d.y}, ` +
                    `${raio}: ${d.r.toFixed(2)}`
                  );
                },
              },
            },
          },
        },
      };
      grafico = new Chart(ctx, config);
    }
  }

  renderizarBolhas();

  todosOsGraficos.push({
    grafico,
    renderizar: renderizarBolhas,
  });
}

/**
 * @param {HTMLCanvasElement} ctx - Contexto do canvas.
 * @param {string} eixoX -  eixo X (string ou número).
 * @param {string} eixoY -  eixo Y (números).
 * @param {Array<Object>} obj - Array de dados.
 * @param {string} titulo - Título do gráfico.
 */
export function criarGraficoMisto(ctx, eixoX, eixoY, obj, titulo = '') {
  const dadosOriginais = Array.isArray(obj) ? [...obj] : obj.slice();
  let grafico;

  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    const agrupado = {};

    dadosFiltrados.forEach((item) => {
      const label = item[eixoX];
      const valor = parseFloat(item[eixoY]);
      if (!label || isNaN(valor)) return;

      if (!agrupado[label]) {
        agrupado[label] = { soma: 0, count: 0 };
      }

      agrupado[label].soma += valor;
      agrupado[label].count += 1;
    });

    const labels = Object.keys(agrupado);
    const soma = labels.map((l) => agrupado[l].soma);
    const media = labels.map((l) => agrupado[l].soma / agrupado[l].count);

    if (grafico) {
      grafico.destroy();
    }

    grafico = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Soma de ' + eixoY,
            data: soma,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
          {
            type: 'line',
            label: 'Média de ' + eixoY,
            data: media,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 2,
            tension: 0.3,
            fill: false,
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
            // ADICIONE A CONFIGURAÇÃO, VICTOR!
          },
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  renderizar();

  todosOsGraficos.push({
    grafico,
    dadosOriginais,
    renderizar,
  });
}


/**
 *
 * @param {HTMLElement} chartContainer Elemento que receberá os gráficos gerados.
 */

export function criarIcone(chartContainer) {
  try {
    if (!(chartContainer instanceof HTMLElement)) {
      console.error('criarIcone: chartContainer inválido', chartContainer);
      alert('Você precisa passar um elemento válido como chartContainer.');
      return;
    }

    if (!document.getElementById('widget-global-styles')) {
      const style = document.createElement('style');
      style.id = 'widget-global-styles';
      style.textContent = `
        /* --- Botão flutuante --- */
        .widget-icon {
          position: fixed; width: 60px; height: 60px;
          bottom: 20px; right: 20px;
          background: #007bff; color: #fff;
          border: none; border-radius: 50%;
          font-weight: bold; font-size: 16px;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 10000;
        }
        /* --- Janela de configuração --- */
        .widget-window {
          position: fixed; width: 320px; padding: 10px;
          background: #fff; border: 1px solid #ccc; border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          z-index: 10000; transition: opacity 0.2s ease;
        }
        .widget-window.hidden { display: none; }

        /* --- Wrapper do gráfico --- */
        .chart-wrapper {
          position: absolute;
        }
        .chart-wrapper.selected {
          border: 2px dashed #007bff;
        }

        /* --- Handle de resize --- */
        .resize-handle {
          position: absolute;
          width: 12px; height: 12px;
          background: #007bff;
          bottom: 4px; right: 4px;
          cursor: se-resize;
          display: none;
        }
        .chart-wrapper.selected .resize-handle {
          display: block;
        }
      `;
      document.head.appendChild(style);
    }

    const widgetIcon = document.createElement('button');
    widgetIcon.id = 'floatingWidgetIcon';
    widgetIcon.className = 'widget-icon';
    widgetIcon.textContent = 'ITP';
    document.body.appendChild(widgetIcon);

    const widgetWindow = document.createElement('div');
    widgetWindow.id = 'floatingWidgetWindow';
    widgetWindow.className = 'widget-window hidden';
    document.body.appendChild(widgetWindow);

    let isDraggingIcon = false,
      iconOffsetX = 0,
      iconOffsetY = 0;
    widgetIcon.addEventListener('mousedown', (e) => {
      isDraggingIcon = true;
      const rect = widgetIcon.getBoundingClientRect();
      iconOffsetX = e.clientX - rect.left;
      iconOffsetY = e.clientY - rect.top;
      document.addEventListener('mousemove', onDragIcon);
      document.addEventListener(
        'mouseup',
        () => {
          isDraggingIcon = false;
          document.removeEventListener('mousemove', onDragIcon);
        },
        { once: true },
      );
    });
    function onDragIcon(e) {
      if (!isDraggingIcon) return;
      const x = Math.min(
        Math.max(e.clientX - iconOffsetX, 0),
        window.innerWidth - widgetIcon.offsetWidth,
      );
      const y = Math.min(
        Math.max(e.clientY - iconOffsetY, 0),
        window.innerHeight - widgetIcon.offsetHeight,
      );
      widgetIcon.style.left = `${x}px`;
      widgetIcon.style.top = `${y}px`;
    }

    widgetIcon.addEventListener('click', () => {
      widgetWindow.classList.toggle('hidden');
      if (!widgetWindow.classList.contains('hidden')) {
        const rect = widgetIcon.getBoundingClientRect();
        widgetWindow.style.top = `${rect.bottom + 5}px`;
        widgetWindow.style.left = `${rect.left}px`;
        renderWidgetContent();
      }
    });

    let latestData = null;

    function renderWidgetContent() {
      widgetWindow.innerHTML = `
        <div><label>Endpoint:</label><input id="widgetEndpoint" style="width:100%"/></div>
        <div><label>Arquivo JSON:</label><input id="widgetJsonFile" type="file" accept=".json"/></div>
        <button id="widgetFetchBtn">Requisição</button>
        <div id="widgetResponseProps"></div>
        <div id="widgetPropSelection" style="display:none; margin-top:8px;">
          <label>Propriedade:</label>
          <select id="widgetPropSelect"></select>
          <label>Tipo:</label>
          <select id="widgetChartType">
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="doughnut">Doughnut</option>
          </select>
          <button id="widgetCreateChartBtn">Criar Gráfico</button>
        </div>
        <button id="widgetClearCharts" style="background:#dc3545;color:#fff; margin-top:8px;">Limpar Gráficos</button>
      `;
      document.getElementById('widgetFetchBtn').onclick = handleFetch;
      document.getElementById('widgetJsonFile').onchange = handleFile;
      document.getElementById('widgetCreateChartBtn').onclick = () =>
        createChartForProp(document.getElementById('widgetPropSelect').value);
      document.getElementById('widgetClearCharts').onclick = () => {
        chartContainer.innerHTML = '';
      };
    }

    async function handleFetch() {
      const endpoint = document.getElementById('widgetEndpoint').value;
      if (!endpoint) return alert('Informe o endpoint');
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        processData(data);
      } catch (err) {
        alert('Erro na requisição: ' + err);
      }
    }
    function handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          processData(data);
        } catch {
          alert('JSON inválido');
        }
      };
      reader.readAsText(file);
    }

    function processData(data) {
      if (!Array.isArray(data) || data.length === 0)
        return alert('O JSON deve ser um array não vazio');
      latestData = data;
      const props = Object.keys(data[0]);
      document.getElementById(
        'widgetResponseProps',
      ).innerHTML = `<b>Propriedades:</b><ul>${props
        .map((p) => `<li>${p}</li>`)
        .join('')}</ul>`;
      const sel = document.getElementById('widgetPropSelect');
      sel.innerHTML = props
        .map((p) => `<option value="${p}">${p}</option>`)
        .join('');
      document.getElementById('widgetPropSelection').style.display = 'block';
    }

    async function loadChartJS() {
      if (window.Chart) return;
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src =
          'https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
        document.head.appendChild(script);
      });
    }

    async function createChartForProp(prop) {
      if (!latestData) return alert('Carregue os dados primeiro');
      await loadChartJS();
      const type = document.getElementById('widgetChartType').value;

      const wrapper = document.createElement('div');
      wrapper.className = 'chart-wrapper';
      wrapper.style.top = '100px';
      wrapper.style.left = '100px';
      wrapper.style.width = '400px';
      wrapper.style.height = '300px';

      const title = document.createElement('h3');
      title.textContent = `Gráfico: ${prop}`;
      title.style.margin = '0 0 8px';
      title.style.cursor = 'move';

      const canvas = document.createElement('canvas');
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';

      wrapper.append(title, canvas, resizeHandle);
      chartContainer.append(wrapper);

      wrapper.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        document
          .querySelectorAll('.chart-wrapper.selected')
          .forEach((w) => w.classList.remove('selected'));
        wrapper.classList.add('selected');
      });
      document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.chart-wrapper')) {
          document
            .querySelectorAll('.chart-wrapper.selected')
            .forEach((w) => w.classList.remove('selected'));
        }
      });

      let isDragging = false,
        dragX = 0,
        dragY = 0;
      title.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        const rect = wrapper.getBoundingClientRect();
        dragX = e.clientX - rect.left;
        dragY = e.clientY - rect.top;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener(
          'mouseup',
          () => {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
          },
          { once: true },
        );
      });
      function onDrag(e) {
        if (!isDragging) return;
        const parentRect = chartContainer.getBoundingClientRect();
        let x = e.clientX - parentRect.left - dragX;
        let y = e.clientY - parentRect.top - dragY;
        x = Math.max(0, Math.min(x, parentRect.width - wrapper.offsetWidth));
        y = Math.max(0, Math.min(y, parentRect.height - wrapper.offsetHeight));
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
      }

      let isResizing = false,
        startX,
        startY,
        startW,
        startH;
      let chartEntry, chartInstance;
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = wrapper.offsetWidth;
        startH = wrapper.offsetHeight;
        document.addEventListener('mousemove', onResize);
        document.addEventListener(
          'mouseup',
          () => {
            isResizing = false;
            document.removeEventListener('mousemove', onResize);
          },
          { once: true },
        );
      });
      function onResize(e) {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.style.width = Math.max(50, startW + dx) + 'px';
        wrapper.style.height = Math.max(50, startH + dy) + 'px';
        if (chartInstance && typeof chartInstance.resize === 'function') {
          chartInstance.resize();
        }
      }

      criarGrafico(
        canvas.getContext('2d'),
        type,
        prop,
        gerarCores([...new Set(latestData.map((d) => d[prop]))]),
        `Contagem de ${prop}`,
        latestData,
      );
      chartEntry = todosOsGraficos[todosOsGraficos.length - 1];
      chartInstance = chartEntry && chartEntry.grafico;

      widgetWindow.classList.add('hidden');
    }

    console.log('criarIcone: inicializado com sucesso');
  } catch (err) {
    console.error('criarIcone falhou:', err);
  }
}

function gerarCores(categorias) {
  return categorias.map(
    (_, i) =>
      `hsl(${(i * 360) / categorias.length}, 70%, 50%)`,
  );
}
