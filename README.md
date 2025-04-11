# Biblioteca de Gráficos ITP Soluções

Biblioteca de Gráficos Interativos baseada em [Chart.js](https://www.chartjs.org/), desenvolvida para facilitar e padronizar a criação de gráficos com funcionalidades de filtros inspiradas no **Power BI**.  

Ideal para desenvolvedores que desejam criar dashboards interativos com **pouco esforço**.

---

## Recursos

- **Gráficos Interativos**: Oferece gráficos com filtros dinâmicos acionados por legendas.
- **Processamento de Dados Automatizada**: Gráfico processa os dados da sua requisição para facilitar processamento.
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
<script src="https://cdn.jsdelivr.net/npm/gmt-charts-growup@2.0.2/dist/index.umd.js" defer></script>
```

## Utilização
Atualmente, a biblioteca oferece dois tipos de gráficos: **Gráfico de Rosca e de Barra**

#### Exemplo de Uso
```bash
itp.criarGrafico(ctx, tipo, parametro_busca, backgroundColor, chave, obj)
```

### Explicação de Parâmetros
<ul>
  <li><code>itp</code>: Método utilizado para acessar a função da biblioteca;</li>
  <li><code>ctx</code>, Seletor do JavaScript</li>
  <li><code>parametro_busca</code>: Campo do seu arquivo JSON que você quer que os dados sejam processados;</li>
  <li><code>backgroundColor</code>: Define cores do gráfico, espera um array de parâmetro (opcional, cores padrão são usadas se omitido);</li>
  <li><code>chave</code>: Grupo de gráficos que interagem com filtros. Vários grupos podem ser criados;</li>
  <li><code>obj</code>: Resposta da requisição no front-end (obrigatório em formato JSON);</li>
</ul>

### Processamento de Dados
A biblioteca conta com uma função para processar dados facilitando a inclusão dos dados nos gráficos.
```bash
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
  "tempo_inicio_hrs": 9,
  "data_resolucao": "2023-01-05 18:12:35",
  "tempo_resolucao_hrs": 22,
  "data_fechamento": "2023-01-06 11:12:35",
  "tempo_fechamento_hrs": 48,
  "nota": "Excelente",
  "interacoes": 10
},
```
**Exemplo**: Caso você queira que os seus dados processados sejam o campo <code>"prioridade"</code>, no exemplo em questão tem quatro tipos: Baixa, Média, Alta e Urgente.
O processamento de dados irá retornar esses dados com quantitativos e unitários. Os unitários serão os tipos de prioridade que serão as labels do gráfico: Baixa, Média, Alta e Urgente.
E os quantitativos serão quantos de cada label existe, que será exibido no gráfico.

### Exemplo prático com esse JSON
```bash
itp.criarGrafico(ctx,'pie', "prioridade", ['blue', 'yellow', 'red', 'pink'], "grupo1", json)
```
### Retorno
![image](https://github.com/user-attachments/assets/d26d6fe7-557c-4af2-9537-c442b0e89acb)


Caso os parametro de busca que for colocado retorna datas, o algoritimo irá fazer a análise e contar referente a cada mês.
```bash
itp.criarGrafico(ctx4,'bar' , "data_solicitacao", ['pink', 'purple', 'yellow', 'green'], "grupo1", json)
```
### Retorno (Organização crescente dos meses em desenvolvimento)
![image](https://github.com/user-attachments/assets/4fb1c8ab-4b77-489e-905e-639021eece66)



## Filtros
A biblioteca oferece suporte a filtros dinâmicos que permitem interatividade entre gráficos agrupados.
Os filtros são configuráveis através de **grupos de gráficos** e aplicados com base nos seguintes parâmetros:
<ul>
  <li><code>Grupos de Gráficos:</code> Gráficos que pertencem ao mesmo grupo interagem entre si;</li>
  <li><code>Multiplas seleções:</code> Gráficos se filtram por vários parâmetros;</li>
  <li><code>Filtro:</code> Ativação e desativação do filtro apenas clicando na legenda do gráfico;</li>
</ul>

### Exemplo de Configuração de Filtros
```bash
itp.criarGrafico(ctx4,'bar' , "data_solicitacao", ['pink', 'purple', 'yellow', 'green'], "grupo1", json)
                                                                                    // Marca o grupo pertencente ao gráfico
```
### Comportamento dos Filtros
<ul>
  <li>Como a resposta da requisição é enviada por parâmetro o processamento dos dados ocorre localmente não sendo necessário fazer outra requisição com os dados filtrados;</li>
  <li><code>Total Dinâmico</code>: O callback retorna o total de itens ajustado ao filtro aplicado; (em desenvolvimento)</li> 
</ul>

## Tipos de Gráficos que a biblioteca suporta atualmente e os dados são filtráveis
## bar (Barra)
![image](https://github.com/user-attachments/assets/4fb1c8ab-4b77-489e-905e-639021eece66)

## line (Linha)
![image](https://github.com/user-attachments/assets/2324e8f5-1c41-4c85-98f3-d08ca0d6088b)

## doughnut (Rosca)
![image](https://github.com/user-attachments/assets/4ba3f866-7ad0-4cab-a892-fa7ace6f67dd)

## pie (Pizza)
![image](https://github.com/user-attachments/assets/d26d6fe7-557c-4af2-9537-c442b0e89acb)

## polarArea (Area Polar)
![image](https://github.com/user-attachments/assets/7002827a-45c4-46a1-af7b-40b4ac79a14a)

## radar (Radar)
![image](https://github.com/user-attachments/assets/942f4619-702e-47a8-84f1-e77f6e8492f9)

## Licença
Esse projeto está licenciado sob a licença MIT. Consulte o arquivo LICENSE para mais detalhes.
