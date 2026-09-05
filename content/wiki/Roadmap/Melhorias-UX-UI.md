## 🏃 Sprint 1: Refatoração Visual, Contraste e Acessibilidade (Foco em UI)
Esta sprint foca em melhorar a leitura e o contraste dos elementos, garantindo que alertas críticos chamem a atenção correta no tema claro.
## Prompt 1.1: Padronização Cromática das Severidades (Badges)

Atue como um Engenheiro Frontend Sênior especializado em Tailwind CSS e Acessibilidade (WCAG). 
Preciso refatorar o componente de Badge de Severidade em um Grid de ASPM. 
Atualmente, as tags de severidade (como High/Critical) usam um tom laranja/claro que perde contraste em fundos brancos.

Gere o código de um componente de Badge dinâmico que receba os status: 'Critical', 'High', 'Medium', 'Low'.
Regras de Design:
- Use cores saturadas com texto de alto contraste (ex: fundo vermelho claro com texto vermelho escuro para 'High').
- Adicione um mini ícone indicador à esquerda do texto (ex: um círculo preenchido ou um triângulo de alerta).
- Garanta que a fonte seja semi-bold e use tracking sutil para melhorar a legibilidade em tamanhos pequenos (text-xs ou text-sm).
Retorne o componente componentizado em React/Tailwind.

## Prompt 1.2: Otimização do Grid Dento (Row Stripping e Hover States)

Atue como Designer de Interação e Desenvolvedor Frontend. 
Olhando para uma tabela com mais de 50 linhas densas de vulnerabilidades de segurança, o olho do usuário se perde facilmente na leitura horizontal.

Crie os estilos CSS/Tailwind para as linhas (tr) da nossa tabela de observações:
1. Implemente um Row Stripping (zebra azulado/acinzentado bem sutil) apenas nas linhas pares para guiar o olhar horizontal.
2. Crie um efeito de 'Hover State' marcante: quando o usuário passar o mouse sobre uma linha, o fundo deve mudar para um tom suave de destaque (ex: slate-100) e a borda esquerda da linha deve ganhar um filete vertical de 3px com a cor da severidade correspondente daquela linha.
3. Adicione uma transição suave de 150ms para esse efeito.

------------------------------
## 🏃 Sprint 2: Enriquecimento de Contexto e Dados no Grid (Foco em Triage)
Esta sprint adiciona as informações contextuais que faltam na listagem para que o analista faça a triagem sem precisar abrir todos os cards.
## Prompt 2.1: Inclusão do Ícone de Origem (Source Integration)

Como Desenvolvedor Frontend, preciso modificar as linhas da nossa tabela de vulnerabilidades para incluir de forma legível a 'Origem/Ferramenta' que detectou a falha (ex: Azure DevOps Search Code, SonarQube, Trivy, Dependabot), logo na listagem principal.

Modifique a estrutura da linha da tabela para adicionar uma coluna chamada 'Origem':
- Ela deve renderizar o logotipo/ícone da ferramenta correspondente em tamanho pequeno (16x16px ou 20x20px).
- Ao lado do ícone, adicione o nome textual da ferramenta em cor cinza secundária (text-slate-500 text-xs).
- Se o nome for muito longo, aplique truncamento de texto (truncate) com um tooltip nativo ao passar o mouse (title="...").
Forneça a estrutura HTML/React atualizada.

## Prompt 2.2: Implementação de Hover Actions (Ações Rápidas por Linha)

Crie um componente de 'Hover Actions' para uma tabela de segurança. 
Para evitar cliques desnecessários abrindo o painel lateral, o analista deve conseguir tomar ações rápidas diretamente na linha ao passar o mouse.

Regras do Componente:
- Na última coluna da tabela (Ações), os botões devem iniciar ocultos (opacity-0 ou hidden).
- Ao fazer hover na linha (group-hover), mostre três botões de ação rápida com ícones (Lucide-react): 
  1. Ícone de Check/Check-Circle (Mudar status para Resolvido/Falso Positivo)
  2. Ícone de Usuário/User-Plus (Atribuir responsável rápido)
  3. Ícone de External-Link (Abrir direto no repositório de origem)
- Adicione tooltips flutuantes curtos explicando cada ação. Gere em React com Tailwind CSS.

------------------------------
## 🏃 Sprint 3: Navegação, Paginação e Preservação de Estado (Foco em UX)
Esta sprint resolve os controles de navegação e garante que o usuário não perca seu progresso ao interagir com o Grid View.
## Prompt 3.1: Componente Avançado de Paginação Tradicional com Seletor de Densidade

Atue como Especialista em UX Architecture. Preciso substituir o sistema de paginação atual do nosso Grid View de segurança por um modelo robusto de Paginação Tradicional Numérica que fique fixado no rodapé (Sticky Footer) da tabela.

Desenvolva o componente de paginação contendo:
- Alinhado à esquerda: Um seletor de densidade de itens (Dropdown/Select: 'Mostrar 25', 'Mostrar 50', 'Mostrar 100 itens').
- Alinhado ao centro: Indicador de progresso textual (ex: 'Exibindo 1-25 de 825 observações').
- Alinhado à direita: Botões numéricos de navegação (Anterior, 1, 2, 3, ..., Última, Próximo).
- Regra de Acessibilidade: Os botões de clique devem ter tamanho mínimo de 40x40px de área de toque. O botão correspondente à página atual deve ter preenchimento de cor sólida primária destacada.

## Prompt 3.2: Persistência de Filtros e Scroll State (Custom Hook)

Atue como Engenheiro de Software React Sênior. 
Em nosso app ASPM, quando o analista de segurança está na página 4 da listagem, clica em uma observação para abrir o painel lateral, realiza uma alteração e fecha o painel, a página recarrega e ele perde os filtros e volta para o topo da página 1. Isso arruína a produtividade de triagem.

Escreva um Custom Hook em React (ex: `useGridState`) utilizando sessionStorage ou a própria URL (Search Parameters) para salvar e recuperar automaticamente o estado do Grid.
O hook deve preservar:
1. Os filtros ativos (Severidade, Status, Origem).
2. O número da página atual da paginação.
3. A posição exata do scroll vertical em pixels que o usuário estava na tabela.
Forneça o código limpo do hook em TypeScript e um exemplo breve de aplicação no componente pai do Grid.

------------------------------
Se precisar, posso ajustar qualquer um desses prompts para frameworks específicos, como Angular, Vue ou bibliotecas de UI prontas como Shadcn/ui ou Ant Design. Como você prefere prosseguir?

