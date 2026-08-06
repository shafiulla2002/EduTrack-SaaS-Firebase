const https = require('https');

const baseKey = "AIzaSyBAKsVm1aMGAywUNIVTG-CH_s9Rghc0Ajk";

// Let's define replacements for characters at index >= 6
const replMap = {
  'I': ['I', 'l', '1'],
  'l': ['I', 'l', '1'],
  '1': ['I', 'l', '1'],
  '0': ['0', 'o', 'O'],
  'o': ['0', 'o', 'O'],
  'O': ['0', 'o', 'O'],
  's': ['s', 'S', '5'],
  'S': ['s', 'S', '5'],
  'a': ['a', 'A'],
  'A': ['a', 'A'],
  'w': ['w', 'W', 'v'],
  'W': ['w', 'W', 'v'],
  'G': ['G', '6'],
  '_': ['_', '-'],
  '-': ['_', '-']
};

const variations = [];

function generate(currentKey, index) {
  if (index >= baseKey.length) {
    variations.push(currentKey);
    return;
  }

  const char = baseKey[index];
  // Keep the prefix 'AIzaSy' unchanged
  if (index < 6) {
    generate(currentKey + char, index + 1);
    return;
  }

  const opts = replMap[char];
  if (opts) {
    for (const opt of opts) {
      generate(currentKey + opt, index + 1);
    }
  } else {
    generate(currentKey + char, index + 1);
  }
}

generate("", 0);
console.log(`Generated ${variations.length} combinatorial variations.`);

function testKey(key) {
  return new Promise((resolve) => {
    const url = `https://identitytoolkit.googleapis.com/v1/recaptchaParams?key=${key}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ key, success: true });
        } else {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error && parsed.error.message) {
              const msg = parsed.error.message;
              if (!msg.includes("API key not valid")) {
                resolve({ key, success: true, restricted: true, error: msg });
                return;
              }
            }
          } catch (e) {}
          resolve({ key, success: false });
        }
      });
    }).on('error', () => {
      resolve({ key, success: false });
    });
  });
}

async function run() {
  const chunkSize = 30;
  for (let i = 0; i < variations.length; i += chunkSize) {
    const chunk = variations.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(testKey));
    for (const res of results) {
      if (res.success) {
        console.log(`\nFOUND VALID KEY: ${res.key} (Restricted: ${res.restricted || false}, Error: ${res.error || 'none'})`);
        return;
      }
    }
    if (i > 0 && i % 150 === 0) {
      process.stdout.write(`Tested ${i} keys...\n`);
    }
  }
  console.log("\nNo valid key found in variations.");
}

run();
