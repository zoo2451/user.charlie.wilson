// Intro sequence for the desktop (index.html): blue screen -> Enter/click ->
// intro video -> desktop. It runs once per browser session; other pages that
// load this file have no intro screens, so it does nothing there.
(function() {
    const bsodScreen = document.getElementById('bsod-screen');
    if (!bsodScreen) return;

    const bsodTextElement = document.getElementById('bsod-text');
    const continuePrompt = document.getElementById('continue-prompt');
    const loaderScreen = document.getElementById('loader-screen');
    const video = document.getElementById('intro-video');
    const audio = document.getElementById('loading-audio');
    const mainContent = document.getElementById('main-content');
    const taskbar = document.querySelector('.taskbar');

    const bsodText = `A problem has been detected and Windows has been shut down to prevent damage
to your computer.

MEMORY_MANAGEMENT

*** STOP: 0x0000001A (0x00041201, 0xF6800033, 0xE7700007, 0xF23EF200)

Physical memory dump complete.`;

    const typeSpeed = 2; // milliseconds between characters
    let currentIndex = 0;
    let introDone = false;
    let promptShown = false; // true once "Press ENTER or click" is visible

    function showMainContent() {
        if (introDone) return;
        introDone = true;
        bsodScreen.style.display = 'none';
        loaderScreen.style.display = 'none';
        if (!video.paused) video.pause();
        mainContent.style.setProperty('display', 'block', 'important');
        if (taskbar) taskbar.style.setProperty('display', 'flex', 'important');
        document.body.style.overflow = 'auto';
        sessionStorage.setItem('introCompleted', 'true');
    }

    // Already seen the intro this session: go straight to the desktop
    if (sessionStorage.getItem('introCompleted') === 'true') {
        showMainContent();
        return;
    }

    mainContent.style.display = 'none';
    if (taskbar) taskbar.style.display = 'none';

    function showPrompt(delay) {
        setTimeout(() => {
            continuePrompt.style.display = 'block';
            bsodScreen.classList.add('ready');
            promptShown = true;
        }, delay);
    }

    function skipTyping() {
        currentIndex = bsodText.length;
        bsodTextElement.textContent = bsodText;
        showPrompt(0);
    }

    function typeText() {
        if (currentIndex >= bsodText.length) return;
        currentIndex++;
        if (currentIndex === bsodText.length) {
            bsodTextElement.textContent = bsodText; // finished: drop the cursor
            showPrompt(1000);
            return;
        }
        bsodTextElement.textContent = bsodText.substring(0, currentIndex) + '█';
        // Jerky, glitchy typing: random delays with an occasional longer pause
        const delay = typeSpeed + Math.random() * 30 + (Math.random() < 0.1 ? 50 : 0);
        setTimeout(typeText, delay);
    }

    function startVideo() {
        bsodScreen.style.display = 'none';
        loaderScreen.style.display = 'flex';
        video.play().catch(error => {
            console.log('Video play failed:', error);
            showMainContent();
        });
        // If the video still hasn't started after 5 seconds, skip it
        setTimeout(() => {
            if (video.currentTime === 0) showMainContent();
        }, 5000);
    }

    // On the blue screen, Enter or a click first skips the typing,
    // then (once the prompt shows) starts the intro video.
    function advanceBsod() {
        if (bsodScreen.style.display === 'none') return;
        if (currentIndex < bsodText.length) {
            skipTyping();
        } else if (promptShown) {
            startVideo();
        }
    }

    bsodScreen.addEventListener('click', advanceBsod);

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' || introDone) return;
        if (loaderScreen.style.display === 'flex') {
            showMainContent(); // Skip the video
        } else {
            advanceBsod();
        }
    });

    video.addEventListener('ended', () => {
        showMainContent();
        if (audio) {
            audio.play().catch(error => console.log('Audio play failed:', error));
        }
    });

    video.addEventListener('error', () => {
        console.log('Video failed to load, showing main content');
        showMainContent();
    });

    typeText();
})();
