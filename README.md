# NutriAI — aplicação MVP

Aplicação web progressiva para registo alimentar, acompanhamento de hábitos e metas nutricionais.

## Executar localmente

1. Serve esta pasta por HTTP, por exemplo:

   `python -m http.server 8000`

2. Abre `http://localhost:8000/`.

## Funcionalidades nesta versão

- Perfil e objectivos guardados neste navegador.
- Registo manual de refeições, calorias e macronutrientes.
- Pesquisa de produtos embalados através do código de barras com Open Food Facts.
- Anexo de fotografia ao registo da refeição.
- Registo de água, peso, actividade física e jejum.
- Gráfico de evolução do peso, receitas, lista de compras e exportação JSON.
- Interface adaptável a telemóvel e instalável como PWA em alojamento HTTPS compatível.

## Limitações actuais

Este é um MVP local: não cria contas online, não sincroniza dados entre dispositivos e não tem base de dados na nuvem. Os dados ficam no armazenamento local do navegador. A fotografia é guardada como anexo, mas ainda não identifica automaticamente os alimentos nem calcula as calorias. Os valores nutricionais são introduzidos pela pessoa; confirma-os sempre com a embalagem ou com uma fonte de confiança.

A pesquisa de código de barras envia o código à Open Food Facts. O ditado por voz depende do suporte do navegador. Não estão incluídos pagamentos nem autenticação.

Antes de disponibilizar a clientes, falta integrar autenticação, sincronização segura, análise de imagens no servidor, pagamentos e documentação de privacidade/consentimento. Chaves de serviços externos nunca devem ser incluídas no código público do navegador.
