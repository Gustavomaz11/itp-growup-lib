import Chart from 'chart.js/auto';

const chartsRegistry = {};
const originalData = {};
const filtrosAtivos = {};

export function criarGraficoRosca(
  ctx,
  dados,
  chave,
  obj,
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = obj;
    filtrosAtivos[chave] = [];
  }

  const configuracaoPadrao = {
    type: 'doughnut',
    data: {
      labels: dados.labels,
      datasets: [
        {
          data: dados.data,
          backgroundColor: dados.backgroundColor || [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
          ],
          hoverBackgroundColor: dados.hoverBackgroundColor || [
            '#FF577F',
            '#4A90E2',
            '#FFD700',
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14 },
            usePointStyle: true,
          },
          onClick: (e, legendItem) =>
            aplicarFiltroPorChave(chave, legendItem.text),
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}`;
            },
          },
        },
      },
      cutout: 80,
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

export function criarGraficoBarra(
  ctx,
  dados,
  chave,
  obj,
  labelPersonalizada = [],
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = obj;
    filtrosAtivos[chave] = [];
  }

  // Cria um dataset por funcionário
  const datasets = dados.labels.map((label, index) => ({
    label: label,
    data: dados.data.map((valor, i) => (i === index ? valor : 0)),
    backgroundColor: Array.isArray(dados.backgroundColor)
      ? dados.backgroundColor[index]
      : dados.backgroundColor || '#36A2EB',
    borderColor: Array.isArray(dados.borderColor)
      ? dados.borderColor[index]
      : dados.borderColor || '#1A7CE2',
    borderWidth: 1,
  }));

  const configuracaoPadrao = {
    type: 'bar',
    data: {
      labels: dados.labels,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          onClick: function (e, legendItem) {
            const funcionarioClicado = legendItem.text;
            aplicarFiltroPorChave(chave, funcionarioClicado);
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.raw}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          stacked: true,
        },
      },
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function aplicarFiltroPorChave(chave, labelSelecionada) {
  if (filtrosAtivos[chave].includes(labelSelecionada)) {
    filtrosAtivos[chave] = filtrosAtivos[chave].filter(
      (f) => f !== labelSelecionada,
    );
  } else {
    filtrosAtivos[chave].push(labelSelecionada);
  }

  const dadosOriginais = originalData[chave];

  const dadosFiltrados =
    filtrosAtivos[chave].length > 0
      ? dadosOriginais.filter((item) =>
          filtrosAtivos[chave].includes(item.label),
        )
      : dadosOriginais;

  chartsRegistry[chave].forEach((chart) => {
    chart.data.datasets.forEach((dataset) => {
      dataset.data = dadosOriginais.map((item) =>
        dadosFiltrados.some((f) => f.label === dataset.label) ? item.value : 0,
      );
    });

    chart.update();
  });
}
