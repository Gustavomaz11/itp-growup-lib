import Chart from 'chart.js/auto';

// ————————————— Variáveis globais —————————————
var filtrosAtuais = {}; // filtros “normais” (mês, prioridade, nota…)
var filtrosDuracao = []; // filtros de duração (bins)
var todosOsGraficos = []; // instâncias para cross-filter
var parametroGlobalDuracaoInicio = null;
var parametroGlobalDuracaoFim = null;

// Cache para nomes de meses
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

// ————————————— Bins de duração e helpers —————————————
function obterBin(diff) {
  const MS = 1000,
    MIN = 60 * MS,
    H = 60 * MIN,
    D = 24 * H;

  const bins = [
    { label: '< 15 minutos', test: (d) => d < 15 * MIN },
    { label: '15–30 minutos', test: (d) => d >= 15 * MIN && d < 30 * MIN },
    { label: '30–45 minutos', test: (d) => d >= 30 * MIN && d < 45 * MIN },
    { label: '45–60 minutos', test: (d) => d >= 45 * MIN && d < 60 * MIN },
    { label: '1–2 horas', test: (d) => d >= 1 * H && d < 2 * H },
    { label: '2–4 horas', test: (d) => d >= 2 * H && d < 4 * H },
    { label: '4–8 horas', test: (d) => d >= 4 * H && d < 8 * H },
    { label: '8–12 horas', test: (d) => d >= 8 * H && d < 12 * H },
    { label: '12–24 horas', test: (d) => d >= 12 * H && d < 24 * H },
    { label: '1–2 dias', test: (d) => d >= 1 * D && d < 2 * D },
    { label: '2–3 dias', test: (d) => d >= 2 * D && d < 3 * D },
    { label: '3–5 dias', test: (d) => d >= 3 * D && d < 5 * D },
    { label: '5–7 dias', test: (d) => d >= 5 * D && d < 7 * D },
    { label: '> 7 dias', test: (d) => d >= 7 * D },
  ];

  for (let bin of bins) {
    if (bin.test(diff)) return bin.label;
  }
  return null;
}

function processarDuracoes(dados, parametroInicio, parametroFim) {
  // conta quantos itens caem em cada bin
  const labels = [];
  const counters = {};
  // inicializa
  obterBin(0) && (() => {})(); // só pra garantir que bins existem
  dados.forEach((item) => {
    const t0 = Date.parse(item[parametroInicio]);
    const t1 = Date.parse(item[parametroFim]);
    if (isNaN(t0) || isNaN(t1)) return;
    const bin = obterBin(t1 - t0);
    if (bin) counters[bin] = (counters[bin] || 0) + 1;
  });
  // monta arrays ordenados conforme definição de bins
  [
    '< 15 minutos',
    '15–30 minutos',
    '30–45 minutos',
    '45–60 minutos',
    '1–2 horas',
    '2–4 horas',
    '4–8 horas',
    '8–12 horas',
    '12–24 horas',
    '1–2 dias',
    '2–3 dias',
    '3–5 dias',
    '5–7 dias',
    '> 7 dias',
  ].forEach((lbl) => {
    labels.push(lbl);
  });
  return {
    labels,
    valores: labels.map((l) => counters[l] || 0),
  };
}

// ————————————— Processamento “normal” por parâmetro —————————————
function processarDados(dados, parametro_busca) {
  const isDateTime = (v) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v);
  const mapCount = new Map();

  dados.forEach((item) => {
    let chave = item[parametro_busca];
    if (!chave) return;
    if (isDateTime(chave)) {
      const mes = chave.slice(5, 7);
      chave = cacheMeses[mes];
    }
    mapCount.set(chave, (mapCount.get(chave) || 0) + 1);
  });

  // ordena meses corretamente
  const ordemMeses = Object.entries(cacheMeses).reduce(
    (acc, [num, nome]) => ((acc[nome] = +num), acc),
    {},
  );
  const labels = Array.from(mapCount.keys()).sort(
    (a, b) => (ordemMeses[a] || 0) - (ordemMeses[b] || 0),
  );
  return {
    labels,
    valores: labels.map((l) => mapCount.get(l)),
  };
}

// ————————————— Filtro global unificado —————————————
function getDadosAtuais(dadosOriginais) {
  let filtrados = dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([param, vals]) => {
      let v = item[param];
      if (param.includes('data') && typeof v === 'string') {
        const mes = v.slice(5, 7);
        v = cacheMeses[mes];
      }
      return vals.includes(v);
    }),
  );
  // aplica filtros de duração
  if (filtrosDuracao.length) {
    filtrados = filtrados.filter((item) => {
      const t0 = Date.parse(item[parametroGlobalDuracaoInicio]);
      const t1 = Date.parse(item[parametroGlobalDuracaoFim]);
      if (isNaN(t0) || isNaN(t1)) return false;
      const bin = obterBin(t1 - t0);
      return filtrosDuracao.includes(bin);
    });
  }
  return filtrados;
}

