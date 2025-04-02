import Chart from 'chart.js/auto';

const chartsRegistry = {}; // Registro de gráficos por chave
const originalData = {}; // Armazena os dados originais dos gráficos

export function criarGraficoRosca(
  ctx,
  dados,
  chave,
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = {
      labels: [...dados.labels],
      datasets: dados.data.map((dataset) => [...dataset]),
    };
  }

  const configuracaoPadrao = {
    type: 'doughnut',
    data: {
      labels: dados.labels || ['Item 1', 'Item 2', 'Item 3'],
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
          onClick: (e, legendItem) => handleFilter(chave, legendItem.text),
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}%`;
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
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = {
      labels: [...dados.labels],
      datasets: dados.data.map((dataset) => [...dataset]),
    };
  }

  const configuracaoPadrao = {
    type: 'bar',
    data: {
      labels: dados.labels || ['Categoria 1', 'Categoria 2', 'Categoria 3'],
      datasets: [
        {
          data: dados.data,
          backgroundColor: dados.backgroundColor || [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
          ],
          borderColor: dados.borderColor || ['#FF3B57', '#1A7CE2', '#FFB800'],
          borderWidth: 1,
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
          onClick: (e, legendItem) => handleFilter(chave, legendItem.text),
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
        y: {
          beginAtZero: true,
          ticks: { stepSize: 10 },
        },
      },
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function handleFilter(chave, labelSelecionada) {
  Object.keys(chartsRegistry).forEach((key) => {
    chartsRegistry[key].forEach((chart) => {
      const labels = chart.data.labels;
      const datasets = chart.data.datasets;
      const originalDataset = originalData[key].datasets;

      datasets.forEach((dataset, datasetIndex) => {
        dataset.data = labels.map((label, index) => {
          if (chave === 'prioridade' && label === labelSelecionada) {
            return originalDataset[datasetIndex][index];
          } else if (chave !== 'prioridade') {
            const correspondente =
              originalData['prioridade'].datasets[0][index];
            return correspondente === labelSelecionada
              ? originalDataset[datasetIndex][index]
              : 0;
          }
          return 0;
        });
      });

      chart.update();
    });
  });
}
