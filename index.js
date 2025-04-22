import Chart from 'chart.js/auto';

// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar os filtros ativos
var todosOsGraficos = []; // Lista de gráficos
var periodoComparacao = 'month'; // 'day' | 'week' | 'month' | 'year'

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

// --- 1. Select de período de comparação ---
export function adicionarSelectComparacao() {
  const container = document.createElement('div');
  container.style.margin = '16px 0';
  const label = document.createElement('label');
  label.innerText = 'Comparar com: ';
  const select = document.createElement('select');
  ['day', 'week', 'month', 'year'].forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.text = { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano' }[p];
    if (p === periodoComparacao) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => {
    periodoComparacao = select.value;
    // ao mudar o período, re-renderiza todos
    todosOsGraficos.forEach(({ grafico, render }) => {
      grafico.destroy();
      render();
    });
  };
  label.appendChild(select);
  container.appendChild(label);
  document.body.insertBefore(container, document.body.firstChild);
}

// --- 2. Intervalos de data ---
function getInterval(period, offset = 0) {
  const now = new Date();
  let start, end;
  switch (period) {
    case 'day': {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
      );
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + 1,
      );
      break;
    }
    case 'week': {
      const dow = now.getDay() || 7; // Domingo = 7
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dow + 1 + offset * 7,
      );
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + 7,
      );
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
      break;
    }
    case 'year': {
      start = new Date(now.getFullYear() + offset, 0, 1);
      end = new Date(now.getFullYear() + offset + 1, 0, 1);
      break;
    }
  }
  return { start, end };
}

// --- 3. Cálculo de comparação ---
function calcularComparacao(dados, campoData) {
  const { start: currStart, end: currEnd } = getInterval(periodoComparacao, 0);
  const { start: prevStart, end: prevEnd } = getInterval(periodoComparacao, -1);
  const parseDate = (item) => new Date(item[campoData]);
  const inInterval = (d, [s, e]) => d >= s && d < e;

  const currentCount = dados.filter((i) =>
    inInterval(parseDate(i), [currStart, currEnd]),
  ).length;
  const previousCount = dados.filter((i) =>
    inInterval(parseDate(i), [prevStart, prevEnd]),
  ).length;
  const percent =
    previousCount === 0
      ? currentCount === 0
        ? 0
        : 100
      : ((currentCount - previousCount) / previousCount) * 100;

  return { current: currentCount, previous: previousCount, percent };
}

// --- 4. Filtragem e total ---
function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) return dadosOriginais;
  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([param, vals]) => {
      let val = item[param];
      if (param.includes('data')) {
        const m = val?.slice(5, 7);
        return vals.includes(cacheMeses[m]);
      }
      return vals.includes(val);
    }),
  );
}

function processarDados(dados, parametro_busca) {
  const isData = (v) => /^\d{4}-\d{2}-\d{2}/.test(v);
  const cont = new Map();
  dados.forEach((item) => {
    let chave = item[parametro_busca];
    if (!chave) return;
    if (isData(chave)) {
      const m = chave.slice(5, 7);
      chave = cacheMeses[m];
    }
    cont.set(chave, (cont.get(chave) || 0) + 1);
  });
  return {
    labels: Array.from(cont.keys()),
    valores: Array.from(cont.values()),
  };
}

// --- 5. Criação de gráfico estendido ---
export function criarGrafico(
  ctx,
  tipoInicial,
  parametro_busca,
  backgroundColor,
  chaveLabel,
  obj,
  callback, // função(total, stats)
) {
  const dadosOriginais = [...obj];
  let tipoAtual = tipoInicial;
  let grafico, estatDiv;

  function renderizarGrafico() {
    const dadosFiltrados = getDadosAtuais(dadosOriginais);
    const { labels, valores } = processarDados(dadosFiltrados, parametro_busca);

    const config = {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: chaveLabel,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            onClick: (_, legendItem) => {
              const valor = grafico.data.labels[legendItem.index];
              toggleFiltro(parametro_busca, valor);
              todosOsGraficos.forEach(({ grafico, render }) => {
                grafico.destroy();
                render();
              });
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

    // calcula total e stats
    const total = valores.reduce((a, b) => a + b, 0);
    const stats = calcularComparacao(dadosFiltrados, 'data_solicitacao');
    if (callback) callback(total, stats);

    // exibe variação
    if (!estatDiv) {
      estatDiv = document.createElement('div');
      estatDiv.style.margin = '4px 0 12px';
      ctx.canvas.parentNode.insertBefore(estatDiv, ctx.canvas.nextSibling);
    }
    estatDiv.innerText =
      `${stats.current} itens  ` +
      `(${stats.percent >= 0 ? '+' : ''}${stats.percent.toFixed(
        1,
      )}% vs. ${periodoComparacao} anterior)`;

    // armazena para re-render
    const idx = todosOsGraficos.findIndex((o) => o.grafico === grafico);
    if (idx === -1)
      todosOsGraficos.push({ grafico, render: renderizarGrafico });
    else todosOsGraficos[idx] = { grafico, render: renderizarGrafico };
  }

  renderizarGrafico();

  // select de tipo
  const container = document.createElement('div');
  container.style.margin = '8px 0';
  const sel = document.createElement('select');
  ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.text = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === tipoAtual) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    tipoAtual = sel.value;
    renderizarGrafico();
  };
  container.appendChild(sel);
  ctx.canvas.parentNode.insertBefore(container, ctx.canvas.nextSibling);
}

// --- 6. Filtros ---
function toggleFiltro(param, valor) {
  if (!filtrosAtuais[param]) filtrosAtuais[param] = [];
  const idx = filtrosAtuais[param].indexOf(valor);
  if (idx === -1) filtrosAtuais[param].push(valor);
  else filtrosAtuais[param].splice(idx, 1);
  if (filtrosAtuais[param].length === 0) delete filtrosAtuais[param];
}

// --- 7. Botões de filtro de mês ---
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  const container = document.createElement('div');
  container.style.margin = '12px 0';
  Object.values(cacheMeses).forEach((m) => {
    const btn = document.createElement('button');
    btn.innerText = m;
    btn.style.margin = '2px';
    btn.onclick = () => {
      toggleFiltro(parametro, m);
      todosOsGraficos.forEach(({ grafico, render }) => {
        grafico.destroy();
        render();
      });
    };
    container.appendChild(btn);
  });
  document.body.appendChild(container);
}
