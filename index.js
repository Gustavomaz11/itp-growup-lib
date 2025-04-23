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

// --- bins globais para duração ---

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

// --- processamento de dados básico (contagem por valor ou mês) ---

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

// --- processamento de durações de atendimento em bins ---

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

// --- NOVAS MÉTRICAS PARA SÉRIE HISTÓRICA ---

// 1. Série temporal (dia ou mês)
function calcularSerieTemporal(dados, campoData, periodo = 'dia') {
  const mapa = new Map();
  dados.forEach((item) => {
    if (!item[campoData]) return;
    let chave;
    if (periodo === 'mes') {
      const m = item[campoData].slice(5, 7);
      chave = cacheMeses[m];
    } else {
      chave = item[campoData].slice(0, 10); // YYYY-MM-DD
    }
    mapa.set(chave, (mapa.get(chave) || 0) + 1);
  });
  let labels = Array.from(mapa.keys()).sort((a, b) => {
    if (periodo === 'mes') {
      return ordemMeses.indexOf(a) - ordemMeses.indexOf(b);
    }
    return new Date(a) - new Date(b);
  });
  const valores = labels.map((l) => mapa.get(l));
  return { labels, valores };
}

// 2. Taxa de crescimento percentual
function calcularTaxaCrescimento(serie) {
  const { labels, valores } = serie;
  const growth = valores.map((v, i) =>
    i === 0 ? 0 : ((v - valores[i - 1]) / valores[i - 1]) * 100,
  );
  return { labels, valores: growth };
}

// 3. Média móvel (janela deslizante)
function calcularMediaMovel(serie, windowSize = 7) {
  const { labels, valores } = serie;
  const movAvg = valores.map((_, i, arr) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = arr.slice(start, i + 1);
    return window.reduce((s, x) => s + x, 0) / window.length;
  });
  return { labels, valores: movAvg };
}

// 4. Cumulativo (soma acumulada)
function calcularCumulativo(serie) {
  const { labels, valores } = serie;
  const cumul = valores.reduce((acc, v, i) => {
    acc.push((acc[i - 1] || 0) + v);
    return acc;
  }, []);
  return { labels, valores: cumul };
}

// --- criação e atualização de gráficos ---

/**
 * @param ctx                  contexto do canvas
 * @param tipoInicial          'bar'|'line'|'pie'|...
 * @param parametro_busca      campo de início (data ou outro)
 * @param backgroundColor      array de cores
 * @param chave                rótulo do dataset
 * @param obj                  array de objetos com dados
 * @param callback             função({ total, variacaoTexto })
 * @param porDuracao           true=contagem normal / false=histograma de duração
 * @param parametro_busca_fim  campo de fim se porDuracao=false
 * @param metricType           'normal'|'growth'|'movingAverage'|'cumulative'
 * @param metricOptions        { periodo: 'dia'|'mes', windowSize: número }
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
  metricType = 'normal',
  metricOptions = {},
) {
  const dadosOriginais = [...obj];
  let tipoAtual = tipoInicial;
  let grafico;

  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let serie;

    if (porDuracao === false) {
      if (!parametro_busca_fim) {
        throw new Error(
          'parametro_busca_fim obrigatório quando porDuracao=false',
        );
      }
      serie = processarDuracaoAtendimentos(
        dadosFiltrados,
        parametro_busca,
        parametro_busca_fim,
      );
    } else {
      // série bruta por dia ou mês
      serie = calcularSerieTemporal(
        dadosFiltrados,
        parametro_busca,
        metricOptions.periodo || 'dia',
      );
    }

    // aplica métrica derivada
    switch (metricType) {
      case 'growth':
        serie = calcularTaxaCrescimento(serie);
        break;
      case 'movingAverage':
        serie = calcularMediaMovel(serie, metricOptions.windowSize || 7);
        break;
      case 'cumulative':
        serie = calcularCumulativo(serie);
        break;
      // 'normal': mantém série bruta
    }

    const { labels, valores } = serie;
    const labelDataset = metricType === 'growth' ? `${chave} (%)` : chave;

    const config = {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: labelDataset,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
        },
        scales:
          tipoAtual === 'bar' || tipoAtual === 'line'
            ? {
                x: { beginAtZero: true },
                y: { beginAtZero: metricType === 'growth' ? false : true },
              }
            : undefined,
      },
    };

    if (grafico) {
      grafico.destroy();
      todosOsGraficos = todosOsGraficos.filter((g) => g.grafico !== grafico);
    }

    grafico = new Chart(ctx, config);
    calcularTotal(dadosOriginais, (total) => {
      const variacaoTexto =
        metricType === 'growth'
          ? `${valores[valores.length - 1].toFixed(1)}%`
          : null;
      if (callback) callback({ total, variacaoTexto });
    });

    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
      metricType,
      metricOptions,
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
      metricType,
      metricOptions,
    } = entry;
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let serie;
    if (porDuracao === false) {
      serie = processarDuracaoAtendimentos(
        dadosFiltrados,
        parametro_busca,
        parametro_busca_fim,
      );
    } else {
      serie = calcularSerieTemporal(
        dadosFiltrados,
        parametro_busca,
        metricOptions.periodo || 'dia',
      );
      switch (metricType) {
        case 'growth':
          serie = calcularTaxaCrescimento(serie);
          break;
        case 'movingAverage':
          serie = calcularMediaMovel(serie, metricOptions.windowSize || 7);
          break;
        case 'cumulative':
          serie = calcularCumulativo(serie);
          break;
      }
    }
    grafico.data.labels = serie.labels;
    grafico.data.datasets[0].data = serie.valores;
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
