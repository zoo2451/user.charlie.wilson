// Sudoku for chromegame.html: expert puzzles only.
//
// Each puzzle is generated fresh: build a random solved grid, then remove
// numbers one by one, keeping a removal only if the puzzle still has exactly
// one solution. A puzzle counts as "expert" when it has few starting numbers
// AND can't be finished using only the easy techniques (naked/hidden singles).
(function() {
    const EXPERT_MAX_CLUES = 24;
    const GENERATE_TIME_MS = 1500; // keep trying for a harder puzzle this long
    const MAX_MISTAKES = 3;
    const SAVE_KEY = 'sudokuGame';

    //////////////////////////
    // Grid helpers         //
    //////////////////////////
    const ROW = [], COL = [], BOX = [], PEERS = [];
    for (let i = 0; i < 81; i++) {
        ROW[i] = Math.floor(i / 9);
        COL[i] = i % 9;
        BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
    }
    for (let i = 0; i < 81; i++) {
        PEERS[i] = [];
        for (let j = 0; j < 81; j++) {
            if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) {
                PEERS[i].push(j);
            }
        }
    }
    // The 27 units (rows, columns, boxes) as lists of cell indexes
    const UNITS = [];
    for (let u = 0; u < 9; u++) {
        UNITS.push([...Array(81).keys()].filter(i => ROW[i] === u));
        UNITS.push([...Array(81).keys()].filter(i => COL[i] === u));
        UNITS.push([...Array(81).keys()].filter(i => BOX[i] === u));
    }

    const ALL = 0x3FE; // bits 1..9 set
    const bit = n => 1 << n;
    function popcount(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Count solutions (stops at `limit`). If `randomFill` is set, fills `grid`
    // in place with the first solution found, trying digits in random order.
    function solve(grid, limit, randomFill) {
        const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
        for (let i = 0; i < 81; i++) {
            const v = grid[i];
            if (v) {
                const b = bit(v);
                if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return 0; // contradiction
                rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
            }
        }
        let count = 0;
        function search() {
            // Pick the empty cell with the fewest options
            let best = -1, bestMask = 0, bestCount = 10;
            for (let i = 0; i < 81; i++) {
                if (grid[i]) continue;
                const mask = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
                const c = popcount(mask);
                if (c < bestCount) {
                    best = i; bestMask = mask; bestCount = c;
                    if (c <= 1) break;
                }
            }
            if (best === -1) { count++; return count >= limit; }
            if (bestCount === 0) return false;
            let digits = [];
            for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) digits.push(d);
            if (randomFill) shuffle(digits);
            for (const d of digits) {
                const b = bit(d);
                grid[best] = d;
                rows[ROW[best]] |= b; cols[COL[best]] |= b; boxes[BOX[best]] |= b;
                if (search()) return true;
                rows[ROW[best]] &= ~b; cols[COL[best]] &= ~b; boxes[BOX[best]] &= ~b;
            }
            grid[best] = 0;
            return false;
        }
        search();
        return count;
    }

    // Can the puzzle be finished with only naked and hidden singles?
    function solvableWithSingles(puzzle) {
        const g = puzzle.slice();
        let progress = true;
        while (progress) {
            progress = false;
            const cand = new Array(81).fill(0);
            for (let i = 0; i < 81; i++) {
                if (g[i]) continue;
                let m = ALL;
                for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
                if (!m) return false;
                cand[i] = m;
                if (popcount(m) === 1) { // naked single
                    g[i] = Math.log2(m);
                    progress = true;
                }
            }
            if (progress) continue;
            for (const unit of UNITS) { // hidden single
                for (let d = 1; d <= 9; d++) {
                    const spots = unit.filter(i => !g[i] && (cand[i] & bit(d)));
                    if (spots.length === 1 && !unit.some(i => g[i] === d)) {
                        g[spots[0]] = d;
                        progress = true;
                    }
                }
            }
        }
        return g.every(v => v);
    }

    function makePuzzle() {
        const solution = new Array(81).fill(0);
        solve(solution, 1, true);
        const puzzle = solution.slice();
        for (const i of shuffle([...Array(81).keys()])) {
            const keep = puzzle[i];
            puzzle[i] = 0;
            if (solve(puzzle.slice(), 2, false) !== 1) puzzle[i] = keep;
        }
        const clues = puzzle.filter(v => v).length;
        return { puzzle, solution, clues, hard: !solvableWithSingles(puzzle) };
    }

    // Keep generating until we get a real expert puzzle (or run out of time,
    // in which case use the hardest one found).
    function makeExpertPuzzle() {
        const start = performance.now();
        let best = null;
        do {
            const p = makePuzzle();
            const score = (p.hard ? 0 : 100) + p.clues;
            if (!best || score < best.score) best = { ...p, score };
            if (p.hard && p.clues <= EXPERT_MAX_CLUES) break;
        } while (performance.now() - start < GENERATE_TIME_MS);
        return best;
    }

    //////////////////////////
    // Page elements        //
    //////////////////////////
    const screens = {
        menu: document.getElementById('sudokuMenu'),
        game: document.getElementById('sudokuGame'),
        loading: document.getElementById('sudokuLoading'),
        records: document.getElementById('sudokuRecords')
    };
    const boardEl = document.getElementById('sudokuBoard');
    const padEl = document.getElementById('sudokuPad');
    const timerEl = document.getElementById('sudokuTimer');
    const mistakesEl = document.getElementById('sudokuMistakes');
    const notesBtn = document.getElementById('sudokuNotes');
    const overlay = document.getElementById('sudokuOverlay');
    const overlayTitle = document.getElementById('sudokuOverlayTitle');
    const overlayText = document.getElementById('sudokuOverlayText');
    const continueBtn = document.getElementById('menuContinue');
    const howTo = document.getElementById('sudokuHowTo');
    if (!boardEl) return;

    function showScreen(name) {
        Object.keys(screens).forEach(k => screens[k].classList.toggle('active', k === name));
    }

    // Board cells and number pad
    const cells = [];
    for (let i = 0; i < 81; i++) {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.setAttribute('role', 'gridcell');
        cell.addEventListener('pointerdown', () => select(i));
        boardEl.appendChild(cell);
        cells.push(cell);
    }
    const padButtons = [];
    for (let d = 1; d <= 9; d++) {
        const b = document.createElement('button');
        b.textContent = d;
        b.addEventListener('click', () => enter(d));
        padEl.appendChild(b);
        padButtons.push(b);
    }

    //////////////////////////
    // Game state           //
    //////////////////////////
    let game = null;       // { puzzle, solution, values, notes, mistakes, seconds, over }
    let selected = -1;
    let notesMode = false;
    let timerId = null;

    function save() {
        try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) {}
    }
    function load() {
        try { return JSON.parse(sessionStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
    }
    function clearSave() {
        try { sessionStorage.removeItem(SAVE_KEY); } catch (e) {}
    }

    function formatTime(s) {
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function startTimer() {
        stopTimer();
        timerId = setInterval(() => {
            if (!game || game.over) return;
            game.seconds++;
            timerEl.textContent = formatTime(game.seconds);
            if (game.seconds % 5 === 0) save();
        }, 1000);
    }
    function stopTimer() {
        if (timerId) clearInterval(timerId);
        timerId = null;
    }

    function newGame() {
        overlay.hidden = true;
        showScreen('loading');
        // Let the "Generating..." screen draw before the heavy work starts
        setTimeout(() => {
            const p = makeExpertPuzzle();
            game = {
                puzzle: p.puzzle,
                solution: p.solution,
                values: p.puzzle.slice(),
                notes: new Array(81).fill(0),
                mistakes: 0,
                seconds: 0,
                over: false
            };
            selected = -1;
            save();
            beginPlaying();
        }, 600);
    }

    function beginPlaying() {
        notesMode = false;
        
        notesBtn.classList.remove('on');
        overlay.hidden = !game.over;
        timerEl.textContent = formatTime(game.seconds);
        render();
        showScreen('game');
        startTimer();
    }

    function goToMenu() {
        stopTimer();
        if (game) save();
        continueBtn.hidden = !(game && !game.over);
        showScreen('menu');
    }

    //////////////////////////
    // Playing              //
    //////////////////////////
    function select(i) {
        if (!game || game.over) return;
        selected = i;
        render();
    }

    function enter(d) {
        if (!game || game.over || selected < 0) return;
        const i = selected;
        if (game.puzzle[i]) return;                         // starting number
        if (game.values[i] === game.solution[i]) return;    // already correct

        if (notesMode) {
            if (game.values[i]) return;
            game.notes[i] ^= bit(d);
        } else {
            game.values[i] = d;
            game.notes[i] = 0;
            if (d === game.solution[i]) {
                // Clear this number from notes in the same row, column and box
                PEERS[i].forEach(p => { game.notes[p] &= ~bit(d); });
            } else {
                game.mistakes++;
            }
        }
        checkEnd();
        save();
        render();
    }

    function erase() {
        if (!game || game.over || selected < 0) return;
        const i = selected;
        if (game.puzzle[i] || game.values[i] === game.solution[i]) return;
        game.values[i] = 0;
        game.notes[i] = 0;
        save();
        render();
    }

    function checkEnd() {
        if (game.mistakes >= MAX_MISTAKES) {
            game.over = true;
            stopTimer();
            recordGame('lost');
            showOverlay('GAME OVER', 'Three mistakes. Better luck on the next one.');
        } else if (game.values.every((v, i) => v === game.solution[i])) {
            game.over = true;
            stopTimer();
            const previousBest = bestTime(loadHistory());
            recordGame('solved');
            const isBest = previousBest === null || game.seconds < previousBest;
            showOverlay('SOLVED', 'Expert puzzle finished in ' + formatTime(game.seconds) +
                ' with ' + game.mistakes + (game.mistakes === 1 ? ' mistake.' : ' mistakes.') +
                (isBest ? ' New best time!' : ''));
        }
    }

    //////////////////////////
    // Records              //
    //////////////////////////
    // Every finished game (solved or game over) is kept in localStorage, so the
    // archive stays in this browser after the tab is closed. Abandoned games
    // aren't counted. Newest first, capped so storage can't grow forever.
    const HISTORY_KEY = 'sudokuHistory';
    const HISTORY_LIMIT = 500;

    function loadHistory() {
        try {
            const h = JSON.parse(localStorage.getItem(HISTORY_KEY));
            return Array.isArray(h) ? h : [];
        } catch (e) { return []; }
    }

    function saveHistory(history) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
    }

    function recordGame(result) {
        const history = loadHistory();
        history.unshift({
            date: new Date().toISOString(),
            result,                          // 'solved' or 'lost'
            seconds: game.seconds,
            mistakes: game.mistakes,
            clues: game.puzzle.filter(v => v).length
        });
        saveHistory(history.slice(0, HISTORY_LIMIT));
    }

    function bestTime(history) {
        const times = history.filter(g => g.result === 'solved').map(g => g.seconds);
        return times.length ? Math.min(...times) : null;
    }

    const recordsSummary = document.getElementById('recordsSummary');
    const recordsBody = document.getElementById('recordsBody');
    const recordsEmpty = document.getElementById('recordsEmpty');
    const clearBtn = document.getElementById('recordsClear');
    let clearArmed = false; // "Clear Records" needs a second click to confirm

    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function renderRecords() {
        const history = loadHistory();
        const solved = history.filter(g => g.result === 'solved');
        const best = bestTime(history);
        const avg = solved.length
            ? Math.round(solved.reduce((sum, g) => sum + g.seconds, 0) / solved.length)
            : null;

        const stats = [
            ['Played', history.length],
            ['Solved', solved.length],
            ['Win rate', history.length ? Math.round(solved.length / history.length * 100) + '%' : '-'],
            ['Best time', best === null ? '-' : formatTime(best)],
            ['Average time', avg === null ? '-' : formatTime(avg)]
        ];
        recordsSummary.innerHTML = '';
        stats.forEach(([label, value]) => {
            const box = document.createElement('div');
            box.className = 'sudoku-records-stat';
            const v = document.createElement('div');
            v.className = 'sudoku-records-stat-value';
            v.textContent = value;
            const l = document.createElement('div');
            l.className = 'sudoku-stat-label';
            l.textContent = label;
            box.appendChild(v);
            box.appendChild(l);
            recordsSummary.appendChild(box);
        });

        recordsBody.innerHTML = '';
        history.forEach((g, index) => {
            const tr = document.createElement('tr');
            if (g.result === 'solved' && g.seconds === best) tr.className = 'best';
            [
                history.length - index,
                formatDate(g.date),
                g.result === 'solved' ? 'Solved' : 'Game over',
                formatTime(g.seconds),
                g.mistakes + '/' + MAX_MISTAKES
            ].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                tr.appendChild(td);
            });
            if (g.result !== 'solved') tr.classList.add('lost');
            recordsBody.appendChild(tr);
        });
        recordsEmpty.hidden = history.length > 0;
        clearBtn.disabled = history.length === 0;
    }

    function showRecords() {
        clearArmed = false;
        clearBtn.textContent = 'Clear Records';
        renderRecords();
        showScreen('records');
    }

    function clearRecords() {
        if (!clearArmed) {
            clearArmed = true;
            clearBtn.textContent = 'Click again to clear';
            return;
        }
        try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
        clearArmed = false;
        clearBtn.textContent = 'Clear Records';
        renderRecords();
    }

    function showOverlay(title, text) {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlay.hidden = false;
    }

    function render() {
        const selValue = selected >= 0 ? game.values[selected] : 0;
        const counts = new Array(10).fill(0);

        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            const v = game.values[i];
            const correct = v && v === game.solution[i];
            if (correct) counts[v]++;

            cell.className = 'sudoku-cell';
            if (game.puzzle[i]) cell.classList.add('given');
            if (v && !correct) cell.classList.add('wrong');
            if (selected >= 0) {
                if (i === selected) cell.classList.add('selected');
                else if (selValue && v === selValue) cell.classList.add('same-number');
                else if (ROW[i] === ROW[selected] || COL[i] === COL[selected] || BOX[i] === BOX[selected]) {
                    cell.classList.add('related');
                }
            }

            if (v) {
                cell.textContent = v;
            } else if (game.notes[i]) {
                const notes = document.createElement('div');
                notes.className = 'sudoku-notes';
                for (let d = 1; d <= 9; d++) {
                    const s = document.createElement('span');
                    s.textContent = game.notes[i] & bit(d) ? d : '';
                    notes.appendChild(s);
                }
                cell.textContent = '';
                cell.appendChild(notes);
            } else {
                cell.textContent = '';
            }
        }

        padButtons.forEach((b, k) => b.classList.toggle('done', counts[k + 1] === 9));
        mistakesEl.textContent = game.mistakes + '/' + MAX_MISTAKES;
    }

    function toggleNotes() {
        notesMode = !notesMode;
        
        notesBtn.classList.toggle('on', notesMode);
    }

    document.addEventListener('keydown', event => {
        if (!screens.game.classList.contains('active') || !game || game.over) return;
        const k = event.key;
        if (/^[1-9]$/.test(k)) { enter(Number(k)); return; }
        if (k === 'Backspace' || k === 'Delete' || k === '0') { erase(); event.preventDefault(); return; }
        if (k === 'n' || k === 'N') { toggleNotes(); return; }
        const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
        if (k in moves) {
            event.preventDefault();
            if (selected < 0) { select(0); return; }
            const r = ROW[selected], c = COL[selected];
            if (k === 'ArrowUp' && r > 0) select(selected - 9);
            if (k === 'ArrowDown' && r < 8) select(selected + 9);
            if (k === 'ArrowLeft' && c > 0) select(selected - 1);
            if (k === 'ArrowRight' && c < 8) select(selected + 1);
        }
    });

    //////////////////////////
    // Buttons              //
    //////////////////////////
    document.getElementById('menuNewGame').addEventListener('click', newGame);
    continueBtn.addEventListener('click', () => { if (game) beginPlaying(); });
    document.getElementById('menuHowTo').addEventListener('click', () => { howTo.hidden = !howTo.hidden; });
    document.getElementById('menuRecords').addEventListener('click', showRecords);
    document.getElementById('recordsBack').addEventListener('click', () => showScreen('menu'));
    clearBtn.addEventListener('click', clearRecords);
    document.getElementById('sudokuErase').addEventListener('click', erase);
    notesBtn.addEventListener('click', toggleNotes);
    document.getElementById('sudokuToMenu').addEventListener('click', goToMenu);
    document.getElementById('overlayNewGame').addEventListener('click', newGame);
    document.getElementById('overlayMenu').addEventListener('click', () => { overlay.hidden = true; goToMenu(); });

    // A game in progress this tab session can be continued from the menu
    const saved = load();
    if (saved && saved.solution && !saved.over) {
        game = saved;
        continueBtn.hidden = false;
    } else {
        clearSave();
    }
    showScreen('menu');
})();
