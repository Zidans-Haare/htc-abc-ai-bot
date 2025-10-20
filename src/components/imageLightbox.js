
import { scrollToBottom } from './ui.js'; // If needed, but probably not

export function processImagesInBubble(bubble) {
  const images = bubble.querySelectorAll('img');
  images.forEach(img => {
    // Skip if the image has already been processed
    if (img.dataset.fullSrc) {
      return;
    }

    const originalSrc = img.src;
    let pathname;
    try {
      const url = new URL(originalSrc);
      pathname = url.pathname;
    } catch (e) {
      // If not a valid URL, assume it's relative and use as is
      pathname = originalSrc;
    }
    
    if (!pathname.startsWith('/uploads/images/')) return; // Only handle our uploads

    img.dataset.fullSrc = originalSrc; // Store original for lightbox
    img.style.cursor = 'pointer'; // Indicate clickable
    //img.alt = img.alt || 'AI-generated image'; // Accessibility
    img.tabIndex = 0; // Make tabbable

    // Measure bubble width after insertion
    const resizeImage = () => {
      const bubbleWidth = bubble.clientWidth;
      if (bubbleWidth > 0) {
        const roundedWidth = Math.floor(bubbleWidth / 20) * 20; // Round down to nearest multiple of 20px
        const fileName = pathname.split('/').pop();
        const baseName = fileName.split('.').shift();
        const ext = fileName.split('.').pop();
        img.src = `/uploads/images/${baseName}_${roundedWidth}px.${ext}`;
      }
    };

    // Initial resize
    resizeImage();

    // Resize on window resize (debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeImage, 200);
    });

    // Lightbox click and keydown (for accessibility)
    img.addEventListener('click', () => openLightbox(originalSrc));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(originalSrc);
      }
    });
  });
}

export function openLightbox(src) {
  const lightbox = document.createElement('div');
  lightbox.id = 'lightbox';
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-content">
      <img src="${src}" alt="Full image">
      <button class="lightbox-close">&times;</button>
    </div>
  `;
  document.body.appendChild(lightbox);

  lightbox.addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', handleLightboxKeydown);
  lightbox.querySelector('img').focus(); // Accessibility: focus on image
}

export function closeLightbox(e) {
  if (e && (e.target.id !== 'lightbox' && !e.target.classList.contains('lightbox-close'))) return;
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.remove();
    document.removeEventListener('keydown', handleLightboxKeydown);
  }
}

function handleLightboxKeydown(e) {
  if (e.key === 'Escape') closeLightbox();
}
