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

  const datasets = dados.data.map((valor, index) => ({
    label: labelPersonalizada[index] || `Item ${index + 1}`,
    data: dados.labels.map((_, i) => (i === index ? valor : 0)),
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
          onClick: function (e, legendItem, legend) {
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
          stacked: false, // Removido empilhamento
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          stacked: false, // Removido empilhamento
        },
      },
      onClick: function (e) {
        const points = this.getElementsAtEventForMode(
          e,
          'nearest',
          { intersect: true },
          true,
        );

        if (points.length) {
          const datasetIndex = points[0].datasetIndex;
          const funcionario = this.data.datasets[datasetIndex].label;
          aplicarFiltroPorChave(chave, funcionario);
        }
      },
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function aplicarFiltroPorChave(chave, labelSelecionada) {
  // Adiciona ou remove o filtro
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
          filtrosAtivos[chave].some((filtro) =>
            Object.values(item).includes(filtro),
          ),
        )
      : dadosOriginais;

  chartsRegistry[chave].forEach((chart) => {
    const labels = chart.data.labels;

    if (chart.config.type === 'bar') {
      // Para gráficos de barras, recalcula os valores mantendo a estrutura original
      chart.data.datasets.forEach((dataset, index) => {
        const label = dataset.label;
        // Calcula o valor para o label correspondente ao dataset
        const valorFiltrado = dadosFiltrados.filter((item) =>
          Object.values(item).includes(label),
        ).length;
        // Mantém a lógica de um valor por posição
        dataset.data = labels.map((_, i) => (i === index ? valorFiltrado : 0));
      });
    } else if (chart.config.type === 'doughnut') {
      // Para gráficos de rosca, atualiza os dados diretamente
      chart.data.datasets.forEach((dataset) => {
        dataset.data = labels.map(
          (label) =>
            dadosFiltrados.filter((item) => Object.values(item).includes(label))
              .length,
        );
      });
    }

    chart.update();
  });
}
