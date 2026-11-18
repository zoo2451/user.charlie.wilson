// Ensure these variables are accessible globally or at a high enough scope
let currentRotation = 0; // Keep track of current rotation for the enlarged PDF
let currentImageIndex = -1; // To store the index of the currently displayed PDF

// Store original position and top for enlarged PDF container
let originalPosition = '';
let originalTop = '';

// Store orignial size/position
let lilTabPrevSize = null;
let lilTabIsMaximized = false;

// Helper function to update PDF container position based on rotation
function updateImagePosition(container) {
    if (currentRotation === 90 || currentRotation === 270) {
        container.style.position = 'relative';
        container.style.top = '133px';
    } else {
        container.style.position = originalPosition;
        container.style.top = originalTop;
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
    console.log('Searching for:', searchTerm);
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
//////////////
// Booklist //
//////////////
// Add books under the right year, one per line, inside quotes and
// followed by a comma, e.g.  "Meditations - Marcus Aurelius",
// Years show newest first. To add a new year, copy a block like "2026": [ ... ],
const booklist = {
    "2026": [
    ],
    "2025": [
    ],
    "2024": [
    ],
    "2023": [
    ],
};

// Remembers whether the Booklist set the window size, so it can be
// cleared again when the window closes (PDFs use their own sizing).
let booklistSizedWindow = false;

function displayBooklist() {
    const lilTabLibrary = document.getElementById('lilTabLibrary');
    const enlargedText = document.getElementById('enlarged-text');

    if (!lilTabLibrary || !enlargedText) return;

    // Not viewing a PDF, so arrow keys shouldn't flip through PDFs
    currentImageIndex = -1;

    enlargedText.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'booklist';

    Object.keys(booklist)
        .sort((a, b) => b.localeCompare(a))
        .forEach(year => {
            const box = document.createElement('div');
            box.className = 'booklist-year';

            const heading = document.createElement('div');
            heading.className = 'booklist-year-title';
            heading.textContent = year;
            box.appendChild(heading);

            const books = document.createElement('ul');
            books.className = 'booklist-books';
            booklist[year].forEach(title => {
                const item = document.createElement('li');
                item.textContent = title;
                books.appendChild(item);
            });
            box.appendChild(books);

            list.appendChild(box);
        });

    enlargedText.appendChild(list);

    // Give the window a book-list shape unless the person already sized it
    if (!lilTabLibrary.style.width && !lilTabLibrary.style.height) {
        lilTabLibrary.style.width = '380px';
        lilTabLibrary.style.height = '480px';
        booklistSizedWindow = true;
    }

    // Set initial position if not already set
    if (!lilTabLibrary.style.left || !lilTabLibrary.style.top) {
        const windowWidth = lilTabLibrary.offsetWidth || 800;
        const windowHeight = lilTabLibrary.offsetHeight || 600;
        const centerX = (window.innerWidth - windowWidth) / 2;
        const centerY = (window.innerHeight - windowHeight) / 2;
        
        lilTabLibrary.style.left = Math.max(0, centerX) + 'px';
        lilTabLibrary.style.top = Math.max(0, centerY) + 'px';
        lilTabLibrary.style.position = 'fixed';
    }

    // Show the modal
    lilTabLibrary.classList.add('active');
    enlargedText.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset rotation
    currentRotation = 0;
    enlargedText.style.transform = 'rotate(0deg)';

    // Set the window title
    const windowTitle = lilTabLibrary.querySelector('.window-title');
    if (windowTitle) {
        windowTitle.textContent = 'Booklist';
    }
    const windowIcon = lilTabLibrary.querySelector('.window-icon img');
    if (windowIcon) {
        windowIcon.src = 'images/notes.png';
        windowIcon.alt = 'Booklist';
    }

    // Fit the scrolling area to the window (defined inside DOMContentLoaded)
    window.dispatchEvent(new Event('resize'));
}


///////////////////////////////////////////////////////////
//////////////DOM CONTENT LOADED FUNCTION/////////////////
// LIBRARY GALLERY SCRIPT AND CORRESPONDING ENLARGED PDF //
///////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    const galleryContainer = document.getElementById('libraryGallery');
    const lilTabLibrary = document.getElementById('lilTabLibrary');
    const enlargedText = document.getElementById('enlarged-text');
    const closebtn = document.getElementById('closebtn');

    // Initialize original position and top for enlargedText container
    if (enlargedText) {
        originalPosition = window.getComputedStyle(enlargedText).position;
        originalTop = window.getComputedStyle(enlargedText).top;
    }

    // --- Part 1: PDF Files Array ---
    const imageFilenames = [
  "An_Essay_Concering_Human_Understanding.pdf",
  "Autobiography_of_Benjamin Franklin.pdf",
  "Drawing_Architecture.pdf",
  "Existential-Analysis-and-Logotherapy.pdf",
  "Logic_or_the_Art_of_Thinking.pdf",
  "Ong_Walter_J_Orality_and_Literacy_2nd_ed.pdf",
  "Revelations Of Divine Love, by Julian of Norwich_.pdf",
  "The Memorable Thoughts of Socrates, by Xenophon.pdf",
  "The_Attic_Nights_of_Aulus_Gellius.pdf",
  "The_Decline_and_Fall_of_the_Roman_Empire.pdf",
  "The_Enchiridion_of_Epicetus.pdf",
  "The_Way_to_Wealth.pdf",
  "This Is My God-Wouk(1960).pdf",
  "Wealth_of_Nations.pdf",
  "ethics.spinoza.pdf",
  "mans-search-for-meaning.pdf",
  "ron_carter_comprehensive_bass_method.pdf",
  "ruling-england-1042-1217-1138786551-9781138786554_compress.pdf",
  "the-norton-introduction-to-philosophy-second-edition.pdf",

    ];
    const imageBasePath = 'images/library/';

    // Add the loading cursor class before rendering starts
    document.body.classList.add('gallery-loading-cursor');

    // Set up the observer
    let observer;
    function setupObserver() {
        observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (!img.src && img.dataset.src) {
                        img.src = img.dataset.src;
                    }
                    observerInstance.unobserve(img);
                }
            });
        }, {
            rootMargin: '0px 0px 100px 0px'
        });
    }

    function loadLibraryContent() {
        galleryContainer.querySelectorAll('.gallery-item').forEach(item => item.remove());
        let imagesProcessedCount = 0;
        const totalImagesInGallery = imageFilenames.length;

        imageFilenames.forEach((filename, index) => {
            const pdfPath = imageBasePath + filename;
            const thumbPath = 'images/pdf_icon.png'; // Fixed: added missing 's'

            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');
            galleryItem.setAttribute('data-name', filename);

            const thumb = document.createElement('img');
            thumb.dataset.src = thumbPath;
            thumb.alt = `PDF: ${filename}`;
            thumb.classList.add('loading');
            thumb.loading = 'lazy';

            const handleImageProcessed = () => {
                thumb.classList.remove('loading');
                imagesProcessedCount++;
                if (imagesProcessedCount === totalImagesInGallery) {
                    document.body.classList.remove('gallery-loading-cursor');
                    console.log("Gallery initialized. Loading cursor removed.");
                }
            };

            thumb.onload = handleImageProcessed;
            thumb.onerror = () => {
                // Fallback to a generic icon or create a simple placeholder
                thumb.src = 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120">
                        <rect width="100" height="120" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
                        <text x="50" y="60" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">PDF</text>
                    </svg>
                `);
                handleImageProcessed();
            };

            galleryItem.appendChild(thumb);

            const caption = document.createElement('span');
            caption.className = 'gallery-caption';
            caption.textContent = filename.replace('.pdf', '').replace(/_/g, ' '); // Clean up display name
            galleryItem.appendChild(caption);

            galleryContainer.appendChild(galleryItem);

            // Click to open PDF
            galleryItem.addEventListener('click', () => {
                currentImageIndex = index;
                displayEnlargedPDF(currentImageIndex);
            });
        });

        // Observe all new images
        galleryContainer.querySelectorAll('img').forEach(img => {
            if (observer) {
                observer.observe(img);
            }
        });

        if (totalImagesInGallery === 0) {
            document.body.classList.remove('gallery-loading-cursor');
            console.log("No PDFs in gallery. Loading cursor removed immediately.");
        }
    }

    // Function to display an enlarged PDF by its index
    function displayEnlargedPDF(index) {
        if (index < 0 || index >= imageFilenames.length) {
            console.warn("Attempted to display PDF with invalid index:", index);
            return;
        }
        
        const filename = imageFilenames[index];
        const pdfPath = imageBasePath + filename;

        // Clear the container
        enlargedText.innerHTML = '';

        // Create embed element for PDF
        const pdfEmbed = document.createElement('embed');
        pdfEmbed.src = pdfPath;
        pdfEmbed.type = 'application/pdf';
        pdfEmbed.width = '100%';
        pdfEmbed.height = '100%';
        pdfEmbed.style.border = 'none';
        pdfEmbed.id = 'current-pdf'; // Add ID for rotation reference

        enlargedText.appendChild(pdfEmbed);

        // Show the modal
        lilTabLibrary.classList.add('active');
        enlargedText.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Reset rotation when opening new PDF
        currentRotation = 0;
        enlargedText.style.transform = 'rotate(0deg)';

        // Set the window title to the filename
        const windowTitle = lilTabLibrary.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = filename.replace('.pdf', '').replace(/_/g, ' ');
        }
        const windowIcon = lilTabLibrary.querySelector('.window-icon img');
        if (windowIcon) {
            windowIcon.src = 'images/pdf_icon.png'; // or another path based on the PDF
            windowIcon.alt = filename;
        }

        // Call resize function
        resizeEnlargedText();
    }

    // Keyboard Navigation for Enlarged PDF
    document.addEventListener('keydown', function(event) {
        // Only navigate if the enlarged PDF tab is active
        if (lilTabLibrary && lilTabLibrary.classList.contains('active')) {
            // Don't navigate if we're in notes mode or if focus is on textarea
            if (currentImageIndex === -1 || event.target.tagName === 'TEXTAREA') {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeSmallTab();
                }
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                currentImageIndex = (currentImageIndex + 1) % imageFilenames.length;
                displayEnlargedPDF(currentImageIndex);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                currentImageIndex = (currentImageIndex - 1 + imageFilenames.length) % imageFilenames.length;
                displayEnlargedPDF(currentImageIndex);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeSmallTab();
            }
        }
    });
    ////////////////////////////////////
    // Resizable window functionality //
    ////////////////////////////////////

// Replace your existing makeWindowResizable function with this enhanced version
function makeWindowResizable() {
    const lilTabLibrary = document.getElementById('lilTabLibrary');
    if (!lilTabLibrary) return;

    // Create resize handles
    const resizeHandles = [
        'resize-handle-n',
        'resize-handle-s', 
        'resize-handle-e',
        'resize-handle-w',
        'resize-handle-ne',
        'resize-handle-nw',
        'resize-handle-se',
        'resize-handle-sw'
    ];

    // Add resize handles to the window
    resizeHandles.forEach(handleClass => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${handleClass}`;
        lilTabLibrary.appendChild(handle);
    });

    // Dragging variables
    let isDragging = false;
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    // Make title bar draggable
    const titleBar = lilTabLibrary.querySelector('.title-bar');
    if (titleBar) {
        titleBar.style.cursor = 'move';
        titleBar.addEventListener('mousedown', initDrag);
    }

    // Add event listeners to all resize handles
    lilTabLibrary.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', initResize);
    });

    function initDrag(e) {
        // Don't drag if clicking on window controls (close button)
        if (e.target.closest('.window-controls')) return;
        
        e.preventDefault();
        isDragging = true;
        
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = lilTabLibrary.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.body.style.userSelect = 'none';
    }

    function doDrag(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Keep window within viewport bounds
        const windowRect = lilTabLibrary.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Prevent window from going completely off-screen
        newLeft = Math.max(-windowRect.width + 100, Math.min(newLeft, viewportWidth - 100));
        newTop = Math.max(0, Math.min(newTop, viewportHeight - 50));
        
        lilTabLibrary.style.left = newLeft + 'px';
        lilTabLibrary.style.top = newTop + 'px';
        
        // Remove any automatic positioning
        lilTabLibrary.style.position = 'fixed';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.body.style.userSelect = '';
    }

    function initResize(e) {
        e.preventDefault();
        isResizing = true;
        currentHandle = e.target;
        
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = lilTabLibrary.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        document.body.style.cursor = getResizeCursor(currentHandle.className);
        document.body.style.userSelect = 'none';
    }

    function doResize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        const minWidth = 400;
        const minHeight = 300;
        
        // Handle different resize directions
        if (currentHandle.classList.contains('resize-handle-e')) {
            newWidth = Math.max(minWidth, startWidth + deltaX);
        } else if (currentHandle.classList.contains('resize-handle-w')) {
            newWidth = Math.max(minWidth, startWidth - deltaX);
            if (newWidth > minWidth) {
                newLeft = startLeft + deltaX;
            }
        } else if (currentHandle.classList.contains('resize-handle-s')) {
            newHeight = Math.max(minHeight, startHeight + deltaY);
        } else if (currentHandle.classList.contains('resize-handle-n')) {
            newHeight = Math.max(minHeight, startHeight - deltaY);
            if (newHeight > minHeight) {
                newTop = startTop + deltaY;
            }
        } else if (currentHandle.classList.contains('resize-handle-se')) {
            newWidth = Math.max(minWidth, startWidth + deltaX);
            newHeight = Math.max(minHeight, startHeight + deltaY);
        } else if (currentHandle.classList.contains('resize-handle-sw')) {
            newWidth = Math.max(minWidth, startWidth - deltaX);
            newHeight = Math.max(minHeight, startHeight + deltaY);
            if (newWidth > minWidth) {
                newLeft = startLeft + deltaX;
            }
        } else if (currentHandle.classList.contains('resize-handle-ne')) {
            newWidth = Math.max(minWidth, startWidth + deltaX);
            newHeight = Math.max(minHeight, startHeight - deltaY);
            if (newHeight > minHeight) {
                newTop = startTop + deltaY;
            }
        } else if (currentHandle.classList.contains('resize-handle-nw')) {
            newWidth = Math.max(minWidth, startWidth - deltaX);
            newHeight = Math.max(minHeight, startHeight - deltaY);
            if (newWidth > minWidth) {
                newLeft = startLeft + deltaX;
            }
            if (newHeight > minHeight) {
                newTop = startTop + deltaY;
            }
        }
        
        // Apply new dimensions and position
        lilTabLibrary.style.width = newWidth + 'px';
        lilTabLibrary.style.height = newHeight + 'px';
        lilTabLibrary.style.left = newLeft + 'px';
        lilTabLibrary.style.top = newTop + 'px';
        lilTabLibrary.style.position = 'fixed';
        
        // Update the enlarged text container height
        resizeEnlargedText();
    }

    function stopResize() {
        isResizing = false;
        currentHandle = null;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    function getResizeCursor(className) {
        if (className.includes('resize-handle-n')) return 'n-resize';
        if (className.includes('resize-handle-s')) return 's-resize';
        if (className.includes('resize-handle-e')) return 'e-resize';
        if (className.includes('resize-handle-w')) return 'w-resize';
        if (className.includes('resize-handle-ne')) return 'ne-resize';
        if (className.includes('resize-handle-nw')) return 'nw-resize';
        if (className.includes('resize-handle-se')) return 'se-resize';
        if (className.includes('resize-handle-sw')) return 'sw-resize';
        return 'default';
    }
}

