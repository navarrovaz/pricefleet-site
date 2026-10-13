# PriceFleet — itens que ainda dependem do cliente

Na página, os pontos abaixo aparecem como chip tracejado `[validar…]` ou estão marcados com `data-validar`.
O botão flutuante **"Pontos a validar"** (canto inferior esquerdo) lista e destaca cada um. Remova o bloco
`data-review-tool` do HTML e a seção "FERRAMENTA DE REVISÃO" do CSS antes de publicar.

## Já resolvido com dados do site atual (pricefleet.com.br)
E-mail, telefone, WhatsApp, endereço, LinkedIn, Instagram, crédito à Rumo Soluções, os 3 posts reais do blog,
a lista de 15 clientes, "até 90% menos tempo de aprovação", "dezenas de locadoras", a parceria com a Audit LocOne,
o estudo de −3,3 p.p. da Reforma Tributária, as 8 etapas do processo, os indicadores (ROI, ROA, Yield, EBITDA)
e as respostas do FAQ sobre suporte e integrações.

## Pendente
| # | Item | Onde |
|---|---|---|
| 1 | Logo oficial em SVG. O do site atual (`https://www.pricefleet.com.br/logo.svg`, 2 KB) pode ser usado, aguardando autorização para baixar | Navbar, rodapé, mockups, favicon, símbolo `#logo-mark` |
| 2 | Arquivos de logo dos 15 clientes (hoje exibidos como nomes em texto, igual ao site atual) | Faixa "Empresas que confiam no PriceFleet" |
| 3 | 3 depoimentos reais: nome, cargo, empresa, logo, foto autorizada e 1 resultado numérico | Carrossel em Resultados |
| 4 | Valores do mockup do hero, do card da planilha, da simulação, do simulador da Reforma Tributária (18,4% → 15,1%) e dos painéis de Diferenciais (proposta, log, tabela de custos) são **ilustrativos** | Hero, Problema, Como funciona, Simulação, Reforma Tributária, Diferenciais |
| 5 | URL da área do cliente (botão "Entrar") | Navbar e menu mobile (hoje `href="#"`) |
| 6 | Páginas `/sobre`, `/politica-de-privacidade`, `/termos-de-uso`, `/lgpd` | Rodapé, formulário e banner de cookies |
| 7 | SLA de retorno ("em até 1 dia útil") | Tela de sucesso do formulário |
| 8 | Endpoint do formulário: preencher `data-endpoint` em `form[data-demo-form]` (POST JSON com nome, email, telefone, empresa, cargo, frota, origem, mensagem, consentimento). Sem endpoint, o envio é **simulado** | Modal de demonstração |

## Rastreamento (preencher no deploy de produção)
Os IDs ficam em `TRACKING`, no fim de `assets/js/main.js`. Nada é carregado antes de o visitante clicar em "Aceitar".
Deixei vazios para que os testes locais não poluam as métricas reais. IDs em uso hoje no site atual:

| Ferramenta | ID |
|---|---|
| Google Tag Manager | `GTM-TK2NPMZ4` |
| Google Analytics 4 | `G-VTK2YCNFZ5` |
| Google Ads | `AW-11373192632` |
| Meta Pixel | `757176157204105` |

Se o GTM já dispara GA4, Ads e Pixel, preencha só `gtm` para não contar em dobro.
O envio do formulário gera o evento `demo_request` no dataLayer e `Lead` no Pixel.

## Técnico
| # | Item |
|---|---|
| 9 | Domínio final em `canonical`, `og:url` e `og:image` |
| 10 | Regerar `assets/og/og-image.png` a partir de `assets/og/og.html` se o mockup mudar |
| 11 | Em produção: hospedar a Nunito Sans no próprio servidor e fazer preload do woff2 700 |
| 12 | Manter as URLs `/blog/...` ativas no novo site (os cards apontam para elas) |
