import Chart from 'chart.js/auto';

const chartsRegistry = {}; // Registro de gráficos por chave
const originalData = {}; // Dados brutos por chave
const filtrosAtivos = {}; // Filtros aplicados por chave

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
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = obj;
    filtrosAtivos[chave] = [];
  }

  // Transformar cada dado em um dataset individual
  const datasets = dados.labels.map((nome, index) => ({
    label: nome,
    data: [dados.data[index]], // apenas um valor por dataset
    backgroundColor: dados.backgroundColor
      ? dados.backgroundColor[index]
      : '#36A2EB',
    borderColor: dados.borderColor ? dados.borderColor[index] : '#1A7CE2',
    borderWidth: 1,
  }));

  const configuracaoPadrao = {
    type: 'bar',
    data: {
      labels: [''], // label vazia pois cada dataset representa uma barra
      datasets: datasets,
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
          onClick: (e, legendItem, legend) =>
            aplicarFiltroPorChave(chave, legendItem.text),
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
            display: false, // esconder eixo X pois cada dataset representa uma pessoa
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function aplicarFiltroPorChave(chave, labelSelecionada) {
  // Alternar o filtro (ativa ou desativa)
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
          filtrosAtivos[chave].every((filtro) =>
            Object.values(item).includes(filtro),
          ),
        )
      : dadosOriginais;

  chartsRegistry[chave].forEach((chart) => {
    const labels = chart.data.labels;
    chart.data.datasets.forEach((dataset) => {
      dataset.data = labels.map((label) => {
        return dadosFiltrados.filter((item) =>
          Object.values(item).includes(label),
        ).length;
      });
    });
    chart.update();
  });
}
