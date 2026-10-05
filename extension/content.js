/**
 * TokenTrim - Content Script
 * Minimal injected script for PDF URL extraction and page detection
 */

(function() {
  'use strict';

  // ==================== INITIALIZATION ====================
  console.log('TokenTrim content script loaded');

  // Check if the current page is a PDF
  const isPdfPage = checkIfPdfPage();
  
  if (isPdfPage) {
    console.log('PDF page detected:', window.location.href);
    notifyBackgroundOfPdf();
  }

  // ==================== PDF DETECTION ====================
  function checkIfPdfPage() {
    // Check if the URL ends with .pdf
    const url = window.location.href.toLowerCase();
    if (url.includes('.pdf')) {
      return true;
    }

    // Check if the page content type is PDF
    const contentType = document.contentType || document.mimeType;
    if (contentType && contentType.toLowerCase().includes('pdf')) {
      return true;
    }

    // Check for embedded PDF viewer
    const embedElements = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    if (embedElements.length > 0) {
      return true;
    }

    // Check for PDF iframe
    const pdfIframes = Array.from(document.querySelectorAll('iframe')).filter(iframe => {
      const src = iframe.src || '';
      return src.toLowerCase().includes('.pdf');
    });
    if (pdfIframes.length > 0) {
      return true;
    }

    return false;
  }

  // ==================== COMMUNICATION WITH BACKGROUND ====================
  function notifyBackgroundOfPdf() {
    chrome.runtime.sendMessage({
      action: 'pdfPageDetected',
      url: window.location.href,
      filename: extractFilenameFromUrl(window.location.href)
    }).catch(err => {
      console.error('Error sending message to background:', err);
    });
  }

  // ==================== PDF LINK DETECTION ====================
  function findPdfLinksOnPage() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const pdfLinks = links.filter(link => {
      const href = link.href.toLowerCase();
      return href.includes('.pdf');
    });

    return pdfLinks.map(link => ({
      url: link.href,
      text: link.textContent.trim(),
      filename: extractFilenameFromUrl(link.href)
    }));
  }

  // ==================== MESSAGE LISTENER ====================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);

    if (message.action === 'getPdfLinks') {
      // Return all PDF links found on the page
      const pdfLinks = findPdfLinksOnPage();
      sendResponse({ pdfLinks });
    }

    if (message.action === 'getCurrentPageUrl') {
      // Return current page URL if it's a PDF
      if (isPdfPage) {
        sendResponse({
          url: window.location.href,
          filename: extractFilenameFromUrl(window.location.href),
          isPdf: true
        });
      } else {
        sendResponse({ isPdf: false });
      }
    }

    if (message.action === 'extractPdfUrl') {
      // Extract PDF URL from embedded elements
      const pdfUrl = extractEmbeddedPdfUrl();
      sendResponse({ url: pdfUrl, filename: pdfUrl ? extractFilenameFromUrl(pdfUrl) : null });
    }

    return false;
  });

  // ==================== EMBEDDED PDF EXTRACTION ====================
  function extractEmbeddedPdfUrl() {
    // Check embed elements
    const embedElement = document.querySelector('embed[type="application/pdf"]');
    if (embedElement && embedElement.src) {
      return embedElement.src;
    }

    // Check object elements
    const objectElement = document.querySelector('object[type="application/pdf"]');
    if (objectElement && objectElement.data) {
      return objectElement.data;
    }

    // Check iframes with PDF src
    const pdfIframe = Array.from(document.querySelectorAll('iframe')).find(iframe => {
      const src = iframe.src || '';
      return src.toLowerCase().includes('.pdf');
    });
    if (pdfIframe) {
      return pdfIframe.src;
    }

    // If this is a PDF page, return the page URL itself
    if (isPdfPage) {
      return window.location.href;
    }

    return null;
  }

  // ==================== UTILITY FUNCTIONS ====================
  function extractFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      // Remove query parameters
      const cleanFilename = filename.split('?')[0];
      
      // Decode URI component
      const decodedFilename = decodeURIComponent(cleanFilename);
      
      // If no extension or not a PDF, add .pdf
      if (!decodedFilename.toLowerCase().endsWith('.pdf')) {
        return decodedFilename + '.pdf';
      }
      
      return decodedFilename || 'document.pdf';
    } catch (error) {
      console.error('Error extracting filename:', error);
      return 'document.pdf';
    }
  }

  // ==================== PAGE INTERACTION ENHANCEMENT ====================
  // Add visual indicator for PDF links (optional enhancement)
  function enhancePdfLinks() {
    const pdfLinks = findPdfLinksOnPage();
    
    pdfLinks.forEach(linkData => {
      const link = Array.from(document.querySelectorAll('a[href]')).find(
        a => a.href === linkData.url
      );
      
      if (link && !link.dataset.tokentrimEnhanced) {
        // Mark as enhanced to avoid duplicate processing
        link.dataset.tokentrimEnhanced = 'true';
        
        // Add title attribute if not present
        if (!link.title) {
          link.title = 'Right-click to convert with TokenTrim';
        }
      }
    });
  }

  // Optionally enhance PDF links after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhancePdfLinks);
  } else {
    enhancePdfLinks();
  }

  // ==================== MUTATION OBSERVER ====================
  // Watch for dynamically added PDF links
  const observer = new MutationObserver((mutations) => {
    let shouldCheckLinks = false;
    
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'A' || node.querySelector('a[href]')) {
              shouldCheckLinks = true;
            }
          }
        });
      }
    });
    
    if (shouldCheckLinks) {
      enhancePdfLinks();
    }
  });

  // Start observing the document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ==================== CLEANUP ====================
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
  });

  // ==================== EXPORT FOR DEBUGGING ====================
  window.TokenTrimContent = {
    isPdfPage,
    findPdfLinksOnPage,
    extractEmbeddedPdfUrl,
    checkIfPdfPage
  };

})();
