import Chart from 'chart.js/auto';

const chartsRegistry = {}; // Registro de gráficos por chave

export function criarGraficoRosca(
  ctx,
  dados,
  chave,
  opcoesPersonalizadas = {},
) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
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
            font: {
              size: 14,
            },
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
  }

  const configuracaoPadrao = {
    type: 'bar',
    data: {
      datasets: [
        {
          label: dados.labels || ['Categoria 1', 'Categoria 2', 'Categoria 3'],
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
            font: {
              size: 14,
            },
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
          ticks: {
            stepSize: 10,
          },
        },
      },
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function handleFilter(chave, labelSelecionada) {
  chartsRegistry[chave].forEach((chart) => {
    const labels = chart.data.labels;
    const datasets = chart.data.datasets;

    datasets.forEach((dataset) => {
      dataset.data = dataset.data.map((value, index) =>
        labels[index] === labelSelecionada ? value : 0,
      );
    });

    chart.update();
  });
}
