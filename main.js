(async () => {
  const fetch = (await import('node-fetch')).default;
  const fs = require('fs').promises;
  const path = require('path');
  const crypto = require('crypto');

  async function main() {
      const tokenFilePath = path.join(__dirname, 'token.txt');
      const browserIdFilePath = path.join(__dirname, 'browserid.txt');

      let accessToken;
      let id8;

      try {
          accessToken = await fs.readFile(tokenFilePath, 'utf-8');
          id8 = await fs.readFile(browserIdFilePath, 'utf-8');
          accessToken = accessToken.trim();
          id8 = id8.trim();
      } catch (error) {
          console.error('Error reading configuration files:', error);
          return;
      }

      let headers = {
          'Accept': 'application/json, text/plain, */*',
          'origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
      };

      async function coday(url, method, payloadData = null) {
          try {
              let response;
              const options = {
                  method: method,
                  headers: headers
              };

              if (method === 'POST') {
                  options.body = JSON.stringify(payloadData);
                  response = await fetch(url, options);
              } else {
                  response = await fetch(url, options);
              }

              return await response.json();
          } catch (error) {
              console.error('Error:', error);
          }
      }

      function generateBrowserId() {
          const rdm = crypto.randomUUID().slice(8);
          const browserId = `${id8}${rdm}`;
          return browserId;  
      }

      async function loadBrowserIds() {
          try {
              const data = await fs.readFile('browser_ids.json', 'utf-8');
              return JSON.parse(data);
          } catch (error) {
              return {};  
          }
      }

      async function saveBrowserIds(browserIds) {
          try {
              await fs.writeFile('browser_ids.json', JSON.stringify(browserIds, null, 2), 'utf-8');
              console.log('Browser IDs saved to file.');
          } catch (error) {
              console.error('Error saving browser IDs:', error);
          }
      }

      async function getBrowserId() {
          const browserIds = await loadBrowserIds();
          const newBrowserId = generateBrowserId();
          browserIds['default'] = newBrowserId;  
          await saveBrowserIds(browserIds);  
          console.log(`Generated new browser_id: ${newBrowserId}`);
          return newBrowserId;
      }

      function getCurrentTimestamp() {
          return Math.floor(Date.now() / 1000);  
      }

      async function pingServer(browser_id, uid) {
          const timestamp = getCurrentTimestamp();
          const pingPayload = { "uid": uid, "browser_id": browser_id, "timestamp": timestamp, "version": "1.0.1" };

          while (true) {
              try {
                  const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload);
                  await coday('https://api.aigaea.net/api/network/ip', 'GET', {});
                  console.log(`Ping successful:`, pingResponse);

                  if (pingResponse.data && pingResponse.data.score < 50) {
                      console.log(`Score below 50, re-authenticating...`);

                      await handleAuthAndPing();
                      break; 
                  }
              } catch (error) {
                  console.error(`Ping failed:`, error);
              }
              await new Promise(resolve => setTimeout(resolve, 600000));  
          }
      }

      async function handleAuthAndPing() {
          const payload = {};
          const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST', payload);
          
          if (authResponse && authResponse.data) {
              const uid = authResponse.data.uid;
              const browser_id = await getBrowserId();  
              console.log(`Authenticated with uid ${uid} and browser_id ${browser_id}`);

              pingServer(browser_id, uid);
          } else {
              console.error(`Authentication failed`);
          }
      }

      try {
          await handleAuthAndPing();
      } catch (error) {
          console.error('An error occurred:', error);
      }
  }

  main();
})();
