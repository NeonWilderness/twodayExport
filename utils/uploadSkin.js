/**
 * uploadSkin: uploads/updates a Twoday skin
 * =========================================
 *
 */
const { argv } = require('yargs');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const Twoday = require('@neonwilderness/twoday');

require('dotenv-safe').config();

if (!argv.alias) {
  console.log('Blog alias must be specified with --alias=blogname');
  process.exit(1);
}
const alias = argv.alias.toLowerCase();

if (!argv.platform) {
  console.log('Target platform must be specified with --platform=dev|prod');
  process.exit(1);
}
const platform = argv.platform.toLowerCase();

const td = new Twoday.Twoday(platform);
td.login()
  .then(() => td.useLayout(alias, 'export'))
  .then(() =>
    td.updateSkin(alias, 'Site.twodayExport', {
      title: 'Site.twodayExport',
      description: `Twoday Blog-Export (Version ${pkg.version})`,
      skin: fs.readFileSync(path.resolve(process.cwd(), './dist/twoday-export.html')).toString()
    })
  )
  .catch(err => {
    console.log(`Export skin update failed for alias "${alias}" --> ${err}`);
  });
