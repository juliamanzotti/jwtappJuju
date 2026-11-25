# Biblioteca Acadêmica

Front-end independente da [Biblioteca JWT API](../jwt-api/README.md), baseado no exemplo [ADS-Unipar/jwt-app](https://github.com/ADS-Unipar/jwt-app). Usa Next.js 16 e React 19.

## Instalação

Requisitos: Node.js 20 ou superior e npm. Inicie a API na porta 3000. Na pasta deste repositório:

```bash
npm install
cp .envex .env.local
npm run dev
```

No Windows, use `Copy-Item .envex .env.local`. Abra [http://localhost:3001](http://localhost:3001). A variável `NEXT_PUBLIC_API_URL` aponta para `http://localhost:3000/v1`. Se alterar a porta do front, atualize `FRONT_URL` na API.

## Telas

Há login com validação e erro, visão geral com indicadores do administrador, CRUD de categorias, autores, livros e leitores, filtros no acervo, histórico do leitor, empréstimos com devolução e multa, reservas em fila e cadastro e ativação de atendentes. O menu de administração só aparece para administrador; a API verifica o perfil em cada rota.

O access token fica em `sessionStorage`; ele é apagado ao fechar a aba. Esse armazenamento pode ser lido por JavaScript da página, portanto uma falha de XSS também poderia expor o token. O refresh token fica em cookie httpOnly emitido pela API, inacessível ao JavaScript. O cliente envia o cookie com `credentials: include`, renova o access token após 401 e repete a chamada. Requisições simultâneas compartilham uma única promessa de refresh. Se a renovação falhar, a sessão local é limpa e a pessoa volta ao login.

## Verificação

```bash
npm run build
npm run lint
```

Para ver a renovação em 30 segundos na apresentação, configure `ACCESS_TOKEN_TTL=30s` na API durante a gravação e restaure `15m` ao terminar.
