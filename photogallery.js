// Shared photo gallery for 2023.html - 2026.html.
// Each page first loads its own photogallery<year>.js, which defines
// `galleryYear` and `imageFilenames`; this file builds the gallery from them.
// Photos are served (and resized) by ImageKit.

const imageBasePath = `https://ik.imagekit.io/charliewilson/tr:w-2000/gallery${galleryYear}/`;
const thumbBasePath = `https://ik.imagekit.io/charliewilson/tr:w-700/gallery${galleryYear}/`;

let currentRotation = 0;    // rotation of the enlarged photo, in degrees
let currentImageIndex = -1; // index of the photo open in the small window

// Original position/top of the enlarged photo, restored after rotating
let originalPosition = '';
let originalTop = '';

// Sideways photos need nudging down so they stay inside the window
function updateImagePosition(imgElement) {
    if (currentRotation === 90 || currentRotation === 270) {
        imgElement.style.position = 'relative';
        imgElement.style.top = '133px';
    } else {
        imgElement.style.position = originalPosition;
        imgElement.style.top = originalTop;
    }
}

////////////
// Search //
////////////
function toggleSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');

    if (searchContainer.classList.contains('active')) {
        closeSearch();
    } else {
        searchContainer.classList.add('active');
        setTimeout(() => searchInput.focus(), 200);
    }
}

function searchPhotos() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const galleryItems = document.querySelectorAll('.gallery-item');

    if (searchTerm === '') {
        showAllPhotos();
        return;
    }
    galleryItems.forEach(item => {
        const searchData = item.getAttribute('data-name').toLowerCase();
        const caption = item.querySelector('.gallery-caption').textContent.toLowerCase();
        item.classList.toggle('hidden', !(searchData.includes(searchTerm) || caption.includes(searchTerm)));
    });
}

function closeSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');

    searchContainer.classList.remove('active');
    searchInput.value = '';
    showAllPhotos();
}

function showAllPhotos() {
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.classList.remove('hidden');
    });
}

