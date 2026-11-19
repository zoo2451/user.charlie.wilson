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
        openWindow(recycleWindow);
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
    // Used by the Recycle Bin and the contact.txt Notepad window.
    let topZ = 100;

    function bringToFront(win) {
        win.style.zIndex = ++topZ;
    }

    function openWindow(win) {
        win.hidden = false;
        if (!win.style.left) centerWindow(win);
        keepWindowOnScreen(win);
        bringToFront(win);
    }

    function centerWindow(win) {
        win.style.left = Math.max(0, (window.innerWidth - win.offsetWidth) / 2) + 'px';
        win.style.top = Math.max(0, (window.innerHeight - taskbarH() - win.offsetHeight) / 2) + 'px';
    }

    function keepWindowOnScreen(win) {
        if (win.hidden) return;
        const maxLeft = Math.max(0, window.innerWidth - win.offsetWidth);
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
        });
        titleBar.addEventListener('pointermove', event => {
            if (!move) return;
            win.style.left = (event.clientX - move.offsetX) + 'px';
            win.style.top = (event.clientY - move.offsetY) + 'px';
            keepWindowOnScreen(win);
        });
        const stopMove = () => { move = null; };
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

            const stop = () => { start = null; };
            handle.addEventListener('pointerup', stop);
            handle.addEventListener('pointercancel', stop);
        });
    }

    makeMovable(recycleWindow, recycleTitleBar, closeButton);

    // contact.txt: a Notepad window opened by the Contact Form icon
    const contactIcon = iconById['contact-form'];
    const contactWindow = document.getElementById('contact-window');
    const contactClose = document.getElementById('contact-close');
    makeMovable(contactWindow, document.getElementById('contact-title-bar'), contactClose);
    if (contactIcon && contactWindow) {
        contactIcon.addEventListener('click', event => {
            event.preventDefault();
            openWindow(contactWindow);
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
    });

    layout();
    renderBin();
    container.classList.add('free-layout');
})();
