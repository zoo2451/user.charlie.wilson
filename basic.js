// TAB OPENING ANIMATION PHOTOS //
const animatedLink = document.querySelector('.my-photos');
const animationOverlay = document.getElementById('tab-animation');
const animationDuration = 500; // ms

animatedLink.addEventListener('click', function(event) {
    event.preventDefault();
    const destinationUrl = this.href;

    // Get the button's position and size
    const rect = this.getBoundingClientRect();

    // Set overlay to match the button's position and size
    animationOverlay.style.top = rect.top + "px";
    animationOverlay.style.left = rect.left + "px";
    animationOverlay.style.width = rect.width + "px";
    animationOverlay.style.height = rect.height + "px";
    animationOverlay.style.opacity = "1";
    animationOverlay.innerHTML = `
      <img src="images/folder_camera.png" alt="My Photos" style="height:40px;vertical-align:middle;margin-right:12px;">
      <span>My Photos</span>
    `;

    // Force a reflow so the browser registers the initial state
    void animationOverlay.offsetWidth;

    // Animate to full screen
    animationOverlay.classList.add('active');

    setTimeout(() => {
        window.location.href = destinationUrl;
    }, animationDuration);
});
// TAB OPENING ANIMATION DOCUMENTS //
const animatedLink1 = document.querySelector('.my-documents');
const animationOverlayDocument = document.getElementById('tab-animation');
const animationDuration1 = 500; // ms

animatedLink1.addEventListener('click', function(event) {
    event.preventDefault();
    const destinationUrl = this.href;

    // Get the button's position and size
    const rect = this.getBoundingClientRect();

    // Set overlay to match the button's position and size
    animationOverlayDocument.style.top = rect.top + "px";
    animationOverlayDocument.style.left = rect.left + "px";
    animationOverlayDocument.style.width = rect.width + "px";
    animationOverlayDocument.style.height = rect.height + "px";
    animationOverlayDocument.style.opacity = "1";
    animationOverlayDocument.innerHTML = `
      <img src="images/folder_documents.png" alt="My Documents" style="height:40px;vertical-align:middle;margin-right:12px;">
      <span>My Documents</span>
    `;

    // Force a reflow so the browser registers the initial state
    void animationOverlayDocument.offsetWidth;

    // Animate to full screen
    animationOverlayDocument.classList.add('active');

    setTimeout(() => {
        window.location.href = destinationUrl;
    }, animationDuration1);
});
// TAB OPENING ANIMATION GAME //
const animatedLinkGame = document.querySelector('.chromegame');
const animationOverlayGame = document.getElementById('tab-animation');
const animationDurationGame = 500; // ms

animatedLinkGame.addEventListener('click', function(event) {
    event.preventDefault();
    const destinationUrl = this.href;

    // Get the button's position and size
    const rect = this.getBoundingClientRect();

    // Set overlay to match the button's position and size
    animationOverlayGame.style.top = rect.top + "px";
    animationOverlayGame.style.left = rect.left + "px";
    animationOverlayGame.style.width = rect.width + "px";
    animationOverlayGame.style.height = rect.height + "px";
    animationOverlayGame.style.opacity = "1";
    animationOverlayGame.innerHTML = `
      <img src="images/folder_tape.png" alt="My Game" style="height:40px;vertical-align:middle;margin-right:12px;">
      <span>insert_game_name_here</span>
    `;

    // Force a reflow so the browser registers the initial state
    void animationOverlayGame.offsetWidth;

    // Animate to full screen
    animationOverlayGame.classList.add('active');

    setTimeout(() => {
        window.location.href = destinationUrl;
    }, animationDurationGame);
});
//Main close button
function closeWindow() {
    window.location.href = 'index.html';
}
//back button
function goBack() {
    window.history.back();
}
document.addEventListener('DOMContentLoaded', function() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            goBack();
        });
    }
});
//start button audio
function playStartAudio(event) {
    event.preventDefault(); // Prevent navigation
    const audio = document.getElementById('start-audio');
    if (audio) {
        audio.currentTime = 0; // Rewind to start
        audio.play()
            .then(() => {
                console.log('Audio playing successfully');
            })
            .catch(error => {
                console.log('Audio play failed:', error);
            });
    }};