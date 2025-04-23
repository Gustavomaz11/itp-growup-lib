# Biblioteca de Gráficos ITP Soluções

Biblioteca leve e poderosa, construída sobre [Chart.js](https://www.chartjs.org/), para criar dashboards interativos com filtros dinâmicos inspirados no **Power BI** — sem complicações.

---

## 🚀 Principais Recursos

- **Gráficos interativos** acionados por cliques na legenda  
- **Filtros globais**: múltiplos gráficos compartilham o mesmo estado  
- **Histogramas de duração**: bins automáticos para intervalos de tempo  
- **Ordenação inteligente** de meses (Jan → Dez)  
- **Total dinâmico** via callback após aplicação de filtros  
- **Compatível** com JavaScript puro e React.js  
- **Distribuição flexível**: CDN ou npm  

---

## 📦 Instalação

### Via npm

```bash
npm install gmt-charts-growup
```

### Via CDN

```html
<script src="https://cdn.jsdelivr.net/npm/gmt-charts-growup@2.3.7/dist/index.umd.js" defer></script>
```

---

## ⚙️ Uso Básico

| Parâmetro                | Tipo                    | Descrição                                                                                       |
|--------------------------|-------------------------|-------------------------------------------------------------------------------------------------|
| `ctx`                    | `CanvasRenderingContext2D` | Contexto do canvas onde o Chart.js renderiza                                                      |
| `tipo`                   | `string`                | Tipo de gráfico: `pie`, `bar`, `line`, `doughnut`, `polarArea`, `radar`                          |
| `campo`                  | `string`                | Nome do campo no JSON que será agrupado ou plotado                                              |
| `cores`                  | `string[]`              | Array de cores para o gráfico (opcional; padrão interno se omitido)                             |
| `grupo`                  | `string`                | Identificador de grupo para filtros cruzados                                                    |
| `dados`                  | `Object[]`              | Array de objetos JSON com seus registros                                                        |
| `callback(total, stats)` | `function`              | Função que recebe total de itens e estatísticas após renderizar ou filtrar                       |

<details>
<summary>Exemplo de uso básico</summary>

```js
const ctx = document.getElementById('myChart').getContext('2d');

itp.criarGrafico(
  ctx,
  'pie',
  'prioridade',
  ['blue','yellow','red','pink'],
  'grupo1',
  dadosJson,
  (total, stats) => {
    document.querySelector('.qtdAtendimentos').textContent =
      `${total} atendimentos (${stats.percent.toFixed(1)}%)`;
  }
);
```
</details>

---

## ⏱️ Contabilização de Duração

Para calcular média ou distribuir por faixas de duração:

| Parâmetro         | Tipo      | Descrição                                                                                              |
|-------------------|-----------|--------------------------------------------------------------------------------------------------------|
| `porDuracao`      | `boolean` | Se `true`, agrupa automaticamente por bins de duração; se `false`, exige `campoFim` para cálculo manual |
| `campoFim`        | `string`  | Nome do campo de data de término (ex.: `"data_fechamento"`)                                             |

<details>
<summary>Exemplo com duração</summary>

```js
itp.criarGrafico(
  ctx,
  'bar',
  'data_inicio_atendimento',
  ['pink','purple','yellow','green'],
  'grupo2',
  dadosJson,
  (total) => {
    console.log(`${total} atendimentos neste intervalo`);
  },
  false,
  'data_fechamento'
);
```
</details>

---

## 🔄 Filtros Dinâmicos

- Clique na legenda para ativar/desativar filtros  
- Gráficos no mesmo `grupo` interagem entre si  
- `callback` reflete o total pós-filtro  

---

## 📊 Tipos de Gráficos Suportados

| Tipo        | Descrição       |
|-------------|-----------------|
| `bar`       | Barras          |
| `line`      | Linhas          |
| `doughnut`  | Rosca           |
| `pie`       | Pizza           |
| `polarArea` | Área Polar      |
| `radar`     | Radar           |

<details>
<summary>Exemplo: solicitações por mês</summary>

```js
const ctx4 = document.getElementById('chartMeses').getContext('2d');
itp.criarGrafico(
  ctx4,
  'bar',
  'data_solicitacao',
  null,
  'meses',
  dadosJson,
  (total) => {
    document.querySelector('.totalMeses').textContent = `${total} registros`;
  }
);
```
</details>

---

## 🗂️ Estrutura de Dados de Exemplo

```json
{
  "codigo_atendimento": "ATD-000001",
  "descricao_atendimento": "Descrição do atendimento 1",
  "cliente": "Innovative Systems",
  "solicitante": "Daniel Souza",
  "data_solicitacao": "2023-01-04 11:12:35",
  "servico": "Configuração de Rede",
  "atendente": "Roberto Almeida",
  "prioridade": "Média",
  "data_inicio_atendimento": "2023-01-04 20:12:35",
  "data_resolucao": "2023-01-05 18:12:35",
  "data_fechamento": "2023-01-06 11:12:35",
  "nota": "Excelente",
  "interacoes": 10
}
```

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.
