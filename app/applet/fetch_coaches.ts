import fetch from 'node-fetch';
import fs from 'fs';

async function main() {
  try {
    console.log('Fetching...');
    const response = await fetch('https://www.cfblabs.com/coaches');
    const html = await response.text();
    console.log('HTML fetched, length:', html.length);
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      fs.writeFileSync('/app/applet/coaches_data.json', nextDataMatch[1]);
      console.log('Successfully wrote /app/applet/coaches_data.json');
    } else {
      console.log('__NEXT_DATA__ not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
