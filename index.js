import Chart from 'chart.js/auto';

export function criarGraficoRosca(ctx, dados, chave,opcoesPersonalizadas = {}) {
    const configuracaoPadrao = {
        type: 'doughnut',
        data: {
            labels: dados.labels || ['Item 1', 'Item 2', 'Item 3'],
            datasets: [{
                data: dados.data,
                backgroundColor: dados.backgroundColor || ['#FF6384', '#36A2EB', '#FFCE56'],
                hoverBackgroundColor: dados.hoverBackgroundColor || ['#FF577F', '#4A90E2', '#FFD700'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            cutout: 80,
            ...opcoesPersonalizadas
        }
    };

    new Chart(ctx, configuracaoPadrao);
}

export function criarGraficoBarra(ctx, dados, chave,opcoesPersonalizadas = {}) {
    const configuracaoPadrao = {
        type: 'bar',
        data: {
            labels: dados.labels || ['Categoria 1', 'Categoria 2', 'Categoria 3'],
            datasets: [{
                label: dados.labels || 'Dados',
                data: dados.data,
                backgroundColor: dados.backgroundColor || ['#FF6384', '#36A2EB', '#FFCE56'],
                borderColor: dados.borderColor || ['#FF3B57', '#1A7CE2', '#FFB800'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                        }
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
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            },
            ...opcoesPersonalizadas
        }
    };

    new Chart(ctx, configuracaoPadrao);
}
