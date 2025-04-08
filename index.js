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
    originalData[chave] = { dados, obj }; // Armazena os dados originais junto com o objeto
    filtrosAtivos[chave] = {};
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
            aplicarFiltro(chave, 'prioridade', legendItem.text),
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

function aplicarFiltro(chave, dimensao, valor) {
  if (!filtrosAtivos[chave][dimensao]) {
    filtrosAtivos[chave][dimensao] = [];
  }

  const filtroAtivo = filtrosAtivos[chave][dimensao].includes(valor);
  if (filtroAtivo) {
    filtrosAtivos[chave][dimensao] = filtrosAtivos[chave][dimensao].filter(
      (v) => v !== valor,
    );
  } else {
    filtrosAtivos[chave][dimensao].push(valor);
  }

  const { dados } = originalData[chave]; // Recupera os dados originais
  const filtros = filtrosAtivos[chave];

  const dadosFiltrados = originalData[chave].obj.filter((item) => {
    return Object.keys(filtros).every((dim) => {
      return filtros[dim].length === 0 || filtros[dim].includes(item[dim]);
    });
  });

  chartsRegistry[chave].forEach((chart) => {
    chart.data.datasets.forEach((dataset) => {
      dataset.data = dados.labels.map((label) => {
        return dadosFiltrados.filter((item) => item.label === label).length;
      });
    });
    chart.update();
  });
}
