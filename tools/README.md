# Запись трейлера
1. `ROUND_SECONDS=60 PORT=10001 node apps/server/index.mjs` и клиент на :3000.
2. `node tools/record.mjs` — скрипт-игрок + 5 ботов играют матч, все пакеты сохраняются в JSON.
3. `node tools/replay.cjs config.json` — покадровый рендер записи в Chromium с виртуальным временем (30 fps).
4. `python3 tools/soundtrack.py` — музыка и звуки по событиям матча; затем ffmpeg.
