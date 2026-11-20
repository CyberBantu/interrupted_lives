@echo off
cd /d "%~dp0"
echo Iniciando Vidas Interrompidas - Rio de Janeiro...
start "" http://localhost:3000
node server.js
pause
