# BandPlan — аудит типографики и иконок

Дата: 2026-10-14. Этап 0: статический аудит без правок приложения. Ветка main.

## Краткий вывод
- Основные файлы: bandplan.css, bandplan-core.js, index.html, sw.js.
- CSS содержит 333 объявления font-size; много сырых px/pt, дробных значений и значений ниже целевого минимума 11px.
- Обнаружены сырые font-weight 650/750/800/850/900. Текущие --fw-med и --fw-semi оба равны 600.
- Есть множество сырых letter-spacing, border-radius и transition/easing значений.
- font-family:var(--mono) найдено 30 раз.
- Вызовов ic() найдено 169; размеры сейчас передаются числами (в том числе 11–22), а не ключами целевой шкалы.
- ICONS содержит grid и rows, но literal-вызовы ic('grid') / ic('rows') не найдены в bandplan-core.js. Это не доказывает неиспользуемость из-за динамических источников; перед удалением нужен grep по всему репозиторию.
- В UI присутствуют ✓, ♭ и ♯; также ×, стрелки и пунктуация. Emoji из основных emoji-диапазонов не выявлены.

## 1. Шрифты
- bandplan.css объявляет Manrope variable WOFF2 с разделением latin/cyrillic и font-display:swap.
- index.html preloads fonts/manrope-latin-wght-normal.woff2.
- Текущий стек: --font:'Manrope','Inter',system-ui,-apple-system,'Segoe UI',sans-serif; отдельно есть --font-2.
- В fonts/ лежат Manrope latin/cyrillic. Inter variable latin+cyrillic пока не обнаружен.
- Основные токены сейчас: --fs-display:56px, --fs-h1:44px, --fs-h2:32px, --fs-h3:22px, --fs-body-l:18px, --fs-body:16px, --fs-body-s:14px, --fs-caption:12px.
- Веса: --fw-reg:400, --fw-med:600, --fw-semi:600, --fw-bold:700. Требуется развести medium/semi.
- Необходимо перейти к HIG-шкале и rem постепенно, проверить html font-size/media overrides, fallback metrics и CLS.

