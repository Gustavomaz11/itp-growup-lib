import Chart from 'chart.js/auto';

// Variáveis globais
let filtrosAtuais = {}; // Filtros ativos
let todosOsGraficos = []; // Gráficos criados
let estatisticasGlobais = {}; // Estatísticas globais

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

// Função para obter os dados filtrados
function getDadosAtuais(dadosOriginais) {
  if (!Object.keys(filtrosAtuais).length) return dadosOriginais;

  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([parametro, valores]) => {
      const valorItem = item[parametro];
      if (parametro.includes('data')) {
        const mes = valorItem?.slice(5, 7);
        const nomeMes = cacheMeses[mes];
        return valores.includes(nomeMes);
      }
      return valores.includes(valorItem);
    }),
  );
}

// Função para calcular estatísticas de forma eficiente
function calcularEstatisticas(dadosOriginais, parametro) {
  const dados = getDadosAtuais(dadosOriginais);
  if (!dados.length) return { tipo: 'vazio' };

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dados[0][parametro])) {
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

    const mediaMesAnterior = temposMesAnterior.length
      ? temposMesAnterior.reduce((a, b) => a + b, 0) / temposMesAnterior.length
      : 0;

    const variacaoPercentual = mediaMesAnterior
      ? ((mediaAtual - mediaMesAnterior) / mediaMesAnterior) * 100
      : null;

    return { tipo: 'media', mediaAtual, mediaMesAnterior, variacaoPercentual };
  }

  return { tipo: 'total', total: dados.length };
}

// Processamento eficiente de dados para gráficos
function processarDados(dados, parametro) {
  const contagem = dados.reduce((map, item) => {
    const valor = item[parametro];
    map[valor] = (map[valor] || 0) + 1;
    return map;
  }, {});

  const labels = Object.keys(contagem);
  const valores = Object.values(contagem);

  return { labels, valores };
}

// Função genérica para criar gráficos
export function criarGrafico(
  ctx,
  tipo,
  parametro,
  backgroundColor,
  chave,
  obj,
) {
  const dadosOriginais = [...obj];
  const { labels, valores } = processarDados(
    getDadosAtuais(dadosOriginais),
    parametro,
  );

  const grafico = new Chart(ctx, {
    type: tipo,
    data: {
      labels,
      datasets: [
        {
          label: parametro,
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
          onClick: (e, legendItem) => {
            toggleFiltro(dadosOriginais, parametro, labels[legendItem.index]);
            atualizarTodosOsGraficos();
          },
        },
      },
      scales:
        tipo === 'bar' || tipo === 'line'
          ? {
              x: { beginAtZero: true },
              y: { beginAtZero: true },
            }
          : undefined,
    },
  });

  const estatisticas = calcularEstatisticas(dadosOriginais, parametro);
  estatisticasGlobais[chave] = estatisticas;
  todosOsGraficos.push({ grafico, dadosOriginais, parametro });
}

// Função para alternar filtros de forma eficiente
function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = new Set();

  if (filtrosAtuais[parametro].has(valor)) {
    filtrosAtuais[parametro].delete(valor);
    if (!filtrosAtuais[parametro].size) delete filtrosAtuais[parametro];
  } else {
    filtrosAtuais[parametro].add(valor);
  }
}

// Atualizar todos os gráficos
function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach(({ grafico, dadosOriginais, parametro }) => {
    const { labels, valores } = processarDados(
      getDadosAtuais(dadosOriginais),
      parametro,
    );
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  });
}

// Função para obter estatísticas globais
export function getEstatisticas(chave) {
  return estatisticasGlobais[chave] || null;
}
