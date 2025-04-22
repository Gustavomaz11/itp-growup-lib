import Chart from 'chart.js/auto';

// Variáveis globais
let filtrosAtuais = {}; // Filtros ativos
let todosOsGraficos = []; // Lista de gráficos

// Cache de nomes dos meses
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

// Detecta formato data-hora YYYY-MM-DD HH:MM:SS
const isData = (valor) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor);

// Obtém dados com filtros aplicados
function getDadosAtuais(dadosOriginais) {
  if (Object.keys(filtrosAtuais).length === 0) return dadosOriginais;

  return dadosOriginais.filter((item) =>
    Object.entries(filtrosAtuais).every(([parametro, valores]) => {
      let valorItem = item[parametro];
      if (parametro.includes('data')) {
        const mes = valorItem?.slice(5, 7);
        return new Set(valores).has(cacheMeses[mes]);
      }
      return new Set(valores).has(valorItem);
    }),
  );
}

// Total de itens filtrados
function calcularTotal(dadosOriginais, callback) {
  const total = getDadosAtuais(dadosOriginais).length;
  if (typeof callback === 'function') callback(total);
  return total;
}

// Agrupa dados por um parâmetro
function processarDados(dados, parametro_busca) {
  const contagem = new Map();

  dados.forEach((item) => {
    let chave = item[parametro_busca];
    if (chave && isData(chave)) {
      const mes = chave.slice(5, 7);
      chave = cacheMeses[mes];
    }
    if (chave) contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });

  return {
    labels: Array.from(contagem.keys()),
    valores: Array.from(contagem.values()),
  };
}

// Adiciona ou remove valor no filtro
function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];

  const index = filtrosAtuais[parametro].indexOf(valor);
  if (index === -1) {
    filtrosAtuais[parametro].push(valor);
  } else {
    filtrosAtuais[parametro].splice(index, 1);
    if (filtrosAtuais[parametro].length === 0) delete filtrosAtuais[parametro];
  }
}

// Atualiza todos os gráficos criados
function atualizarTodosOsGraficos() {
  todosOsGraficos.forEach(({ grafico, dadosOriginais, parametro_busca }) => {
    const { labels, valores } = processarDados(
      getDadosAtuais(dadosOriginais),
      parametro_busca,
    );
    grafico.data.labels = labels;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  });
}

// Função pública para remover todos os filtros
export function limparFiltros() {
  filtrosAtuais = {};
  atualizarTodosOsGraficos();
}

// Cria gráfico interativo
export function criarGrafico(
  ctx,
  tipo,
  parametro_busca,
  backgroundColor,
  chave,
  obj,
  callback,
) {
  const dadosOriginais = [...obj];
  const idCanvas = ctx.id || `grafico-${Date.now()}`;

  const { labels, valores } = processarDados(
    getDadosAtuais(dadosOriginais),
    parametro_busca,
  );

  const totalInicial = calcularTotal(dadosOriginais, callback);

  // Cria um container para o gráfico + seletor
  const container = document.createElement('div');
  container.className = 'grafico-container';

  const selectTipos = document.createElement('select');
  selectTipos.innerHTML = `
    <option value="bar" ${tipo === 'bar' ? 'selected' : ''}>Barras</option>
    <option value="line" ${tipo === 'line' ? 'selected' : ''}>Linha</option>
    <option value="pie" ${tipo === 'pie' ? 'selected' : ''}>Pizza</option>
    <option value="doughnut" ${
      tipo === 'doughnut' ? 'selected' : ''
    }>Rosquinha</option>
    <option value="radar" ${tipo === 'radar' ? 'selected' : ''}>Radar</option>
    <option value="polarArea" ${
      tipo === 'polarArea' ? 'selected' : ''
    }>Área Polar</option>
  `;
  selectTipos.className = 'tipo-grafico-select';

  // Move o canvas para dentro do container visual
  const canvas = document.getElementById(idCanvas);
  container.appendChild(selectTipos);
  container.appendChild(canvas);

  // Renderiza o container no body (ou local desejado)
  canvas.parentNode.insertBefore(container, canvas);

  // Criação inicial do gráfico
  let grafico = new Chart(canvas, {
    type: tipo,
    data: {
      labels,
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
        tooltip: {
          callbacks: {
            label: function (context) {
              const valor = context.raw;
              const total = context.chart.total || 1;
              const percentual = ((valor / total) * 100).toFixed(1);
              return `${context.label}: ${valor} (${percentual}%)`;
            },
          },
        },
        legend: {
          display: true,
          labels: {
            generateLabels: (chart) => {
              const dataset = chart.data.datasets[0];
              return chart.data.labels.map((label, i) => ({
                text: label,
                fillStyle: dataset.backgroundColor[i],
                strokeStyle: dataset.backgroundColor[i],
                hidden: !chart.getDataVisibility(i),
                index: i,
              }));
            },
          },
          onClick: (e, legendItem) => {
            const legendaClicada = grafico.data.labels[legendItem.index];
            toggleFiltro(dadosOriginais, parametro_busca, legendaClicada);
            atualizarTodosOsGraficos();
            grafico.total = calcularTotal(dadosOriginais, callback);
          },
        },
      },
      scales:
        tipo === 'bar' || tipo === 'line'
          ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
          : undefined,
    },
  });

  grafico.total = totalInicial;

  // Adiciona à lista global para reuso
  todosOsGraficos.push({ grafico, dadosOriginais, parametro_busca });

  // Atualiza o tipo do gráfico dinamicamente
  selectTipos.addEventListener('change', () => {
    const novoTipo = selectTipos.value;

    // Remove gráfico anterior
    grafico.destroy();

    // Recria com novo tipo
    grafico = new Chart(canvas, {
      type: novoTipo,
      data: {
        labels,
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
          tooltip: {
            callbacks: {
              label: function (context) {
                const valor = context.raw;
                const total = context.chart.total || 1;
                const percentual = ((valor / total) * 100).toFixed(1);
                return `${context.label}: ${valor} (${percentual}%)`;
              },
            },
          },
          legend: {
            display: true,
            labels: {
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0];
                return chart.data.labels.map((label, i) => ({
                  text: label,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.backgroundColor[i],
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                }));
              },
            },
            onClick: (e, legendItem) => {
              const legendaClicada = grafico.data.labels[legendItem.index];
              toggleFiltro(dadosOriginais, parametro_busca, legendaClicada);
              atualizarTodosOsGraficos();
              grafico.total = calcularTotal(dadosOriginais, callback);
            },
          },
        },
        scales:
          novoTipo === 'bar' || novoTipo === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : undefined,
      },
    });

    grafico.total = calcularTotal(dadosOriginais, callback);
  });
}

// Adiciona UI de botões de filtro por mês
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  let container = document.getElementById('filtros');
  if (!container) {
    container = document.createElement('div');
    container.id = 'filtros';
    container.className = 'filtro-container';
    document.body.appendChild(container);
  }

  Object.values(cacheMeses).forEach((mes) => {
    const botaoMes = document.createElement('button');
    botaoMes.innerText = mes;
    botaoMes.className = 'filtro-botao';
    botaoMes.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
      calcularTotal(dadosOriginais, (total) =>
        console.log(`Total filtrado após clique: ${total}`),
      );
    };
    container.appendChild(botaoMes);
  });
}
