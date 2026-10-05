# NutriAI — aplicação MVP

Aplicação web progressiva para registo alimentar, acompanhamento de hábitos e metas nutricionais.

## Executar localmente

1. Instala as dependências com `npm install`.
2. Para usar a análise por IA fora da Vercel, define `AI_GATEWAY_API_KEY` apenas no ambiente do servidor.
3. Serve esta pasta por HTTP e abre `http://localhost:8000/`.

Em produção, a rota `/api/analyze-meal` usa o AI Gateway da Vercel. A chave nunca é incluída no JavaScript enviado ao navegador.

## Funcionalidades

- Perfil, refeições e metas guardados neste navegador.
- Análise automática da fotografia escolhida: identifica o prato, estima a porção e preenche calorias e macronutrientes.
- Estimativa nutricional por descrição escrita, através do botão «Estimar com IA».
- Preferência de idioma (Português de Portugal ou Português do Brasil) e país de referência (Portugal ou Brasil) no perfil. O padrão é Português de Portugal.
- Sistema local de gamificação com níveis, XP, desafios diários e conquistas por consistência.
- Painel de refeição inteligente com estimativa de calorias, porção, proteína, hidratos, gordura, ingredientes e confiança da análise.
- Pesquisa de produtos embalados pelo código de barras na Open Food Facts.
- Registo de água, peso, actividade física e jejum.
- Gráfico de evolução do peso, receitas, lista de compras, tema escuro e exportação JSON.
- Interface adaptável a telemóvel e instalável como PWA em alojamento HTTPS compatível.
- Página administrativa de pré-configuração em `/admin.html`; os indicadores ficam indisponíveis até ligar contas, dados centralizados e pagamentos.

## Como funciona a análise

A fotografia é redimensionada no dispositivo e enviada à rota de servidor `/api/analyze-meal`. Essa rota pede ao AI Gateway uma estimativa estruturada no idioma e com o país de referência escolhidos no perfil. O resultado preenche os campos do formulário; a pessoa pode rever e alterar os valores antes de guardar.

As quantidades e calorias estimadas a partir de uma imagem podem estar erradas, especialmente quando a porção ou os ingredientes não estão visíveis. Confirma os resultados. A fotografia é enviada ao serviço de IA para análise; os restantes registos continuam guardados localmente no navegador e não são sincronizados entre dispositivos.

Para testes locais, define `AI_GATEWAY_API_KEY` no servidor. Em produção na Vercel, o AI SDK pode autenticar pelo OIDC do projecto. Erros de créditos (HTTP 402) e de limite/quota (HTTP 429) são apresentados separadamente. O uso do modelo pode gerar custos no AI Gateway.

## Limitações

Este MVP não cria contas online, não tem base de dados na nuvem nem integra pagamentos. O XP e as conquistas ficam guardados localmente e não sincronizam entre dispositivos. O painel administrativo não apresenta contagens de utilizadores ou compras até haver fontes de dados reais. O ditado por voz depende do suporte do navegador. A NutriAI é uma ferramenta de registo e informação geral e não substitui aconselhamento de um profissional de saúde.
