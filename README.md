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

<h2>Licença</h2>
<p>Este projeto está licenciado sob a licença MIT. Para mais detalhes, consulte o arquivo LICENSE</p>
