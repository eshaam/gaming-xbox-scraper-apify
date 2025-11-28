import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

// Wrap the entire execution in an Asynchronously Invoked Function Expression (IIFE)
(async () => {

  // --- INITIALIZATION ---
  await Actor.init();

  // --- VARIABLE DECLARATIONS ---
  let USERNAME = 'TEST_GAMERTAG';
  let totalGamerscore = 0;

  // --- CRAWLER DEFINITION ---
  const crawler = new PlaywrightCrawler({
    requestHandlerTimeoutSecs: 60,

    async requestHandler({ page, request, log }) {
      log.info(`Processing game history page for user: ${USERNAME}`);

      try {
        // Wait for the dynamic content to be loaded
        await page.waitForSelector('.game-card', { timeout: 15000 });
      } catch (error) {
        log.warning('Timed out waiting for game cards. The user profile may be empty or failed to load.');
      }

      // --- Scraping Logic using page.evaluate() ---
      const results = await page.evaluate((USERNAME) => {

        // 1. Gamerscore Extraction
        const gamerscoreElement = Array.from(document.querySelectorAll('.profile-detail-item'))
          .find(el => el.textContent.includes('Gamerscore'));

        let gamerscoreText = "0";
        if (gamerscoreElement) {
          gamerscoreText = Array.from(gamerscoreElement.childNodes)
            .find(node => node.nodeType === 3 && node.textContent.trim().length > 0)
            ?.textContent || "0";
        }

        const totalGamerscore = parseInt(gamerscoreText.replace(/[,\s]/g, ''), 10);

        // 2. Extract Game Cards
        const games = [];
        document.querySelectorAll('.game-card').forEach((card) => {

          const gameTitle = card.querySelector('.game-card-desc h3')?.textContent.trim();
          if (!gameTitle) return;

          const lastPlayed = card.querySelector('.game-card-desc p.text-sm')?.textContent.replace('Last played', '').trim();
          const platform = card.querySelector('.game-card-desc p.text-xs')?.textContent.trim();
          const progressPercent = parseFloat(card.querySelector('.progress-bar')?.getAttribute('aria-valuenow') || '0.0');

          const gamerscoreTextRaw = card.querySelector('.col-9.font-weight-bold')?.textContent.trim();
          const [earnedScoreText, totalScoreText] = (gamerscoreTextRaw || '/').split('/');

          const earnedGamerscore = parseInt(earnedScoreText?.trim().replace(/\D/g, '') || '0', 10);
          const totalGamerscorePossible = parseInt(totalScoreText?.trim().replace(/\D/g, '') || '0', 10);

          // 3. Image Link (FIXED LOGIC)
          const coverStyle = card.querySelector('.game-card-cover')?.getAttribute('style');

          // Initialize coverLink explicitly to prevent ReferenceError
          let coverLink = '';

          if (coverStyle) {
            // Safely assign the initial URL match
            coverLink = coverStyle.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || '';
          }

          if (coverLink) {
            // Safely access and reassign coverLink
            const urlParamMatch = coverLink.match(/url=(http.*?)\&/);
            coverLink = urlParamMatch ? decodeURIComponent(urlParamMatch[1]) : coverLink;
          }

          games.push({
            "User Name": USERNAME,
            "User Total Gamerscore": totalGamerscore,
            "Game Title": gameTitle,
            "Progress %": progressPercent,
            "Gamerscore Earned": earnedGamerscore,
            "Gamerscore Total": totalGamerscorePossible,
            "Platform(s)": platform,
            "Last Played": lastPlayed,
            "Cover Link": coverLink
          });
        });

        return { games, totalGamerscore };
      }, USERNAME);

      // --- Post-Evaluation ---
      totalGamerscore = results.totalGamerscore;
      if (results.games.length > 0) {
        await Actor.pushData(results.games);
        log.info(`✅ Successfully extracted and pushed ${results.games.length} game records.`);
      } else {
        log.warning('⚠️ No game records were found after evaluating the page.');
      }
    },
  });

  // ------------------------------------------------------------------

  // --- EXECUTION BLOCK ---
  const { npsso, username } = await Actor.getInput() || {};

  if (username) {
    USERNAME = username;

    console.log(`INFO: Starting Playwright crawler for user: ${USERNAME}`);

    if (npsso) {
      console.log("INFO: NPSSO token found in input. (Not used in this public scraper, but available).");
    }

    await crawler.run([`https://xboxgamertag.com/search/${username}`]);
  } else {
    console.log("ERROR: Missing username in INPUT.json. Crawler aborted.");
  }

  await Actor.exit();

})(); // End of IIFE