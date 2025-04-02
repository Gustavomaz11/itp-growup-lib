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
      datasets: [...dados.data], // Armazena os dados corretamente
    };
  }

  const configuracaoPadrao = {
    type: 'doughnut',
    data: {
      labels: dados.labels,
      datasets: [
        {
          data: dados.data.map(Number), // Garante que os valores sejam numéricos
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
          labels: { font: { size: 14 }, usePointStyle: true },
          onClick: (e, legendItem) => handleFilter(chave, legendItem.text),
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
      datasets: [...dados.data],
    };
  }

  const configuracaoPadrao = {
    type: 'bar',
    data: {
      labels: dados.labels,
      datasets: [
        {
          label: 'Atendimentos', // Corrigido: Label agora aparece corretamente no tooltip e legenda
          data: dados.data.map(Number),
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
          labels: { font: { size: 14 }, usePointStyle: true },
          onClick: (e, legendItem) => handleFilter(chave, legendItem.text),
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              // Agora exibe a categoria correta no tooltip
              let label = context.dataset.label || '';
              if (context.parsed.y !== null) {
                label += `: ${context.parsed.y}`;
              }
              return label;
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
  if (!originalData[chave]) {
    console.error(
      `Erro: Os dados originais para '${chave}' não foram encontrados.`,
    );
    return;
  }

  Object.keys(chartsRegistry).forEach((key) => {
    chartsRegistry[key].forEach((chart) => {
      const labels = chart.data.labels;
      const datasets = chart.data.datasets;
      const originalDataset = originalData[key]?.datasets;

      if (!originalDataset) {
        console.error(`Erro: Não há dataset original para '${key}'`);
        return;
      }

      datasets.forEach((dataset, datasetIndex) => {
        dataset.data = labels.map((label, index) => {
          if (chave === 'prioridade' && label === labelSelecionada) {
            return originalDataset[index];
          } else if (chave !== 'prioridade') {
            const correspondente = originalData['prioridade']?.datasets[index];
            return correspondente === labelSelecionada
              ? originalDataset[index]
              : 0;
          }
          return 0;
        });
      });

      chart.update();
    });
  });
}

export default { criarGraficoRosca, criarGraficoBarra };
