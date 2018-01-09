'use strict';
/**
 * This script runs on the Semantic Scholar PDP and adds a link to ArXiv vanity when appropriate.
 *
 * This will eventually just be implemented as part of the standard PDP, and will be removed
 * from the plugin at that point.
 */

// The ArXiv Vanity link, if it's rendered.
let arxivVanityLink;

/**
 * Removes the ArXiv Vanity link, if it's present in the DOM.
 * @return {undefined}
 */
function removeArxivVanityLink() {
  if (arxivVanityLink) {
    arxivVanityLink.parentNode.removeChild(arxivVanityLink);
  }
}

/**
 * If we're on a S2 PDP for an ArXiv paper, add a link to ArXiv Vanity
 * @return {undefined}
 */
function addArxivVanityLink() {
  // Iterate over all of the paper links, looking for one that links to ArXiv. If we find one it's
  // an ArXiv paper and we can inject a link to ArXiv vanity.
  document.querySelectorAll('.paper-link').forEach(paperLink => {
    const href = paperLink.getAttribute('href');
    if (href.startsWith('https://arxiv.org/pdf/')) {
      // Extract the ArXiv id from the url, which looks something like
      // https://arxiv.org/pdf/cs/0101027.123.pdf
      const arxivId = href.split('/').pop().split('.pdf').shift();

      //
      // TODO: We have ArXiv links IDs that are only numeric,
      // i.e. https://arxiv.org/pdf/cs/0608027.pdf
      // These ids, however, deterministically don't work in ArXiv Vanity.
      //
      // I'll touch base with Ben to figure out what's going on here -- it could be something
      // wrong with our data, or something wrong on the ArXiv Vanity side.
      //
      if (arxivId && arxivId.indexOf('.') !== -1) {
        // Create  a link to ArXiv Vanity and inject it into the window. It'll be absolutely
        // positioned in the bottom right corner of the screen.
        const linkElement = document.createElement('a');

        linkElement.setAttribute('id', 's2-arxiv-vanity-link');
        linkElement.setAttribute('href', `https://www.arxiv-vanity.org/papers/${arxivId}/`);
        linkElement.setAttribute('target', '_blank');
        linkElement.appendChild(document.createTextNode('View on Arxiv Vanity'));

        arxivVanityLink = document.body.appendChild(linkElement);
      }
    }
  });
}

/**
 * Our background listener tells us when we need to show / hide the Arxiv Vanity link.
 */
chrome.runtime.onMessage.addListener(message => {
  if (message.isS2PDP) {
    // This is a no-op if it's not there
    removeArxivVanityLink();
    addArxivVanityLink();
  } else {
    removeArxivVanityLink();
  }
});


