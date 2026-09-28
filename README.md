# LocalFood Web

Frontend web do LocalFood, uma plataforma de pedidos locais para escolas, empresas, fabricas, faculdades e outros ambientes fechados.

## O Que Este Frontend Faz

- Login com JWT usando a API LocalFood.
- Cadastro de cliente usando codigo de ambiente.
- Edicao de perfil com nome, e-mail, telefone, senha e foto.
- Vitrine de produtos do ambiente do usuario.
- Filtros por busca e categoria.
- Carrinho com produtos de um unico vendedor por pedido.
- Criacao de pedido com forma de pagamento e local combinado.
- Historico de pedidos do cliente.
- Painel do vendedor para ver pedidos recebidos.
- Atualizacao de status do pedido pelo vendedor.
- Cadastro, edicao, imagem, ativacao/pausa e remocao de produtos do vendedor.
- Painel admin para gerenciar usuarios, vendedores e categorias.
- Solicitacao de vendedor com aprovacao administrativa.
- Comparacao dos planos Basico, Pro e Institucional.
- Painel financeiro do vendedor com faturamento, comissoes e receita liquida.
- Central administrativa de monetizacao e pagamentos simulados.
- Solicitacoes completas de vendedor e de criacao de ambiente.
- Aprovacao de participantes em ambientes privados.
- Painel exclusivo da equipe TimeOut para ambientes e administradores.
- Notificacoes internas, linha do tempo e auditoria.

## Tecnologias

- React
- Vite
- Axios
- Lucide React
- CSS puro responsivo

## Antes De Rodar

O backend precisa estar ligado em:

```txt
http://localhost:3001/api/v1
```

No projeto da API, rode:

```bash
cd C:\FatecoinsGPT\local-food-api
npm run dev
```

Se a API estiver em outra porta, altere o arquivo `.env`.

## Instalar

```bash
cd C:\FatecoinsGPT\local-food-web
npm install
copy .env.example .env
```

O arquivo `.env` deve ficar assim:

```env
VITE_API_URL=http://localhost:3001/api/v1
```

## Rodar Em Desenvolvimento

```bash
npm run dev
```

Abra no navegador:

```txt
http://localhost:5173
```

## Contas De Teste

Essas contas sao criadas pelo seeder do backend:

```txt
Cliente: cliente@timeout.local
Vendedor pendente: pendente@timeout.local
Administrador do ambiente: admin.ambiente@timeout.local
Equipe TimeOut: platform@timeout.local

Senha comum: TimeOutDev#2026
```

Codigo do ambiente para novos cadastros:

```txt
SENAI2026
```

## Fluxo Para Testar

1. Entre como cliente.
2. Veja a vitrine de produtos.
3. Adicione Coxinha e Suco ao carrinho.
4. Envie o pedido e escolha o resultado simulado do pagamento.
5. Entre como administrador e aprove uma solicitacao de vendedor em "Acessos e aprovacoes".
6. Entre como vendedor e abra "Pedidos recebidos".
7. Atualize o pedido para aceito, preparando, pronto e entregue.
8. Confira a comissao confirmada na pagina "Financeiro".
9. Compare os planos e teste a troca entre Basico e Pro.
10. Entre como equipe TimeOut para analisar ambientes, transferir responsaveis e conferir a auditoria.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Estrutura

```txt
src/
  api.js        Configuracao do Axios e URL da API
  App.jsx       Telas, regras de interface e integracao com backend
  App.css       Layout principal do sistema
  index.css     Estilos globais
  main.jsx      Entrada do React
```

## Observacoes

- Todos os pagamentos desta fase sao simulados, aprovados automaticamente e nao movimentam dinheiro real.
- As mensalidades dos planos tambem sao simuladas.
- O vendedor e o cliente precisam estar no mesmo ambiente.
- O backend continua responsavel pelas regras importantes, como estoque, permissao e seguranca.
