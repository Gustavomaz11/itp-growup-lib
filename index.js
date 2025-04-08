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
    originalData[chave] = { ...dados }; // Clona os dados originais
    filtrosAtivos[chave] = []; // Inicializa os filtros
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
          onClick: (e, legendItem) => aplicarFiltro(chave, legendItem.text),
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}`;
            },
          },
        },
      },
      cutout: 80, // Define o tamanho do recorte interno
      ...opcoesPersonalizadas,
    },
  };

  const chartInstance = new Chart(ctx, configuracaoPadrao);
  chartsRegistry[chave].push(chartInstance);
}

function aplicarFiltro(chave, labelSelecionada) {
  // Adiciona ou remove o filtro para o item selecionado
  if (filtrosAtivos[chave].includes(labelSelecionada)) {
    filtrosAtivos[chave] = filtrosAtivos[chave].filter(
      (label) => label !== labelSelecionada,
    );
  } else {
    filtrosAtivos[chave].push(labelSelecionada);
  }

  const dadosOriginais = originalData[chave];

  // Aplica os filtros aos dados
  const dadosFiltrados = filtrosAtivos[chave].length
    ? dadosOriginais.labels.map((label, index) => {
        return filtrosAtivos[chave].includes(label)
          ? dadosOriginais.data[index]
          : 0;
      })
    : [...dadosOriginais.data]; // Sem filtros, mantém os dados originais

  // Atualiza os gráficos registrados para a chave
  chartsRegistry[chave].forEach((chart) => {
    chart.data.datasets[0].data = dadosFiltrados;
    chart.update();
  });
}
