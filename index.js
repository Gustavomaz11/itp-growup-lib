import Chart from 'chart.js/auto';

const chartsRegistry = {};
const originalData = {};
const filtrosAtivos = {};

export function processarDados(
  dados,
  campoData,
  lapsoTemporal,
  tipoCalculo,
  mesDesejado = null,
) {
  // Verificação inicial de dados
  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    console.warn('Dados inválidos ou vazios');
    return { labels: [], data: [] };
  }

  console.log(`Processando ${dados.length} registros para ${lapsoTemporal}`);

  // Função de parse de data mais robusta
  const parseDate = (str) => {
    if (!str) return null;
    try {
      // Garantir formato consistente
      return new Date(str);
    } catch (e) {
      console.error('Erro ao converter data:', str, e);
      return null;
    }
  };

  // Obter os dias da semana em português
  const diasDaSemana = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
  ];

  // Para semana: em vez de filtrar pelos últimos 7 dias, agrupar por dia da semana
  if (lapsoTemporal === 'semana') {
    // Agrupar por dia da semana, independente da data específica
    const porDiaDaSemana = {};

    // Inicializar todos os dias da semana
    diasDaSemana.forEach((dia) => {
      porDiaDaSemana[dia] = [];
    });

    // Agrupar por dia da semana
    dados.forEach((item) => {
      const data = parseDate(item[campoData]);
      if (data) {
        const diaDaSemana = diasDaSemana[data.getDay()];
        porDiaDaSemana[diaDaSemana].push(item);
      }
    });

    // Criar labels e data
    const labels = diasDaSemana;
    const data = labels.map((dia) => {
      const itens = porDiaDaSemana[dia];
      if (tipoCalculo === 'média de tempo') {
        if (itens.length === 0) return 0;
        return Math.round(
          itens.reduce((soma, item) => {
            const data = parseDate(item[campoData]);
            return soma + (data ? data.getTime() : 0);
          }, 0) /
            itens.length /
            (1000 * 60 * 60),
        );
      } else {
        return itens.length;
      }
    });

    console.log('Dados por dia da semana:', { labels, data });
    return { labels, data };
  }
  // Para mês: filtrar pelo mês desejado e agrupar por dia do mês
  else if (lapsoTemporal === 'mês') {
    const porDiaDoMes = {};

    // Inicializar todos os dias do mês (1 a 31)
    for (let i = 1; i <= 31; i++) {
      porDiaDoMes[i] = [];
    }

    // Filtrar e agrupar por dia do mês
    dados.forEach((item) => {
      const data = parseDate(item[campoData]);
      if (data && (!mesDesejado || data.getMonth() + 1 === mesDesejado)) {
        const diaDoMes = data.getDate();
        porDiaDoMes[diaDoMes].push(item);
      }
    });

    // Criar labels e data (apenas para dias com dados)
    const labels = Object.keys(porDiaDoMes).filter(
      (dia) => porDiaDoMes[dia].length > 0,
    );
    const data = labels.map((dia) => {
      const itens = porDiaDoMes[dia];
      if (tipoCalculo === 'média de tempo') {
        return Math.round(
          itens.reduce((soma, item) => {
            const data = parseDate(item[campoData]);
            return soma + (data ? data.getTime() : 0);
          }, 0) /
            itens.length /
            (1000 * 60 * 60),
        );
      } else {
        return itens.length;
      }
    });

    return { labels, data };
  }
  // Para ano: agrupar por mês
  else if (lapsoTemporal === 'ano') {
    const meses = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const porMes = {};

    // Inicializar todos os meses
    meses.forEach((mes) => {
      porMes[mes] = [];
    });

    // Agrupar por mês
    dados.forEach((item) => {
      const data = parseDate(item[campoData]);
      if (data) {
        const mes = meses[data.getMonth()];
        porMes[mes].push(item);
      }
    });

    // Criar labels e data
    const labels = meses;
    const data = labels.map((mes) => {
      const itens = porMes[mes];
      if (tipoCalculo === 'média de tempo') {
        if (itens.length === 0) return 0;
        return Math.round(
          itens.reduce((soma, item) => {
            const data = parseDate(item[campoData]);
            return soma + (data ? data.getTime() : 0);
          }, 0) /
            itens.length /
            (1000 * 60 * 60),
        );
      } else {
        return itens.length;
      }
    });

    return { labels, data };
  }

  return { labels: [], data: [] };
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
