// Intro sequence for the desktop (index.html): blue screen -> type "start" ->
// intro video -> desktop. It runs once per browser session; other pages that
// load this file have no intro screens, so it does nothing there.
(function() {
    const bsodScreen = document.getElementById('bsod-screen');
    if (!bsodScreen) return;

    const bsodTextElement = document.getElementById('bsod-text');
    const inputSection = document.getElementById('input-section');
    const userInput = document.getElementById('user-input');
    const loaderScreen = document.getElementById('loader-screen');
    const video = document.getElementById('intro-video');
    const audio = document.getElementById('loading-audio');
    const mainContent = document.getElementById('main-content');
    const taskbar = document.querySelector('.taskbar');

    const bsodText = `A problem has been detected and Windows has been shut down to prevent damage
to your computer.

MEMORY_MANAGEMENT

If this is the first time you've seen this stop error screen,
restart your computer. If this screen appears again, follow
these steps:

Technical Information:

*** STOP: 0x0000001A (0x0000000041201,0XFFFFF68000033978,0xE7700007E5BC,
0xFFFFFFA800F23EF20)

Collecting data for crash dump ...
Initializing disk for crash dump ...
Beginning dump of physical memory.
Dumping physical memory to disk: 100
Physical memory dump complete.
Contact your system administrator or technical support group for further assistance.

System will restart automatically...`;

    const typeSpeed = 2; // milliseconds between characters
    let currentIndex = 0;
    let introDone = false;

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

    function showInput() {
        setTimeout(() => {
            inputSection.style.display = 'block';
            userInput.focus();
        }, 1000);
    }

    function typeText() {
        if (currentIndex >= bsodText.length) return;
        currentIndex++;
        if (currentIndex === bsodText.length) {
            bsodTextElement.textContent = bsodText; // finished: drop the cursor
            showInput();
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

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;
        if (currentIndex < bsodText.length) {
            // Skip the typing animation
            currentIndex = bsodText.length;
            bsodTextElement.textContent = bsodText;
            showInput();
        } else if (loaderScreen.style.display === 'flex') {
            // Skip the video
            showMainContent();
        }
    });

    userInput.addEventListener('keypress', function(event) {
        if (event.key !== 'Enter') return;
        if (userInput.value.toLowerCase().trim() === 'start') {
            startVideo();
        } else {
            userInput.value = '';
            userInput.placeholder = "Invalid command. Type 'start'";
            setTimeout(() => {
                userInput.placeholder = "Type 'start' to continue...";
            }, 2000);
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
