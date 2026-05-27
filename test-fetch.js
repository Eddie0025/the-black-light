const https = require('https');
https.get('https://www.theblacklight.blog/article/5-test', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const titleMatch = data.match(/<title>(.*?)<\/title>/i);
    const descMatch = data.match(/<meta id="meta-desc" name="description" content="(.*?)">/i);
    console.log('TITLE:', titleMatch ? titleMatch[1] : 'NOT FOUND');
    console.log('DESC:', descMatch ? descMatch[1] : 'NOT FOUND');
  });
});
