import Chart from 'chart.js/auto';

// --- UTILIDADES ---
// Debounce para scroll
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- VARIÁVEIS GLOBAIS ---
var filtrosAtuais = {}; // Objeto para armazenar filtros
var todosOsGraficos = []; // Lista de gráficos

// Meses
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

// --- FILTRAGEM COMUM ---
function getDadosAtuais(dadosOriginais) {
  return dadosOriginais.filter(
    (item) =>
      !Object.entries(filtrosAtuais).some(([param, vals]) => {
        if (!item.hasOwnProperty(param)) return false; // ignora filtros não-mapeados
        let v = item[param];
        if (/^\d{4}-\d{2}-\d{2} /.test(v)) v = cacheMeses[v.slice(5, 7)];
        return !vals.includes(v);
      }),
  );
}

// --- PROCESSAMENTO DE DADOS ---
function processarDados(dados, campo) {
  const counts = new Map();
  dados.forEach((item) => {
    let k = item[campo];
    if (!k) return;
    if (/^\d{4}-\d{2}-\d{2} /.test(k)) k = cacheMeses[k.slice(5, 7)];
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  return { labels: [...counts.keys()], valores: [...counts.values()] };
}

function binsGlobais() {
  return [
    { label: '< 30 min', min: 0, max: 30 },
    { label: '30–45 min', min: 30, max: 45 },
    { label: '45–60 min', min: 45, max: 60 },
    { label: '> 60 min', min: 60, max: Infinity },
  ];
}
function processarDuracao(dados, iniKey, fimKey) {
  const bins = binsGlobais(),
    cont = bins.map((_) => 0);
  dados.forEach((item) => {
    const i = Date.parse(item[iniKey]),
      f = Date.parse(item[fimKey]);
    if (isNaN(i) || isNaN(f) || f < i) return;
    const d = (f - i) / 60000;
    bins.forEach((b, j) => {
      if (d >= b.min && d < b.max) cont[j]++;
    });
  });
  const durKey = `${iniKey}|${fimKey}_duracao`;
  const filtro = filtrosAtuais[durKey];
  const labels = [],
    valores = [];
  bins.forEach((b, i) => {
    if (cont[i] > 0 && (!filtro || filtro.includes(b.label))) {
      labels.push(b.label);
      valores.push(cont[i]);
    }
  });
  return { labels, valores };
}

// --- GRÁFICOS ---
export function criarGrafico(
  ctx,
  tipoInit,
  campo,
  cores,
  label,
  dados,
  cb,
  porDuracao = true,
  fimCampo = null,
) {
  const orig = [...dados];
  let tipo = tipoInit;
  let chart;
  function render() {
    const df = getDadosAtuais(orig);
    const res = porDuracao
      ? processarDados(df, campo)
      : processarDuracao(df, campo, fimCampo);
    const cfg = {
      type: tipo,
      data: {
        labels: res.labels,
        datasets: [
          {
            label,
            data: res.valores,
            backgroundColor: cores.slice(0, res.labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            onClick: (_, item) => {
              const v = chart.data.labels[item.index];
              const param = porDuracao ? campo : `${campo}|${fimCampo}_duracao`;
              toggleFiltro(param, v);
              aplicarFiltrosTabela();
              atualizarTodosOsGraficos();
            },
          },
        },
        scales:
          tipo === 'bar' || tipo === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : {},
      },
    };
    if (chart) {
      chart.destroy();
      todosOsGraficos = todosOsGraficos.filter((e) => e.chart !== chart);
    }
    chart = new Chart(ctx, cfg);
    cb && cb(getDadosAtuais(orig).length);
    todosOsGraficos.push({ chart, orig, campo, porDuracao, fimCampo });
  }
  render();
  // seletor tipo
  const sel = document.createElement('select');
  ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.text = t;
    if (t === tipo) o.selected = true;
    sel.append(o);
  });
  sel.onchange = () => {
    tipo = sel.value;
    render();
  };
  ctx.canvas.parentNode.insertBefore(sel, ctx.canvas.nextSibling);
}
function toggleFiltro(param, valor) {
  if (!filtrosAtuais[param]) filtrosAtuais[param] = [];
  const i = filtrosAtuais[param].indexOf(valor);
  if (i === -1) filtrosAtuais[param].push(valor);
  else {
    filtrosAtuais[param].splice(i, 1);
    if (!filtrosAtuais[param].length) delete filtrosAtuais[param];
  }
}
function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach((e) => {
    const df = getDadosAtuais(e.orig);
    const res = e.porDuracao
      ? processarDados(df, e.campo)
      : processarDuracao(df, e.campo, e.fimCampo);
    e.chart.data.labels = res.labels;
    e.chart.data.datasets[0].data = res.valores;
    e.chart.update();
  });
}

