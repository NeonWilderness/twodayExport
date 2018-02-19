/**
 * Update a file on the Twoday blogger platform
 * ============================================
 * 
 */
const { req } = require('./_login');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * Returns a GETs secretKey to be used in a subsequent POST
 */
const getSecretKey = function(body, response, resolveWithFullResponse){
  var $ = cheerio.load(body);
  return $('[name="secretKey"]').val();
};

/**
 * Returns a GETs secretKey and uri to be used in a subsequent POST
 */
const getSecretKeyAndUri = function(body, response, resolveWithFullResponse){
  return { 
      secretKey: getSecretKey(body, response, resolveWithFullResponse),
      uri: this.uri
  };
};

/**
 * Request-Promise sequence to update Twoday skin in the export layout
 * @param blog  string name of Twoday blog
 * @param file object
 *   name      string file name, e.g. 'version'
 *   src       string source file name in dist folder, e.g. 'version.json'
 *   mime      string mime type, e.g. 'application/json'
 *   desc      string description of file content
 */
const updateFile = (blog, file) => {
  const filesUrl = `https://${blog}.twoday.net/files/`;
  const fileCreateUrl = `${filesUrl}create`;
  const fileDeleteUrl = `${filesUrl}${file.name}/delete`;
  console.log('Preparing to delete file url:', fileDeleteUrl);
  req.get({
    uri: fileDeleteUrl,
    transform: getSecretKeyAndUri
  })
    .then(function (incoming) {
      console.log('Deleting file url:', incoming.uri);
      return req.post({
        uri: incoming.uri,
        form: {
          'secretKey': incoming.secretKey,
          'remove': 'Löschen'
        }
      });
    })
    /* Init file upload */
    .then(function () {
      console.log('Delete completed. Prep to recreate.');
      return req.get({
        uri: fileCreateUrl,
        transform: getSecretKey
      });
    })
    /* Conduct file upload */
    .then(function (secretKey) {
      return req.post({
        uri: fileCreateUrl,
        formData: {
          'secretKey': secretKey,
          'rawfile': {
            value: fs.createReadStream(path.resolve(process.cwd(), `dist/${file.src}`)),
            options: {
              filename: file.src,
              contentType: file.mime
            }
          },
          'alias': file.name,
          'description': file.desc,
          'save': 'Sichern'
        },
      });
    })
    .then(function () {
      console.log(`Update completed for file: ${file.name} (${file.src}).`);
    })
    .catch(function (err) {
      console.log('Upload ***failed*** for file:', file.src, 'with Error', err);
    });
};

module.exports = updateFile;