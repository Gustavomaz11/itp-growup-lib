import Chart from 'chart.js/auto';

// Variáveis globais
let filtrosAtuais = {};
let todosOsGraficos = [];

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

const isData = (valor) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor);

function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) return dadosOriginais;

  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([parametro, valores]) => {
      let valorItem = item[parametro];
      if (parametro.includes('data')) {
        const mes = valorItem?.slice(5, 7);
        return new Set(valores).has(cacheMeses[mes]);
      }
      return new Set(valores).has(valorItem);
    }),
  );
}

function calcularTotal(dadosOriginais, callback) {
  const total = getDadosAtuais(dadosOriginais).length;
  if (typeof callback === 'function') callback(total);
  return total;
}

function processarDados(dados, parametro_busca) {
  const contagem = new Map();

  dados.forEach((item) => {
    let chave = item[parametro_busca];
    if (chave && isData(chave)) {
      const mes = chave.slice(5, 7);
      chave = cacheMeses[mes];
    }
    if (chave) contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });

  return {
    labels: Array.from(contagem.keys()),
    valores: Array.from(contagem.values()),
  };
}

function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];

  const index = filtrosAtuais[parametro].indexOf(valor);
  if (index === -1) {
    filtrosAtuais[parametro].push(valor);
  } else {
    filtrosAtuais[parametro].splice(index, 1);
    if (filtrosAtuais[parametro].length === 0) delete filtrosAtuais[parametro];
  }
}

function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach(({ grafico, dadosOriginais, parametro_busca }) => {
    const { labels, valores } = processarDados(
      getDadosAtuais(dadosOriginais),
      parametro_busca,
    );
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  });
}

export function limparFiltros() {
  filtrosAtuais = {};
  atualizarTodosOsGraficos();
}

export function criarGrafico(
  canvas,
  tipo,
  parametro_busca,
  backgroundColor,
  chave,
  obj,
  callback,
) {
  const dadosOriginais = [...obj];
  const idCanvas = canvas.id || `grafico-${Date.now()}`;
  const { labels, valores } = processarDados(
    getDadosAtuais(dadosOriginais),
    parametro_busca,
  );
  const totalInicial = calcularTotal(dadosOriginais, callback);

  const container = document.createElement('div');
  container.className = 'grafico-container';

  const selectTipos = document.createElement('select');
  selectTipos.innerHTML = `
    <option value="bar" ${tipo === 'bar' ? 'selected' : ''}>Barras</option>
    <option value="line" ${tipo === 'line' ? 'selected' : ''}>Linha</option>
    <option value="pie" ${tipo === 'pie' ? 'selected' : ''}>Pizza</option>
    <option value="doughnut" ${
      tipo === 'doughnut' ? 'selected' : ''
    }>Rosquinha</option>
    <option value="radar" ${tipo === 'radar' ? 'selected' : ''}>Radar</option>
    <option value="polarArea" ${
      tipo === 'polarArea' ? 'selected' : ''
    }>Área Polar</option>
  `;
  selectTipos.className = 'tipo-grafico-select';

  const novoCanvas = canvas.cloneNode(true);
  const ctx = novoCanvas.getContext('2d');

  container.appendChild(selectTipos);
  container.appendChild(novoCanvas);
  canvas.parentNode.replaceChild(container, canvas);

  let grafico = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label: parametro_busca,
          data: valores,
          backgroundColor: backgroundColor.slice(0, labels.length),
          borderWidth: 1,
        },
      ],
    },
    options: getOpcoesGrafico(
      tipo,
      dadosOriginais,
      parametro_busca,
      callback,
      () => grafico,
    ),
  });

  grafico.total = totalInicial;
  todosOsGraficos.push({ grafico, dadosOriginais, parametro_busca });

  selectTipos.addEventListener('change', () => {
    const novoTipo = selectTipos.value;
    grafico.destroy();

    const canvasSubstituto = document.createElement('canvas');
    canvasSubstituto.id = idCanvas;
    container.replaceChild(canvasSubstituto, container.querySelector('canvas'));

    const novoCtx = canvasSubstituto.getContext('2d');

    grafico = new Chart(novoCtx, {
      type: novoTipo,
      data: {
        labels,
        datasets: [
          {
            label: parametro_busca,
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: getOpcoesGrafico(
        novoTipo,
        dadosOriginais,
        parametro_busca,
        callback,
        () => grafico,
      ),
    });

    grafico.total = calcularTotal(dadosOriginais, callback);

    const indexGrafico = todosOsGraficos.findIndex(
      (g) => g.parametro_busca === parametro_busca,
    );
    if (indexGrafico !== -1) {
      todosOsGraficos[indexGrafico].grafico = grafico;
    }
  });
}

function getOpcoesGrafico(
  tipo,
  dadosOriginais,
  parametro_busca,
  callback,
  getGrafico,
) {
  return {
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const valor = context.raw;
            const total = context.chart.total || 1;
            const percentual = ((valor / total) * 100).toFixed(1);
            return `${context.label}: ${valor} (${percentual}%)`;
          },
        },
      },
      legend: {
        display: true,
        labels: {
          generateLabels: (chart) => {
            const dataset = chart.data.datasets[0];
            return chart.data.labels.map((label, i) => ({
              text: label,
              fillStyle: dataset.backgroundColor[i],
              strokeStyle: dataset.backgroundColor[i],
              hidden: !chart.getDataVisibility(i),
              index: i,
            }));
          },
        },
        onClick: (e, legendItem) => {
          const grafico = getGrafico();
          const legendaClicada = grafico.data.labels[legendItem.index];
          toggleFiltro(dadosOriginais, parametro_busca, legendaClicada);
          atualizarTodosOsGraficos();
          grafico.total = calcularTotal(dadosOriginais, callback);
        },
      },
    },
    scales:
      tipo === 'bar' || tipo === 'line'
        ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
        : undefined,
  };
}

export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  let container = document.getElementById('filtros');
  if (!container) {
    container = document.createElement('div');
    container.id = 'filtros';
    container.className = 'filtro-container';
    document.body.appendChild(container);
  }

  Object.values(cacheMeses).forEach((mes) => {
    const botaoMes = document.createElement('button');
    botaoMes.innerText = mes;
    botaoMes.className = 'filtro-botao';
    botaoMes.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
      calcularTotal(dadosOriginais, (total) =>
        console.log(`Total filtrado após clique: ${total}`),
      );
    };
    container.appendChild(botaoMes);
  });
}
