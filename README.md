## ITP-GROWUP-LIB

Biblioteca JavaScript para criação de gráficos interativos, tabelas virtuais e widgets dinâmicos. Integra-se com Chart.js, jsPDF e html2canvas para fornecer funcionalidades completas de visualização, filtragem e exportação de relatórios em PDF.

---

### Índice

1. [Visão Geral](#visão-geral)  
2. [Instalação](#instalação)  
3. [API / Funcionalidades](#api--funcionalidades)  
   - [filtrosAtuais](#filtrosatuais)  
   - [criarGrafico(ctx, tipoInicial, parametro_busca, backgroundColor, chave, obj, callback, porDuracao, parametro_busca_fim, aggregationType, valueField)](#criargráfico)  
   - [adicionarFiltrosDeMeses(dadosOriginais, parametro)](#adicionarfiltrosdemeses)  
   - [criarDataTable(containerEl, obj, colunas, options)](#criardtabela)  
   - [criarBotaoGerarRelatorio(dadosOriginais, containerEl)](#criarbotaogerarrelatório)  
   - [criarGraficoBolha(ctx, dadosOriginais, eixoX, eixoY, raio, corField, aggregationType, valueField)](#criargraficobolha)  
   - [criarGraficoMisto(ctx, obj, titulo)](#criargraficomisto)  
   - [criarIcone(chartContainer)](#criaricone)  
4. [Exemplos de Uso](#exemplos-de-uso)  
5. [Dependências Externas](#dependências-externas)  
6. [Licença](#licença)  

---

## Visão Geral

A **ITP-GROWUP-LIB** é voltada para desenvolvedores que desejam:

- **Gerar gráficos interativos** (barra, linha, pizza, doughnut, radar, polarArea, bolha, misto)  
- **Aplicar filtros globais** (ano, mês, trimestre, valores de categoria, durações)  
- **Exibir tabelas virtuais** com paginação e possibilidade de filtrar diretamente pela célula clicada  
- **Exportar relatórios em PDF** contendo todos os gráficos renderizados e estatísticas por categoria  
- **Criar um widget flutuante** para carregar dados via endpoint ou arquivo JSON, selecionar propriedade, escolher tipo de gráfico e renderizar diretamente em um container  

A biblioteca encapsula toda a lógica de filtragem, agregação e atualização automática de gráficos e tabelas, além de fornecer componentes prontos (botão de Relatório, spinner de carregamento) para facilitar integrações em aplicações web.

---

## Instalação

1. **Via NPM**  
   Caso a biblioteca esteja publicada no registro NPM (por exemplo `npm install itp-growup-lib`), basta:  
   ```bash
   # NPM
   npm install itp-growup-lib


2. **Via CDN**  
   ```html
     <script src="https://cdn.jsdelivr.net/npm/gmt-charts-growup@2.3.78/dist/index.umd.js" defer></script>
   ``` 


---

## API / Funcionalidades

### `filtrosAtuais`

- **Descrição**: Objeto global que armazena, em tempo real, todos os filtros aplicados a gráficos e tabelas.  
- **Tipo**: `Object`  
- **Uso**:  
  - Chaves: nome do campo (por exemplo, `"data_inicio"` ou `"prioridade"`).  
  - Valor: array de valores permitidos para esse campo.  
  - Exemplo de estado:  
    ```js
    filtrosAtuais = {
      "data_inicio_ano": ["2023"],
      "categoria": ["Financeiro", "Operacional"],
      "sla_duracao": ["< 30 minutos", "> 5 dias"]
    };
    ```  
- **Propósito**:  
  - É consultado internamente por todas as funções de filtragem (`getDadosAtuais`, `processarDados`, `processarDuracaoAtendimentos`).  
  - Sempre que um gráfico ou tabela é renderizado, o estado de `filtrosAtuais` determina quais registros permanecem visíveis.  

---

### `criarGrafico(ctx, tipoInicial, parametro_busca, backgroundColor, chave, obj, callback, porDuracao = true, parametro_busca_fim = null, aggregationType = 'count', valueField = null)`

#### Descrição
Cria um gráfico Chart.js com suporte a filtros dinâmicos (ano, mês, trimestre etc.), alternância de tipo de gráfico (bar, line, pie, doughnut, radar, polarArea), possibilidade de exibir tabela de valores, e, opcionalmente, histograma de durações.

#### Parâmetros

1. **ctx**  
   - Tipo: `CanvasRenderingContext2D`  
   - Descrição: Contexto do `<canvas>` onde o gráfico será renderizado.  

2. **tipoInicial**  
   - Tipo: `string`  
   - Valores possíveis: `'bar'`, `'line'`, `'pie'`, `'doughnut'`, `'radar'`, `'polarArea'`  
   - Descrição: Tipo de gráfico inicial a ser exibido.  

3. **parametro_busca**  
   - Tipo: `string`  
   - Descrição: Nome do campo no objeto de dados (`obj`) que será utilizado para agrupar ou filtrar por categoria/data (ex.: `"data_inicio"`, `"categoria"`, `"status"`). Se o campo contiver data (`YYYY-MM-DD...`), os controles de período (ano/mês/trimestre) serão gerados automaticamente.  

4. **backgroundColor**  
   - Tipo: `string` ou `Array<string>`  
   - Descrição: Cor(es) de fundo para as barras, fatias ou pontos. Pode ser um array com tantas cores quantos rótulos são gerados, ou uma única string de cor (ex.: `"rgba(0, 123, 255, 0.5)"`).  

5. **chave**  
   - Tipo: `string`  
   - Descrição: Rótulo do dataset, exibido na legenda e tooltips. Exemplo: `"Total de Vendas"`, `"Contagem de Categorias"`.  

6. **obj**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos contendo os dados originais. Cada objeto deve ter a propriedade `parametro_busca` e, caso `aggregationType` seja `'sum'` ou `'mean'`, deve conter também a propriedade `valueField` (campo numérico).  

7. **callback**  
   - Tipo: `function` ou `null`  
   - Descrição: Função opcional chamada toda vez que o gráfico for renderizado ou atualizado. Recebe um objeto `{ total, variacaoTexto }`, onde:
     - `total`: número de registros após os filtros.  
     - `variacaoTexto`: string com variação percentual em relação ao render anterior (ex.: `"+10.50%"`).  

8. **porDuracao** (opcional; padrão: `true`)  
   - Tipo: `boolean`  
   - Descrição: 
     - `true`: agrupa por `parametro_busca` normal (count).  
     - `false`: cria um histograma de duração entre campo início e término (necessário passar `parametro_busca_fim`).  

9. **parametro_busca_fim** (opcional; necessário se `porDuracao === false`)  
   - Tipo: `string`  
   - Descrição: Nome do campo que representa data/fim para calcular durações (ex.: `"data_termino"`).  

10. **aggregationType** (opcional; padrão: `'count'`)  
    - Tipo: `string`  
    - Valores possíveis: `'count'`, `'sum'`, `'mean'`, `'raw'` (apenas para bubble).  
    - Descrição:
      - `'count'`: conta quantos itens existem em cada categoria.  
      - `'sum'`: soma os valores de `valueField` por categoria.  
      - `'mean'`: média de `valueField` por categoria.  

11. **valueField** (opcional; necessário se `aggregationType === 'sum'` ou `'mean'`)  
    - Tipo: `string`  
    - Descrição: Nome do campo numérico para agregação (`sum` ou `mean`).  

#### Comportamentos Internos

- **Detecção automática de campo de data**:  
  - Se um dos campos (das propriedades dos objetos em `obj`) corresponder ao formato `YYYY-MM-DD...`, são gerados botões para filtrar por ano, dropdown para mês e dropdown para trimestre, todos respeitando filtros anteriores (ano ⇒ filtra meses/trimestres correspondentes).  

- **Controles visuais**:  
  - _Select_ para alternar tipo de gráfico (os tipos listados em `tipoInicial`).  
  - Botão "Ver tabela" / "Ver gráfico" que alterna entre a visualização do `<canvas>` e uma tabela HTML gerada a partir dos `labels` e `valores` calculados após aplicação de `filtrosAtuais`.  

- **Atualização ao clicar na legenda**:  
  - Clicar em cada item da legenda (por exemplo, uma cor de barra ou fatia) aplica/remove filtro de categoria correspondente, atualizando todos os gráficos registrados em `todosOsGraficos`, assim como tabelas e KPIs (caso seja implementado callback).  

- **Registro em `todosOsGraficos`**:  
  - Cada gráfico renderizado é armazenado em `todosOsGraficos` para permitir atualização global ao aplicar/remover filtros.  

#### Exemplo de uso básico

```js


// Supondo que haja um <canvas id="chartCanvas"></canvas> no HTML:
const canvasEl = document.getElementById('chartCanvas');
const ctx = canvasEl.getContext('2d');

// Dados de exemplo:
const dados = [
  { data_inicio: '2023-01-15 08:30:00', categoria: 'A', valor: 100 },
  { data_inicio: '2023-02-20 10:000:00', categoria: 'B', valor: 200 },
  { data_inicio: '2023-01-10 14:45:00', categoria: 'A', valor: 150 },
  // ...
];

// Cria um gráfico de barras agrupado por 'categoria', com cores automáticas:
itp.criarGrafico(
  ctx,
  'bar',
  'categoria',
  ['#007bff', '#28a745', '#dc3545'],  // ex.: array de cores
  'Contagem por Categoria',
  dados,
  ({ total, variacaoTexto }) => {
    console.log(`Total após filtro: ${total}`, `Variação: ${variacaoTexto}`);
  }
);
```

---

### `adicionarFiltrosDeMeses(dadosOriginais, parametro)`

#### Descrição
Gera dinamicamente botões para cada mês do ano, permitindo filtrar o array `dadosOriginais` pelo campo `parametro` (por exemplo, se `parametro === 'data_inicio'`, ao clicar em "Janeiro" o filtro global `filtrosAtuais['data_inicio'] = ['Janeiro']` será aplicado).

#### Parâmetros

1. **dadosOriginais**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos (mesmos que você passaria a `criarGrafico`).  

2. **parametro**  
   - Tipo: `string`  
   - Descrição: Nome do campo que contém data ou valor categórico onde os meses serão detectados/exibidos (se for campo de data, ele extrai o mês; se não, cria botões simplesmente ligando valor ao filtro).  

#### Exemplo de uso

```js

const dados = [
  { data_inicio: '2023-02-10 09:15:00', categoria: 'X' },
  { data_inicio: '2023-03-05 11:00:00', categoria: 'Y' },
  { data_inicio: '2023-02-20 15:30:00', categoria: 'X' },
  // ...
];

// Ao chamar, adiciona ao <body> botões: "Janeiro", "Fevereiro", ..., "Dezembro"
// e clicando neles filtra globalmente por esse mês no campo "data_inicio".
itp.adicionarFiltrosDeMeses(dados, 'data_inicio');
```

---

### `criarDataTable(containerEl, obj, colunas, options = {})`

#### Descrição
Cria uma tabela “virtualizada” dentro de `containerEl`, com header fixo, corpo rolável (scroll vertical), paginação e suporte a filtrar clicando em qualquer célula. A filtragem também respeita `filtrosAtuais`, atualizando a visualização conforme filtros globais são aplicados.

#### Parâmetros

1. **containerEl**  
   - Tipo: `HTMLElement`  
   - Descrição: Div ou elemento onde a tabela será montada.  

2. **obj**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos contendo dados (mesmos que poderia passar a `criarGrafico`).  

3. **colunas**  
   - Tipo: `Array<string>`  
   - Descrição: Lista de nomes de propriedades dos objetos que deverão aparecer como colunas (ex.: `['nome', 'data_inicio', 'status']`).  

4. **options** (opcional)  
   - Tipo: `Object`  
   - Propriedades disponíveis:
     - `itemsPerPage` (número; padrão 50): quantos registros exibir por página.  
     - `virtualRowHeight` (número; em px; padrão 35): altura estimada de cada linha para cálculo de scroll virtual.  
     - `debounceTime` (número; em ms; padrão 200): tempo para debounce de scroll/pesquisa.  
     - Outros campos customizáveis, conforme necessidade.  

#### Comportamentos Internos

- **Header Fixo + Corpo com Scroll**  
  - O header (nomes de colunas) fixa no topo, enquanto o `<tbody>` (conteúdo) fica dentro de uma `<div>` rolável.  

- **Paginação**  
  - Se o total de registros filtrados exceder `itemsPerPage`, mostra botões de página (“1”, “2”, “3” …).  

- **Filtragem ao Clicar na Célula**  
  - Todas as células recebem a classe `.celula-clicavel`.  
  - Ao clicar em qualquer célula, (`coluna`, `valor`) são extraídos de `data-coluna` e `data-valor`. Em seguida, chama `toggleFiltro(coluna, valor)`, aplicando/removendo esse filtro global e atualizando todos os gráficos/tabelas.  

- **Registro em `todasAsTabelas`**  
  - Cada instância de tabela é armazenada em uma lista interna para que, sempre que `toggleFiltro` for chamado, `atualizarTodasAsTabelas()` seja executada, redesenhando todas as tabelas com base no filtro global corrente.  

#### Exemplo de uso

Suponha que exista uma `<div id="tableContainer"></div>` no seu HTML:

```js

const containerEl = document.getElementById('tableContainer');
const dados = [
  { id: 1, nome: 'Alice', status: 'Ativo' },
  { id: 2, nome: 'Bruno', status: 'Inativo' },
  { id: 3, nome: 'Carla', status: 'Ativo' },
  // ...
];

// Queremos exibir apenas as colunas "nome" e "status"
itp.criarDataTable(containerEl, dados, ['nome', 'status'], {
  itemsPerPage: 20,
  virtualRowHeight: 30,
  debounceTime: 150
});
```

---

### `criarBotaoGerarRelatorio(dadosOriginais, containerEl)`

#### Descrição
Insere, dentro de `containerEl`, um botão estilizado (“Gerar Relatório”) que, ao ser clicado, gera um arquivo PDF contendo:

1. Um spinner de carregamento com status de porcentagem (`showLoadingSpinner`, `updateLoadingSpinner`).  
2. Todos os gráficos (armazenados em `todosOsGraficos`) convertidos em imagens via `grafico.toBase64Image()`.  
3. Estatísticas geradas pela função `calcularEstatisticasGrafico` (variações ano a ano, mês a mês).  
4. Texto explicativo para cada gráfico (rótulos e valores em forma de tabela de texto no PDF).  
5. O PDF é salvo localmente com nome `"Relatorio_Visual_Completo.pdf"` (ou outros, conforme erros: `"Relatorio_Visual_Sem_Graficos.pdf"`, etc).  

#### Parâmetros

1. **dadosOriginais**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos (mesmos passados a `criarGrafico`). Utilizado internamente para calcular estatísticas, caso necessário.  

2. **containerEl**  
   - Tipo: `HTMLElement`  
   - Descrição: Elemento DOM onde o botão “[Gerar Relatório](#)” será inserido.  

#### Retorno

- Retorna o elemento `<button>` criado, caso seja necessário fazer referência a ele posteriormente.  

#### Exemplo de uso

```js

// Primeiro, renderizamos um gráfico para popular `todosOsGraficos`
const canvasEl = document.getElementById('chartCanvas');
const ctx = canvasEl.getContext('2d');
const dados = [ /* ...dados... */ ];
itp.criarGrafico(ctx, 'bar', 'categoria', ['#007bff', '#28a745'], 'Contagem', dados);

// Em seguida, em um container de sua escolha:
const relatorioContainer = document.getElementById('relatorioContainer');
criarBotaoGerarRelatorio(dados, relatorioContainer);

// Ao clicar no botão, será gerado automaticamente o PDF com todos os gráficos já renderizados.
```

---

### `criarGraficoBolha(ctx, dadosOriginais, eixoX, eixoY, raio, corField, aggregationType = 'raw', valueField = null)`

#### Descrição
Cria um gráfico de **bolhas** (bubble) usando Chart.js, agrupando dados conforme as dimensões passadas, agregando o campo `raio` (arraynumérico ou categórico) e colorindo bolhas de acordo com `corField`. O raio de cada bolha é normalizado entre 5px e 40px para melhor visualização.

#### Parâmetros

1. **ctx**  
   - Tipo: `CanvasRenderingContext2D`  
   - Descrição: Contexto do `<canvas>` onde o gráfico de bolhas será renderizado.  

2. **dadosOriginais**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos contendo dados crus.  

3. **eixoX**  
   - Tipo: `string`  
   - Descrição: Campo do objeto que será usado como coordenada X (pode ser string ou número). Quando for string não numérico, será convertido para número via `convBuilder`.  

4. **eixoY**  
   - Tipo: `string`  
   - Descrição: Campo do objeto que será usado como coordenada Y (idem `eixoX`).  

5. **raio**  
   - Tipo: `string`  
   - Descrição: Campo-fonte para calcular o tamanho bruto (quando `aggregationType === 'raw'`) ou somatório/média de `valueField`.  

6. **corField**  
   - Tipo: `string`  
   - Descrição: Campo categórico para gerar cores diferentes para cada grupo. Bolhas que compartilham o mesmo valor em `corField` terão cor igual.  

7. **aggregationType** (opcional; padrão: `'raw'`)  
   - Tipo: `string`  
   - Valores possíveis: `'raw'`, `'count'`, `'sum'`, `'mean'`  
   - Descrição:
     - `'raw'`: raio = valor numérico bruto (`raio`).  
     - `'count'`: raio proporcional à contagem de itens em cada grupo `(eixoX, eixoY, corField)`.  
     - `'sum'`: somatório de `valueField` para cada grupo.  
     - `'mean'`: média de `valueField` em cada grupo.  

8. **valueField** (opcional; necessário se `aggregationType === 'sum'` ou `'mean'`)  
   - Tipo: `string`  
   - Descrição: Nome do campo numérico para somatório/média.  

#### Comportamentos Internos

- **Agrupamento**  
  - Cria chaves no formato `${valorX}||${valorY}||${valorCor}`.  
  - Calcula `count` e `sum` de `raio` ou `valueField` para cada grupo.  

- **Normalização do Raio**  
  - Pega todos valores brutos calculados (count, sum ou mean) e normaliza linearmente entre 5px e 40px. Se `useSqrt = true`, aplica raiz quadrada para compressão visual.  

- **Geração de Cores**  
  - Identifica todas as categorias distintas em `corField` (após filtragem em `filtrosAtuais`) e gera tons HSL distribuídos uniformemente.  

- **Atualização Dinâmica**  
  - Se o gráfico já existia, apenas atualiza `grafico.data.datasets[0].data` e `grafico.data.datasets[0].backgroundColor`, chamando `grafico.update()`.  
  - Caso contrário, instancia um novo `Chart(ctx, { type: 'bubble', ... })` e registra em `todosOsGraficos` com sua função `renderizar`.  

#### Exemplo de uso

```js

const canvasEl = document.getElementById('bubbleChart');
const ctx = canvasEl.getContext('2d');

const dados = [
  { mes: 'Janeiro', region: 'Norte', valor: 120, categoria: 'A' },
  { mes: 'Fevereiro', region: 'Sul', valor: 200, categoria: 'B' },
  { mes: 'Janeiro', region: 'Norte', valor: 80, categoria: 'A' },
  // ...
];

// Cria um gráfico de bolhas onde:
//  - eixoX = 'mes'
//  - eixoY = 'region'
//  - raio  = 'valor'
//  - corField = 'categoria'
//  - aggregationType = 'sum' (soma valores de 'valor' por (mes,region,categoria))
itp.criarGraficoBolha(ctx, dados, 'mes', 'region', 'valor', 'categoria', 'sum', 'valor');
```

---

### `criarGraficoMisto(ctx, obj, titulo = '')`

#### Descrição
Cria um **gráfico misto** (_mixed chart_) com barra + linha, reagindo a filtros globais (campo de data detectado automaticamente). A lógica interna foi exemplificada para um cenário de “atendimentos mensais”:

- **Barras**: total de atendimentos por mês.  
- **Linha**: quantidade de atendimentos com nota “Excelente” por mês.  

Podem ser adaptados para outros casos, bastando alterar nomes de propriedades dentro de `processar` (o usuário pode customizar e estender o código-fonte conforme necessário).

#### Parâmetros

1. **ctx**  
   - Tipo: `CanvasRenderingContext2D`  
   - Descrição: Contexto do `<canvas>` onde o gráfico será renderizado.  

2. **obj**  
   - Tipo: `Array<Object>`  
   - Descrição: Array de objetos contendo dados originais. Deve-se ter, em cada objeto:
     - Um campo com data (`YYYY-MM-DD...`) para extrair mês.  
     - Um campo numérico ou categórico para contar/filtrar notas “Excelente” (ex.: `nota: 'Excelente'` ou `nota: 'Bom'`).  

3. **titulo** (opcional; padrão: `''`)  
   - Tipo: `string`  
   - Descrição: Título que será exibido no topo do gráfico (plugin de `title`).  

#### Comportamentos Internos

- **Agrupamento Mensal**  
  - Percorre `dadosFiltrados`, extrai mês de `item.data_resolucao`, incrementa contadores em dois objetos:
    - `contagemAtendimentosMensal[nomeMes]`  
    - `contagemExcelentesMensal[nomeMes]` (somente se `item.nota === 'Excelente'`).  

- **Criação Chart.js**  
  - Configura `type: 'bar'` como tipo base, com `datasets: [ { type: 'bar', ... }, { type: 'line', ... } ]`.  
  - Eixo Y único (`y`), barras em cores RGBA semitransparentes, linha sólida.  

- **Atualização Global**  
  - Cada vez que `filtrosAtuais` muda, chama `renderizar()` definido internamente para recalcular e redesenhar o gráfico.  

- **Registro em `todosOsGraficos`**  
  - Permite que chamadas subsequentes a `toggleFiltro` acionem atualização automática.  

#### Exemplo de uso

```js

const canvasEl = document.getElementById('mixedChart');
const ctx = canvasEl.getContext('2d');

const dados = [
  { data_resolucao: '2023-01-05 12:00:00', nota: 'Excelente' },
  { data_resolucao: '2023-01-15 14:30:00', nota: 'Bom' },
  { data_resolucao: '2023-02-02 09:15:00', nota: 'Excelente' },
  // ...
];

// Gera gráfico com título:
itp.criarGraficoMisto(ctx, dados, 'Atendimentos Mensais vs Excelentes');
```

---

### `criarIcone(chartContainer)`

#### Descrição
Cria um **widget flutuante** (ícone móvel) fixo na tela, que abre uma pequena janela de configuração. A janela permite:

1. **Inserir endpoint** (URL) para buscar dados JSON com `fetch`.  
2. **Fazer upload de arquivo JSON** local.  
3. Após carregar dados (array de objetos), listar propriedades disponíveis.  
4. Selecionar uma propriedade (`<select>`) para gerar gráfico.  
5. Selecionar tipo de gráfico (`bar`, `line`, `pie`, `doughnut`).  
6. Clicar em "Criar Gráfico" para chamar internamente `criarGrafico(ctx, ...)` e renderizar no `chartContainer`.  
7. Botão "Limpar Gráficos" que remove todos os elementos dentro de `chartContainer`.  

O ícone pode ser **arrastado** (drag and drop) e “encaixado” automaticamente nos cantos da tela (esquerda, direita, topo, base) quando solto, para manter uma boa experiência de UX.

#### Parâmetros

1. **chartContainer**  
   - Tipo: `HTMLElement`  
   - Descrição: Elemento DOM (geralmente uma `<div>`) onde os gráficos criados via widget serão inseridos.  

#### Comportamentos Internos

- **Criação do ícone flutuante**  
  - `<button id="floatingWidgetIcon">ITP</button>`  
  - Estilizado via JavaScript (`position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; ...`).  

- **Janela de Configuração**  
  - `<div>` fixo, inicialmente `display: none`.  
  - Ao clicar no ícone (se não houve arraste), alterna `display: block/none`.  
  - Posiciona a janela logo abaixo do ícone (`widgetWindow.style.top = rect.bottom + 'px'`, `widgetWindow.style.left = rect.left + 'px'`).  

- **Drag & Drop**  
  - Lógica de `mousedown` + `mousemove` + `mouseup` para arrastar o ícone.  
  - Se o usuário arrastar além de um `DRAG_THRESHOLD`, define `justDragged = true` para evitar que um clique acione a janela durante o arraste.  
  - Ao soltar o mouse, identifica o canto mais próximo (esquerda, direita, topo, base) e “encaixa” o ícone com margem de 20px.  

- **Processamento de Dados**  
  - **`handleFetch()`**: faz `fetch(endpoint)`, trata `res.json()`, passa para `processData(data)`.  
  - **`handleFile(e)`**: lê arquivo JSON local usando `FileReader`, chama `processData(jsonParsed)`.  
  - **`processData(data)`**:  
    - Verifica se `data` é array não vazio.  
    - Extrai chaves `Object.keys(data[0])`, exibe lista em `<div id="widgetResponseProps">`.  
    - Popula `<select id="widgetPropSelect">` com nomes de propriedades.  
    - Exibe bloco de seleção de propriedade e tipo de gráfico.  

- **Criação do Gráfico via Widget**  
  - **`createChartForProp(prop)`**:  
    1. Garante que `latestData` (array) exista.  
    2. `await loadChartJS()` — carrega dinamicamente Chart.js, caso não esteja no `window.Chart`.  
    3. Monta `<div>` container interno com `<canvas>` e título `<h3>`.  
    4. Chama `criarGrafico(ctx, chartType, prop, gerarCores(labels), \`Contagem de ${prop}\`, latestData, null)`.  
    5. Fecha widget (`widgetWindow.style.display = 'none'`).  

- **Limpar Gráficos**  
  - Botão “Limpar Gráficos” simplesmente faz `chartContainer.innerHTML = ''`, removendo tudo que foi inserido no container.  

#### Exemplo de uso (arquivo **script.js**)

```js
// script.js
// Supondo que você tenha incluído a biblioteca em seu HTML e importado corretamente:
const app = document.getElementById('app'); // <div id="app"></div>
itp.criarIcone(app);
```

- O código acima irá:
  1. Inserir o ícone flutuante “ITP” no canto inferior direito.  
  2. Ao clicar (não arrastando), abrirá a janela que permite carregar JSON e gerar gráficos dentro de `<div id="app">`.  
  3. Ao arrastar o ícone, ele “encaixa” no canto mais próximo.  

---

## Exemplos de Uso

Abaixo listamos alguns exemplos que integram as funcionalidades em cenários típicos.

---

### 1. Exibir um Gráfico em uma Página Simples

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Exemplo ITP-GROWUP-LIB</title>
</head>
<body>
  <h1>Dashboard de Indicadores</h1>
  <canvas id="chartCanvas" width="600" height="400"></canvas>
  <div id="relatorioContainer"></div>

  <script>
    // Exemplo de dados
    const dados = [
      { data_inicio: '2023-01-10 09:00:00', categoria: 'Vendas', valor: 1200 },
      { data_inicio: '2023-01-15 11:30:00', categoria: 'Suporte', valor: 800 },
      { data_inicio: '2023-02-05 14:45:00', categoria: 'Vendas', valor: 1500 },
      { data_inicio: '2023-02-10 10:20:00', categoria: 'Suporte', valor: 900 },
      // ... mais registros ...
    ];

    // 1) Criar um gráfico de barras por "categoria"
    const canvasEl = document.getElementById('chartCanvas');
    const ctx = canvasEl.getContext('2d');
    itp.criarGrafico(
      ctx,
      'bar',
      'categoria',
      ['#007bff', '#28a745'],     // array de cores
      'Contagem por Categoria',
      dados,
      ({ total, variacaoTexto }) => {
        // Opcional: Atualizar algum KPI na página
        console.log(`Total após filtro: ${total}`);
        console.log(`Variação: ${variacaoTexto}`);
      }
    );

    // 2) Adicionar botões de mês para filtragem
    itp.adicionarFiltrosDeMeses(dados, 'data_inicio');

    // 3) Adicionar botão para gerar relatório em PDF
    const relatorioContainer = document.getElementById('relatorioContainer');
    itp.criarBotaoGerarRelatorio(dados, relatorioContainer);
  </script>
</body>
</html>
```

---

### 2. Criar uma Tabela Virtualizada com Pesquisa Clicável

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Tabela Virtual ITP-GROWUP-LIB</title>
  <style>
    #tableContainer {
      width: 80%;
      margin: 20px auto;
      border: 1px solid #ccc;
      padding: 10px;
      height: 300px; /* Altura fixa para demonstrar scroll */
      overflow: hidden;
    }
    /* Exemplo de estilos adicionais para a tabela */
    .celula-clicavel:hover {
      background-color: #f0f8ff;
    }
  </style>
</head>
<body>
  <h1>Lista de Chamados</h1>
  <div id="tableContainer"></div>

  <script>
    // Dados de exemplo
    const chamados = [
      { id: 1, titulo: 'Erro no Sistema', prioridade: 'Alta', status: 'Aberto' },
      { id: 2, titulo: 'Atualizar Cadastro', prioridade: 'Média', status: 'Fechado' },
      { id: 3, titulo: 'Backup Falhou', prioridade: 'Crítica', status: 'Aberto' },
      // ... centenas ou milhares de registros ...
    ];

    // Criar tabela virtualizada exibindo colunas "id", "titulo", "prioridade", "status"
    const containerEl = document.getElementById('tableContainer');
    itp.criarDataTable(containerEl, chamados, ['id', 'titulo', 'prioridade', 'status'], {
      itemsPerPage: 100,
      virtualRowHeight: 30,
      debounceTime: 150
    });

    // Ao clicar em qualquer célula, o valor e coluna correspondentes serão filtrados globalmente
    // Chamados com "prioridade: Alta" ⇒ filtro aplicado e, se existirem gráficos, eles se atualizarão.
  </script>
</body>
</html>
```

---

### 3. Gerar Relatório em PDF com Gráficos e Estatísticas

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Indicadores</title>
  <style>
    #containerRelatorio {
      width: 90%;
      margin: 0 auto;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <h1>Dashboard e Relatório Automatizado</h1>
  <canvas id="chartCanvas1" width="400" height="300"></canvas>
  <canvas id="chartCanvas2" width="400" height="300"></canvas>
  <div id="containerRelatorio"></div>

  <script>
    const dados = [
      { data_inicio: '2023-01-01 09:00:00', categoria: 'Financeiro', nota: 'Excelente', valor: 500 },
      { data_inicio: '2023-01-05 11:00:00', categoria: 'Operacional', nota: 'Bom', valor: 300 },
      { data_inicio: '2023-02-10 14:00:00', categoria: 'Financeiro', nota: 'Excelente', valor: 700 },
      // ...
    ];

    // Gráfico 1: Contagem por "categoria"
    const ctx1 = document.getElementById('chartCanvas1').getContext('2d');
    itp.criarGrafico(ctx1, 'pie', 'categoria', ['#17a2b8', '#ffc107'], 'Distribuição de Categorias', dados);

    // Gráfico 2: Misturado de atendimentos mensais / notas "Excelente"
    const ctx2 = document.getElementById('chartCanvas2').getContext('2d');
    itp.criarGraficoMisto(ctx2, dados, 'Atendimentos Mensais vs Excelentes');

    // Botão para gerar relatório (PDF) com ambos os gráficos
    const contRel = document.getElementById('containerRelatorio');
    itp.criarBotaoGerarRelatório(dados, contRel);
  </script>
</body>
</html>
```

---

### 4. Widget Flutuante Dinâmico (criarIcone)

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Widget Flutuante ITP</title>
  <style>
    /* Apenas para definir onde os gráficos do widget serão inseridos */
    #app {
      width: 100%;
      min-height: 500px;
      border: 2px dashed #888;
      margin-top: 60px; /* distância do topo para não conflitar com o widget */
      padding: 20px;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <h1>Exemplo: Widget Flutuante</h1>
  <p>Arraste o ícone “ITP” para posicioná-lo no canto desejado. Clique para abrir o widget e gerar gráficos a partir de um endpoint ou arquivo JSON.</p>

  <div id="app">
    <!-- Aqui serão renderizados os gráficos criados via widget -->
  </div>

  <script>
    // Inicializa o widget, apontando para #app
    itp.criarIcone(document.getElementById('app'));
  </script>
</body>
</html>
```
---

## Licença

MIT License © 2025  


