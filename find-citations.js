'use strict';

/**
 * This script runs on a rendered ArXiv Vanity document and:
 *   - Adds a link to the S2 PDP.
 *   - Links S2 reference contexts to the S2 PDP.
 *   - Links references to the S2 PDP.
 *   - Makes the bib entries clickable.
 */

/**
 * Parse the ArXiv ID from the URL, which will look something like:
 * https://www.arxiv-vanity.com/papers/1211.1036/
 *
 * @return {string}
 */
function getArxivIdFromUrl() {
  const urlParts = location.pathname.split('/');
  return urlParts[2];
}

/**
 * Noramlize the provided text, by removing leading / trailing whitespace, newlines and converting
 * it to lowercase.
 *
 * @param  {string} text
 * @return {string}
 */
function normalize(text) {
  return text.toLowerCase().trim().replace(/\n/g, ' ');
}

/**
 * Replace bibligographic references (i.e. "[14]") with an expression that matches a <cite> tag,
 * since we match against the innerHTML.
 *
 * @param  {string} text
 * @return {string}
 */
function replaceBibReferencesWithTags(text) {
  return text.replace(/\[\d+\]/g, '<cite.+?</cite>');
}

/**
 * Enhance the ArXiv Vanity document with additional content based on the S2 metadata.
 *
 * @param  {string}    arxivId
 * @param  {object[]}  references
 * @param  {object[]}  authors
 * @param  {string}    s2Id
 * @return {undefined}
 */
function addContentToDocument(arxivId, references, authors, s2Id) {
  const paragraphs = document.querySelectorAll('.ltx_p');
  const bibEntries =
    Array.from(document.querySelectorAll('.ltx_bibitem')).concat(
      Array.from(document.querySelectorAll('#cite-hover-boxes-container .dt-hover-box'))
    );

  references.forEach(ref => {
    // Hyperlink the references listed at the bottom of the document and those listed in
    // "hover boxes" for aech reference.
    bibEntries.forEach(entry => {
      if (normalize(entry.textContent).indexOf(normalize(ref.title.text)) !== -1) {
        entry.innerHTML =
          `<a href="https://www.semanticscholar.org/paper/${ref.slug}/${ref.id}" target="_blank">`
          + entry.innerHTML
          + '</a>';
      };
    });

    // Hyperlink the context (mentioning text) of each citation.
    //
    // TODO: This doesn't work terribly well, likely because the text we extract doesn't always
    // align with the text as rendered via the HTML. We can likely come up with a far more
    // sophisticated way of doing this.
    ref.citationContexts.forEach(ctx => {
      const { text } = ctx;
      paragraphs.forEach(p => {
        let paragraphText = p.innerHTML;
        const matches = normalize(paragraphText).match(
          new RegExp(
            // TODO: There's probably more to escape here
            replaceBibReferencesWithTags(normalize(text).replace(/[()!+*?.]/g, (match) => '\\' + match)),
            'g'
          )
        );
        if (matches) {
          matches.forEach(match => {
            const start = normalize(paragraphText).indexOf(match);
            if (start !== -1) {
              const after = paragraphText.substr(start + match.length);
              const originalText = paragraphText.substr(start, start + match.length);
              p.innerHTML =
                paragraphText.substr(0, start)
                + `<a href="https://www.semanticscholar.org/paper/${ref.slug}/${ref.id}" target="_blank">${originalText}</a>`
                + after
              paragraphText = after;
            }
          });
        }
      });
    });
  });


  // Remove the event.preventDefault() present on anchors to bib entries, as with this they aren't
  // clickable.
  //
  // TODO: This should really just be submitted as a patch to Engrafo.
  document.querySelectorAll('a.ltx_ref').forEach(link => {
    if (link.getAttribute('href').startsWith('#bib')) {
      link.addEventListener('click', () => {
        document.location.hash = link.getAttribute('href');
      }, true);
    }
  });

  // Add links to the AHPs for each of the papers authors
  const authorsList = document.querySelectorAll('.ltx_personname')[0];
  if (authorsList) {
    let authorsListWithLinks = authorsList.innerHTML;
    authors.forEach(author => {
      authorsListWithLinks = authorsListWithLinks.replace(
        author.name,
        `<a href="${author.url}" target="_blank">${author.name}</a>`
      );
    });
    authorsList.innerHTML = authorsListWithLinks;
  }

  // Add a link to the Semantic Scholar PDP
  const pdpLink = document.createElement('a');
  pdpLink.setAttribute('href', `https://www.semanticscholar.org/paper/${s2Id}`);
  pdpLink.appendChild(document.createTextNode('Semantic Scholar'));

  const pdpLinkContainer = document.createElement('div');
  pdpLinkContainer.appendChild(pdpLink);

  const metadata = document.querySelectorAll('.engrafo-metadata-custom')[0];
  if (metadata) {
    metadata.appendChild(pdpLinkContainer);
  }
}

/**
 * Returns a boolean indicating if the ArXiv Vanity document has rendered or not.
 *
 * @return {Boolean}
 */
function isDocLoaded() {
  return document.getElementsByTagName('dt-article').length > 0;
}

const arxivId = getArxivIdFromUrl();
chrome.runtime.onMessage.addListener(message => {
  if (message.arxivId === arxivId) {
    const fn = addContentToDocument.bind(
      undefined,
      message.arxivId,
      message.references,
      message.authors,
      message.s2Id
    );

    // Wait for the document to load before trying to add additional content. If the chrome plugin
    // ends up sticking, we can work with ArXiv vanity to dispatch an event instead of doing this.
    if (isDocLoaded()) {
      fn();
    } else {
      let docLoadInterval = setInterval(() => {
        if (isDocLoaded()) {
          fn();
          if (docLoadInterval !== undefined) {
            clearInterval(docLoadInterval)
          }
        }
      }, 100);
    }
  }
});

chrome.runtime.sendMessage({ arxivId });
