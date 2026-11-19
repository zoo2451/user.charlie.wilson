// Shared by every page: embedded-window mode, close/back buttons, start button sound.

//////////////////////////////
// EMBEDDED IN A DESKTOP    //
// WINDOW                   //
//////////////////////////////
// The desktop (index.html) opens pages like My photos or Sudoku inside its own
// XP windows (an iframe). In that case the page hides its own title bar and
// taskbar, fills the window, and talks to the desktop through postMessage:
//   window-info  -> its title and icon, so the desktop window can show them
//   window-focus -> it was clicked, so the desktop brings its window forward
//   close-window -> its X button was pressed
const IS_EMBEDDED = (function() {
    try { return window.self !== window.top; } catch (e) { return true; }
})();

function tellDesktop(message) {
    if (IS_EMBEDDED) window.parent.postMessage(message, '*');
}

if (IS_EMBEDDED) {
    document.documentElement.classList.add('embedded');
    const style = document.createElement('style');
    style.textContent = `
        html.embedded, html.embedded body { height: 100%; margin: 0; overflow: hidden; background: #ece9d8; }
        html.embedded .taskbar { display: none !important; }
        html.embedded #main-content { height: 100%; }
        html.embedded .tab-photos {
            position: fixed; inset: 0; margin: 0; width: auto; height: auto;
            display: flex; flex-direction: column;
            border: none; border-radius: 0; box-shadow: none;
        }
        html.embedded .tab-photos > .title-bar { display: none; }
        html.embedded .tab-photos > .menu-bar,
        html.embedded .tab-photos > .toolbar { flex-shrink: 0; }
        html.embedded .tab-photos > .window-content {
            flex: 1 1 auto; height: auto !important; min-height: 0; box-sizing: border-box;
        }
    `;
    document.head.appendChild(style);

    // Clicking anywhere in the page brings its desktop window to the front
    document.addEventListener('pointerdown', () => tellDesktop({ type: 'window-focus' }), true);

    function sendWindowInfo() {
        const title = document.querySelector('.tab-photos > .title-bar .window-title');
        const icon = document.querySelector('.tab-photos > .title-bar .window-icon img');
        tellDesktop({
            type: 'window-info',
            title: title ? title.textContent.trim() : document.title,
            icon: icon ? icon.getAttribute('src') : null
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sendWindowInfo);
    } else {
        sendWindowInfo();
    }
}

////////////////////////////
// WINDOW CLOSE AND BACK  //
////////////////////////////
// Every window's X button returns to the desktop (or closes its desktop window).
function closeWindow() {
    if (IS_EMBEDDED) {
        tellDesktop({ type: 'close-window' });
        return;
    }
    // After the Start button, wait for the startup sound to finish first
    if (startSoundDone) {
        startSoundDone.then(() => { window.location.href = 'index.html'; });
        return;
    }
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!backBtn.classList.contains('disabled')) {
                window.history.back();
            }
        });
    }
});

////////////////////////////
// START BUTTON SOUND     //
////////////////////////////
// The Start button plays the XP startup sound all the way through, then
// closeWindow() goes to the desktop. startSoundDone resolves when the sound
// ends (or can't play, or after a safety timeout so the button never hangs).
let startSoundDone = null;
const START_SOUND_MAX_MS = 8000;

function playStartAudio(event) {
    event.preventDefault(); // closeWindow() handles the navigation
    if (startSoundDone) return; // already playing: ignore extra clicks
    const audio = document.getElementById('start-audio');
    if (!audio) return;

    // XP's busy cursor everywhere while the sound plays
    const busy = document.createElement('style');
    busy.textContent = "* { cursor: url('default_wait.cur'), wait !important; }";
    document.head.appendChild(busy);
    startSoundDone = new Promise(resolve => {
        const timer = setTimeout(resolve, START_SOUND_MAX_MS);
        audio.addEventListener('ended', () => { clearTimeout(timer); resolve(); }, { once: true });
        audio.currentTime = 0;
        audio.play().catch(error => {
            console.log('Audio play failed:', error);
            clearTimeout(timer);
            resolve();
        });
    });
}
