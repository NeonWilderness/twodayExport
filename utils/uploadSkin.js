/**
 * uploadSkin: uploads/updates a Twoday skin
 * =========================================
 * 
 */
const fs = require('fs');
const path = require('path');
const { loginTwoday } = require('./_login');
const getMemberships = require('./_getMemberships');
const updateSkin = require('./_updateSkin');
const argv = require('yargs').argv;

/**
 * Request-Promise sequence to update one skin
 * @param story object
 *      name    string skin name, e.g. site.cdnSettings
 *      content string skin content
 */
if (!argv.blog) {
  console.log('Blogname must be specified with --blog=blogname or -b blogname.');
  return;
}
let blog = argv.blog.toLowerCase();
loginTwoday()
  .then( () => {
    console.log('Successfully logged into Twoday. Checking Memberships...');
    return getMemberships();
  })
  .then( (adminBlogs) => {
    if (adminBlogs.indexOf(blog)<0) throw new Error('Blog not found or authorization failed.');
    console.log(`${blog} blog is authorized.`);
    let exportSkin = fs.readFileSync(path.resolve(process.cwd(), './dist/twoday-export.html'), 'utf-8');
    return updateSkin( blog, {
      name: 'Site.twodayExport',
      content: exportSkin
    })
  })
  .catch(function (err) {
    console.log('Update ***failed*** for blog:', blog, 'with Error', err);
  });