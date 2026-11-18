function startgame() {
    // Play the audio
    const csMusic = document.getElementById('cs-music');
    csMusic.loop = true;
    csMusic.play();

    // Hide the start menu
    const startMenu = document.querySelector('#startMenu');
    startMenu.classList.add('hidden');
    // Move the title to the top
    const csTitle = document.querySelector('.cs-title');
    csTitle.classList.add('top');
    //old man sequence
    const delayTime = 1000;
    setTimeout(() => {
        const csIntro = document.querySelector('.cs-intro')
        const windowContent = document.querySelector('.window-content');
        csIntro.style.display = 'flex';
        startWizardAnimation();
    }, delayTime);
}
////////////////////////////    
// WIZARD ANIMATION INTRO //
////////////////////////////
function startWizardAnimation() {
    const oldGuideAnimation = document.querySelector('.old-guide-animation');
    
    oldGuideAnimation.style.display = 'flex';
    oldGuideAnimation.classList.add('active');
    if (oldGuideAnimation) {
    setTimeout(() => {
        oldGuideAnimation.style.display = 'none';
        introTextAnimation();
    }, 4000);
    }
    else {
        console.error("Old guide animation element not found.");
    }
}

function introTextAnimation() {
    const oldGuideIdle = document.querySelector('.old-guide-idle');
    const oldGuideText = document.querySelector('.old-guide-text');
    const delayTime = 1000;
    if (oldGuideIdle && oldGuideText) {
        setTimeout(() => {
        oldGuideIdle.classList.add('active');
        oldGuideIdle.style.display = 'flex';
        oldGuideText.classList.add('active');
        }, 0);
    }
    else {
        console.error("Old guide idle sprite or text box not found.");
    }
const oldGuideKey = document.querySelector('.old-guide-key');
const steps = [
    document.querySelector('#welcomeTravler'),
    document.querySelector('#welcome2'),
    document.querySelector('#welcome3'),
    document.querySelector('#welcome4'),
    document.querySelector('#welcome5')
];

let currentStep = 0;

// Make only the first visible
steps.forEach((el, index) => {
    if (el) el.style.display = index === 0 ? 'flex' : 'none';
});
 const oldGuideKeyIdle = document.querySelector('.old-guide-key-idle');
document.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
        if (steps[currentStep]) steps[currentStep].style.display = 'none';
        currentStep++;
        if (steps[currentStep]) steps[currentStep].style.display = 'flex';
        console.log(`Step ${currentStep + 1} displayed.`);
            // Show key sprite
    if (currentStep === 3 && oldGuideKey && oldGuideIdle) {
        oldGuideIdle.classList.remove('active');
        oldGuideIdle.style.display = 'none';
        oldGuideKey.style.display = 'flex';
    }
    if (oldGuideKey) {
        oldGuideKey.addEventListener('animationend', () => {
        console.log("Key animation ended, switching to idle.");

        // Replace animation with idle animation
        oldGuideKey.style.display = 'none';
        oldGuideKeyIdle.style.display = 'flex';

    });}
    // Play audio during dialogue
    const oldGuideDialogue = document.getElementById('oldGuideDialogue');
    if (oldGuideIdle.style.display !== 'none') {
        oldGuideDialogue.loop = true;
        oldGuideDialogue.volume = 0.2;
        oldGuideDialogue.play();
    } else {
        oldGuideDialogue.pause();
    }

    if (currentStep === 4 && oldGuideKeyIdle)
        oldGuideKeyIdle.onclick = () => {
        console.log('Old guide key clicked!');
        openLibrary();
        }
    }
 else if (currentStep === steps.length - 1) {
        // Final step - trigger cleanup
        if (steps[currentStep]) steps[currentStep].style.display = 'flex'; // Already visible
        if (typeof oldGuideText !== 'undefined') {
            oldGuideText.classList.remove('active');
            console.log("Main text box hidden.");
        }
        // Optionally remove the event listener if no more clicks needed:
        // document.removeEventListener('click', clickHandler);
    }
    
});


}
function openLibrary() {
    const oldGuideKey = document.querySelector('.old-guide-key');
    if (oldGuideKey) {
        oldGuideKey.style.display = 'none'; // Hide the key
    }
    const csIntro = document.querySelector('.cs-intro');
    if (csIntro) {
        csIntro.style.display = 'none'; // Hide the intro
    }
    const csTitle = document.querySelector('.cs-title');
    if (csTitle) {
        csTitle.style.display = 'none'; // Hide the title
    }
    const libraryGallery = document.querySelector('.library-gallery');
    if (libraryGallery) {
        libraryGallery.style.display = 'flex'; // Show the library gallery
    }
}