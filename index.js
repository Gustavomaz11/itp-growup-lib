import Chart from 'chart.js/auto';

// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar os filtros ativos
var todosOsGraficos = []; // Lista de gráficos

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

function processarDuracoes(dados, parametroInicio, parametroFim) {
  const bins = [
    { label: '< 30 minutos', test: (diff) => diff < 30 * 60 * 1000 },
    {
      label: '> 45min e < 60min',
      test: (diff) => diff > 45 * 60 * 1000 && diff < 60 * 60 * 1000,
    },
    {
      label: '> 24h e < 48h',
      test: (diff) => diff > 24 * 60 * 60 * 1000 && diff < 48 * 60 * 60 * 1000,
    },
    {
      label: '> 48h e < 72h',
      test: (diff) => diff > 48 * 60 * 60 * 1000 && diff < 72 * 60 * 60 * 1000,
    },
  ];
  // inicializa contadores em zero
  const contadores = bins.map(() => 0);

  dados.forEach((item) => {
    const t0 = Date.parse(item[parametroInicio]);
    const t1 = Date.parse(item[parametroFim]);
    if (isNaN(t0) || isNaN(t1)) return;
    const diff = t1 - t0;
    bins.forEach((bin, i) => {
      if (bin.test(diff)) contadores[i]++;
    });
  });

  return {
    labels: bins.map((b) => b.label),
    valores: contadores,
  };
}

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

// Função para calcular o total de dados e executar um callback
function calcularTotal(dadosOriginais, callback) {
  const dadosAtuais = getDadosAtuais(dadosOriginais);
  const total = dadosAtuais.length; // Conta o total de itens
  if (callback && typeof callback === 'function') {
    callback(total); // Chama o callback com o total
  }
  return total; // Retorna o total
}

// Função otimizada para processar dados agrupados por mês ou outro parâmetro
function processarDados(dados, parametro_busca) {
  const isDataTime = (valor) =>
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor);
  const contagem = new Map();

  dados.forEach((item) => {
    let chave = item[parametro_busca];

    if (chave) {
      if (isDataTime(chave)) {
        const mes = chave.slice(5, 7);
        chave = cacheMeses[mes];
      }

      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
  });

  // Criar um mapa reverso com nome -> número para ordenação
  const ordemMeses = Object.entries(cacheMeses).reduce((acc, [num, nome]) => {
    acc[nome] = parseInt(num, 10);
    return acc;
  }, {});

  // Ordena os labels com base na posição do mês no ano
  const labelsOrdenados = Array.from(contagem.keys()).sort(
    (a, b) => ordemMeses[a] - ordemMeses[b],
  );

  const valoresOrdenados = labelsOrdenados.map((label) => contagem.get(label));

  return {
    labels: labelsOrdenados,
    valores: valoresOrdenados,
  };
}

// --- Novas funções para comparação entre períodos ---

