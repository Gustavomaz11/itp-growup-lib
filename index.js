import Chart from 'chart.js/auto';

// Objeto para armazenar o estado das labels ocultadas
const estadoLabelsOcultadas = {};

function criarGrafico(ctx, tipo, dados, chave, opcoesPersonalizadas = {}) {
    if (!estadoLabelsOcultadas[chave]) {
        estadoLabelsOcultadas[chave] = new Set();
    }

    const configuracaoPadrao = {
        type: tipo,
        data: {
            labels: dados.labels,
            datasets: dados.datasets.map(dataset => ({
                ...dataset,
                data: dataset.data
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                        },
                        usePointStyle: true,
                        generateLabels: (chart) => {
                            const originalLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            return originalLabels.map(label => ({
                                ...label,
                                hidden: estadoLabelsOcultadas[chave].has(label.text)
                            }));
                        },
                    },
                    onClick: (e, legendItem, legend) => {
                        const label = legendItem.text;
                        if (estadoLabelsOcultadas[chave].has(label)) {
                            estadoLabelsOcultadas[chave].delete(label);
                        } else {
                            estadoLabelsOcultadas[chave].add(label);
                        }
                        atualizarGraficos(chave);
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            ...opcoesPersonalizadas
        }
    };

    const chart = new Chart(ctx, configuracaoPadrao);
    chart.chave = chave;
    return chart;
}

export function criarGraficoRosca(ctx, dados, chave, opcoesPersonalizadas = {}) {
    return criarGrafico(ctx, 'doughnut', dados, chave, opcoesPersonalizadas);
}

export function criarGraficoBarra(ctx, dados, chave, opcoesPersonalizadas = {}) {
    return criarGrafico(ctx, 'bar', dados, chave, opcoesPersonalizadas);
}

export function criarGraficoMisto(ctx, dados, chave, opcoesPersonalizadas = {}) {
    return criarGrafico(ctx, 'bar', dados, chave, opcoesPersonalizadas);
}

function atualizarGraficos(chave) {
    Chart.helpers.each(Chart.instances, instance => {
        if (instance.chave === chave) {
            instance.data.datasets.forEach(dataset => {
                dataset.data = dataset.originalData ? dataset.originalData.slice() : dataset.data;
            });
            instance.data.labels.forEach((label, index) => {
                if (estadoLabelsOcultadas[chave].has(label)) {
                    instance.data.datasets.forEach(dataset => {
                        dataset.data[index] = null;
                    });
                }
            });
            instance.update();
        }
    });
}
