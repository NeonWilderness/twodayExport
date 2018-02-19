/**
 * uploadSkin: uploads/updates a Twoday skin
 * =========================================
 * 
 */
const fs = require('fs');
const path = require('path');
const { loginTwoday } = require('./_login');
const getMemberships = require('./_getMemberships');
const updateFile = require('./_updateFile');
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
    return updateFile( blog, {
      name: 'version',
      src:  'version.json',
      mime: 'application/json',
      desc: 'JSON Datei mit Versionsführung für Downloadelemente'
    })
  })
  .catch(function (err) {
    console.log('Update ***failed*** for blog:', blog, 'with Error', err);
  });