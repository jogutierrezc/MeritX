const fs = require('fs');
const glob = require('glob');
const path = require('path');

const srcFiles = glob.sync('src/pages/**/*.tsx');

let changedCount = 0;

for (const file of srcFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Pattern injected by refactor_all.cjs:
  // const subscription = connection.subscriptionBuilder().onApplied(() => refreshFromCache()).subscribe(['...']);
  // return () => subscription.unsubscribe();
  const subPattern1 = /const\s+subscription\s*=\s*connection\.subscriptionBuilder\(\)\.onApplied\(\(\)\s*=>\s*refreshFromCache\(\)\)\.subscribe\(\[[^\]]+\]\);\s*return\s*\(\)\s*=>\s*subscription\.unsubscribe\(\);/gs;

  if (subPattern1.test(content)) {
    content = content.replace(subPattern1, 'if (globalDataReady) { refreshFromCache(); }');
  }

  // Ensure they have globalDataReady in useSpacetime()
  if (content !== originalContent) {
    if (!content.includes('globalDataReady')) {
      content = content.replace(/const\s+\{\s*connection,\s*connected\s*\}\s*=\s*useSpacetime\(\);/g, 'const { connection, connected, globalDataReady } = useSpacetime();');
    }
    
    // Add globalDataReady to useEffect dependencies if it's not there
    const useEffectPattern = /(useEffect\(\(\)\s*=>\s*\{[\s\S]*?refreshFromCache\(\)[\s\S]*?\}\s*,\s*\[)\s*connection\s*\]\);/g;
    content = content.replace(useEffectPattern, '$1connection, globalDataReady]);');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
    changedCount++;
  }
}

console.log(`Finished fixing ${changedCount} files.`);
