# Segurança

Para reportar uma vulnerabilidade, use **Security → Report a vulnerability** no
GitHub quando o recurso estiver habilitado. Não publique credenciais ou dados
pessoais em issues; se esse canal não estiver disponível, peça um contato privado
ao mantenedor sem incluir os detalhes sensíveis.

O aplicativo não possui autenticação, backend, banco de usuários ou chave de API.
Cadastros manuais ficam somente no armazenamento do navegador. Backups exportados
devem ser tratados como arquivos do usuário e não enviados ao repositório.

Variáveis `VITE_*` são públicas no JavaScript compilado: nunca coloque segredos
nelas. Nenhum arquivo `.env` é necessário para executar este projeto.

Dev e preview escutam apenas em `127.0.0.1`. Para disponibilizar publicamente,
publique o build estático em HTTPS, com suporte a HTTP Range para PMTiles.
Não use o servidor de desenvolvimento como servidor público.

Execute `npm audit`, testes e revisão de dependências antes de atualizar versões.
O pipeline Python usa arquivos oficiais baixados pela internet e deve ser
executado em ambiente virtual. A auditoria automatizada complementa a revisão;
não constitui garantia de ausência de vulnerabilidades.
