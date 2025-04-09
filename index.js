import Chart from 'chart.js/auto';

const chartsRegistry = {};
const originalData = {};
const filtrosAtivos = {};

export function processarDados(
  dados,
  campoData, // Nome do campo contendo a data no formato "2023-01-04 20:12:35"
  lapsoTemporal, // 'semana', 'mês' ou 'ano'
  tipoCalculo, // 'média de tempo' ou 'contagem de atendimentos'
  mesDesejado = null, // Apenas para o lapso 'mês'
) {
  // Conversão de strings de data para objetos Date
  const parseDate = (str) => new Date(str.replace(' ', 'T'));

  const agora = new Date();
  const filtrados = dados.filter((item) => {
    const data = parseDate(item.data);
    if (!data || isNaN(data.getTime())) return false; // Ignorar entradas inválidas
    if (lapsoTemporal === 'semana') {
      return (agora - data) / (1000 * 60 * 60 * 24) <= 7; // Últimos 7 dias
    } else if (lapsoTemporal === 'mês') {
      return (
        data.getFullYear() === agora.getFullYear() &&
        (mesDesejado ? data.getMonth() + 1 === mesDesejado : true)
      );
    } else if (lapsoTemporal === 'ano') {
      return data.getFullYear() === agora.getFullYear();
    }
    return false;
  });

  const agrupados = filtrados.reduce((acc, item) => {
    const data = parseDate(item[campoData]);
    let chave;
    if (lapsoTemporal === 'semana') {
      chave = data.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else if (lapsoTemporal === 'mês') {
      chave = data.getDate();
    } else if (lapsoTemporal === 'ano') {
      chave = data.toLocaleDateString('pt-BR', { month: 'short' });
    }
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(data);
    return acc;
  }, {});

  const labels = Object.keys(agrupados);
  const data = Object.values(agrupados).map((datas) =>
    tipoCalculo === 'média de tempo'
      ? Math.round(
          datas.reduce((soma, d) => soma + d.getTime(), 0) /
            datas.length /
            (1000 * 60 * 60), // Converte milissegundos para horas
        )
      : datas.length,
  );

  return { labels, data };
}

/**
 * Cria um gráfico de Rosca.
 */
export function criarGraficoRosca(
  ctx,
  dados,
  chave,
  obj,
  opcoesPersonalizadas = {},
  callbackTotalAtendimentos = null,
) {
  inicializarGrafico(chave, obj);

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
          onClick: (_, legendItem) =>
            aplicarFiltroPorChave(
              chave,
              legendItem.text,
              callbackTotalAtendimentos,
            ),
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.raw}`,
          },
        },
      },
      cutout: 80,
      ...opcoesPersonalizadas,
    },
  };

  adicionarGrafico(chave, ctx, configuracaoPadrao);
  calcularTotalAtendimentos(chave, callbackTotalAtendimentos); // Inicializa o total de atendimentos
}

/**
 * Inicializa um gráfico na chave especificada.
 */
function inicializarGrafico(chave, obj) {
  if (!chartsRegistry[chave]) {
    chartsRegistry[chave] = [];
    originalData[chave] = obj;
    filtrosAtivos[chave] = [];
  }
}

/**
 * Adiciona um gráfico à chave especificada no registro.
 */
function adicionarGrafico(chave, ctx, configuracao) {
  const chartInstance = new Chart(ctx, configuracao);
  chartsRegistry[chave].push(chartInstance);
}

/**
 * Aplica ou remove um filtro para a chave especificada.
 */
function aplicarFiltroPorChave(
  chave,
  labelSelecionada,
  callbackTotalAtendimentos = null,
) {
  const filtros = filtrosAtivos[chave];

  if (filtros.includes(labelSelecionada)) {
    filtrosAtivos[chave] = filtros.filter(
      (filtro) => filtro !== labelSelecionada,
    );
  } else {
    filtrosAtivos[chave].push(labelSelecionada);
  }

  atualizarGraficos(chave, callbackTotalAtendimentos);
}

/**
 * Atualiza os gráficos associados a uma chave.
 */
function atualizarGraficos(chave, callbackTotalAtendimentos = null) {
  const dadosOriginais = originalData[chave];
  const filtros = filtrosAtivos[chave];
  const dadosFiltrados =
    filtros.length > 0
      ? dadosOriginais.filter((item) =>
          filtros.some((filtro) => Object.values(item).includes(filtro)),
        )
      : dadosOriginais;

  chartsRegistry[chave].forEach((chart) => {
    if (chart.config.type === 'bar') {
      chart.data.datasets.forEach((dataset, index) => {
        const label = dataset.label;
        const itemFiltrado = dadosFiltrados.find((item) =>
          Object.values(item).includes(label),
        );
        dataset.data = chart.data.labels.map((_, i) =>
          i === index && itemFiltrado ? itemFiltrado.valor : 0,
        );
      });
    } else if (chart.config.type === 'doughnut') {
      chart.data.datasets.forEach((dataset) => {
        dataset.data = chart.data.labels.map(
          (label) =>
            dadosFiltrados.filter((item) => Object.values(item).includes(label))
              .length,
        );
      });
    }

    chart.update();
  });

  calcularTotalAtendimentos(chave, callbackTotalAtendimentos, dadosFiltrados);
}

/**
 * Calcula o total de atendimentos.
 */
function calcularTotalAtendimentos(chave, callback, dadosFiltrados = null) {
  const dados = dadosFiltrados || originalData[chave];
  const totalAtendimentos = dados.length;

  if (typeof callback === 'function') {
    callback(totalAtendimentos);
  }
}
