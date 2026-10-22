@echo off
cd /d "%~dp0frontend"
if not exist "public\data\manifest.json" (
  echo Dados do mapa ausentes. Execute na raiz: python scripts/baixar_dados.py
  echo Consulte o README para acesso ao repositorio privado ou instalacao por ZIP.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run dev -- --open