export function adicionarFiltrosDeMeses(dados, campo) {
  ordemMeses.forEach((m) => {
    const b = document.createElement('button');
    b.innerText = m;
    b.onclick = () => {
      toggleFiltro(campo, m);
      aplicarFiltrosTabela();
      atualizarTodosOsGraficos();
    };
    document.body.append(b);
  });
}

// --- DATATABLE ---
const CONFIG_TABLE = {
  itemsPerPage: 50,
  maxPages: 5,
  virtualRowHeight: 35,
  debounceTime: 100,
};
let dtOrig = [];
let dtFilt = [];
let dtCols = [];
let dtCont = {};
export async function criarDataTable(sel, dados, cols = []) {
  dtOrig = dados;
  dtFilt = [...dados];
  dtCols = cols;
  dtCont = configurarTabela(sel);
  adicionarEstilos();
  await processarChunks(dtFilt);
  dtCont.content.addEventListener(
    'scroll',
    debounce(renderVisiveis, CONFIG_TABLE.debounceTime),
  );
  renderVisiveis();
  atualizarPag();
  updInfo();
}
function configurarTabela(sel) {
  const c = document.querySelector(sel);
  c.innerHTML = '';
  const info = document.createElement('div');
  const hdrDiv = document.createElement('div');
  const tblH = document.createElement('table');
  const th = document.createElement('thead');
  const row = document.createElement('tr');
  dtCols.forEach((col) => {
    const h = document.createElement('th');
    h.textContent = col;
    row.append(h);
  });
  th.append(row);
  tblH.append(th);
  hdrDiv.append(tblH);
  const content = document.createElement('div');
  content.className = 'table-content';
  const vh = document.createElement('div');
  vh.className = 'virtual-height';
  const tbl = document.createElement('table');
  const body = document.createElement('tbody');
  tbl.append(body);
  content.append(vh, tbl);
  const pag = document.createElement('div');
  pag.className = 'pagination';
  c.append(info, hdrDiv, content, pag);
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('cel-click')) {
      const col = e.target.dataset.col,
        colv = e.target.dataset.val;
      toggleFiltro(col, colv);
      aplicarFiltrosTabela();
      atualizarTodosOsGraficos();
      renderVisiveis();
      updInfo();
    }
  });
  return { info, header: hdrDiv, content, virtual: vh, body, pag };
}
function processarChunks(dados) {
  return new Promise((r) => {
    const step = CONFIG_TABLE.virtualRowHeight;
    r();
  });
}
function renderVisiveis() {
  const { content, virtual, body } = dtCont;
  const h = content.scrollTop;
  const vview = content.clientHeight;
  const start = Math.floor(h / CONFIG_TABLE.virtualRowHeight);
  const count = Math.ceil(vview / CONFIG_TABLE.virtualRowHeight) + 5;
  const end = Math.min(start + count, dtFilt.length);
  virtual.style.height = `${dtFilt.length * CONFIG_TABLE.virtualRowHeight}px`;
  body.innerHTML = '';
  for (let i = start; i < end; i++) {
    const tr = document.createElement('tr');
    tr.style.position = 'absolute';
    tr.style.top = `${i * CONFIG_TABLE.virtualRowHeight}px`;
    dtCols.forEach((c) => {
      const td = document.createElement('td');
      td.textContent = dtFilt[i][c];
      td.className = 'cel-click';
      td.dataset.col = c;
      td.dataset.val = dtFilt[i][c];
      tr.append(td);
    });
    body.append(tr);
  }
}
function aplicarFiltrosTabela() {
  const keys = Object.keys(filtrosAtuais).filter((k) => dtCols.includes(k));
  dtFilt = keys.length
    ? dtOrig.filter((item) =>
        keys.every((k) => filtrosAtuais[k].includes(item[k])),
      )
    : [...dtOrig];
}
function atualizarPag() {
  /* implementação de paginação opcional */
}
function updInfo() {
  dtCont.info.textContent =
    dtFilt.length === dtOrig.length
      ? `Total: ${dtOrig.length}`
      : `Mostrando ${dtFilt.length} de ${dtOrig.length}`;
}
function adicionarEstilos() {
  if (document.getElementById('dt-style')) return;
  const s = document.createElement('style');
  s.id = 'dt-style';
  s.textContent = `.table-content{position:relative;overflow-y:auto;height:300px}`;
  document.head.append(s);
}
