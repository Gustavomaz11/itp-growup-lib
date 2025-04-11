import Chart from 'chart.js/auto';
// Variáveis globais
var filtrosAtuais = {}; // Objeto para armazenar os filtros ativos
var todosOsGraficos = []; // Lista de gráficos

// Cache para nomes de meses
const cacheMeses = {
    "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
    "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
};

// Função para obter os dados atuais (considerando filtros ou dados originais)
function getDadosAtuais(dadosOriginais) {
    if (Object.keys(filtrosAtuais).length === 0) {
        return dadosOriginais;
    }

    return dadosOriginais.filter(item =>
        Object.entries(filtrosAtuais).every(([parametro, valores]) => {
            let valorItem = item[parametro];

            if (parametro.includes("data")) { // Verifica se o filtro é de data
                const mes = valorItem?.slice(5, 7); // Extrai o mês (MM)
                const nomeMes = cacheMeses[mes]; // Converte para o nome do mês
                return valores.includes(nomeMes); // Compara com o filtro
            }

            return valores.includes(valorItem); // Filtro padrão
        })
    );
}

// Função otimizada para processar dados agrupados por mês ou outro parâmetro
function processarDados(dados, parametro_busca) {
    const isData = (valor) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor); // Detecta formato de data/hora
    const contagem = new Map(); // Substitui o objeto por um Map para melhor desempenho

    dados.forEach((item) => {
        let chave = item[parametro_busca];

        if (chave) {
            if (isData(chave)) {
                const mes = chave.slice(5, 7); // Extrai o mês (MM)
                chave = cacheMeses[mes]; // Obtém o nome do mês do cache
            }

            contagem.set(chave, (contagem.get(chave) || 0) + 1); // Incrementa a contagem
        }
    });

    return {
        labels: Array.from(contagem.keys()), // Extrai as chaves (nomes) como labels
        valores: Array.from(contagem.values()), // Extrai os valores como contagem
    };
}

// Função genérica para criar gráficos
export function criarGrafico(ctx, tipo, parametro_busca, backgroundColor, chave, obj) {
    const dadosOriginais = [...obj];

    const { labels, valores } = processarDados(getDadosAtuais(dadosOriginais), parametro_busca);

    const grafico = new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: parametro_busca,
                data: valores,
                backgroundColor: backgroundColor.slice(0, labels.length),
                borderWidth: 1,
            }],
        },
        options: {
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        // Exibe as legendas com cores
                        generateLabels: (chart) => {
                            const dataset = chart.data.datasets[0];
                            return chart.data.labels.map((label, i) => ({
                                text: label,
                                fillStyle: dataset.backgroundColor[i],
                                strokeStyle: dataset.borderColor ? dataset.borderColor[i] : dataset.backgroundColor[i],
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
            scales: tipo === 'bar' || tipo === 'line' ? {
                x: {
                    beginAtZero: true,
                },
                y: {
                    beginAtZero: true,
                },
            } : undefined,
        },
    });
    todosOsGraficos.push({ grafico, dadosOriginais, parametro_busca });
}

// Função para alternar um filtro
function toggleFiltro(dadosOriginais, parametro, valor) {
    if (!filtrosAtuais[parametro]) {
        filtrosAtuais[parametro] = [];
    }

    const index = filtrosAtuais[parametro].indexOf(valor);
    if (index === -1) {
        // Adiciona o valor ao filtro
        filtrosAtuais[parametro].push(valor);
    } else {
        // Remove o valor do filtro
        filtrosAtuais[parametro].splice(index, 1);

        // Se nenhum valor permanecer para o parâmetro, remove o parâmetro
        if (filtrosAtuais[parametro].length === 0) {
            delete filtrosAtuais[parametro];
        }
    }
}

// Função para atualizar todos os gráficos
function atualizarTodosOsGraficos() {
    todosOsGraficos.forEach(({ grafico, dadosOriginais, parametro_busca }) => {
        const { labels, valores } = processarDados(getDadosAtuais(dadosOriginais), parametro_busca);
        grafico.data.labels = labels;
        grafico.data.datasets[0].data = valores;
        grafico.update();
    });
}

// Função para adicionar botões de filtro por meses na interface
function adicionarFiltrosDeMeses(dadosOriginais, parametro) {
    Object.values(cacheMeses).forEach((mes) => {
        const botaoMes = document.createElement("button");
        botaoMes.innerText = mes;
        botaoMes.onclick = () => {
            toggleFiltro(dadosOriginais, parametro, mes);
            atualizarTodosOsGraficos();
        };
        document.body.appendChild(botaoMes); // Adiciona o botão ao DOM
    });
}
