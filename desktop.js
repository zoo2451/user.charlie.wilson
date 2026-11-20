// Desktop icons you can drag around, drop on the Recycle Bin, and restore from it.
// Used by index.html only.
//
// Everything is remembered in sessionStorage, so it lasts while the tab is open
// (including reloads) and resets to the default layout when the tab is closed.
// Each visitor has their own desktop; nobody can change it for anyone else.
(function() {
    const container = document.getElementById('desktop-icons');
    if (!container) return;

    const recycleWindow = document.getElementById('recycle-window');
    const recycleTitleBar = document.getElementById('recycle-title-bar');
    const recycleItems = document.getElementById('recycle-items');
    const recycleStatus = document.getElementById('recycle-status');
    const emptyButton = document.getElementById('recycle-empty');
    const restoreButton = document.getElementById('recycle-restore');
    const closeButton = document.getElementById('recycle-close');

    const BIN_ID = 'recycle-bin';
    const BIN_EMPTY_ICON = 'images/recycle_bin_empty.png';
    const BIN_FULL_ICON = 'images/recycle_bin_full.png';
    const STORAGE_KEY = 'desktopState';

    // Invisible grid the icons snap to, like XP's "Align to Grid"
    const CELL_W = 100;
    const CELL_H = 110;
    const ORIGIN_X = 10;
    const ORIGIN_Y = 10;
    // Height of the taskbar, measured so windows and icons stop right above it
    // (it is 28px plus its borders). Falls back to 32 while it is hidden.
    function taskbarH() {
        const bar = document.querySelector(".taskbar");
        return (bar && bar.offsetHeight) || 32;
    }
    const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag

    const icons = Array.from(container.querySelectorAll('a[data-icon-id]'));
    const iconById = {};
    icons.forEach(el => { iconById[el.dataset.iconId] = el; });
    const bin = iconById[BIN_ID];

    // Turn off the browser's own link/image dragging so ours takes over
    icons.forEach(el => {
        el.setAttribute('draggable', 'false');
        el.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));
    });

    //////////////////////
    // Saved state      //
    //////////////////////
    // positions: { iconId: { col, row } }  (kept for trashed icons too, so a
    //            restored icon goes back where it was if that spot is free)
    // trashed:   [ iconId, ... ] in the order they were thrown away
    let state = loadState();
    let current = {}; // where each visible icon is right now: { iconId: { col, row } }

    function loadState() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
            if (saved && typeof saved === 'object') {
                return {
                    positions: saved.positions || {},
                    trashed: (saved.trashed || []).filter(id => iconById[id] && id !== BIN_ID)
                };
            }
        } catch (e) { /* storage blocked or bad data: start fresh */ }
        return { positions: {}, trashed: [] };
    }

    function saveState() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* storage blocked: changes just won't survive a reload */ }
    }

    // The first time anything moves, remember where every icon currently is,
    // so the others stay put instead of re-flowing around the moved one.
    function rememberCurrentPositions() {
        Object.keys(current).forEach(id => {
            state.positions[id] = { col: current[id].col, row: current[id].row };
        });
    }

    //////////////////////
    // Grid layout      //
    //////////////////////
    function gridSize() {
        // Use the window size: the desktop is hidden (zero size) during the intro
        const cols = Math.max(1, Math.floor((window.innerWidth - ORIGIN_X) / CELL_W));
        const rows = Math.max(1, Math.floor((window.innerHeight - taskbarH() - ORIGIN_Y) / CELL_H));
        return { cols, rows };
    }

    function key(cell) {
        return cell.col + ',' + cell.row;
    }

    function clampCell(cell, size) {
        return {
            col: Math.min(Math.max(0, cell.col), size.cols - 1),
            row: Math.min(Math.max(0, cell.row), size.rows - 1)
        };
    }

    // Closest free grid cell to `wanted` (the cell itself if it's free)
    function nearestFreeCell(wanted, occupied, size) {
        wanted = clampCell(wanted, size);
        if (!occupied.has(key(wanted))) return wanted;
        let best = null;
        let bestDist = Infinity;
        for (let col = 0; col < size.cols; col++) {
            for (let row = 0; row < size.rows; row++) {
                const cell = { col, row };
                if (occupied.has(key(cell))) continue;
                const dist = (col - wanted.col) ** 2 + (row - wanted.row) ** 2;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = cell;
                }
            }
        }
        return best || wanted; // desktop completely full: overlap rather than vanish
    }

    // Cells taken by visible icons, optionally ignoring one icon
    function occupiedCells(exceptId) {
        const occupied = new Set();
        Object.keys(current).forEach(id => {
            if (id !== exceptId) occupied.add(key(current[id]));
        });
        return occupied;
    }

    function placeIcon(el, cell) {
        el.style.left = (ORIGIN_X + cell.col * CELL_W) + 'px';
        el.style.top = (ORIGIN_Y + cell.row * CELL_H) + 'px';
    }

    // Work out where every visible icon goes, then put it there
    function layout() {
        const size = gridSize();
        const occupied = new Set();
        const next = {};
        const visible = icons.filter(el => !state.trashed.includes(el.dataset.iconId));

        // 1. Icons that have a saved spot
        visible.forEach(el => {
            const id = el.dataset.iconId;
            if (!state.positions[id]) return;
            const cell = nearestFreeCell(state.positions[id], occupied, size);
            next[id] = cell;
            occupied.add(key(cell));
        });

        // 2. Default spots: the Recycle Bin bottom-right like XP...
        if (bin && !next[BIN_ID]) {
            const cell = nearestFreeCell({ col: size.cols - 1, row: size.rows - 1 }, occupied, size);
            next[BIN_ID] = cell;
            occupied.add(key(cell));
        }
        // ...and everything else down the left side, column by column
        visible.forEach(el => {
            const id = el.dataset.iconId;
            if (next[id]) return;
            let cell = null;
            for (let col = 0; col < size.cols && !cell; col++) {
                for (let row = 0; row < size.rows && !cell; row++) {
                    if (!occupied.has(key({ col, row }))) cell = { col, row };
                }
            }
            cell = cell || { col: 0, row: 0 };
            next[id] = cell;
            occupied.add(key(cell));
        });

        current = next;
        icons.forEach(el => {
            const id = el.dataset.iconId;
            el.classList.toggle('trashed', state.trashed.includes(id));
            if (current[id]) placeIcon(el, current[id]);
        });
        updateBinIcon();
    }

    function updateBinIcon() {
        const src = state.trashed.length ? BIN_FULL_ICON : BIN_EMPTY_ICON;
        if (bin) bin.querySelector('img').src = src;
        const titleIcon = recycleWindow && recycleWindow.querySelector('.xp-title-icon');
        if (titleIcon) titleIcon.src = src;
    }

    //////////////////////
    // Trash / restore  //
    //////////////////////
    function trashIcon(id) {
        if (id === BIN_ID || state.trashed.includes(id)) return;
        rememberCurrentPositions();
        state.trashed.push(id);
        saveState();
        layout();
        renderBin();
    }

    // Put an icon back on the desktop, at `cell` if given, otherwise where it
    // used to be. Either way it takes the nearest free spot.
    function restoreIcon(id, cell) {
        if (!state.trashed.includes(id)) return;
        rememberCurrentPositions();
        state.trashed = state.trashed.filter(t => t !== id);
        const wanted = cell || state.positions[id] || { col: 0, row: 0 };
        state.positions[id] = nearestFreeCell(wanted, occupiedCells(id), gridSize());
        saveState();
        layout();
        if (selectedBinItem === id) selectedBinItem = null;
        renderBin();
    }

    // "Empty Recycle Bin" puts everything back on the desktop
    function emptyBin() {
        state.trashed.slice().forEach(id => restoreIcon(id));
    }

    //////////////////////////////
    // Dragging desktop icons   //
    //////////////////////////////
    let press = null;           // the icon currently pressed or dragged
    let suppressClick = false;  // true right after a drag, so it doesn't also open

    function pointInside(el, x, y) {
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    icons.forEach(el => {
        el.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            suppressClick = false;
            press = {
                el,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                offsetX: event.clientX - el.offsetLeft,
                offsetY: event.clientY - el.offsetTop,
                dragging: false
            };
            // Keep getting moves even if the pointer outruns the icon
            el.setPointerCapture(event.pointerId);
        });

        el.addEventListener('pointermove', event => {
            if (!press || press.el !== el || press.pointerId !== event.pointerId) return;
            if (!press.dragging) {
                const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
                if (moved < DRAG_THRESHOLD) return;
                press.dragging = true;
                el.classList.add('dragging');
            }
            el.style.left = (event.clientX - press.offsetX) + 'px';
            el.style.top = (event.clientY - press.offsetY) + 'px';

            if (bin && el !== bin) {
                bin.classList.toggle('drop-target', pointInside(bin, event.clientX, event.clientY));
            }
        });

        el.addEventListener('pointerup', event => {
            if (!press || press.el !== el) return;
            const wasDragging = press.dragging;
            press = null;
            if (!wasDragging) return; // a normal click: let it open

            // The click that follows a drag arrives right away; if none comes
            // (e.g. the icon was trashed and hidden), stop waiting for it.
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 300);
            el.classList.remove('dragging');
            if (bin) bin.classList.remove('drop-target');
            const id = el.dataset.iconId;

            if (bin && el !== bin && pointInside(bin, event.clientX, event.clientY)) {
                trashIcon(id);
                return;
            }

            // Snap to the grid cell nearest to where the icon was dropped
            const size = gridSize();
            const dropped = {
                col: Math.round((el.offsetLeft - ORIGIN_X) / CELL_W),
                row: Math.round((el.offsetTop - ORIGIN_Y) / CELL_H)
            };
            rememberCurrentPositions();
            state.positions[id] = nearestFreeCell(dropped, occupiedCells(id), size);
            saveState();
            layout();
        });

        el.addEventListener('pointercancel', () => {
            if (!press || press.el !== el) return;
            press = null;
            el.classList.remove('dragging');
            if (bin) bin.classList.remove('drop-target');
            layout(); // put it back where it was
        });

        // Stop the browser's own drag-a-link behaviour
        el.addEventListener('dragstart', event => event.preventDefault());
    });

    // A drag ends with a click on the icon; swallow it before any page script
    // (like the window-opening animation) sees it.
    document.addEventListener('click', event => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    //////////////////////////
    // Recycle Bin window   //
    //////////////////////////
    let selectedBinItem = null;

    function openBin() {
        if (!recycleWindow) return;
        openWindow(recycleWindow, bin);
        renderBin();
    }

    function closeBin() {
        if (recycleWindow) recycleWindow.hidden = true;
        selectedBinItem = null;
    }

    function renderBin() {
        if (!recycleItems) return;
        recycleItems.innerHTML = '';

        if (!state.trashed.length) {
            const note = document.createElement('div');
            note.className = 'xp-empty-note';
            note.textContent = 'The Recycle Bin is empty. Drag desktop icons onto the Recycle Bin to throw them away.';
            recycleItems.appendChild(note);
        }

        state.trashed.forEach(id => {
            const source = iconById[id];
            const item = document.createElement('div');
            item.className = 'recycle-item';
            item.dataset.iconId = id;
            item.title = 'Double-click or drag onto the desktop to restore';
            if (id === selectedBinItem) item.classList.add('selected');

            const img = document.createElement('img');
            img.src = source.querySelector('img').getAttribute('src');
            img.alt = '';
            img.draggable = false;
            const label = document.createElement('span');
            label.textContent = source.querySelector('span').textContent;

            item.appendChild(img);
            item.appendChild(label);
            setUpBinItem(item, id);
            recycleItems.appendChild(item);
        });

        const count = state.trashed.length;
        recycleStatus.textContent = count + (count === 1 ? ' object' : ' objects');
        restoreButton.disabled = !selectedBinItem;
        emptyButton.disabled = count === 0;
    }

    function selectBinItem(id) {
        selectedBinItem = id;
        recycleItems.querySelectorAll('.recycle-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.iconId === id);
        });
        restoreButton.disabled = !id;
    }

    // Items in the bin: click selects, double-click restores, and dragging one
    // out of the window onto the desktop restores it where it's dropped.
    function setUpBinItem(item, id) {
        let drag = null;

        item.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            selectBinItem(id);
            drag = { startX: event.clientX, startY: event.clientY, ghost: null };
            item.setPointerCapture(event.pointerId);
        });

        item.addEventListener('pointermove', event => {
            if (!drag) return;
            if (!drag.ghost) {
                if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
                drag.ghost = item.cloneNode(true);
                drag.ghost.classList.add('recycle-drag-ghost');
                document.body.appendChild(drag.ghost);
            }
            drag.ghost.style.left = (event.clientX - 42) + 'px';
            drag.ghost.style.top = (event.clientY - 30) + 'px';
        });

        function endDrag(event, cancelled) {
            if (!drag) return;
            const ghost = drag.ghost;
            drag = null;
            if (!ghost) return;
            ghost.remove();
            if (cancelled || pointInside(recycleWindow, event.clientX, event.clientY)) return;
            // Dropped on the desktop: restore at the cell under the pointer
            restoreIcon(id, {
                col: Math.floor((event.clientX - ORIGIN_X) / CELL_W),
                row: Math.floor((event.clientY - ORIGIN_Y) / CELL_H)
            });
        }

        item.addEventListener('pointerup', event => endDrag(event, false));
        item.addEventListener('pointercancel', event => endDrag(event, true));
        item.addEventListener('dblclick', () => restoreIcon(id));
    }

    //////////////////////////////////////
    // Desktop windows (shared helpers) //
    //////////////////////////////////////
    // Used by every window on the desktop: Recycle Bin, My documents, the
    // contact windows, and the app windows (My photos, Sudoku, ...).
    let topZ = 100;

    function bringToFront(win) {
        win.style.zIndex = ++topZ;
    }

    // Each window opened for the first time lands a little down and to the
    // right of the last one, like XP cascading windows.
    const CASCADE_STEP = 28;
    let cascadeCount = 0;

    // `source` is the icon that was clicked: a window that wasn't already open
    // zooms out of it with an XP-style outline.
    function openWindow(win, source) {
        const wasHidden = win.hidden;
        win.hidden = false;
        if (!win.style.left) {
            // Step down from a fixed starting point so each title bar stays visible
            const step = (cascadeCount++ % 8) * CASCADE_STEP;
            const startX = Math.max(16, Math.round(window.innerWidth * 0.18));
            const startY = 30;
            win.style.left = (startX + step) + 'px';
            win.style.top = (startY + step) + 'px';
        }
        keepWindowOnScreen(win);
        bringToFront(win);
        if (wasHidden && source) zoomOpen(source, win);
    }

    // XP's window-opening effect: an outline grows from the icon to the window,
    // and the window appears when it gets there.
    const ZOOM_MS = 220;
    function zoomOpen(source, win) {
        const from = source.getBoundingClientRect();
        const to = win.getBoundingClientRect();
        if (!from.width || !win.animate) return;
        const outline = document.createElement('div');
        outline.className = 'xp-zoom-outline';
        document.body.appendChild(outline);
        win.style.visibility = 'hidden';
        const frame = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        const done = () => { outline.remove(); win.style.visibility = ''; };
        const anim = outline.animate([frame(from), frame(to)], { duration: ZOOM_MS, easing: 'ease-out' });
        anim.onfinish = done;
        anim.oncancel = done;
    }

    // While a window is moved or resized, the pages inside app windows mustn't
    // grab the mouse, or the drag stops as soon as the pointer crosses them.
    function setDragging(on) {
        document.body.classList.toggle('xp-window-dragging', on);
    }

    function keepWindowOnScreen(win) {
        if (win.hidden) return;
        // clientWidth leaves out the page's scrollbar, if there is one
        const maxLeft = Math.max(0, document.documentElement.clientWidth - win.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - taskbarH() - win.offsetHeight);
        win.style.left = Math.min(Math.max(0, win.offsetLeft), maxLeft) + 'px';
        win.style.top = Math.min(Math.max(0, win.offsetTop), maxTop) + 'px';
    }

    // Drag a window by its title bar; clicking anywhere on it brings it forward
    function makeMovable(win, titleBar, closeBtn) {
        if (!win || !titleBar) return;
        win.addEventListener('pointerdown', () => bringToFront(win));
        let move = null;
        titleBar.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target === closeBtn) return;
            move = {
                offsetX: event.clientX - win.offsetLeft,
                offsetY: event.clientY - win.offsetTop
            };
            titleBar.setPointerCapture(event.pointerId);
            setDragging(true);
        });
        titleBar.addEventListener('pointermove', event => {
            if (!move) return;
            win.style.left = (event.clientX - move.offsetX) + 'px';
            win.style.top = (event.clientY - move.offsetY) + 'px';
            keepWindowOnScreen(win);
        });
        const stopMove = () => { move = null; setDragging(false); };
        titleBar.addEventListener('pointerup', stopMove);
        titleBar.addEventListener('pointercancel', stopMove);
        makeResizable(win);
    }

    // Resize a window by dragging any edge or corner, like XP.
    // Smallest size allowed; it can grow up to the space above the taskbar.
    const MIN_WIN_W = 260;
    const MIN_WIN_H = 160;

    function makeResizable(win) {
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
            const handle = document.createElement('div');
            handle.className = 'xp-resize xp-resize-' + dir;
            win.appendChild(handle);

            let start = null;
            handle.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation(); // don't start a title-bar move
                bringToFront(win);
                start = {
                    x: event.clientX, y: event.clientY,
                    left: win.offsetLeft, top: win.offsetTop,
                    width: win.offsetWidth, height: win.offsetHeight
                };
                handle.setPointerCapture(event.pointerId);
                setDragging(true);
            });

            handle.addEventListener('pointermove', event => {
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                const maxRight = window.innerWidth;
                const maxBottom = window.innerHeight - taskbarH();
                let { left, top, width, height } = start;

                if (dir.includes('e')) {
                    width = Math.min(Math.max(MIN_WIN_W, start.width + dx), maxRight - start.left);
                }
                if (dir.includes('s')) {
                    height = Math.min(Math.max(MIN_WIN_H, start.height + dy), maxBottom - start.top);
                }
                if (dir.includes('w')) {
                    // Right edge stays put; left edge can't pass the screen edge
                    const right = start.left + start.width;
                    left = Math.min(Math.max(0, start.left + dx), right - MIN_WIN_W);
                    width = right - left;
                }
                if (dir.includes('n')) {
                    const bottom = start.top + start.height;
                    top = Math.min(Math.max(0, start.top + dy), bottom - MIN_WIN_H);
                    height = bottom - top;
                }

                win.style.left = left + 'px';
                win.style.top = top + 'px';
                win.style.width = width + 'px';
                win.style.height = height + 'px';
            });

            const stop = () => { start = null; setDragging(false); };
            handle.addEventListener('pointerup', stop);
            handle.addEventListener('pointercancel', stop);
        });
    }

    makeMovable(recycleWindow, recycleTitleBar, closeButton);

    // My documents: a folder window instead of a separate page
    const documentsIcon = iconById['my-documents'];
    const documentsWindow = document.getElementById('documents-window');
    const documentsClose = document.getElementById('documents-close');
    makeMovable(documentsWindow, document.getElementById('documents-title-bar'), documentsClose);
    if (documentsIcon && documentsWindow) {
        documentsIcon.addEventListener('click', event => {
            event.preventDefault();
            openWindow(documentsWindow, documentsIcon);
        });
    }
    if (documentsClose) documentsClose.addEventListener('click', () => { documentsWindow.hidden = true; });

    ////////////////////////////////////////
    // App windows (pages in a window)    //
    ////////////////////////////////////////
    // Links with data-app="..." open their page inside a desktop window instead
    // of leaving the desktop. The page runs in an iframe; basic.js notices that
    // and hides the page's own title bar and taskbar.
    const APPS = {
        photos:  { url: 'film.html',       title: 'My photos - Charlie',      icon: 'images/folder_camera.png', width: 860, height: 600 },
        sudoku:  { url: 'chromegame.html', title: 'Sudoku',                   icon: 'images/sudoku.png',   width: 860, height: 640 },
        library: { url: 'library.html',    title: 'My Library - Charlie',     icon: 'images/winrar3.png',       width: 860, height: 600 },
        study:   { url: 'cs.html',         title: "Charlie's Study the game", icon: 'images/cs_icon.png',       width: 900, height: 660 },
        resume:  { url: 'images/wilson.mcharles.resume (11_10_26).pdf',
                   title: 'Resume.pdf', icon: 'images/pdf_icon.png', width: 760, height: 680 }
    };
    const openApps = {}; // app name -> { win, frame }

    function openApp(name, source) {
        const app = APPS[name];
        if (!app) return;
        if (openApps[name]) { // already open: just bring it forward
            bringToFront(openApps[name].win);
            return;
        }

        const win = document.createElement('div');
        win.className = 'xp-window app-window';
        win.hidden = true;
        win.style.width = Math.min(app.width, window.innerWidth - 16) + 'px';
        win.style.height = Math.min(app.height, window.innerHeight - taskbarH() - 16) + 'px';

        const titleBar = document.createElement('div');
        titleBar.className = 'xp-title-bar';
        const icon = document.createElement('img');
        icon.className = 'xp-title-icon';
        icon.src = app.icon;
        icon.alt = '';
        const title = document.createElement('div');
        title.className = 'xp-title-text';
        title.textContent = app.title;
        const close = document.createElement('button');
        close.className = 'xp-close-btn';
        close.title = 'Close';
        close.setAttribute('aria-label', 'Close');
        titleBar.append(icon, title, close);

        const body = document.createElement('div');
        body.className = 'app-window-body';
        const loading = document.createElement('div');
        loading.className = 'app-window-loading';
        loading.textContent = 'Loading...';
        const frame = document.createElement('iframe');
        frame.className = 'app-window-frame';
        frame.title = app.title;
        frame.src = app.url;
        frame.addEventListener('load', () => loading.remove());
        body.append(loading, frame);

        win.append(titleBar, body);
        document.getElementById('main-content').appendChild(win);
        makeMovable(win, titleBar, close);
        close.addEventListener('click', () => closeApp(name));

        openApps[name] = { win, frame, title, icon };
        openWindow(win, source);
    }

    // Closing removes the window (and stops any sound the page was playing);
    // opening it again starts fresh.
    function closeApp(name) {
        const entry = openApps[name];
        if (!entry) return;
        entry.win.remove();
        delete openApps[name];
    }

    // Any link with data-app opens in a window. This runs after the drag
    // check, so dragging a desktop icon still just moves it.
    document.addEventListener('click', event => {
        const link = event.target.closest && event.target.closest('[data-app]');
        if (!link || !APPS[link.dataset.app]) return;
        event.preventDefault();
        openApp(link.dataset.app, link);
    });

    // Messages from the pages inside app windows (see basic.js)
    window.addEventListener('message', event => {
        const name = Object.keys(openApps).find(n => openApps[n].frame.contentWindow === event.source);
        if (!name || !event.data || typeof event.data !== 'object') return;
        const entry = openApps[name];
        if (event.data.type === 'close-window') {
            closeApp(name);
        } else if (event.data.type === 'window-focus') {
            bringToFront(entry.win);
        } else if (event.data.type === 'window-info') {
            // The page may have moved on (e.g. My photos -> 2025), so show its title
            if (typeof event.data.title === 'string' && event.data.title) {
                entry.title.textContent = event.data.title.slice(0, 120);
            }
            if (typeof event.data.icon === 'string' && /^images\/[\w\-. ()]+$/.test(event.data.icon)) {
                entry.icon.src = event.data.icon;
            }
        } else if (event.data.type === 'open-photo') {
            openPhoto(event.data, entry.frame);
        } else if (event.data.type === 'photo-key') {
            handlePhotoKey(event.data.key);
        } else if (event.data.type === 'escape') {
            closeFrontWindow();
        }
    });

    // Esc closes the front window, as if its X was clicked. Pages inside
    // app windows pass their Esc presses on (see basic.js).
    function closeFrontWindow() {
        const open = Array.from(document.querySelectorAll('#main-content .xp-window'))
            .filter(win => !win.hidden);
        if (!open.length) return;
        const front = open.reduce((a, b) => (Number(b.style.zIndex) > Number(a.style.zIndex) ? b : a));
        const close = front.querySelector('.xp-close-btn');
        if (close) close.click();
    }
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        closeFrontWindow();
    });

    //////////////////////////////
    // Photo viewer             //
    //////////////////////////////
    // Clicking a photo in a year gallery (2023-2026) opens it here, in its own
    // desktop window that can go anywhere on the screen. There is one viewer:
    // clicking another photo shows it in the same window.
    // Photos come from ImageKit, like in the galleries (photogallery.js).
    const PHOTO_BASE = 'https://ik.imagekit.io/charliewilson/tr:w-2000/gallery';
    const SAFE_PHOTO_NAME = /^[\w\-. ()]+$/;
    const photo = { year: '', files: [], index: 0, rotation: 0, flipH: false, flipV: false };
    let viewer = null; // the window's parts, built the first time a photo opens

    function buildViewer() {
        const win = document.createElement('div');
        win.className = 'xp-window photo-viewer';
        win.hidden = true;
        win.style.width = Math.min(720, window.innerWidth - 16) + 'px';
        win.style.height = Math.min(580, window.innerHeight - taskbarH() - 16) + 'px';
        win.innerHTML = `
            <div class="xp-title-bar">
                <img class="xp-title-icon" src="images/folder_camera.png" alt="">
                <div class="xp-title-text"></div>
                <button class="xp-close-btn" title="Close" aria-label="Close"></button>
            </div>
            <div class="xp-menu-bar">
                <div class="xp-menu">
                    <div class="xp-menu-item">File</div>
                    <div class="xp-menu-dropdown">
                        <button data-cmd="download">Download</button>
                        <hr>
                        <button data-cmd="close">Close</button>
                    </div>
                </div>
                <div class="xp-menu">
                    <div class="xp-menu-item">View</div>
                    <div class="xp-menu-dropdown">
                        <button data-cmd="prev">Previous photo<span>&larr;</span></button>
                        <button data-cmd="next">Next photo<span>&rarr;</span></button>
                        <hr>
                        <button data-cmd="rotate-right">Rotate clockwise<span>D</span></button>
                        <button data-cmd="rotate-left">Rotate counterclockwise<span>A</span></button>
                        <button data-cmd="rotate-180">Rotate 180&deg;<span>W</span></button>
                        <hr>
                        <button data-cmd="flip-h">Flip horizontally</button>
                        <button data-cmd="flip-v">Flip vertically</button>
                    </div>
                </div>
            </div>
            <div class="xp-toolbar">
                <button class="xp-toolbar-button" data-cmd="prev" title="Previous photo (&larr;)">&#9664; Previous</button>
                <button class="xp-toolbar-button" data-cmd="next" title="Next photo (&rarr;)">Next &#9654;</button>
                <span class="photo-viewer-sep"></span>
                <button class="xp-toolbar-button" data-cmd="rotate-left" title="Rotate counterclockwise (A)">&#8634;</button>
                <button class="xp-toolbar-button" data-cmd="rotate-right" title="Rotate clockwise (D)">&#8635;</button>
            </div>
            <div class="photo-viewer-body">
                <img class="photo-viewer-img" alt="">
                <div class="photo-viewer-loading">Loading...</div>
            </div>
            <div class="xp-status-bar"></div>`;
        document.getElementById('main-content').appendChild(win);

        const parts = {
            win,
            title: win.querySelector('.xp-title-text'),
            close: win.querySelector('.xp-close-btn'),
            body: win.querySelector('.photo-viewer-body'),
            img: win.querySelector('.photo-viewer-img'),
            loading: win.querySelector('.photo-viewer-loading'),
            status: win.querySelector('.xp-status-bar')
        };
        makeMovable(win, win.querySelector('.xp-title-bar'), parts.close);
        parts.close.addEventListener('click', closePhoto);

        parts.img.addEventListener('load', () => {
            parts.loading.hidden = true;
            fitPhoto();
        });
        parts.img.addEventListener('error', () => {
            if (!parts.img.getAttribute('src')) return;
            parts.loading.hidden = false;
            parts.loading.textContent = "Couldn't load this photo.";
        });
        // Keep the photo fitted while the window is resized
        if (window.ResizeObserver) new ResizeObserver(fitPhoto).observe(parts.body);

        // Menus: click a name to open its list, click anywhere else to close it
        const menus = Array.from(win.querySelectorAll('.xp-menu'));
        menus.forEach(menu => {
            menu.querySelector('.xp-menu-item').addEventListener('click', event => {
                event.stopPropagation();
                const wasOpen = menu.classList.contains('open');
                menus.forEach(m => m.classList.remove('open'));
                if (!wasOpen) menu.classList.add('open');
            });
        });
        document.addEventListener('click', () => menus.forEach(m => m.classList.remove('open')));

        win.addEventListener('click', event => {
            const button = event.target.closest('[data-cmd]');
            if (button) photoCommand(button.dataset.cmd);
        });
        return parts;
    }

    // `data` comes from the gallery page: { year, files, index, from }
    function openPhoto(data, frame) {
        if (!/^\d{4}$/.test(String(data.year)) || !Array.isArray(data.files)) return;
        const wanted = data.files[data.index];
        const files = data.files.filter(f => typeof f === 'string' && SAFE_PHOTO_NAME.test(f)).slice(0, 5000);
        const index = files.indexOf(wanted);
        if (index < 0) return;

        if (!viewer) viewer = buildViewer();
        photo.year = String(data.year);
        photo.files = files;

        // Zoom out of the thumbnail that was clicked (its spot inside the page's window)
        let source = null;
        const r = data.from;
        if (viewer.win.hidden && r && [r.left, r.top, r.width, r.height].every(Number.isFinite)) {
            const f = frame.getBoundingClientRect();
            const rect = { left: f.left + r.left, top: f.top + r.top, width: r.width, height: r.height };
            source = { getBoundingClientRect: () => rect };
        }
        showPhoto(index);
        openWindow(viewer.win, source);
    }

    function showPhoto(index) {
        const count = photo.files.length;
        if (!count) return;
        photo.index = (index + count) % count;
        photo.rotation = 0;
        photo.flipH = false;
        photo.flipV = false;

        const name = photo.files[photo.index];
        viewer.loading.hidden = false;
        viewer.loading.textContent = 'Loading...';
        viewer.img.style.visibility = 'hidden';
        viewer.img.src = photoUrl(name);
        viewer.img.alt = name;
        viewer.title.textContent = name + ' - Windows Picture and Fax Viewer';
        viewer.status.textContent = `${photo.index + 1} of ${count}  ·  ${photo.year}`;

        // Load the next photo in the background so arrowing through is quick
        if (count > 1) new Image().src = photoUrl(photo.files[(photo.index + 1) % count]);
    }

    function photoUrl(name) {
        return PHOTO_BASE + photo.year + '/' + encodeURIComponent(name);
    }

    // Size the photo to fit the window (turned sideways when rotated 90/270)
    function fitPhoto() {
        if (!viewer || !viewer.img.naturalWidth || !viewer.loading.hidden) return;
        const img = viewer.img;
        const room = 16;
        const W = Math.max(1, viewer.body.clientWidth - room);
        const H = Math.max(1, viewer.body.clientHeight - room);
        const sideways = photo.rotation % 180 !== 0;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = Math.min(W / (sideways ? h : w), H / (sideways ? w : h), 1);
        img.style.width = Math.round(w * scale) + 'px';
        img.style.height = Math.round(h * scale) + 'px';
        img.style.transform = `translate(-50%, -50%) rotate(${photo.rotation}deg)` +
            ` scale(${photo.flipH ? -1 : 1}, ${photo.flipV ? -1 : 1})`;
        img.style.visibility = '';
    }

    function rotatePhoto(degrees) {
        photo.rotation = (photo.rotation + degrees + 360) % 360;
        fitPhoto();
    }

    function photoCommand(cmd) {
        if (!viewer || viewer.win.hidden) return;
        switch (cmd) {
            case 'prev': showPhoto(photo.index - 1); break;
            case 'next': showPhoto(photo.index + 1); break;
            case 'rotate-right': rotatePhoto(90); break;
            case 'rotate-left': rotatePhoto(-90); break;
            case 'rotate-180': rotatePhoto(180); break;
            case 'flip-h': photo.flipH = !photo.flipH; fitPhoto(); break;
            case 'flip-v': photo.flipV = !photo.flipV; fitPhoto(); break;
            case 'download': window.open(viewer.img.src, '_blank'); break;
            case 'close': closePhoto(); break;
        }
    }

    function closePhoto() {
        if (!viewer) return;
        viewer.win.hidden = true;
        viewer.img.removeAttribute('src');
    }

    // Arrows = previous/next, A/D = rotate, W/S = rotate 180, Esc = close.
    // Keys reach here from the desktop itself, or passed on by the gallery page
    // when it has the keyboard (see photogallery.js).
    const PHOTO_KEYS = {
        ArrowLeft: 'prev', ArrowRight: 'next', // Esc: see closeFrontWindow

        d: 'rotate-right', a: 'rotate-left', w: 'rotate-180', s: 'rotate-180'
    };
    function handlePhotoKey(key) {
        if (!viewer || viewer.win.hidden || typeof key !== 'string') return false;
        const cmd = PHOTO_KEYS[key.length === 1 ? key.toLowerCase() : key];
        if (!cmd) return false;
        photoCommand(cmd);
        return true;
    }
    document.addEventListener('keydown', event => {
        if (!viewer || viewer.win.hidden) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target.closest && event.target.closest('input, textarea, select')) return;
        // Only when the viewer is the front window
        if (Number(viewer.win.style.zIndex) !== topZ) return;
        if (handlePhotoKey(event.key)) event.preventDefault();
    });

    // contact.txt: a Notepad window opened by the Contact Form icon
    const contactIcon = iconById['contact-form'];
    const contactWindow = document.getElementById('contact-window');
    const contactClose = document.getElementById('contact-close');
    makeMovable(contactWindow, document.getElementById('contact-title-bar'), contactClose);
    if (contactIcon && contactWindow) {
        contactIcon.addEventListener('click', event => {
            event.preventDefault();
            openWindow(contactWindow, contactIcon);
        });
    }
    if (contactClose) contactClose.addEventListener('click', () => { contactWindow.hidden = true; });

    //////////////////////////////
    // New Message (mail form)  //
    //////////////////////////////
    // Messages are sent through Web3Forms (web3forms.com), which emails them to
    // the address the access key was created with. GitHub Pages can't send mail
    // itself. The key is meant to be public, so it's fine to have it here.
    const WEB3FORMS_ACCESS_KEY = 'b02ffd0a-57eb-4266-825e-e11f7755a7bf';
    const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

    const mailWindow = document.getElementById('mail-window');
    const mailForm = document.getElementById('mail-form');
    const mailStatus = document.getElementById('mail-status');
    const mailSend = document.getElementById('mail-send');
    const mailClose = document.getElementById('mail-close');
    const openMail = document.getElementById('open-mail');
    makeMovable(mailWindow, document.getElementById('mail-title-bar'), mailClose);

    function setMailStatus(text, kind) {
        mailStatus.textContent = text;
        mailStatus.classList.toggle('error', kind === 'error');
        mailStatus.classList.toggle('success', kind === 'success');
    }

    if (openMail && mailWindow) {
        openMail.addEventListener('click', event => {
            event.preventDefault();
            const wasHidden = mailWindow.hidden;
            if (wasHidden && contactWindow) {
                // Open just below and to the right of contact_form.txt, like a new window would
                mailWindow.hidden = false;
                mailWindow.style.left = (contactWindow.offsetLeft + 40) + 'px';
                mailWindow.style.top = (contactWindow.offsetTop + 30) + 'px';
            }
            openWindow(mailWindow);
            if (wasHidden) document.getElementById('mail-name').focus();
        });
    }
    if (mailClose) mailClose.addEventListener('click', () => { mailWindow.hidden = true; });

    if (mailForm) {
        // Clear the red outline as soon as a field is fixed
        mailForm.addEventListener('input', event => event.target.classList.remove('invalid'));

        mailForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (mailSend.disabled) return;

            const fields = {
                name: document.getElementById('mail-name'),
                email: document.getElementById('mail-email'),
                message: document.getElementById('mail-message')
            };
            const missing = Object.values(fields).filter(f => !f.value.trim() || !f.checkValidity());
            Object.values(fields).forEach(f => f.classList.toggle('invalid', missing.includes(f)));
            if (missing.length) {
                setMailStatus(fields.email.value.trim() && !fields.email.checkValidity()
                    ? 'Please enter a valid email address.'
                    : 'Please fill in your name, email and message.', 'error');
                missing[0].focus();
                return;
            }

            if (WEB3FORMS_ACCESS_KEY.startsWith('PASTE_')) {
                setMailStatus("Sending isn't set up yet. Please try again later.", 'error');
                return;
            }

            const subject = document.getElementById('mail-subject').value.trim();
            const payload = {
                access_key: WEB3FORMS_ACCESS_KEY,
                subject: 'Website message: ' + (subject || 'no subject'),
                from_name: fields.name.value.trim(),
                name: fields.name.value.trim(),
                email: fields.email.value.trim(),
                message: fields.message.value.trim(),
                botcheck: mailForm.querySelector('.mail-botcheck').checked
            };

            mailSend.disabled = true;
            setMailStatus('Sending...');
            try {
                const response = await fetch(WEB3FORMS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json().catch(() => ({}));
                if (response.ok && result.success) {
                    mailForm.reset();
                    setMailStatus('Message sent. Thanks! I will get back to you soon.', 'success');
                } else {
                    setMailStatus("Couldn't send: " + (result.message || 'please try again later.'), 'error');
                }
            } catch (e) {
                setMailStatus("Couldn't send. Check your connection and try again.", 'error');
            } finally {
                mailSend.disabled = false;
            }
        });
    }

    if (bin) {
        bin.addEventListener('click', event => {
            event.preventDefault();
            openBin();
        });
    }
    if (closeButton) closeButton.addEventListener('click', closeBin);
    if (emptyButton) emptyButton.addEventListener('click', emptyBin);
    if (restoreButton) {
        restoreButton.addEventListener('click', () => {
            if (selectedBinItem) restoreIcon(selectedBinItem);
        });
    }
    // Clicking empty space in the bin clears the selection
    if (recycleItems) {
        recycleItems.addEventListener('pointerdown', event => {
            if (event.target === recycleItems) selectBinItem(null);
        });
    }

    window.addEventListener('resize', () => {
        layout();
        if (recycleWindow) keepWindowOnScreen(recycleWindow);
        if (contactWindow) keepWindowOnScreen(contactWindow);
        if (mailWindow) keepWindowOnScreen(mailWindow);
        if (documentsWindow) keepWindowOnScreen(documentsWindow);
        if (viewer) keepWindowOnScreen(viewer.win);
    });

    layout();
    renderBin();
    container.classList.add('free-layout');
})();
