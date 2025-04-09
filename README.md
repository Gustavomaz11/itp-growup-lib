# Biblioteca de Gráficos ITP Soluções

Biblioteca de Gráficos Interativos baseada em [Chart.js](https://www.chartjs.org/), desenvolvida para facilitar e padronizar a criação de gráficos com funcionalidades de filtros inspiradas no **Power BI**.  

Ideal para desenvolvedores que desejam criar dashboards interativos com **pouco esforço**.

---

## Recursos

- **Gráficos Interativos**: Oferece gráficos com filtros dinâmicos acionados por legendas.
- **Baseado em Chart.js**: Utiliza o poderoso Chart.js como base para renderização.
- **Personalização Simples**: Configurações amigáveis para fácil adaptação.
- **Compatibilidade**: Funciona com React.js e projetos JavaScript comuns.
- **Distribuição Flexível**: Disponível via CDN ou instalação via NPM.

---

## Instalação

### Usando NPM
```bash
npm install gmt-growup-lib
```

### Usando CDN
```bash
<script src="https://cdn.jsdelivr.net/npm/gmt-charts-growup@1.2.0/dist/index.umd.js" defer></script>
```

## Utilização
Atualmente, a biblioteca oferece dois tipos de gráficos: **Gráfico de Rosca e de Barra**

#### Exemplo de Uso
```bash
itp.criarGraficoRosca(
  graficoRosca,
  {
    labels: ['Baixa', 'Média', 'Alta', 'Urgente'],
    data: [baixo, medio, alto, urgente],
    backgroundColor: ['red', 'green', 'magenta', 'blue'],
  },
  'grupo1',
  resposta,
  {},
  (totalAtendimentos) => {
    qtd_atendimentos.textContent = totalAtendimentos;
  }
);
```

### Explicação de Parâmetros
<ul>
  <li><code>graficoRosca</code>, Seletor do JavaScript</li>
  <li><code>itp</code>: Método utilizado para acessar a função da biblioteca;</li>
  <li><code>labels</code>: Legendas do gráfico;</li>
  <li><code>data</code>: Dados que serão renderizados no gráfico;</li>
  <li><code>backgroundColor</code>: Define cores do gráfico (opcional, cores padrão são usadas se omitido);</li>
  <li><code>"grupo1"</code>: Grupo de gráficos que interagem com filtros. Vários grupos podem ser criados;</li>
  <li><code>resposta</code>: Resposta da requisição no front-end (obrigatório em formato JSON);</li>
  <li><code>{}</code>: Opções Personalizaveis;</li>
  <li><code>Callback</code>: Função que exibe o total atualizado após a aplicação de filtros;</li>
</ul>

### Processamento de Dados
A biblioteca conta com uma função para processar dados, calculando **contagem de itens** ou **média de tempo**.

#### Exemplo
##### Contagem de Atendimentos
```bash
const resultadoMes = itp.processarDados(resposta, "data_solicitacao", "mês", "contagem de atendimentos", 1);
```
#### Média de Tempo
```bash
const resultadoMes = itp.processarDados(resposta, "data_solicitacao", "mês", "média de tempo", 1, "data_fechamento");
```

### Explicação de Parâmetros
<ul>
  <li><code>resposta</code>: Lista de objetos, como a resposta da requisição;</li>
  <li><code>"data_solicitacao"</code>: Campo objeto a ser processado no formato <code>YYYY-MM-DD HH:MM:SS</code>;</li>
  <li>
    <strong>Intervalo:</strong>
    <ul>
      <li><code>"semana"</code>: Dados agrupados de domingo à sábado (de todo o ano);</li>
      <li><code>"mês"</code>: Dados agrupado do dia 1 ao 30/31;</li>
      <li><code>"ano"</code>: Dados agrupado de Janeiro a Dezembro;</li>
    </ul>
  </li>
  <li>
    <strong>Tipo de Cálculo:</strong>
    <ul>
      <li><code>"contagem de atendimentos"</code>: Retorna o número de objetos no intervalo;</li>
      <li><code>"média de tempo"</code>: Calcula a média de tempo entre os campos <code>"data_solicitacao</code> e <code>data_fechamento</code>;</li>
    </ul>
  </li>
  <li><code>1</code>: Mês escolhido pelo desenvolvedor, no caso: Janeiro;</li>
  <li>Caso nenhum mês seja escolhido o parâmetro deve ser passado como <code>null</code>;</li>
</ul>

#### Exemplo do objeto processado
```bash
{
  "codigo_atendimento": "ATD-000059",
  "descricao_atendimento": "Descrição do atendimento 59",
  "cliente": "Innovative Systems",
  "solicitante": "Victor Dias",
  "data_solicitacao": "2024-12-30 00:51:32",
  "data_fechamento": "2025-01-01 19:51:32",
  "prioridade": "Média",
  "tempo_fechamento_hrs": 67
}
```

## Filtros
A biblioteca oferece suporte a filtros dinâmicos que permitem interatividade entre gráficos agrupados.
Os filtros são configuráveis através de **grupos de gráficos** e aplicados com base nos seguintes parâmetros:
<ul>
  <li><code>Campo de Dados:</code> Escolha o campo que será utilizado para filtrar os dados;</li>
  <li><code>Grupos de Gráficos:</code> Gráficos que pertencem ao mesmo grupo interagem entre si;</li>
  <li><code>Callback de resumo:</code> Função que retorna o total de dados filtrados;</li>
</ul>

### Exemplo de Configuração de Filtros
```bash
itp.criarGraficoRosca(
  graficoRosca,
  {
    labels: ['Aprovados', 'Pendentes', 'Rejeitados'],
    data: [50, 30, 20],
    backgroundColor: ['green', 'yellow', 'red'],
  },
  'grupo2', // Grupo para interação entre gráficos
  resposta,
  {},
  (totalItens) => {
    console.log(`Total de itens no filtro atual: ${totalItens}`);
  }
);
```
### Comportamento dos Filtros
<ul>
  <li><code>Interatividade</code>: Ao clicar em uma legenda, o filtro é aplicado e todos os gráficos do mesmo grupo são atualizados;</li>
  <li><code>Total Dinâmico</code>: O callback retorna o total de itens ajustado ao filtro aplicado;</li>
</ul>

## Licença
Esse projeto está licenciado sob a licença MIT. Consulte o arquivo LICENSE para mais detalhes.
