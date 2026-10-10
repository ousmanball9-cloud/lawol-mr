@echo off
REM Collecte auto LAWOL — appelee par les taches planifiees Windows.
cd /d D:\opencode\lawol-mr
python -X utf8 scripts\collecte_auto.py >> logs\collecte.log 2>&1
