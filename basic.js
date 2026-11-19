// Shared by every page: tab-opening animation, close/back buttons, start button sound.

/////////////////////////////
// TAB OPENING ANIMATION   //
/////////////////////////////
// Clicking one of these links grows a window outline from the icon to full
// screen, then opens the page. Links that aren't on the current page are skipped.
const TAB_ANIMATION_MS = 500;

function setupTabAnimation(selector, iconSrc, label) {
    const link = document.querySelector(selector);
    const overlay = document.getElementById('tab-animation');
    if (!link || !overlay) return;

    link.addEventListener('click', function(event) {
        event.preventDefault();
        const destinationUrl = this.href;
        const rect = this.getBoundingClientRect();

        // Start the overlay exactly over the icon...
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.opacity = '1';
        overlay.innerHTML = `
          <img src="${iconSrc}" alt="${label}" style="height:40px;vertical-align:middle;margin-right:12px;">
          <span>${label}</span>
        `;

        // ...force a reflow so the browser registers that starting point,
        // then animate to full screen.
        void overlay.offsetWidth;
        overlay.classList.add('active');

        setTimeout(() => {
            window.location.href = destinationUrl;
        }, TAB_ANIMATION_MS);
    });
}

setupTabAnimation('.my-photos', 'images/folder_camera.png', 'My Photos');
setupTabAnimation('.my-documents', 'images/folder_documents.png', 'My Documents');
setupTabAnimation('.chromegame', 'images/folder_tape.png', 'Sudoku');
setupTabAnimation('.charlies-study', 'images/cs_icon.png', "Charlie's Study");

////////////////////////////
// WINDOW CLOSE AND BACK  //
////////////////////////////
// Every window's X button returns to the desktop.
function closeWindow() {
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
function playStartAudio(event) {
    event.preventDefault(); // closeWindow() handles the navigation
    const audio = document.getElementById('start-audio');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(error => console.log('Audio play failed:', error));
    }
}
