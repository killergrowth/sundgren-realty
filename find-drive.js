const { google } = require('googleapis');
const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('C:/Users/KillerGrowth/.openclaw/credentials/google-service-account.json'));
const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, ['https://www.googleapis.com/auth/drive'], 'brickley@killergrowth.com');
const drive = google.drive({ version: 'v3', auth });

async function main() {
  // Find Sundgren Realty folder
  const r1 = await drive.files.list({
    q: "name='Sundgren Realty' and mimeType='application/vnd.google-apps.folder'",
    fields: 'files(id,name,parents)'
  });
  console.log('Sundgren Realty folders:', JSON.stringify(r1.data.files));

  for (const folder of r1.data.files) {
    // Find Website subfolder
    const r2 = await drive.files.list({
      q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id,name)'
    });
    console.log(`Children of ${folder.name} (${folder.id}):`, JSON.stringify(r2.data.files));

    for (const sub of r2.data.files) {
      if (sub.name.toLowerCase().includes('website') || sub.name.toLowerCase().includes('hero')) {
        const r3 = await drive.files.list({
          q: `'${sub.id}' in parents`,
          fields: 'files(id,name,mimeType,size)'
        });
        console.log(`  Contents of ${sub.name}:`, JSON.stringify(r3.data.files));

        // Go one level deeper for Hero Video folder
        for (const item of r3.data.files) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            const r4 = await drive.files.list({
              q: `'${item.id}' in parents`,
              fields: 'files(id,name,mimeType,size)'
            });
            console.log(`    Contents of ${item.name}:`, JSON.stringify(r4.data.files));
          }
        }
      }
    }
  }
}

main().catch(e => console.error(e.message));
