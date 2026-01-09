---
title: Por que todo desenvolvedor deveria ter um blog (e como criei o meu)
date: '2026-01-01T00:00:00-00:00'
description: Mais do que um blog, um backup da mente. Saiba por que documentar seus projetos e estudos é essencial para programadores e como o exercício da escrita pode transformar sua carreira.
tags:
- blog
- hugo
- markdown
- obsidian
draft: false
---

![Capa do Artigo](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019ba3f6-edb9-7263-ba31-4d0b9cc0ff88.webp)

## Por que decidi criar meu próprio blog?

Há algum tempo assisti ao [Fábio Akita](https://akitaonrails.com) falando sobre a importância de programadores criarem seus próprios blogs pessoais. Seja para compartilhar um projeto, documentar estudos ou até tentar a sorte como influenciador, no fim *doesn't matter*. O que realmente importa é o exercício da escrita. Se for sobre algo que você goste ou deseja registrar, o processo deixa de ser penoso e se torna prazeroso.

Foi aí que percebi que criar essas "anotações" realmente me ajudam a fixar melhor o que estou aprendendo. Essa prática é validada por estudos da neurociência e da psicologia cognitiva: o ato de tomar notas é uma das ferramentas mais eficazes para a consolidação da memória. A ideia é basicamente dizer para o cérebro que aquilo que você está escrevendo é importante. Quando você escreve algo com suas próprias palavras, você está processando a informação e cria conexões neurais mais fortes. O artigo [Listening and note takin](https://psycnet.apa.org/record/1972-21817-001) explica bem sobre.

Além disso, existe o conceito do "backup da mente". Se daqui a algum tempo eu precisar refazer uma tarefa ou aplicar um conceito antigo, saberei exatamente onde procurar.

## A busca pela ferramenta ideal: Do Notion ao Obsidian

### O fracasso com o Notion

Comecei criando minhas primeiras notas no Notion, mas acabei me perdendo nas customizações. O Notion é excelente com suas milhares de possibilidades, que foi justamente o motivo do meu fracasso. Passei mais tempo estudando como criar templates, interligar notas, criar banco de dados, do que realmente escrevendo.

Além disso, o fato de tudo estar vinculado à plataforma me incomodava, nada era realmente "meu". O estalo final veio quando tentei abrir uma nota sem conexão e não consegui, pois estava tudo na nuvem. Para criar um "backup do meu cérebro", eu precisava ser dono da informação.

### A simplicidade do Obsidian

Comecei a pesquisar por uma alternativa, que fosse simples e me desse controle total, foi ai que conheci o [Obsidian](https://obsidian.md). Ele é um editor visual de Markdown que, embora permita o uso de plugins poderosos, cumpre perfeitamente a função base que eu buscava: ser fácil e personalizável.

Sem entrar em muito detalhes do Obsidian, o que fiz foi basicamente instalar alguns plugins básicos que deixassem meu fluxo agradável, sem gerar dependência. Se o Obsidian deixar de existir amanhã, minhas notas continuam comigo e podem ser lidas em qualquer editor de texto. Tudo está offline, sincronizado entre meus dispositivos e sem dependência de nuvens proprietárias.

![My Obsidian](https://joaooliveirablog.s3.us-east-1.amazonaws.com/obsidian_082840.webp)

## Compartilhando o conhecimento: LinkedIn vs. Dev.To

Ao tomar gosto pela escrita, decidi compartilhar minhas notas. Escrever para você mesmo é libertador, sem pressão por frequência, sem a necessidade de agradar a ninguém. Claro, não tem nenhum problema em querer escrever artigos com o intuito de ficar famoso, ou virar um "influencer", o único problema é que a maioria das pessoas vai se frustrar, afinal você precisa ter uma boa cadência de postagens, estar sempre interagindo com seu público, é claro tomar cuidado para não ser "cancelado".

Tentei inicialmente o [LinkedIn](https://www.linkedin.com/in/joaooliveira889/), mas a experiência foi ruim para conteúdos técnicos. A falta de suporte nativo ao Markdown torna a formatação de códigos um processo penoso. Funciona bem para textos curtos ou relatos de experiência, mas para códigos, deixa a desejar.

Resolvi testar então a plataforma [Dev.To](https://dev.to/joaooliveiratech), é de cara já gostei muito porque os post são escritos nativamente com Markdown, (bastou um "copiar e colar" das minhas notas). A plataforma oferece um bom dashboard de métricas e gera um engajamento orgânico interessante. Pretendo continuar usando o Dev.To para artigos técnicos em inglês, visando melhorar meu vocabulário e soft skills.

No entanto, este blog pessoal será em português. Quero aprimorar minha comunicação nativa e manter meu "segundo cérebro" acessível na minha língua materna.

## Blog Engine Hugo com Hextra

Foi então que lendo justamente um post no blog do [Akita](https://akitaonrails.com/2025/09/10/meu-novo-blog-como-eu-fiz/), sobre o seu novo blog, que conheci a ferramenta perfeita para o meu propósito o [Hugo](https://gohugo.io). Ele é um gerador de sites estáticos que transforma Markdown em HTML. Usei o tema Hextra pela simplicidade e recursos como busca poderosa e tags.

### Instalação e Configuração rápida

Seguindo a premissa de "primeiro faça, depois melhore", a instalação foi simples. No macOS, via Homebrew (outros sistemas só conferir a [documentação oficial](https://imfing.github.io/hextra/docs/getting-started/))

``` bash
brew install hugo
```

Para criar o site e configurar o tema

``` bash
hugo new site myblog --format=yaml
```

Na pasta onde criou seu blog, faça a Inicialização do Hextra theme

``` bash
cd myblog
hugo mod init github.com/username/myblog
hugo mod get github.com/imfing/hextra
```

No arquivo hugo.yaml, basta adicionar o módulo

```yaml
module:
  imports:
    - path: github.com/imfing/hextra
```

Para criar o menu de navegação, após importar o hextra no hugo.yaml, adicione

```yaml
# Navigation Menu
menu:
  main:
    - name: About
      pageRef: /about
      weight: 1
    - name: Contact ↗
      url: ""
      weight: 2
    - name: Search
      weight: 3
      params:
        type: search
    - name: Rss
      weight: 4
      url: "/index.xml"
      params:
        icon: rss
```

Criando as primeiras páginas para test

```bash
hugo new content/_index.md
hugo new content/docs/_index.md
```

Para rodar o blog localmente, inicie o servidor do Hugo e acesse <http://localhost:1313>

```bash
hugo server --buildDrafts --disableFastRender
```

Se o comando executar sem erros, você verá o site carregado no navegador, como na imagem abaixo:
![My Blog](https://joaooliveirablog.s3.us-east-1.amazonaws.com/hugo_080650.webp)

Eu organizo os posts em `content/blog` por ano e mês (ex.: 2026/01). Assim eu consigo publicar rápido, manter o conteúdo organizado, e deixar o Hugo cuidar do index e da navegação entre as postagens.

O Hextra possui uma documentação muito completa com todas as opções de configuração. Você pode consultá-la aqui: [Guia de configuração do Hextra](https://imfing.github.io/hextra/docs/guide/configuration/).

Comandos extras
Para atualizar todos os módulos do Hugo no projeto para a versão mais recente:

``` bash
hugo mod get -u
```

Para atualizar apenas o tema Hextra para a versão mais recente:

``` bash
hugo mod get -u github.com/imfing/hextra
```

Opcionalmente, após atualizar, você pode garantir que o go.sum e dependências estejam consistentes:

``` bash
hugo mod tidy
```

## Deploy descomplicado com Netlify

Agora que está tudo configurado e rodando localmente, o próximo passo é fazer o deploy, eu decidir escolher a [Netlify](https://www.netlify.com). Já tinha visto muitos desenvolvedores elogiando a simplicidade do processo e, de fato, me surpreendi. Bastou subir o projeto no GitHub e conectar a conta. Em segundos, o blog estava online com uma URL temporária.

Para usar meu domínio próprio, configurei os registros DNS da seguinte forma

``` yaml
Registro A      @      75.2.60.5
Registro CNAME  www    joaooliveira.netlify.app
```

Em poucos segundos, o blog estava acessível em: <https://joaooliveira.net>

![Blog deployed on Netlify](https://joaooliveirablog.s3.us-east-1.amazonaws.com/joaooliveirablog_073632.webp)

## Conclusão

Alcancei o equilíbrio que buscava: um blog pessoal com baixo esforço de manutenção e alto controle do conteúdo. O foco agora é escrever, sem me perder em customizações infinitas. O combo Hugo + Hextra + Netlify entrega simplicidade agora e flexibilidade para o futuro.

## Links e Referências

### Projeto

* **[Repositório no GitHub](https://github.com/JoaoOliveira889/JoaoOliveiraBlog)**: Código-fonte, configurações e estrutura de pastas deste blog.

### Referências Úteis

* **[Meu novo blog: como eu fiz](https://akitaonrails.com/2025/09/10/meu-novo-blog-como-eu-fiz/)**: Artigo de Fabio Akita que serviu de inspiração para a escolha da *stack*.
* **[Documentação Oficial do Hextra](https://imfing.github.io/hextra/docs/getting-started/)**: Guia completo para configuração e customização do tema utilizado.