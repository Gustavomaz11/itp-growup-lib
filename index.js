import Chart from 'chart.js/auto';

// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar os filtros ativos
var todosOsGraficos = []; // Lista de gráficos
var estatisticasGlobais = {}; // Objeto para armazenar as estatísticas de cada gráfico

// Cache para nomes de meses
const cacheMeses = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

// Função para obter os dados atuais (considerando filtros ou dados originais)
function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) {
    return dadosOriginais;
  }

  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([parametro, valores]) => {
      let valorItem = item[parametro];

      if (parametro.includes('data')) {
        // Verifica se o filtro é de data
        const mes = valorItem?.slice(5, 7); // Extrai o mês (MM)
        const nomeMes = cacheMeses[mes]; // Converte para o nome do mês
        return valores.includes(nomeMes); // Compara com o filtro
      }

      return valores.includes(valorItem); // Filtro padrão
    }),
  );
}

// Função para calcular estatísticas
function calcularEstatisticas(dadosOriginais, parametro) {
  const dados = getDadosAtuais(dadosOriginais);
  const isData = (valor) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor);

  if (isData(dados[0]?.[parametro])) {
    const tempos = dados.map((item) => new Date(item[parametro]).getTime());
    const mediaAtual = tempos.reduce((a, b) => a + b, 0) / tempos.length;

    const mesAtual = new Date(tempos[0]).getMonth();
    const anoAtual = new Date(tempos[0]).getFullYear();
    const temposMesAnterior = dadosOriginais
      .filter((item) => {
        const data = new Date(item[parametro]);
        return (
          data.getMonth() === mesAtual - 1 && data.getFullYear() === anoAtual
        );
      })
      .map((item) => new Date(item[parametro]).getTime());

    const mediaMesAnterior =
      temposMesAnterior.reduce((a, b) => a + b, 0) / temposMesAnterior.length ||
      0;

    const variacaoPercentual = mediaMesAnterior
      ? ((mediaAtual - mediaMesAnterior) / mediaMesAnterior) * 100
      : null;

    return {
      tipo: 'media',
      mediaAtual,
      mediaMesAnterior,
      variacaoPercentual,
    };
  } else {
    const total = dados.length;
    return { tipo: 'total', total };
  }
}

// Função genérica para criar gráficos
export function criarGrafico(
  ctx,
  tipo,
  parametro_busca,
  backgroundColor,
  chave,
  obj,
) {
  const dadosOriginais = [...obj];

  const { labels, valores } = processarDados(
    getDadosAtuais(dadosOriginais),
    parametro_busca,
  );

  const grafico = new Chart(ctx, {
    type: tipo,
    data: {
      labels: labels,
      datasets: [
        {
          label: parametro_busca,
          data: valores,
          backgroundColor: backgroundColor.slice(0, labels.length),
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            generateLabels: (chart) => {
              const dataset = chart.data.datasets[0];
              return chart.data.labels.map((label, i) => ({
                text: label,
                fillStyle: dataset.backgroundColor[i],
                strokeStyle: dataset.borderColor
                  ? dataset.borderColor[i]
                  : dataset.backgroundColor[i],
                hidden: !chart.getDataVisibility(i),
                index: i,
              }));
            },
          },
          onClick: (e, legendItem) => {
            const legendaClicada = grafico.data.labels[legendItem.index];
            toggleFiltro(dadosOriginais, parametro_busca, legendaClicada);
            atualizarTodosOsGraficos();
          },
        },
      },
      scales:
        tipo === 'bar' || tipo === 'line'
          ? {
              x: {
                beginAtZero: true,
              },
              y: {
                beginAtZero: true,
              },
            }
          : undefined,
    },
  });

  // Calcula as estatísticas e armazena no objeto global
  const estatisticas = calcularEstatisticas(dadosOriginais, parametro_busca);
  estatisticasGlobais[chave] = estatisticas;

  todosOsGraficos.push({ grafico, dadosOriginais, parametro_busca });
}

// Função para alternar um filtro
function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) {
    filtrosAtuais[parametro] = [];
  }

  const index = filtrosAtuais[parametro].indexOf(valor);
  if (index === -1) {
    filtrosAtuais[parametro].push(valor);
  } else {
    filtrosAtuais[parametro].splice(index, 1);
    if (filtrosAtuais[parametro].length === 0) {
      delete filtrosAtuais[parametro];
    }
  }
}

// Função para atualizar todos os gráficos
function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach(
    ({ grafico, dadosOriginais, parametro_busca, chave }) => {
      const { labels, valores } = processarDados(
        getDadosAtuais(dadosOriginais),
        parametro_busca,
      );
      grafico.data.labels = labels;
      grafico.data.datasets[0].data = valores;
      grafico.update();

      // Recalcula e atualiza as estatísticas no objeto global
      const estatisticas = calcularEstatisticas(
        dadosOriginais,
        parametro_busca,
      );
      estatisticasGlobais[chave] = estatisticas;
    },
  );
}

// Função para acessar as estatísticas globais
export function getEstatisticas(chave) {
  return estatisticasGlobais[chave] || null;
}
