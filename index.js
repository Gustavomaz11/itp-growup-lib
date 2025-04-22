import Chart from 'chart.js/auto';

// Regex pré-compilada para detectar data-hora YYYY-MM-DD HH:MM:SS
const DATA_HORA_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// Cache de nomes dos meses
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

// Estado global
let filtrosAtuais = {};
const todosOsGraficos = [];

// Detecta se um valor segue o formato data-hora
function isData(valor) {
  return DATA_HORA_REGEX.test(valor);
}

// Aplica filtros e retorna array filtrado
function getDadosAtuais(dadosOriginais) {
  if (!Object.keys(filtrosAtuais).length) return dadosOriginais;
  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([param, vals]) => {
      let v = item[param];
      if (param.includes('data') && isData(v)) {
        v = cacheMeses[v.slice(5, 7)];
      }
      return vals.includes(v);
    }),
  );
}

// Conta total de itens filtrados (mantido para compatibilidade)
function calcularTotal(dadosOriginais, callback) {
  const total = getDadosAtuais(dadosOriginais).length;
  if (typeof callback === 'function') callback(total);
  return total;
}

// Agrupa e conta ocorrências por parâmetro (ou mês)
function processarDados(dados, parametro) {
  const contagem = new Map();
  for (const item of dados) {
    let chave = item[parametro];
    if (chave && isData(chave)) {
      chave = cacheMeses[chave.slice(5, 7)];
    }
    if (chave != null) {
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
  }
  return {
    labels: [...contagem.keys()],
    valores: [...contagem.values()],
  };
}

// Função que calcula estatísticas básicas de um array de números
function calcularEstatisticas(valores) {
  const n = valores.length;
  if (n === 0) {
    return {
      total: 0,
      media: 0,
      mediana: 0,
      moda: null,
      variancia: 0,
      desvioPadrao: 0,
    };
  }
  const total = valores.reduce((s, v) => s + v, 0);
  const media = total / n;
  const sorted = [...valores].sort((a, b) => a - b);
  const mediana =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const freq = sorted.reduce((f, v) => {
    f[v] = (f[v] || 0) + 1;
    return f;
  }, {});
  let moda = null,
    maxF = 0;
  for (const [v, f] of Object.entries(freq)) {
    if (f > maxF) {
      maxF = f;
      moda = Number(v);
    }
  }
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / n;
  const desvioPadrao = Math.sqrt(variancia);

  return { total, media, mediana, moda, variancia, desvioPadrao };
}

// Expor função para obter estatísticas diretamente
export function obterEstatisticas(dadosOriginais, parametro) {
  const dados = getDadosAtuais(dadosOriginais);
  const { valores } = processarDados(dados, parametro);
  return calcularEstatisticas(valores);
}

// Toggle de filtro
function toggleFiltro(dadosOriginais, parametro, valor) {
  const arr = filtrosAtuais[parametro] || (filtrosAtuais[parametro] = []);
  const idx = arr.indexOf(valor);
  if (idx === -1) arr.push(valor);
  else {
    arr.splice(idx, 1);
    if (!arr.length) delete filtrosAtuais[parametro];
  }
}

// Atualiza todos os charts na página
function atualizarTodosOsGraficos() {
  for (const { grafico, dadosOriginais, parametro } of todosOsGraficos) {
    const { labels, valores } = processarDados(
      getDadosAtuais(dadosOriginais),
      parametro,
    );
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  }
}

// Limpa filtros
export function limparFiltros() {
  filtrosAtuais = {};
  atualizarTodosOsGraficos();
}

// Cria gráfico interativo com estatísticas embutidas
export function criarGrafico(
  canvas,
  tipo,
  parametro,
  backgroundColor,
  chaveLabel,
  dadosSource,
  callback,
) {
  const dadosOriginais = [...dadosSource];
  const container = document.createElement('div');
  container.className = 'grafico-container';

  // Dropdown de tipos
  const selectTipos = document.createElement('select');
  selectTipos.className = 'tipo-grafico-select';
  ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].forEach((t) => {
    selectTipos.innerHTML += `<option value="${t}" ${
      t === tipo ? 'selected' : ''
    }>${t}</option>`;
  });

  // Novo canvas para Chart.js
  const novoCanvas = canvas.cloneNode();
  const ctx = novoCanvas.getContext('2d');
  canvas.parentNode.replaceChild(container, canvas);
  container.append(selectTipos, novoCanvas);

  // Função para (re)criar o chart
  let grafico;
  const redraw = (chartType) => {
    const dados = getDadosAtuais(dadosOriginais);
    const { labels, valores } = processarDados(dados, parametro);
    const stats = calcularEstatisticas(valores);

    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: chaveLabel || parametro,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.raw;
                const pct = ((v / stats.total) * 100).toFixed(1);
                return `${ctx.label}: ${v} (${pct}%)`;
              },
            },
          },
          legend: {
            onClick(e, item) {
              const lbl = grafico.data.labels[item.index];
              toggleFiltro(dadosOriginais, parametro, lbl);
              atualizarTodosOsGraficos();
            },
          },
        },
        scales: ['bar', 'line'].includes(chartType)
          ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
          : undefined,
      },
    });

    grafico.estatisticas = stats;
    callback && callback(stats);
    return grafico;
  };

  // Inicializa
  todosOsGraficos.push({ grafico: redraw(tipo), dadosOriginais, parametro });
  selectTipos.addEventListener('change', () => redraw(selectTipos.value));
}

// Botões para filtrar meses
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  let container = document.getElementById('filtros');
  if (!container) {
    container = document.createElement('div');
    container.id = 'filtros';
    document.body.appendChild(container);
  }
  Object.values(cacheMeses).forEach((mes) => {
    const btn = document.createElement('button');
    btn.innerText = mes;
    btn.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
    };
    container.append(btn);
  });
}
