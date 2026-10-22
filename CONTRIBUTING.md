# Contribuir

Siga a instalação do README. Para alterações de interface ou lógica, execute em
`frontend/`: `npm test`, `npx tsc -b` e, com os dados instalados, `npm run build`.

Os testes unitários não exigem o pacote nacional de dados. As validações completas
estão em [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

Não adicione CSVs originais, tiles, builds, credenciais ou backups pessoais ao Git.
Mantenha `package-lock.json` atualizado junto a `package.json`. Mudanças em dados
devem registrar fontes, ano, precisão e efeito sobre a cobertura. Valores ausentes
ou suprimidos nunca devem ser substituídos por zero.
