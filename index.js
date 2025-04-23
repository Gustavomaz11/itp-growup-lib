import Chart from 'chart.js/auto';

// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar os filtros ativos
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

// --- processamento de durações de atendimento em bins ---

function processarDuracaoAtendimentos(dados, campoInicio, campoFim) {
  const bins = [
    { label: '< 30 minutos', min: 0, max: 30 },
    { label: '> 30m < 45m', min: 30, max: 45 },
    { label: '> 45m < 60m', min: 45, max: 60 },
    { label: '> 1h < 24h', min: 60, max: 1440 },
    { label: '> 24h < 48h', min: 1440, max: 2880 },
    { label: '> 48h < 72h', min: 2880, max: 4320 },
    { label: '> 72 horas', min: 4320, max: Infinity },
  ];
  const contagem = bins.map(() => 0);

  dados.forEach((item) => {
    const ini = item[campoInicio];
    const fim = item[campoFim];
    if (!ini || !fim) return;
    const t1 = Date.parse(ini),
      t2 = Date.parse(fim);
    if (isNaN(t1) || isNaN(t2) || t2 < t1) return;
    const diffMin = (t2 - t1) / 60000;
    for (let i = 0; i < bins.length; i++) {
      if (diffMin >= bins[i].min && diffMin < bins[i].max) {
        contagem[i]++;
        break;
      }
    }
  });

  const labels = bins.map((b) => b.label);
  const valores = contagem;
  return { labels, valores };
}

// --- comparação entre períodos ---

function obterPeriodoAnterior(rotuloAtual) {
  const idx = ordemMeses.indexOf(rotuloAtual);
  if (idx !== -1) {
    return ordemMeses[(idx + ordemMeses.length - 1) % ordemMeses.length];
  }
  if (/^\d{4}$/.test(rotuloAtual)) {
    return String(Number(rotuloAtual) - 1);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(rotuloAtual)) {
    const d = new Date(rotuloAtual);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function formatarVariacao(p) {
  if (p == null) return '—';
  if (p > 0) return `${p.toFixed(1)}% a mais`;
  if (p < 0) return `${Math.abs(p).toFixed(1)}% a menos`;
  return '0% (sem variação)';
}

function calcularComparacao(dadosOriginais, parametro_busca, valorAtual) {
  const backup = { ...filtrosAtuais };

  filtrosAtuais[parametro_busca] = [valorAtual];
  const totalAtual = getDadosAtuais(dadosOriginais).length;

  const ante = obterPeriodoAnterior(valorAtual);
  let totalAnterior = null;
  if (ante) {
    filtrosAtuais[parametro_busca] = [ante];
    totalAnterior = getDadosAtuais(dadosOriginais).length;
  }

  filtrosAtuais = backup;

  let perc = null;
  if (totalAnterior > 0) {
    perc = ((totalAtual - totalAnterior) / totalAnterior) * 100;
  }
  return { total: totalAtual, variacaoTexto: formatarVariacao(perc) };
}

// --- criação e atualização de gráficos ---

/**
 * @param ctx                 contexto do canvas
 * @param tipoInicial         'bar'|'pie'|...
 * @param parametro_busca     campo de início (data ou outro)
 * @param backgroundColor     array de cores
 * @param chave               rótulo do dataset
 * @param obj                 array de objetos com dados
 * @param callback            função({ total, variacaoTexto })
 * @param porDuracao          true=normal / false=histograma de duração
 * @param parametro_busca_fim campo de fim se porDuracao=false
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
  const dadosOriginais = [...obj];
  let tipoAtual = tipoInicial;
  let grafico;

  function renderizar() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    let labels, valores;

    if (porDuracao === false) {
      if (!parametro_busca_fim) {
        throw new Error(
          'Quando porDuracao=false, é obrigatório informar parametro_busca_fim',
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
              toggleFiltro(dadosOriginais, parametro_busca, val);
              atualizarTodosOsGraficos();
              if (parametro_busca.includes('data')) {
                const cmp = calcularComparacao(
                  dadosOriginais,
                  parametro_busca,
                  val,
                );
                if (callback) callback(cmp);
              } else {
                calcularTotal(dadosOriginais, (total) => {
                  if (callback) callback({ total, variacaoTexto: null });
                });
              }
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

    // armazenamos também porDuracao e parametro_busca_fim
    todosOsGraficos.push({
      grafico,
      dadosOriginais,
      parametro_busca,
      porDuracao,
      parametro_busca_fim,
    });
  }

  renderizar();

  // seletor de tipo de gráfico
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

// --- filtros de mês na interface ---

export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  ordemMeses.forEach((mes) => {
    const btn = document.createElement('button');
    btn.innerText = mes;
    btn.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
      calcularTotal(dadosOriginais, (total) =>
        console.log(`Total após filtro: ${total}`),
      );
    };
    document.body.appendChild(btn);
  });
}