// ————————————— Funções de toggle —————————————
function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];
  const idx = filtrosAtuais[parametro].indexOf(valor);
  if (idx === -1) filtrosAtuais[parametro].push(valor);
  else filtrosAtuais[parametro].splice(idx, 1);
  if (!filtrosAtuais[parametro].length) delete filtrosAtuais[parametro];
  atualizarTodosOsGraficos();
}

function toggleFiltroDuracao(labelBin) {
  const idx = filtrosDuracao.indexOf(labelBin);
  if (idx === -1) filtrosDuracao.push(labelBin);
  else filtrosDuracao.splice(idx, 1);
  atualizarTodosOsGraficos();
}

// ————————————— Cross-filtering —————————————
function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach((item) => {
    const {
      grafico,
      dadosOriginais,
      parametroBuscaInicio,
      usarDuracao,
      parametroBuscaFim,
    } = item;
    const base = getDadosAtuais(dadosOriginais);
    const resultado = usarDuracao
      ? processarDados(base, parametroBuscaInicio)
      : processarDuracoes(base, parametroBuscaInicio, parametroBuscaFim);

    grafico.data.labels = resultado.labels;
    grafico.data.datasets[0].data = resultado.valores;
    grafico.update();
  });
}

// ————————————— Função principal: criarGrafico —————————————
export function criarGrafico(
  ctx,
  tipoInicial,
  parametroBuscaInicio,
  usarDuracao = true,
  parametroBuscaFim = null,
  backgroundColor,
  labelDataset,
  obj,
  callback,
) {
  if (!usarDuracao && !parametroBuscaFim) {
    throw new Error(
      'parametroBuscaFim é obrigatório quando usarDuracao for false',
    );
  }

  // se for gráfico de duração, define globais
  if (!usarDuracao) {
    parametroGlobalDuracaoInicio = parametroBuscaInicio;
    parametroGlobalDuracaoFim = parametroBuscaFim;
  }

  let tipoAtual = tipoInicial;
  let grafico = null;
  const dadosOriginais = [...obj];

  function renderizarGrafico() {
    const base = getDadosAtuais(dadosOriginais);
    const { labels, valores } = usarDuracao
      ? processarDados(base, parametroBuscaInicio)
      : processarDuracoes(base, parametroBuscaInicio, parametroBuscaFim);

    const config = {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: usarDuracao ? labelDataset : 'Duração',
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        onClick: (evt) => {
          const elems = grafico.getElementsAtEventForMode(
            evt,
            'nearest',
            { intersect: true },
            true,
          );
          if (elems.length) {
            const idx = elems[0].index;
            const label = grafico.data.labels[idx];
            if (usarDuracao) toggleFiltroDuracao(label);
            else toggleFiltro(dadosOriginais, parametroBuscaInicio, label);
          }
        },
        plugins: {
          legend: {
            display: true,
            onClick: (_, legendItem) => {
              const label = grafico.data.labels[legendItem.index];
              if (usarDuracao) toggleFiltroDuracao(label);
              else toggleFiltro(dadosOriginais, parametroBuscaInicio, label);
            },
          },
        },
        scales:
          tipoAtual === 'bar' || tipoAtual === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : undefined,
      },
    };

    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, config);

    if (callback) callback({ total: labels.length, variacaoTexto: null });
  }

  renderizarGrafico();

  // guarda para cross-filter
  todosOsGraficos.push({
    grafico,
    dadosOriginais,
    parametroBuscaInicio,
    usarDuracao,
    parametroBuscaFim,
  });

  // select para trocar tipo de gráfico
  const tiposDisponiveis = [
    'bar',
    'line',
    'pie',
    'doughnut',
    'radar',
    'polarArea',
  ];
  const select = document.createElement('select');
  select.style.margin = '8px';
  tiposDisponiveis.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.text = t[0].toUpperCase() + t.slice(1);
    if (t === tipoAtual) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    tipoAtual = select.value;
    renderizarGrafico();
  });
  ctx.canvas.parentNode.insertBefore(select, ctx.canvas.nextSibling);
}

// ————————————— Filtros de meses (UI) —————————————
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  Object.values(cacheMeses).forEach((mes) => {
    const btn = document.createElement('button');
    btn.innerText = mes;
    btn.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
    };
    document.body.appendChild(btn);
  });
}
