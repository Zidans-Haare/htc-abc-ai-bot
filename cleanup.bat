@echo off
echo Bereinige unnötige Dateien...

:: Temporäre und Debug-Dateien löschen
if exist error.txt del error.txt
if exist logo-test.js del logo-test.js  
if exist server.pid del server.pid
if exist dashboard.md del dashboard.md
if exist gemini.md del gemini.md

:: Dashboard-Bild löschen
if exist "public\dashboard\ChatGPT Image 4. Aug. 2025, 20_55_59.png" del "public\dashboard\ChatGPT Image 4. Aug. 2025, 20_55_59.png"

echo.
echo === MIGRATION SCRIPTS ===
echo Die folgenden Scripts können wahrscheinlich gelöscht werden:
echo (Prüfe vorher, ob sie noch benötigt werden!)
echo.
dir scripts\add_*.js
dir scripts\create_*.js  
dir scripts\fix_*.js
dir scripts\test_*.js
dir scripts\update_*.js
dir scripts\migration_*.js

echo.
echo Temporäre Dateien gelöscht!
echo Prüfe die Migration-Scripts manuell vor dem Löschen.