// Remove or modify the updateImagePosition function to prevent automatic repositioning
function updateImagePosition(container) {
    // Remove the automatic positioning logic that was causing issues
    // The window position should now be controlled entirely by user dragging
    
    // Only apply transform for rotation, don't change position
    if (currentRotation !== 0) {
        const enlargedText = document.getElementById('enlarged-text');
        if (enlargedText) {
            enlargedText.style.transform = `rotate(${currentRotation}deg)`;
        }
    }
}

// Update the displayEnlargedPDF function to set initial position properly
function displayEnlargedPDF(index) {
    if (index < 0 || index >= imageFilenames.length) {
        console.warn("Attempted to display PDF with invalid index:", index);
        return;
    }
    
    const filename = imageFilenames[index];
    const pdfPath = imageBasePath + filename;
    const lilTabLibrary = document.getElementById('lilTabLibrary');
    const enlargedText = document.getElementById('enlarged-text');

    // Clear the container
    enlargedText.innerHTML = '';

    // Create embed element for PDF
    const pdfEmbed = document.createElement('embed');
    pdfEmbed.src = pdfPath;
    pdfEmbed.type = 'application/pdf';
    pdfEmbed.width = '100%';
    pdfEmbed.height = '100%';
    pdfEmbed.style.border = 'none';
    pdfEmbed.id = 'current-pdf';

    enlargedText.appendChild(pdfEmbed);

    // Set initial position if not already set
    if (!lilTabLibrary.style.left || !lilTabLibrary.style.top) {
        // Center the window initially
        const windowWidth = lilTabLibrary.offsetWidth || 800;
        const windowHeight = lilTabLibrary.offsetHeight || 600;
        const centerX = (window.innerWidth - windowWidth) / 2;
        const centerY = (window.innerHeight - windowHeight) / 2;
        
        lilTabLibrary.style.left = Math.max(0, centerX) + 'px';
        lilTabLibrary.style.top = Math.max(0, centerY) + 'px';
        lilTabLibrary.style.position = 'fixed';
    }

    // Show the modal
    lilTabLibrary.classList.add('active');
    enlargedText.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset rotation when opening new PDF
    currentRotation = 0;
    enlargedText.style.transform = 'rotate(0deg)';

    // Set the window title to the filename
    const windowTitle = lilTabLibrary.querySelector('.window-title');
    if (windowTitle) {
        windowTitle.textContent = filename.replace('.pdf', '').replace(/_/g, ' ');
    }

    // Call resize function
    resizeEnlargedText();
}
    // Close button functionality
    if (closebtn) {
        closebtn.addEventListener('click', closeSmallTab);
    } else {
        console.warn("Close button with ID 'closebtn' not found in HTML.");
    }

    function closeSmallTab() {
        if (lilTabLibrary && enlargedText) {
            lilTabLibrary.classList.remove('active');
            enlargedText.classList.add('closing');
            setTimeout(() => {
                enlargedText.classList.remove('active', 'closing');
                enlargedText.innerHTML = ''; // Clear PDF content
                document.body.style.overflow = 'auto';
                currentRotation = 0;
                enlargedText.style.transform = 'rotate(0deg)';
                enlargedText.style.top = originalTop;
                if (booklistSizedWindow && !lilTabIsMaximized) {
                    lilTabLibrary.style.width = '';
                    lilTabLibrary.style.height = '';
                }
                booklistSizedWindow = false;
            }, 300);
        }
    }
    // MAXIMIZE AND MINIMIZE FUNCTIONALITY
    const maxBtn = document.getElementById('maxbtn');
        if (maxBtn) {
        maxBtn.addEventListener('click', function() {
            const lilTabLibrary = document.getElementById('lilTabLibrary');
            if (!lilTabLibrary) return;

            if (!lilTabIsMaximized) {
                // Save current size and position
                lilTabPrevSize = {
                    width: lilTabLibrary.style.width || lilTabLibrary.offsetWidth + 'px',
                    height: lilTabLibrary.style.height || lilTabLibrary.offsetHeight + 'px',
                    left: lilTabLibrary.style.left || lilTabLibrary.offsetLeft + 'px',
                    top: lilTabLibrary.style.top || lilTabLibrary.offsetTop + 'px'
                };
                // Maximize
                lilTabLibrary.style.width = window.innerWidth + 'px';
                lilTabLibrary.style.height = window.innerHeight + 'px';
                lilTabLibrary.style.left = '0px';
                lilTabLibrary.style.top = '0px';
                lilTabLibrary.style.position = 'fixed';
                lilTabIsMaximized = true;
            } else {
                // Restore previous size and position
                if (lilTabPrevSize) {
                    lilTabLibrary.style.width = lilTabPrevSize.width;
                    lilTabLibrary.style.height = lilTabPrevSize.height;
                    lilTabLibrary.style.left = lilTabPrevSize.left;
                    lilTabLibrary.style.top = lilTabPrevSize.top;
                    lilTabLibrary.style.position = 'fixed';
                }
                lilTabIsMaximized = false;
            }
            resizeEnlargedText();
        });
    }


    // Hide dropdowns when clicking elsewhere
    document.addEventListener('click', function() {
        const lilFileDropdown = document.getElementById('lilFileDropdown');
        const lilViewDropdown = document.getElementById('lilViewDropdown');
        if (lilFileDropdown) lilFileDropdown.style.display = 'none';
        if (lilViewDropdown) lilViewDropdown.style.display = 'none';
    });

    // View Menu Dropdown
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
        loadLibraryContent();
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

    // Lil Tab View Dropdown
    const lilViewMenu = document.getElementById('lil-view-menu');
    const lilViewDropdown = document.getElementById('lilViewDropdown');

    if (lilViewMenu && lilViewDropdown) {
        lilViewMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            lilViewDropdown.style.display = lilViewDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    // Close search when Escape key is pressed
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const searchContainer = document.getElementById('searchContainer');
            if (searchContainer && searchContainer.classList.contains('active')) {
                closeSearch();
            }
        }
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchPhotos);
    }

    // Initial load
    setupObserver();
    loadLibraryContent();
    makeWindowResizable();

    // Dropdown menu for lil Tab File
    const lilFileMenu = document.getElementById('lil-file-menu');
    const lilFileDropdown = document.getElementById('lilFileDropdown');

    if (lilFileMenu && lilFileDropdown) {
        lilFileMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            lilFileDropdown.style.display = lilFileDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    // Download button functionality
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            const currentPdf = document.getElementById('current-pdf');
            if (currentPdf && currentPdf.src) {
                window.open(currentPdf.src, '_blank');
            }
        });
    }
    // Download button functionality
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            const currentPdf = document.getElementById('current-pdf');
            if (currentPdf && currentPdf.src) {
                window.open(currentPdf.src, '_blank');
            }
        });
    }
    
    saveBtn.addEventListener('click', function() {
        saveLibraryNotes(notesTextarea.value);
        // Visual feedback
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveBtn.textContent = 'Save Notes';
        }, 1000);
    });


    // Resize enlarged PDF container
    // Replace your existing resizeEnlargedText function with this updated version
    function resizeEnlargedText() {
        const currentLilTabLibrary = document.getElementById('lilTabLibrary');
        if (currentLilTabLibrary && currentLilTabLibrary.classList.contains('active')) {
            const titleBar = currentLilTabLibrary.querySelector('.title-bar');
            const menuBar = currentLilTabLibrary.querySelector('.menu-bar');
            const currentEnlargedText = currentLilTabLibrary.querySelector('.enlarged-text');

            const barsHeight = (titleBar?.offsetHeight || 0) + (menuBar?.offsetHeight || 0);
            
            // Get the actual window height (either from resizing or default)
            const windowHeight = currentLilTabLibrary.offsetHeight;
            
            if (currentEnlargedText) {
                const newHeight = windowHeight - barsHeight;
                currentEnlargedText.style.height = newHeight + 'px';
                
                // Also update the PDF embed if it exists
                const pdfEmbed = currentEnlargedText.querySelector('embed');
                if (pdfEmbed) {
                    pdfEmbed.style.height = '100%';
                }
            }
        }
    }
    
    window.addEventListener('resize', resizeEnlargedText);
});