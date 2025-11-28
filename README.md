# 🎮 XBOX Gamertag Scraper (Apify Actor)

This project is an open-source **Apify Actor** designed to scrape public game history and statistics for any given Xbox Gamertag from the `xboxgamertag.com` website. It uses the **PlaywrightCrawler** to handle dynamic content loading and bypass common bot detection mechanisms that caused the original 503 errors.

---

## 🌟 Features

* **Playwright Integration:** Uses a real, headless browser to ensure **robust scraping** of dynamic, JavaScript-rendered content.
* **Gamerscore Extraction:** Retrieves the user's **Total Gamerscore**.
* **Game Detail Scraping:** Collects data for each played game, including:
    * Game Title
    * Gamerscore Earned / Total Possible
    * Completion Progress (%)
    * Last Played Date
    * Platform
    * Cover Image Link

---

## 🛠️ Setup and Installation

### Prerequisites

1.  **Node.js:** Installed on your system (v18 or higher recommended).
2.  **Apify Account:** Needed to run the actor on the Apify platform (optional for local development).
3.  **Apify CLI:**
    ```bash
    npm install -g apify-cli
    ```

### Local Development

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/gaming-xbox-scraper.git](https://github.com/your-username/gaming-xbox-scraper.git)
    cd gaming-xbox-scraper
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Create Input File:**
    Create a file named **`INPUT.json`** in the root directory with the following structure:
    ```json
    {
        "username": "deadpaul4" 
        // Replace "deadpaul4" with the Gamertag you want to scrape
    }
    ```
4.  **Run Locally:**
    ```bash
    apify run
    ```
    The results will be stored in the local `apify_storage/key_value_stores/default` directory.

---

## 💻 Code Details (`src/main.js`)

The core logic is structured to ensure reliability and proper execution within the Apify environment.

### Key Technical Details

1.  **Async IIFE (Top-Level Execution Wrapper):**
    The entire script is wrapped in an `(async () => { ... })();` to ensure **`await Actor.init()`** is executed successfully before any other Apify SDK methods are called, preventing runtime initialization errors.

2.  **PlaywrightCrawler:**
    Used instead of CheerioCrawler to overcome the **503 Internal Server Error** by simulating a real browser visit, which is necessary for websites using bot detection.

3.  **`page.evaluate()`:**
    The complex data extraction logic is executed entirely within a `page.evaluate()` block. This code runs in the browser's context, allowing the use of standard DOM manipulation (e.g., `document.querySelectorAll`) after the page's JavaScript has executed.

4.  **Local Logging (Console):**
    For local runs, the main execution block uses `console.log` for immediate output, while the `requestHandler` still uses the dedicated `log` object provided by Crawlee for structured logging.

```javascript
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
                
                // 1. Gamerscore Extraction (omitted for brevity)
                // ...
                const totalGamerscore = 0; // Placeholder

                // 2. Extract Game Cards (omitted for brevity)
                const games = []; // Placeholder

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