// Retorna o rótulo do período anterior (mês, ano ou dia)
function obterPeriodoAnterior(rotuloAtual) {
  const meses = Object.values(cacheMeses);
  const idx = meses.indexOf(rotuloAtual);
  if (idx !== -1) {
    return meses[(idx + meses.length - 1) % meses.length];
  }
  if (/^\d{4}$/.test(rotuloAtual)) {
    return String(Number(rotuloAtual) - 1);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(rotuloAtual)) {
    const d = new Date(rotuloAtual);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// Formata o texto de variação (a mais / a menos)
function formatarVariacao(percentual) {
  if (percentual == null) return '—';
  if (percentual > 0) {
    return `${percentual.toFixed(1)}% a mais`;
  } else if (percentual < 0) {
    return `${Math.abs(percentual).toFixed(1)}% a menos`;
  }
  return '0% (sem variação)';
}

// Calcula totais do período atual e anterior, devolvendo texto de variação
function calcularComparacao(dadosOriginais, parametro_busca, valorAtual) {
  const backupFiltros = { ...filtrosAtuais };

  // total do período atual
  filtrosAtuais[parametro_busca] = [valorAtual];
  const totalAtual = getDadosAtuais(dadosOriginais).length;

  // total do período anterior
  const valorAnterior = obterPeriodoAnterior(valorAtual);
  let totalAnterior = null;
  if (valorAnterior) {
    filtrosAtuais[parametro_busca] = [valorAnterior];
    totalAnterior = getDadosAtuais(dadosOriginais).length;
  }

  // restaura filtros
  filtrosAtuais = backupFiltros;

  // calcula variação
  let percentual = null;
  if (totalAnterior && totalAnterior > 0) {
    percentual = ((totalAtual - totalAnterior) / totalAnterior) * 100;
  }

  return {
    total: totalAtual,
    variacaoTexto: formatarVariacao(percentual),
  };
}

// Função genérica para criar gráficos com comparação de períodos
export function criarGrafico(
  ctx,
  tipoInicial,
  parametroBuscaInicio,
  usarDuracao = true, // ← novo parâmetro booleano
  parametroBuscaFim = null, // ← obrigatório se usarDuracao for false
  backgroundColor,
  chave,
  obj,
  callback,
) {
  const dadosOriginais = [...obj];
  let tipoAtual = tipoInicial;
  let grafico;

  if (!usarDuracao && !parametroBuscaFim) {
    throw new Error(
      'Parâmetro "parametroBuscaFim" é obrigatório quando usarDuracao for false.',
    );
  }

  function renderizarGrafico() {
    // escolhe entre o processamento por mês (antigo) ou por duração (novo)
    let processResult;
    if (!usarDuracao) {
      processResult = processarDuracoes(
        dadosOriginais,
        parametroBuscaInicio,
        parametroBuscaFim,
      );
    } else {
      processResult = processarDados(
        getDadosAtuais(dadosOriginais),
        parametroBuscaInicio,
      );
    }

    const { labels, valores } = processResult;
    const config = {
      type: tipoAtual,
      data: {
        labels,
        datasets: [
          {
            label: usarDuracao
              ? parametroBuscaInicio
              : 'Distribuição de Duração',
            data: valores,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
        },
        scales:
          tipoAtual === 'bar' || tipoAtual === 'line'
            ? { x: { beginAtZero: true }, y: { beginAtZero: true } }
            : undefined,
      },
    };

    if (grafico) {
      grafico.destroy();
    }
    grafico = new Chart(ctx, config);

    // callback inicial
    if (callback) callback({ total: labels.length, variacaoTexto: null });
  }

  // primeira renderização
  renderizarGrafico();

  // select de tipos de gráfico
  const tiposDisponiveis = [
    'bar',
    'line',
    'pie',
    'doughnut',
    'radar',
    'polarArea',
  ];
  const select = document.createElement('select');
  select.style.margin = '8px';
  tiposDisponiveis.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.text = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === tipoAtual) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    tipoAtual = select.value;
    renderizarGrafico();
  });
  ctx.canvas.parentNode.insertBefore(select, ctx.canvas.nextSibling);
}

// Função para alternar um filtro
function toggleFiltro(dadosOriginais, parametro, valor) {
  if (!filtrosAtuais[parametro]) filtrosAtuais[parametro] = [];
  const idx = filtrosAtuais[parametro].indexOf(valor);
  if (idx === -1) filtrosAtuais[parametro].push(valor);
  else {
    filtrosAtuais[parametro].splice(idx, 1);
    if (filtrosAtuais[parametro].length === 0) delete filtrosAtuais[parametro];
  }
}

// Função para atualizar todos os gráficos
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

// Função para adicionar botões de filtro por meses na interface
export function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
  Object.values(cacheMeses).forEach((mes) => {
    const botaoMes = document.createElement('button');
    botaoMes.innerText = mes;
    botaoMes.onclick = () => {
      toggleFiltro(dadosOriginais, parametro, mes);
      atualizarTodosOsGraficos();
      calcularTotal(dadosOriginais, (total) =>
        console.log(`Total após filtro: ${total}`),
      );
    };
    document.body.appendChild(botaoMes);
  });
}