///////////////////////////////////////////////////////////
// PHOTO GALLERY AND ENLARGED PHOTO WINDOW               //
///////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    const galleryContainer = document.getElementById('photoGallery');
    const lilTabPhotos = document.getElementById('lilTabPhotos');
    const enlargedPhoto = document.getElementById('enlarged-photo');
    const enlargedPhotoImg = document.getElementById('enlarged-photo-img');
    const closebtn = document.getElementById('closebtn');

    if (enlargedPhotoImg) {
        originalPosition = window.getComputedStyle(enlargedPhotoImg).position;
        originalTop = window.getComputedStyle(enlargedPhotoImg).top;
    }

    // Show the loading cursor until every thumbnail has loaded
    document.body.classList.add('gallery-loading-cursor');

    // Thumbnails load only when scrolled near
    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (!img.src) {
                    img.src = img.dataset.src;
                }
                observerInstance.unobserve(img);
            }
        });
    }, {
        rootMargin: '0px 0px 100px 0px'
    });

    function loadGalleryImages() {
        galleryContainer.innerHTML = '';
        let imagesProcessedCount = 0;
        const totalImagesInGallery = imageFilenames.length;

        imageFilenames.forEach((filename, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');
            galleryItem.setAttribute('data-name', filename);

            const img = document.createElement('img');
            img.dataset.src = thumbBasePath + filename;
            img.alt = `Gallery image: ${filename}`;
            img.classList.add('loading');
            img.loading = 'lazy';

            const handleImageProcessed = () => {
                img.classList.remove('loading');
                imagesProcessedCount++;
                if (imagesProcessedCount === totalImagesInGallery) {
                    document.body.classList.remove('gallery-loading-cursor');
                }
            };

            img.onload = handleImageProcessed;
            img.onerror = () => {
                console.error(`Failed to load image: ${imageBasePath + filename}`);
                galleryItem.remove();
                handleImageProcessed();
            };

            galleryItem.appendChild(img);

            const caption = document.createElement('span');
            caption.className = 'gallery-caption';
            caption.textContent = filename;
            galleryItem.appendChild(caption);

            galleryContainer.appendChild(galleryItem);

            galleryItem.addEventListener('click', () => {
                currentImageIndex = index;
                displayEnlargedImage(currentImageIndex);
            });

            observer.observe(img);
        });

        if (totalImagesInGallery === 0) {
            document.body.classList.remove('gallery-loading-cursor');
        }
    }

    function displayEnlargedImage(index) {
        if (index < 0 || index >= imageFilenames.length) return;

        const filename = imageFilenames[index];
        enlargedPhotoImg.src = imageBasePath + filename;
        enlargedPhotoImg.alt = `Gallery image: ${filename}`;

        lilTabPhotos.classList.add('active');
        enlargedPhoto.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Each photo starts unrotated
        currentRotation = 0;
        enlargedPhotoImg.style.transform = 'rotate(0deg)';
        enlargedPhotoImg.style.top = originalTop;

        const windowTitle = lilTabPhotos.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = filename;
        }
    }

    function rotate(degrees) {
        currentRotation = (currentRotation + degrees + 360) % 360;
        enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
        updateImagePosition(enlargedPhotoImg);
    }

    function closeSmallTab() {
        lilTabPhotos.classList.remove('active');
        enlargedPhoto.classList.add('closing');
        setTimeout(() => {
            enlargedPhoto.classList.remove('active', 'closing');
            enlargedPhotoImg.src = '';
            document.body.style.overflow = 'auto';
            currentRotation = 0;
            enlargedPhotoImg.style.transform = 'rotate(0deg)';
            enlargedPhotoImg.style.top = originalTop;
        }, 300); // matches the CSS fade-out
    }

    // Keyboard: arrows = previous/next photo, Esc = close,
    // D/A = rotate right/left, W/S = rotate 180
    document.addEventListener('keydown', function(event) {
        if (lilTabPhotos.classList.contains('active')) {
            switch (event.key) {
                case 'ArrowRight':
                    event.preventDefault();
                    currentImageIndex = (currentImageIndex + 1) % imageFilenames.length;
                    displayEnlargedImage(currentImageIndex);
                    return;
                case 'ArrowLeft':
                    event.preventDefault();
                    currentImageIndex = (currentImageIndex - 1 + imageFilenames.length) % imageFilenames.length;
                    displayEnlargedImage(currentImageIndex);
                    return;
                case 'Escape':
                    event.preventDefault();
                    closeSmallTab();
                    return;
                case 'd': case 'D': rotate(90); return;
                case 'a': case 'A': rotate(-90); return;
                case 'w': case 'W': case 's': case 'S': rotate(180); return;
            }
        }
        if (event.key === 'Escape' && document.getElementById('searchContainer').classList.contains('active')) {
            closeSearch();
        }
    });

    if (closebtn) {
        closebtn.addEventListener('click', closeSmallTab);
    }

    // --- Menus ---
    const rotate90Btn = document.getElementById('rotate90-btn');
    if (rotate90Btn) rotate90Btn.addEventListener('click', () => rotate(90));

    const rotate180Btn = document.getElementById('rotate180-btn');
    if (rotate180Btn) rotate180Btn.addEventListener('click', () => rotate(180));

    // Clicking anywhere else closes the small window's dropdowns
    document.addEventListener('click', function() {
        const lilFileDropdown = document.getElementById('lilFileDropdown');
        const lilViewDropdown = document.getElementById('lilViewDropdown');
        if (lilFileDropdown) lilFileDropdown.style.display = 'none';
        if (lilViewDropdown) lilViewDropdown.style.display = 'none';
    });

    function toggleDropdown(menuId, dropdownId) {
        const menu = document.getElementById(menuId);
        const dropdown = document.getElementById(dropdownId);
        if (menu && dropdown) {
            menu.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
        }
    }
    toggleDropdown('view-menu', 'ViewDropdown');
    toggleDropdown('lil-view-menu', 'lilViewDropdown');
    toggleDropdown('lil-file-menu', 'lilFileDropdown');

    // View > sort by name
    const ViewDropdown = document.getElementById('ViewDropdown');
    function sortGallery(order) {
        imageFilenames.sort((a, b) => order === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
        loadGalleryImages();
        if (ViewDropdown) ViewDropdown.style.display = 'none';
    }
    const aToZBtn = document.getElementById('A to Z-btn');
    if (aToZBtn) aToZBtn.addEventListener('click', e => { e.stopPropagation(); sortGallery('asc'); });
    const zToABtn = document.getElementById('Z to A-btn');
    if (zToABtn) zToABtn.addEventListener('click', e => { e.stopPropagation(); sortGallery('desc'); });

    // File > Download opens the full-size photo in a new tab
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (enlargedPhotoImg.src) {
                window.open(enlargedPhotoImg.src, '_blank');
            }
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchPhotos);
    }

    loadGalleryImages();
});
