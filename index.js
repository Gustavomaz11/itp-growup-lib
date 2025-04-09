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

  // Adicionar logging para entender os dados recebidos
  // console.log('Dados recebidos:', dados.length, 'itens');
  // console.log('Exemplo do primeiro item:', dados[0]);
  // console.log('Campo de data a ser usado:', campoData);
  // console.log('Lapso temporal:', lapsoTemporal);
  // console.log('Tipo de cálculo:', tipoCalculo);
  // console.log('Mês desejado:', mesDesejado);

  // Conversão de strings de data para objetos Date com tratamento de erros
  const parseDate = (str) => {
    if (!str) {
      // console.warn('String de data inválida:', str);
      return null;
    }
    try {
      // Adicionar formato ISO para garantir interpretação correta
      return new Date(str.replace(' ', 'T'));
    } catch (e) {
      // console.error('Erro ao converter data:', str, e);
      return null;
    }
  };

  const agora = new Date();
  console.log('Data atual de referência:', agora);

  // Filtrar dados verificando cada item antes do processamento
  const filtrados = [];
  for (let i = 0; i < dados.length; i++) {
    const item = dados[i];
    
    if (!item || typeof item !== 'object') {
      // console.warn('Item inválido no índice', i, ':', item);
      continue;
    }
    
    if (!item[campoData]) {
      // console.warn('Item sem o campo de data especificado no índice', i, ':', item);
      continue;
    }
    
    const dataStr = item[campoData];
    const data = parseDate(dataStr);
    
    if (!data) {
      // console.warn('Falha ao converter data no índice', i, ':', dataStr);
      continue;
    }
    
    // console.log(`Item ${i}: data=${dataStr}, convertida para=${data}`);
    
    let incluir = false;
    
    if (lapsoTemporal === 'semana') {
      const diferencaDias = (agora - data) / (1000 * 60 * 60 * 24);
      incluir = diferencaDias <= 7;
      // console.log(`  - Semana: diferença=${diferencaDias} dias, incluir=${incluir}`);
    } else if (lapsoTemporal === 'mês') {
      const mesAtual = mesDesejado || (agora.getMonth() + 1);
      incluir = data.getMonth() + 1 === mesAtual;
      // console.log(`  - Mês: mês do item=${data.getMonth() + 1}, mês desejado=${mesAtual}, incluir=${incluir}`);
    } else if (lapsoTemporal === 'ano') {
      incluir = data.getFullYear() === agora.getFullYear();
      // console.log(`  - Ano: ano do item=${data.getFullYear()}, ano atual=${agora.getFullYear()}, incluir=${incluir}`);
    }
    
    if (incluir) {
      filtrados.push(item);
    }
  }

  // console.log('Itens filtrados:', filtrados.length);
  
  if (filtrados.length === 0) {
    // console.warn('Nenhum dado após filtragem');
    return { labels: [], data: [] };
  }

  // Agrupar dados filtrados
  const agrupados = {};
  for (const item of filtrados) {
    const data = parseDate(item[campoData]);
    let chave;
    
    if (lapsoTemporal === 'semana') {
      chave = data.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else if (lapsoTemporal === 'mês') {
      chave = data.getDate();
    } else if (lapsoTemporal === 'ano') {
      chave = data.toLocaleDateString('pt-BR', { month: 'short' });
    }
    
    if (!agrupados[chave]) {
      agrupados[chave] = [];
    }
    agrupados[chave].push(data);
  }

  // console.log('Agrupados por chave:', Object.keys(agrupados));

  const labels = Object.keys(agrupados);
  const data = Object.values(agrupados).map((datas) => {
    if (tipoCalculo === 'média de tempo') {
      return Math.round(
        datas.reduce((soma, d) => soma + d.getTime(), 0) /
          datas.length /
          (1000 * 60 * 60) // Converte para horas
      );
    } else {
      return datas.length;
    }
  });

  // console.log('Labels finais:', labels);
  // console.log('Dados finais:', data);

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