### Все места с font-family:var(--mono)
bandplan.css:122 — (--lh)}.t-xs{font-size:var(--fs-caption);line-height:1.45} .mono{font-family:var(--mono)} .nowrap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis
bandplan.css:125 — -cap);color:var(--muted)} .num{font-variant-numeric:tabular-nums;font-family:var(--mono)}  /* ─── 4. LAYOUT ───────────────────────────────────────────────
bandplan.css:186 — h-cancel-button{-webkit-appearance:none;appearance:none} .tb-kbd{font-family:var(--mono);font-size:10.5px;color:var(--muted);background:var(--surf-3);borde
bandplan.css:216 — white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .sd-k{font-family:var(--mono);font-size:11px;font-weight:var(--fw-bold);color:var(--accent);back
bandplan.css:221 — s2);font-size:11px;color:var(--muted);flex-wrap:wrap} .sd-foot b{font-family:var(--mono);background:var(--surf-3);border:1px solid var(--border);padding:1p
bandplan.css:308 — font-weight:var(--fw-bold);letter-spacing:-.03em;line-height:1.1;font-family:var(--mono);color:var(--text)} .hero-metric .l{font-size:var(--fs-caption);col
bandplan.css:334 — 5;cursor:not-allowed} .textarea{min-height:112px;resize:vertical;font-family:var(--mono);line-height:1.75;font-size:16px;font-weight:var(--fw-reg)} .select
bandplan.css:466 — (--text-2);display:flex;align-items:center;gap:6px;padding:0 2px;font-family:var(--mono)} .cal-cell.today .cal-num{color:var(--accent);font-weight:var(--fw
bandplan.css:492 — -fw-bold);letter-spacing:-.02em;margin-top:2px;color:var(--text);font-family:var(--mono)} .tg-hc.now b{color:var(--accent)} .tg-times{position:sticky;left:
bandplan.css:495 — );text-align:right;padding:2px 8px 0 0;font-weight:var(--fw-med);font-family:var(--mono)} .tg-col{position:relative;border-left:1px solid var(--border);min
bandplan.css:504 — lipsis} .tg-ev span{color:var(--muted);font-weight:var(--fw-med);font-family:var(--mono)} .tg-nowline{position:absolute;left:0;right:0;height:2px;backgroun
bandplan.css:514 — );font-weight:var(--fw-bold);line-height:1;letter-spacing:-.04em;font-family:var(--mono);color:var(--text)} .ev-date .m{font-size:10.5px;color:var(--muted)
bandplan.css:548 — ar(--fw-bold);font-size:13.5px;border:1px solid var(--border);   font-family:var(--mono);box-shadow:0 1px 2px var(--raw-color-121)}  .song-title-wrap{flex:
bandplan.css:562 — );background:var(--warn-bg)} .fav.on{color:var(--warn)}  .lyrics{font-family:var(--mono);font-size:var(--lsize);line-height:2.05;white-space:pre;background
bandplan.css:571 — ign:center;font-weight:var(--fw-bold);font-size:var(--fs-body-l);font-family:var(--mono);letter-spacing:-.02em} .info-row{display:flex;justify-content:spac
bandplan.css:584 — yn-chip .v{font-size:var(--fs-body-l);font-weight:var(--fw-bold);font-family:var(--mono);margin-top:var(--s1);letter-spacing:-.03em} .d0 .v{color:var(--mut
bandplan.css:595 — e-block;min-width:34px;padding:3px 8px;border-radius:var(--r-10);font-family:var(--mono);   font-weight:var(--fw-bold);font-size:11.5px;background:var(--su
bandplan.css:605 — ell select{padding:8px 28px 8px 10px;font-size:var(--fs-caption);font-family:var(--mono);font-weight:var(--fw-bold);   border-radius:var(--r-10);min-height
bandplan.css:616 — ght:var(--fw-bold);font-size:12px;border:1px solid var(--border);font-family:var(--mono)} .sl-info{flex:1;min-width:0} .sl-name{font-weight:var(--fw-bold);
bandplan.css:630 — --shadow-1)} .mini-stepper span{min-width:30px;text-align:center;font-family:var(--mono);font-size:11.5px;font-weight:var(--fw-bold);color:var(--text)} .li
bandplan.css:635 — background:var(--accent-soft);color:var(--accent)} .lib-item .lk{font-family:var(--mono);font-size:11px;font-weight:var(--fw-bold);color:var(--text-2);back
bandplan.css:644 — ar(--fs-body-l);font-weight:var(--fw-bold);letter-spacing:-.03em;font-family:var(--mono)} .stat-mini .l{font-size:var(--fs-caption);color:var(--muted);font
bandplan.css:758 — op:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono)} #scene .sbtn{width:44px;height:44px;border-radius:12px;background
bandplan.css:760 — ap;border:1px solid var(--raw-color-123)}#scene .scene-dyn .dc b{font-family:var(--mono);font-size:13.5px;color:var(--raw-color-127);font-weight:var(--fw-b
bandplan.css:761 — ne-body{flex:1;min-height:0;overflow-y:auto;padding:var(--s8) 6%;font-family:var(--mono);white-space:pre-wrap;line-height:2.05;font-size:var(--scsize,26px)
bandplan.css:762 — 29);opacity:1}#scene .sctl span{min-width:38px;text-align:center;font-family:var(--mono);font-size:11.5px;font-weight:var(--fw-bold);color:var(--raw-color-
bandplan.css:963 — e:10pt;color:var(--text-2);margin-bottom:10px}   .print-song pre{font-family:var(--mono);font-size:10.5pt;line-height:1.8;white-space:pre-wrap}   .print-ar
bandplan.css:996 — 2);margin-bottom:14px}.account-name{font-weight:700}.friend-code{font-family:var(--mono);letter-spacing:.08em}.friend-tools{margin-bottom:14px}.friends-lis
bandplan.css:5458 —   border: 1px solid var(--border) !important; }  .lyrics .ch {   font-family: var(--mono) !important;   color: var(--accent) !important;   font-weight: 800
bandplan.css:9669 — r: var(--accent) !important;   background: var(--accent-ring);   font-family: var(--mono);   font-size: 1.04em;   font-weight: 900 !important;   line-heigh

## 2. Иконки
### Все вызовы ic() и текущие размеры
bandplan-core.js:54 — ic('alert', 24)
bandplan-core.js:192 — ic(n, s)
bandplan-core.js:679 — ic('download', 13)
bandplan-core.js:778 — ic('clock', 12)
bandplan-core.js:972 — ic('clock', 12)
bandplan-core.js:1116 — ic(TOAST_ICONS[t] || 'info', 18)
bandplan-core.js:1117 — ic('x', 15)
bandplan-core.js:1213 — ic('x', 18)
bandplan-core.js:1215 — ic('info', 14)
bandplan-core.js:1281 — ic('alert', 13)
bandplan-core.js:1351 — ic(n.i, 19)
bandplan-core.js:1354 — ic(n.i, 21)
bandplan-core.js:1363 — ic(nextTheme.icon, 18)
bandplan-core.js:1367 — ic('monitor', 18)
bandplan-core.js:1368 — ic('left', 20)
bandplan-core.js:1369 — ic('x', 20)
bandplan-core.js:1370 — ic('right', 20)
bandplan-core.js:1371 — ic('fs', 19)
bandplan-core.js:1372 — ic(scene.auto ? 'pause' : 'play', 19)
bandplan-core.js:1380 — ic(icons[kind] || 'inbox', 24)
bandplan-core.js:1420 — ic('target', 17)
bandplan-core.js:1420 — ic('plus', 17)
bandplan-core.js:1424 — ic('right', 12)
bandplan-core.js:1425 — ic('edit', 17)
bandplan-core.js:1428 — ic('right', 12)
bandplan-core.js:1429 — ic('monitor', 17)
bandplan-core.js:1431 — ic('dl', 17)
bandplan-core.js:1515 — ic('calendar', 17)
bandplan-core.js:1515 — ic('plus', 17)
bandplan-core.js:1516 — ic('monitor', 17)
bandplan-core.js:1525 — ic('left', 18)
bandplan-core.js:1527 — ic('right', 18)
bandplan-core.js:1531 — ic(v[2], 14)
bandplan-core.js:1540 — ic('search', 18)
bandplan-core.js:1543 — ic('x', 15)
bandplan-core.js:1544 — ic('filter', 17)
bandplan-core.js:1546 — ic('search', 13)
bandplan-core.js:1554 — ic('plus', 15)
bandplan-core.js:1587 — ic(EV_TYPES[t].ic, 14)
bandplan-core.js:1589 — ic('target', 14)
bandplan-core.js:1591 — ic('repeat', 14)
bandplan-core.js:1611 — ic(t.ic, 12)
bandplan-core.js:1619 — ic('plus', 16)
bandplan-core.js:1649 — ic(type.ic, 12)
bandplan-core.js:1666 — ic('plus', 15)
bandplan-core.js:1714 — ic('plus', 15)
bandplan-core.js:1726 — ic(t.ic, 11)
bandplan-core.js:1727 — ic('repeat', 11)
bandplan-core.js:1728 — ic('check', 11)
bandplan-core.js:1731 — ic('clock', 12)
bandplan-core.js:1732 — ic('pin', 12)
bandplan-core.js:1733 — ic('bolt', 12)
bandplan-core.js:1734 — ic('list', 12)
bandplan-core.js:1739 — ic('monitor', 16)
bandplan-core.js:1740 — ic('edit', 16)
bandplan-core.js:1741 — ic('repeat', 16)
bandplan-core.js:1742 — ic('check', 16)
bandplan-core.js:1743 — ic('trash', 16)
bandplan-core.js:1772 — ic('search', 18)
bandplan-core.js:1774 — ic('x', 15)
bandplan-core.js:1776 — ic('filter', 17)
bandplan-core.js:1777 — ic('plus', 17)
bandplan-core.js:1782 — ic('search', 13)
bandplan-core.js:1785 — ic('star', 13)
bandplan-core.js:1795 — ic('plus', 17)
bandplan-core.js:1806 — ic('star', 18)
bandplan-core.js:1811 — ic('clock', 11)
bandplan-core.js:1815 — ic('print', 15)
bandplan-core.js:1816 — ic('monitor', 15)
bandplan-core.js:1818 — ic('list', 15)
bandplan-core.js:1838 — ic('star', 14)
bandplan-core.js:1998 — ic('star', 17)
bandplan-core.js:1999 — ic('trash', 17)
bandplan-core.js:2000 — ic('print', 17)
bandplan-core.js:2009 — ic('music', 14)
bandplan-core.js:2014 — ic('wave', 17)
bandplan-core.js:2016 — ic('edit', 16)
bandplan-core.js:2019 — ic('monitor', 16)
bandplan-core.js:2020 — ic('list', 16)
bandplan-core.js:2040 — ic('search', 18)
bandplan-core.js:2043 — ic('x', 15)
bandplan-core.js:2045 — ic('plus', 17)
bandplan-core.js:2056 — ic('plus', 17)
bandplan-core.js:2057 — ic('plus', 17)
bandplan-core.js:2072 — ic('print', 16)
bandplan-core.js:2073 — ic('copy', 16)
bandplan-core.js:2074 — ic('trash', 16)
bandplan-core.js:2075 — ic('monitor', 15)
bandplan-core.js:2097 — ic('edit', 16)
bandplan-core.js:2098 — ic('trash', 16)
bandplan-core.js:2099 — ic('print', 16)
bandplan-core.js:2100 — ic('copy', 16)
bandplan-core.js:2105 — ic('clock', 11)
bandplan-core.js:2106 — ic('calendar', 11)
bandplan-core.js:2108 — ic('monitor', 16)
bandplan-core.js:2111 — ic('search', 17)
bandplan-core.js:2127 — ic('plus', 15)
bandplan-core.js:2140 — ic('x', 16)
bandplan-core.js:2144 — ic('grip', 18)
bandplan-core.js:2157 — ic('up', 16)
bandplan-core.js:2158 — ic('down', 16)
bandplan-core.js:2159 — ic('edit', 16)
bandplan-core.js:2160 — ic('x', 16)
bandplan-core.js:2166 — ic('clock', 11)
bandplan-core.js:2234 — ic('chevronDown', 16)
bandplan-core.js:2236 — ic('check', 14)
bandplan-core.js:2236 — ic(r.icon, 14)
bandplan-core.js:2241 — ic('x', 16)
bandplan-core.js:2242 — ic('userX', 16)
bandplan-core.js:2250 — ic('link', 16)
bandplan-core.js:2250 — ic('users', 16)
bandplan-core.js:2262 — ic('edit', 15)
bandplan-core.js:2262 — ic('trash', 15)
bandplan-core.js:2266 — ic('x', 16)
bandplan-core.js:2270 — ic('palette', 18)
bandplan-core.js:2273 — ic(t.icon, 14)
bandplan-core.js:2275 — ic('chevronDown', 15)
bandplan-core.js:2277 — ic('check', 14)
bandplan-core.js:2294 — ic('dl', 16)
bandplan-core.js:2297 — ic('music', 17)
bandplan-core.js:2298 — ic('calendar', 17)
bandplan-core.js:2299 — ic('list', 17)
bandplan-core.js:2300 — ic('users', 17)
bandplan-core.js:2303 — ic('dl', 16)
bandplan-core.js:2303 — ic('ul', 16)
bandplan-core.js:2313 — ic('refresh', 16)
bandplan-core.js:2313 — ic('trash', 16)
bandplan-core.js:2315 — ic('trash', 16)
bandplan-core.js:2376 — ic(t.ic, 12)
bandplan-core.js:2377 — ic('check', 11)
bandplan-core.js:2378 — ic('repeat', 11)
bandplan-core.js:2402 — ic('monitor', 16)
bandplan-core.js:2404 — ic('edit', 16)
bandplan-core.js:2413 — ic(EV_TYPES[k].ic, 14)
bandplan-core.js:2440 — ic('check', 16)
bandplan-core.js:2484 — ic('wave', 16)
bandplan-core.js:2489 — ic('check', 16)
bandplan-core.js:2501 — ic('music', 16)
bandplan-core.js:2505 — ic('x', 14)
bandplan-core.js:2508 — ic('plus', 15)
bandplan-core.js:2547 — ic('check', 16)
bandplan-core.js:2557 — ic(r.icon, 13)
bandplan-core.js:2558 — ic('check', 16)
bandplan-core.js:2572 — ic('list', 16)
bandplan-core.js:2574 — ic('plus', 16)
bandplan-core.js:2625 — ic(v ? 'pause' : 'play', 19)
bandplan-core.js:2721 — ic('search', 22)
bandplan-core.js:2727 — ic(r.icon, 17)
bandplan-core.js:2813 — ic('mic', 28)
bandplan-core.js:2817 — ic(r.icon, 13)
bandplan-core.js:2822 — ic('users', 28)
bandplan-core.js:2827 — ic('check', 14)
bandplan-core.js:2829 — ic('wave', 28)
bandplan-core.js:2833 — ic('check', 28)
bandplan-core.js:2836 — ic(t.icon, 14)
bandplan-core.js:2838 — ic('left', 16)
bandplan-core.js:2839 — ic('right', 16)
bandplan-core.js:2839 — ic('check', 16)
bandplan-core.js:2868 — ic('alert', 13)
bandplan-core.js:2877 — ic('x', 15)
bandplan-core.js:3030 — ic('check', 17)
bandplan-core.js:3032 — ic('check', 16)
bandplan-core.js:3036 — ic('check', 16)
bandplan-core.js:3038 — ic('check', 16)
bandplan-core.js:3043 — ic('check', 16)
bandplan-core.js:3511 — ic('copy', 16)
bandplan-core.js:3845 — ic(icons[kind] || 'info', 15)
bandplan-core.js:3859 — ic('wifiOff', 16)
bandplan-core.js:3865 — ic('alert', 16)

### Определения ICONS
Имена иконок: calendar, music, list, gear, plus, filter, sun, moon, play, trash, edit, star, print, x, up, clock, pin, users, monitor, dl, check, checkCircle, alert, info, wifiOff, grip, mic, repeat, copy, bolt, fs, link, wave, grid, rows, target, palette, sparkles, inbox, chevronDown, userX.

Размеры вызовов варьируются от 11 до 28 и включают промежуточные значения, не входящие в целевую шкалу 14/16/18/20/24/28. Есть вызовы с динамическими именами/размерами; нужно сохранить совместимость.

## 3. Символы и иконки
- ✓ используется как символ состояния участия в bandplan-core.js.
- ♭ и ♯ используются в кнопках транспонирования в деталях песни и режиме сцены.
- × используется в закрытии уведомлений и очистке фильтров/чипов; стрелки встречаются в подсказках клавиатуры.
- Не каждый символ пунктуации нужно менять. Заменять только самостоятельные UI-иконки, сохраняя aria-label и доступность.
- grid и rows есть в ICONS; literal-вызовы не обнаружены. Проверить grep по всем исходникам и динамическим конфигурациям перед удалением.

## 4. Радиусы, интервалы, анимации
- Текущие токены радиусов включают --r-8, --r-10, --r-12, --r-14, --r-16, --r-18, --r-24 и --r-pill, плюс многочисленные сырые значения.
- Существуют --shadow-1/2/3 и дополнительные варианты. Нужно сохранить claymorphism и не добавлять Liquid Glass.
- Отступы частично токенизированы через --s1…--s6 и --s8/--s10/--s12/--s16, но остаются прямые px.
- CSS использует @layer tokens,base,components,screens,utilities. Не переписывать каскад массово.

## 5. Проверки
- package.json не объявляет script test; есть build, tests/smoke.mjs, tests/design-contrast.mjs и tests/component-contrast.mjs.
- На этапе 0 тесты и Lighthouse не запускались, скриншоты до изменений не снимались. Это статический аудит, а не подтверждение прохождения контрастности или CLS.

## 6. Порядок работы
1. Этап 1 — шрифты и типографика; проверить/добавить Inter variable latin+cyrillic, обновить preload и cache только в соответствующем этапе.
2. Этап 2 — SVG-иконки: шкала размеров, толщина штриха, filled нижней навигации, замена символов; не удалять иконки до grep.
3. Этап 3 — радиусы, clay-тени, motion, spacing, focus/pressed/disabled, safe areas.
4. После каждого этапа показать изменённые файлы и результаты, остановиться и ждать «дальше».