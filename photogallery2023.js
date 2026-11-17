// Ensure these variables are accessible globally or at a high enough scope
// if your rotation buttons are outside the main DOMContentLoaded block
// Otherwise, they will be redeclared inside DOMContentLoaded.
// For now, let's keep them scoped within the main DOMContentLoaded.

let currentRotation = 0; // Keep track of current rotation for the enlarged image
let currentImageIndex = -1; // To store the index of the currently displayed image

// Store original position and top for enlarged photo so we can restore them
// These need to be initialized once the img element is loaded or available
let originalPosition = '';
let originalTop = '';

// Helper function to update image position based on rotation
// This function needs access to enlargedPhotoImg
function updateImagePosition(imgElement) {
    if (currentRotation === 90 || currentRotation === 270) {
        imgElement.style.position = 'relative';
        // This 'top' adjustment might need fine-tuning based on your CSS and image sizes
        // A more robust solution might involve dynamic calculation or flexbox centering
        imgElement.style.top = '133px';
    } else {
        imgElement.style.position = originalPosition;
        imgElement.style.top = originalTop;
    }
}
////////////
// SEarch //
////////////
//toggle search
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
       console.log('Searching for:', searchTerm); // Add this line
      const galleryItems = document.querySelectorAll('.gallery-item');
    
      if (searchTerm === '') {
        showAllPhotos();
        return;
      }
      galleryItems.forEach(item => {
        const searchData = item.getAttribute('data-name').toLowerCase();
        const caption = item.querySelector('.gallery-caption').textContent.toLowerCase();
        
        if (searchData.includes(searchTerm) || caption.includes(searchTerm)) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    }
    // Search functionality
    function closeSearch() {
      const searchContainer = document.getElementById('searchContainer');
      const searchInput = document.getElementById('searchInput');
      
      searchContainer.classList.remove('active');
      searchInput.value = '';
      showAllPhotos();
    }
      
    function showAllPhotos() {
      const galleryItems = document.querySelectorAll('.gallery-item');
      galleryItems.forEach(item => {
        item.classList.remove('hidden');
      });
    }

///////////////////////////////////////////////////////////
//////////////DOMCONTENTLAODED FUNCTION////////////////////
// PHOTO GALLERY SCRIPT AND CORRESPONDING ENLARGED IMAGE //
///////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    const galleryContainer = document.getElementById('photoGallery');
    const lilTabPhotos = document.getElementById('lilTabPhotos'); // Corrected ID usage from 'lilTabPhotos'
    const enlargedPhoto = document.getElementById('enlarged-photo');
    const enlargedPhotoImg = document.getElementById('enlarged-photo-img');
    const closebtn = document.getElementById('closebtn'); // Assuming this is your main close button for enlarged photo

    // Initialize original position and top for enlargedPhotoImg once it's available
    // and its styles are computed.
    if (enlargedPhotoImg) {
        originalPosition = window.getComputedStyle(enlargedPhotoImg).position;
        originalTop = window.getComputedStyle(enlargedPhotoImg).top;
    }

    // --- Part 1: Simulate "Automatic" Image Loading ---
    const imageFilenames = [

    'film_08_24_2023.jpg', 'film_09_14_2023.jpg', 'film_09_14_2023A.jpg',
    'film_09_14_2023B.jpg', 'film_09_14_2023C.jpg', 'film_09_19_2023.jpg',
    'film_09_20_2023.jpg', 'film_09_25_2023.jpg', 'film_09_29_2023.jpg',
    'film_09_30_2023.jpg', 'film_10_07_2023.jpg', 'film_10_08_2023.jpg',
    'film_10_10_2023.jpg', 'film_10_13_2023.jpg', 'film_10_15_2023.jpg',
    'film_10_15_2023A.jpg', 'film_10_23_2023.jpg', 'film_11_03_2023.jpg',

    ];
    const imageBasePath = 'images/gallery2023/';
    const thumbBasePath = 'images/gallery2023/thumbs/';

    // --- Add the loading cursor class before rendering starts ---
    document.body.classList.add('gallery-loading-cursor');

    // Set up the observer ONCE
    let observer; // Declared outside to be accessible across functions
    function setupObserver() {
        observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (!img.src) {
                        img.src = img.dataset.src;
                    }
                    observerInstance.unobserve(img);
                }
                // Removed the img.removeAttribute('src') from else block
                // as it can cause images to disappear if user scrolls too fast
            });
        }, {
            rootMargin: '0px 0px 100px 0px'
        });
    }

    function loadGalleryImages() {
        galleryContainer.innerHTML = '';
        let imagesProcessedCount = 0;
        const totalImagesInGallery = imageFilenames.length;

        imageFilenames.forEach((filename, index) => { // Get index here
            const imgPath = imageBasePath + filename;
            const thumbPath = thumbBasePath + filename; // Assuming thumbnails are named the same

            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');
            galleryItem.setAttribute('data-name', filename);

            const img = document.createElement('img');
            img.dataset.src = thumbPath;
            img.alt = `Gallery image: ${filename}`;
            img.classList.add('loading');
            img.loading = 'lazy'; // Native lazy loading

            const handleImageProcessed = () => {
                img.classList.remove('loading');
                imagesProcessedCount++;
                if (imagesProcessedCount === totalImagesInGallery) {
                    document.body.classList.remove('gallery-loading-cursor');
                    console.log("Gallery initialized. Loading cursor removed.");
                }
            };

            img.onload = handleImageProcessed;
            img.onerror = () => {
                console.error(`Failed to load image: ${imgPath}`);
                galleryItem.remove();
                handleImageProcessed();
            };

            galleryItem.appendChild(img);

            const caption = document.createElement('span');
            caption.className = 'gallery-caption';
            caption.textContent = filename;
            galleryItem.appendChild(caption);

            galleryContainer.appendChild(galleryItem);

            // --- Part 2: Click to Enlarge (Enlarged Photo View) ---
            galleryItem.addEventListener('click', () => {
                currentImageIndex = index; // Set the current image index when opened
                displayEnlargedImage(currentImageIndex); // Use a new helper function
            });
        });

        // Observe all new images
        galleryContainer.querySelectorAll('img').forEach(img => {
            if (observer) { // Ensure observer is set up
                observer.observe(img);
            }
        });

        if (totalImagesInGallery === 0) {
            document.body.classList.remove('gallery-loading-cursor');
            console.log("No images in gallery. Loading cursor removed immediately.");
        }
    }

    // New helper function to display an enlarged image by its index
    function displayEnlargedImage(index) {
        if (index < 0 || index >= imageFilenames.length) {
            console.warn("Attempted to display image with invalid index:", index);
            return;
        }

        const filename = imageFilenames[index];
        const imgPath = imageBasePath + filename;

        enlargedPhotoImg.src = imgPath;
        enlargedPhotoImg.alt = `Gallery image: ${filename}`;

        lilTabPhotos.classList.add('active');
        enlargedPhoto.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Reset starting rotation & position to 0 for the new image
        currentRotation = 0;
        enlargedPhotoImg.style.transform = 'rotate(0deg)';
        enlargedPhotoImg.style.top = originalTop; // Restore original top position

        // Set the window title to the filename
        const windowTitle = lilTabPhotos.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = filename;
        }
    }

    // --- Keyboard Navigation for Enlarged Image ---
    document.addEventListener('keydown', function(event) {
        // Only navigate if the enlarged photo tab is active
        if (lilTabPhotos && lilTabPhotos.classList.contains('active')) {
            if (event.key === 'ArrowRight') {
                event.preventDefault(); // Prevent page scrolling
                currentImageIndex = (currentImageIndex + 1) % imageFilenames.length;
                displayEnlargedImage(currentImageIndex);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault(); // Prevent page scrolling
                currentImageIndex = (currentImageIndex - 1 + imageFilenames.length) % imageFilenames.length;
                displayEnlargedImage(currentImageIndex);
            } else if (event.key === 'Escape') {
                event.preventDefault(); // Prevent default escape behavior if needed
                closeSmallTab();
            }
        }
    });

    // --- Rotation button functionality (relocated to main DOMContentLoaded) ---
    const rotate90Btn = document.getElementById('rotate90-btn');
    if (rotate90Btn) {
        rotate90Btn.addEventListener('click', function() {
            currentRotation = (currentRotation + 90) % 360;
            enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
            updateImagePosition(enlargedPhotoImg); // Pass the image element
        });
    }

    // Keyboard shortcuts: D = rotate right, A = rotate left
    document.addEventListener('keydown', function(event) {
        if (lilTabPhotos && lilTabPhotos.classList.contains('active')) {
            if (event.key === 'd' || event.key === 'D') {
                currentRotation = (currentRotation + 90) % 360;
                enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
                updateImagePosition(enlargedPhotoImg);
            } else if (event.key === 'a' || event.key === 'A') {
                currentRotation = (currentRotation - 90 + 360) % 360;
                enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
                updateImagePosition(enlargedPhotoImg);
            }
        }
    });

    const rotate180Btn = document.getElementById('rotate180-btn');
    if (rotate180Btn) {
        rotate180Btn.addEventListener('click', function() {
            currentRotation = (currentRotation + 180) % 360;
            enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
            updateImagePosition(enlargedPhotoImg); // Pass the image element
        });
    }
    // Keyboard shortcut: W = rotate 180 degrees S = rotate 180 degrees
    document.addEventListener('keydown', function(event) {
        if (lilTabPhotos && lilTabPhotos.classList.contains('active')) {
            if (event.key === 'w' || event.key === 'W') {
                currentRotation = (currentRotation + 180) % 360;
                enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
                updateImagePosition(enlargedPhotoImg);
            } else if (event.key === 's' || event.key === 'S') {
                currentRotation = (currentRotation - 180 + 360) % 360;
                enlargedPhotoImg.style.transform = `rotate(${currentRotation}deg)`;
                updateImagePosition(enlargedPhotoImg);
            }
        }
    });

    // --- Lil Tab Close when clicking the 'x' button (relocated and adjusted) ---
    // Make sure 'closebtn' element exists in your HTML with id="close-btn"
    if (closebtn) {
        closebtn.addEventListener('click', closeSmallTab);
    } else {
        console.warn("Close button with ID 'close-btn' not found in HTML.");
    }

    function closeSmallTab() {
        if (lilTabPhotos && enlargedPhoto) { // Ensure elements exist before trying to access properties
            lilTabPhotos.classList.remove('active');
            enlargedPhoto.classList.add('closing'); // Add closing animation class
            setTimeout(() => {
                enlargedPhoto.classList.remove('active', 'closing'); // Remove active and closing classes
                enlargedPhotoImg.src = ''; // Clear image source for next time
                document.body.style.overflow = 'auto'; // Re-enable body scrolling
                currentRotation = 0; // Reset rotation on close
                enlargedPhotoImg.style.transform = 'rotate(0deg)'; // Ensure it snaps back
                enlargedPhotoImg.style.top = originalTop; // Reset position
            }, 300); // Match CSS fadeOut animation duration
        }
    }

    // Hide dropdowns when clicking elsewhere (added for both lil-file-dropdown and lil-view-dropdown)
    document.addEventListener('click', function() {
        const lilFileDropdown = document.getElementById('lilFileDropdown');
        const lilViewDropdown = document.getElementById('lilViewDropdown');
        if (lilFileDropdown) lilFileDropdown.style.display = 'none';
        if (lilViewDropdown) lilViewDropdown.style.display = 'none';
    });


    // --- View Menu Dropdown (relocated for better scope) ---
    const ViewMenu = document.getElementById('view-menu');
    const ViewDropdown = document.getElementById('ViewDropdown');
    const aToZBtn = document.getElementById('A to Z-btn');
    const zToABtn = document.getElementById('Z to A-btn');

    if (ViewMenu && ViewDropdown) {
        ViewMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            ViewDropdown.style.display = ViewDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    function sortGallery(order = 'asc') {
        if (!Array.isArray(imageFilenames)) return;
        imageFilenames.sort((a, b) =>
            order === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
        );
        loadGalleryImages();
        if (ViewDropdown) ViewDropdown.style.display = 'none';
    }

    if (aToZBtn) {
        aToZBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sortGallery('asc');
        });
    }

    if (zToABtn) {
        zToABtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sortGallery('desc');
        });
    }

    // --- Lil Tab View Dropdown (relocated for better scope) ---
    const lilViewMenu = document.getElementById('lil-view-menu'); // Corrected ID from 'lilViewMenu'
    const lilViewDropdown = document.getElementById('lilViewDropdown');

    if (lilViewMenu && lilViewDropdown) {
        lilViewMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            lilViewDropdown.style.display = lilViewDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }
    // No need for a separate document.addEventListener('click') for this dropdown,
    // as the main one already handles hiding all dropdowns.


    // Close search when Escape key is pressed
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        const searchContainer = document.getElementById('searchContainer');
        if (searchContainer.classList.contains('active')) {
          closeSearch();
        }
      }
    });
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', searchPhotos);
        }


    // --- Initial load of gallery images when the page loads ---
    setupObserver(); // Setup the Intersection Observer first
    loadGalleryImages(); // Then load the images into the gallery

    // --- Dropdown menu for lil Tab File (relocated for better scope) ---
    const lilFileMenu = document.getElementById('lil-file-menu');
    const lilFileDropdown = document.getElementById('lilFileDropdown');

    if (lilFileMenu && lilFileDropdown) {
        lilFileMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            lilFileDropdown.style.display = lilFileDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }
    // No need for a separate document.addEventListener('click') for this dropdown,
    // as the main one already handles hiding all dropdowns.

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // enlargedPhotoImg is already declared at the top of DOMContentLoaded
            if (enlargedPhotoImg && enlargedPhotoImg.src) {
                window.open(enlargedPhotoImg.src, '_blank');
            }
        });
    }

    // Resize enlarged photo
    function resizeEnlargedPhoto() {
        // Ensure lilTabPhotos, titleBar, menuBar, enlargedPhoto are correctly identified within the current scope
        const currentLilTabPhotos = document.getElementById('lil-tab-photos');
        if (currentLilTabPhotos) {
            const titleBar = currentLilTabPhotos.querySelector('.title-bar');
            const menuBar = currentLilTabPhotos.querySelector('.menu-bar');
            const currentEnlargedPhoto = currentLilTabPhotos.querySelector('.enlarged-photo'); // Corrected to query within the tab

            const barsHeight = (titleBar?.offsetHeight || 0) + (menuBar?.offsetHeight || 0);
            const popupHeight = currentLilTabPhotos.offsetHeight;
            if (currentEnlargedPhoto) {
                 // Adjust height calc to account for padding/borders if any on .enlarged-photo itself
                currentEnlargedPhoto.style.height = (popupHeight - barsHeight) + 'px';
            }
        }
    }
    window.addEventListener('resize', resizeEnlargedPhoto);

    // Call resizeEnlargedPhoto immediately after the lilTabPhotos is made active
    // This needs to be called within the galleryItem.addEventListener('click') block
    // and whenever the enlarged photo is displayed/reshown.
    // I've moved this to the new displayEnlargedImage function.
    

});
