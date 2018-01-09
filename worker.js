'use strict';

/**
 * Fetch paper information for the provided ArXiv ID, using the public Semantic Scholar API.
 * @param  {string} arxivId
 * @return {Promise[object]] A promise for the paper's metadata.
 */
function getS2Paper(arxivId) {
  return fetch(`https://api.semanticscholar.org/v1/paper/arXiv:${arxivId}`)
    .then(resp => resp.json())
    .then(resp => {
      // Parse out the paper ID, by parsing the URL.
      const id = resp.url.split('/').pop();
      return { id, authors: resp.authors };
    });
}

/**
 * Fetches full reference information from the non-documented Semantic Scholar API.
 *
 * TODO: This data should eventually be exposed via the documented, publish API -- so that it can
 * be reliably used. As implemented, things could easily break./
 *
 * @param  {string} s2Id
 * @return {Promise[object]} A promise for the paper's references and their metadata.
 */
function getS2References(s2Id) {
  // We request 1000 so that we get all of them in a single request. This could be revised longer term to be more intelligent
  // (just in case there's a paper that cites more than 1000 documents)
  return fetch(`https://www.semanticscholar.org/api/1/paper/${s2Id}/citations?citationType=citedPapers&citationsPageSize=1000`)
    .then(resp => resp.json());
}

const PATTERN_PDP = new RegExp('https://www.semanticscholar.org/paper/[^/]+/.+');

/**
 * Detects if the user is on a S2 PDP and notifies the content script with this information.
 *
 * @param  {string} options.url
 * @param  {string} options.tabId
 * @return {undefined}
 */
function detectSemanticScholarPDP({ url, tabId }) {
  const message = { isS2PDP: PATTERN_PDP.test(url) };
  chrome.tabs.sendMessage(tabId, message);
}

/**
 * This listens for messages (passed by the content script) which include an arxivId member. If
 * this occurs we lookup metadata from S2 and send it back to that tab.
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.arxivId) {
    getS2Paper(message.arxivId).then(paper => {
      return getS2References(paper.id).then(({ citations }) => {
        chrome.tabs.sendMessage(
          sender.tab.id,
          {
            arxivId: message.arxivId,
            references: citations,
            s2Id: paper.id,
            authors: paper.authors
          }
        );
      });
    });
  }
});

/**
 * Whenever the URL changes, detect if we're on an S2 PDP and notify the content script with
 * this information.  This allows the content script to decide whether it should show (or hide)
 * the "Read on ArXiv Vanity" link.
 *
 * We have to do it this way since S2 is a fancy SPA, and their aren't traditional page transitions
 * (which reload the content script).
 */
chrome.webNavigation.onCompleted.addListener(detectSemanticScholarPDP);
chrome.webNavigation.onHistoryStateUpdated.addListener(detectSemanticScholarPDP);
