// Hide main content and taskbar at the start
document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');
    const taskbar = document.querySelector('.taskbar');
    
    if (!hasCompletedIntro) {
        if (mainContent) mainContent.style.display = 'none';
        if (taskbar) taskbar.style.display = 'none';
    }
});
// Intro Skip Script
let hasCompletedIntro = sessionStorage.getItem('introCompleted') === 'true';
// BSOD Text to type out
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

let currentIndex = 0;
const typeSpeed = 2; // milliseconds between characters
const bsodTextElement = document.getElementById('bsod-text');
const inputSection = document.getElementById('input-section');
const userInput = document.getElementById('user-input');

function typeText() {
    if (currentIndex < bsodText.length) {
        bsodTextElement.textContent = bsodText.substring(0, currentIndex + 1) + '█';
        currentIndex++;
        // Add more extreme random variation for very jerky typing
        const randomDelay = typeSpeed + Math.random() * 30;
        // Occasionally pause for a longer glitch effect
        if (Math.random() < 0.1) {
            setTimeout(typeText, randomDelay + 50);
        } else {
            setTimeout(typeText, randomDelay);
        }
    } else {
        // Remove cursor and show input
        bsodTextElement.textContent = bsodText;
        setTimeout(() => {
            inputSection.style.display = 'block';
            userInput.focus();
        }, 1000);
    }
}

// Allow skipping typing animation with Enter key (moved outside function)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && currentIndex < bsodText.length) {
        currentIndex = bsodText.length;
        bsodTextElement.textContent = bsodText;
        setTimeout(() => {
            inputSection.style.display = 'block';
            userInput.focus();
        }, 1000);
    }
});

// Only show BSOD if user hasn't completed intro
document.addEventListener('DOMContentLoaded', function() {
    if (!hasCompletedIntro) {
        typeText();
    } else {
        // Skip directly to main content
        document.getElementById('bsod-screen').style.display = 'none';
        document.getElementById('loader-screen').style.display = 'none';
        showMainContent();
    }
});
// Handle user input
userInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        const input = userInput.value.toLowerCase().trim();
        if (input === 'start') {
            startVideo();
        } else {
            // Clear input and show error
            userInput.value = '';
            userInput.placeholder = "Invalid command. Type 'start'";
            setTimeout(() => {
                userInput.placeholder = "Type 'start' to continue...";
            }, 2000);
        }
    }
});

function startVideo() {
    document.getElementById('bsod-screen').style.display = 'none';
    document.getElementById('loader-screen').style.display = 'flex';

    const video = document.getElementById('intro-video');
    video.play().catch(error => {
        console.log('Video play failed:', error);
        showMainContent();
    });
}

// Video handling
const video = document.getElementById('intro-video');
const loaderScreen = document.getElementById('loader-screen');
const mainContent = document.getElementById('main-content');
const taskbar = document.querySelector('.taskbar');
const audio = document.getElementById('loading-audio');

function showMainContent() {
    loaderScreen.style.display = 'none';
    mainContent.style.setProperty('display', 'block', 'important');
    if (taskbar) taskbar.style.setProperty('display', 'flex', 'important');
    document.body.style.overflow = 'auto';
    sessionStorage.setItem('introCompleted', 'true');
}
// Allow skipping video and audio with Enter key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && loaderScreen.style.display === 'flex') {
        // Pause and hide video if playing
        if (!video.paused) {
            video.pause();
        }
        showMainContent();
    }
});

    // When video ends, play audio and show main content
    video.addEventListener('ended', () => {
        showMainContent();
    if (audio) {
        audio.play()
            .then(() => {
                console.log('Audio playing successfully');
            })
            .catch(error => {
                console.log('Audio play failed:', error);
            });
        }
        });
    

    // Handle video load error (show main content if video fails)
    video.addEventListener('error', function() {
      console.log('Video failed to load, showing main content');
      showMainContent();
});

    // Auto-play may be blocked by browser, so we need to handle that
    video.addEventListener('loadeddata', function() {
  const playPromise = video.play();
  
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('Video playing successfully');
    }).catch(error => {
      console.log('Auto-play was prevented:', error);
      // If autoplay fails, try to unmute and play with user interaction
      document.addEventListener('click', function() {
        video.muted = false;
        video.play();
      }, { once: true });
    });
  }
});

    // Fallback: if video doesn't load within 5 seconds, show main content
    setTimeout(() => {
      if (loaderScreen.style.display !== 'none') {
        console.log('Video timeout, showing main content');
        showMainContent();
      }})

// MOUSE CURSOR HANDLING
function startLoading() {
    const body = document.getElementById("page");
    
    // Add 'loading' class to change cursor
    body.classList.add("loading");

    // Simulate a loading delay
    setTimeout(() => {
      // Revert to normal cursor after 2 seconds
      body.classList.remove("loading");
    }, 2000);
  }
