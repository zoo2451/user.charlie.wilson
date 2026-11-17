// Clock handling - works on any page
function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const clockElem = document.getElementById('clock-time');
    if (clockElem) {
        clockElem.textContent = `${hours}:${minutes}`;
    }
}

// Start the clock when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateClock(); // Update immediately
    setInterval(updateClock, 1000); // Update every second
});