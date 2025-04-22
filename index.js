import Chart from 'chart.js/auto';

/**
 * ChartLibrary
 * Biblioteca de criação e gestão de gráficos com filtros dinâmicos, seleção de tipo e estatísticas mensais.
 */
export default class ChartLibrary {
  // Cache de meses para tradução de datas
  static cacheMonths = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio',    '06': 'Junho',     '07': 'Julho',  '08': 'Agosto',
    '09': 'Setembro','10': 'Outubro',   '11': 'Novembro','12': 'Dezembro',
  };

  // Cores padrão para datasets
  static defaultColors = [
    '#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#0099C6', '#DD4477'
  ];

  constructor() {
    this.filters = {};             // { campo: Set<valor> }
    this._charts = [];             // lista interna de gráficos
  }

  // Aplica filtros ao array de dados
  _getFilteredData(data) {
    if (!Object.keys(this.filters).length) return data;
    return data.filter(item =>
      Object.entries(this.filters).every(([key, values]) => {
        let val = item[key];
        if (key.includes('data') && val) {
          const m = val.slice(5,7);
          val = ChartLibrary.cacheMonths[m];
        }
        return values.has(val);
      })
    );
  }

  // Conta total de itens após filtros
  getTotal(data) {
    return this._getFilteredData(data).length;
  }

  // Agrupa e conta por campo
  _aggregate(data, key) {
    const map = new Map();
    this._getFilteredData(data).forEach(item => {
      let v = item[key];
      if (key.includes('data') && v) {
        const m = v.slice(5,7);
        v = ChartLibrary.cacheMonths[m];
      }
      if (v != null) map.set(v, (map.get(v) || 0) + 1);
    });
    return { labels: [...map.keys()], values: [...map.values()] };
  }

  // Limpa todos os filtros e atualiza gráficos
  clearFilters() {
    this.filters = {};
    this._updateAll();
  }

  // Desabilita ou habilita filtro de um valor
  toggleFilter(key, value) {
    if (!this.filters[key]) this.filters[key] = new Set();
    const s = this.filters[key];
    s.has(value) ? s.delete(value) : s.add(value);
    if (!s.size) delete this.filters[key];
    this._updateAll();
  }

  // Atualiza todos os gráficos existentes
  _updateAll() {
    this._charts.forEach(item => {
      const { chart, data, key } = item;
      const { labels, values } = this._aggregate(data, key);
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.update();
    });
  }

  // Gera botões de filtro (por mês, por exemplo)
  generateFilterButtons(container, data, key) {
    const div = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    Object.values(ChartLibrary.cacheMonths).forEach(mes => {
      const btn = document.createElement('button');
      btn.textContent = mes;
      btn.onclick = () => this.toggleFilter(key, mes);
      div.appendChild(btn);
    });
  }

  // Cria seletor de tipo de gráfico
  _makeTypeSelect(initial, callback) {
    const types = ['bar','line','pie','doughnut','radar','polarArea'];
    const sel = document.createElement('select');
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      if (t === initial) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => callback(sel.value);
    return sel;
  }

  // Opções padrão de gráfico (legenda, tooltip, escalas)
  _getOptions(type, key) {
    return {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              const total = ctx.chart.total || 1;
              const pct = ((v/total)*100).toFixed(1);
              return `${ctx.label}: ${v} (${pct}%)`;
            }
          }
        },
        legend: {
          onClick: (e, li, legend) => {
            this.toggleFilter(key, legend.chart.data.labels[li.index]);
            if (legend.chart.onStats) this._emitStats(legend.chart.data, key, legend.chart.onStats);
          }
        }
      },
      scales: (type==='bar'||type==='line')
        ? { x: { beginAtZero:true }, y:{ beginAtZero:true } }
        : undefined
    };
  }

  // Calcula estatísticas de mês atual vs mês anterior, retorna objeto com {current, previous, changePct}
  _computeMonthlyStats(data, dateKey) {
    const counts = {};
    data.forEach(item => {
      const d = item[dateKey].slice(0,7); // 'YYYY-MM'
      counts[d] = (counts[d]||0) + 1;
    });
    const months = Object.keys(counts).sort();
    const len = months.length;
    if (len < 2) return { current: counts[months[len-1]]||0, previous:0, changePct: null };
    const current = counts[months[len-1]];
    const previous = counts[months[len-2]];
    const changePct = previous ? ((current-previous)/previous*100).toFixed(1) : null;
    return { current, previous, changePct };
  }

  // Emite estatísticas via callback
  _emitStats(data, dateKey, callback) {
    if (typeof callback !== 'function') return;
    const stats = this._computeMonthlyStats(data, dateKey);
    callback(stats);
  }

  /**
   * Cria e registra um gráfico com seletor, filtros e estatísticas
   * @param {HTMLCanvasElement} canvas
   * @param {string} type
   * @param {string} key
   * @param {Array} data
   * @param {Object} opts { container, onTotal, onStats }
   */
  createChart(canvas, type, key, data, opts={}) {
    const { container=canvas.parentNode, onTotal, onStats, dateKey=key } = opts;
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-lib-container';

    // Seletor de tipo
    const sel = this._makeTypeSelect(type, newType => {
      chart.destroy();
      this._renderChart(newCanvas, newType);
      this._emitStats(data, dateKey, onStats);
    });

    const newCanvas = document.createElement('canvas');
    container.replaceChild(wrapper, canvas);
    wrapper.appendChild(sel);
    wrapper.appendChild(newCanvas);

    const ctx = newCanvas.getContext('2d');
    let chart = this._renderChart(newCanvas, type);
    this._charts.push({ chart, data, key });

    // Emitir total e estatísticas iniciais
    if (typeof onTotal==='function') onTotal(this.getTotal(data));
    this._emitStats(data, dateKey, onStats);

    return chart;
  }

  // Renderiza o Chart.js e retorna instância
  _renderChart(canvas, chartType) {
    const { labels, values } = this._aggregate(this._charts.at(-1).data, this._charts.at(-1).key);
    const c = new Chart(canvas.getContext('2d'), {
      type: chartType,
      data: { labels, datasets:[{ label: this._charts.at(-1).key, data: values, backgroundColor: ChartLibrary.defaultColors }] },
      options: this._getOptions(chartType, this._charts.at(-1).key)
    });
    c.total = this.getTotal(this._charts.at(-1).data);
    // armazenar callback de estatísticas
    c.onStats = this._charts.at(-1).opts?.onStats;
    return c;
  }
}
