<h1>Biblioteca de Gráficos ITP Soluções</h1>
<p>Biblioteca de Gráficos Interativos baseada em <a href="https://www.chartjs.org/">Chart.js</a>, desenvolvida para facilitar e padronizar a criação de gráficos com funcionalidades de filtros inspiradas no <code>Power BI</code>.</p>
<p>Ideal para desenvolvedores que desejam criar dashboards interativos com <strong>pouco esforço</strong>.</p>

<h2>Recursos</h2>
<ul>
  <li><code>Gráficos Interativos</code>: Oferece gráficos com filtros dinâmicos acionados por legendas;</li>
  <li><code>Baseado em Chart.js</code>: Utiliza o poderoso Chart.js como base para renderização;</li>
  <li><code>Personalização Simples</code>: Configurações amigáveis para fácil adaptação;</li>
  <li><code>Compatibilidade</code>: Funciona com React.js e projetos JavaScript comuns;</li>
  <li><code>Distribuição Flexível</code>: Disponível via CDN ou instalação via NPM;</li>
</ul>

<h2>Instalação</h2>
<h4>Usando NPM</h4>
<pre lang="bash">
  <code>npm install gmt-growup-lib</code>
</pre>

<h4>Usando CDN</h4>
<p>Adicione o seguinte script ao seu <code>HTML</code>:</p>
<pre lang="bash">
  <code><script src="https://cdn.jsdelivr.net/npm/gmt-charts-growup@1.1.11/dist/index.umd.js" defer></script></code>
</pre>

<h2>Utilização</h2>
<p>Atualmente a biblioteca oferece dois tipos de gráficos: <code>Gráfico de Rosca</code> e <code>Gráfico de Barra</code>.</p>

<h2>Exemplo de utilização</h2>
<pre lang="bash">
  <code>
    itp.criarGraficoRosca(graficoRosca, {
        labels: ['Baixa', 'Média', 'Alta', 'Urgente'],
        data: [baixo, medio, alto, urgente],
        backgroundColor: ['red', 'green', 'magenta', 'blue'],
      }, 'grupo1', resposta, {},
      (totalAtendimentos) => {
        qtd_atendimentos.textContent = totalAtendimentos;
      }
    );
  </code>
</pre>
<p>O presente exemplo acima é uma simulação para criar um gráfico tipo rosca para prioridades de atendimentos.</p>
<ul>
  <li><code>itp</code> é o método utilizado para utilizar a função da biblioteca;</li>
  <li><code>labels</code> se trata das legendas que o usuário deseja adicionar no gráfico;</li>
  <li><code>data</code> são os dados que serão renderizados na biblioteca;</li>
  <li><code>backgroundColor</code> define as cores do gráfico, é um método opicional, caso o usuário deseje não colocar, será adicionado cores padrões;</li>
  <li><code>"grupo1"</code> trata-se de um grupo de gráficos que irão interagir aos filtros, vários grupos podem ser criados;</li>
  <li><code>resposta</code> trata-se da resposta da requisição feita no front-end, a biblioteca espera um objeto do tipo JSON;</li>
  <li><code>{}</code> trata-se de opções personalizáveis que o desenvolvedor decida implementar;</li>
  <li><code>(totalAtendimentos) => </code> a biblioteca irá fazer uma contagem total do seu objeto que foi enviado como parâmetro, sempre que for filtrado novos números serão renderizados, exemplo: empresa Y tem 100k atendimentos ano de 2025, o atendente Gustavo atendeu 50k pessoas no ano, quando o filtro for aplicado para o mês de Janeiro, por exemplo. O total de atendimentos foi de 10k e Gustavo 2k;</li>
  <li>O total de atendimentos sempre vai funcionar referente ao parâmetro do filtro, caso o filtro seja o tipo de atendimento, o total do tipo do atendimento será retornado. Se o filtro for a quantidade de atendimento do atendente, o total referente ao atendente será retornado;</li>
  <li>Para que a biblioteca possa processar todos os dados é obrigatório o envio da resposta da requisição;</li>
</ul>

<h2>Processamento de Dados</h2>
<p>A biblioteca conta com uma função que processa dados fazendo a contagem do quantitativo e/ou a média de tempo.</p>
<p>Exemplo:</p>
<pre lang="bash">
  <code>
     const resultadoMes = itp.processarDados(resposta, "data_solicitacao", 'mês', 'contagem de atendimentos', 1);
  </code>
</pre>
<ul>
  <li><code>resposta</code>, trata-se da lista de objetos que é a resposta da requisição;</li>
  <li><code>"data_solicitação"</code>, campo do objeto que a função irá processar;</li>
  <pre lang="bash">
    <code>
       {
        "codigo_atendimento": "ATD-000059",
        "descricao_atendimento": "Descrição do atendimento 59",
        "cliente": "Innovative Systems",
        "solicitante": "Victor Dias",
        "data_solicitacao": "2024-12-30 00:51:32",
        "servico": "Monitoramento de Infraestrutura",
        "atendente": "Roberto Almeida",
        "prioridade": "Média",
        "data_inicio_atendimento": "2024-12-31 14:51:32",
        "tempo_inicio_hrs": 38,
        "data_resolucao": "2025-01-01 06:51:32",
        "tempo_resolucao_hrs": 16,
        "data_fechamento": "2025-01-01 19:51:32",
        "tempo_fechamento_hrs": 67,
        "nota": "Ruim",
        "interacoes": 3
      },
    </code>
  </pre>
  <li>O tipo de dado que o campo do objeto da requisição precisa ter é no formato: <code>YYYY-MM-DD HH:MM:SS</code>;</li>
  <li>No parâmetro onde se encontra <code>mês</code> podem ser colocados outros parâmetros sendo eles: semana, mês e ano;</li>
  <li>Caso ano será contabilizado os dados de Janeiro à Dezembro;</li>
  <li>Caso mês, será contabilizado os dados do dia 1 ao dia 30 ou 31;</li>
  <li>Caso semana, será contabilizado todos os dados de domingo a sábado (todos os dados de todos os domingos à sábados);</li>
  <li>No parâmetro onde se encontra <code>"contagem de atendimentos"</code> podem ser colocados outros parâmetros sendo eles: contagem de atendimentos e média de tempo;</li>
  <li>Caso <code>contagem de atendimento</code>, o processamento irá contabilizar quantos objetos tem na lista de objetos;</li>
  <li>Caso <code>média de tempo</code>, o processamento irá calcular a média de acordo com o horário de atendimentos;</li>
  <li>O ultimo parâmetro ele é obrigatório apenas caso seja escolhido o parâmetro <code>mês</code>. O ultimo parametro serve para identificar qual o mês o usuário deseja;</li>
</ul>

<h2>Licença</h2>
<p>Este projeto está licenciado sob a licença MIT. Para mais detalhes, consulte o arquivo LICENSE</p>
