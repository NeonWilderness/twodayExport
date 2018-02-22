/**
 * checkExport
 * ===========
 * 
 */
const fs = require('fs');
const path = require('path');
const argv = require('yargs').argv;
const validFmTestcases = require('./checks/validFm');
const validBodyTestcases = require('./checks/validBody');
const validCommentsTestcases = require('./checks/validComments');

const readFrontmatter = (chunk) => {
  return chunk.split('\n').reduce((all, line, index) => {
    let parts = line.split(': ');
    let key = parts[0].toLowerCase().replace(/\s/g, '');
    if (key.length) all[key] = parts.slice(1).join('');
    return all;
  }, {});
};

const readBody = (chunk) => {
  return chunk.substr(6); // 'BODY:\n'.length
};

const readComments = (chunks) => {
  return chunks.reduce((all, chunk, index) => {
    let lines = chunk.split('\n');
    let comment = { type: '?' };
    for (let i = 0; i < 4; i++) {
      let line = lines[i];
      let parts = line.split(': ');
      switch (parts[0]) {
        case 'COMMENT:':
        case 'REPLY:': comment.type = parts[0].charAt(0); break;
        default: comment[parts[0].toLowerCase()] = parts.slice(1).join('');
      }
    }
    comment.body = lines.slice(4).join('\n');
    all.push(comment);
    return all;
  }, []);
};

if (!argv.blog) {
  console.log('Blogname must be specified with --blog=blogname or -b blogname.');
  return;
}
let blog = argv.blog.toLowerCase();
let dir = `D:/Dokumente/Dev/twodayexport/clients/${blog}/`;
let file; // --file="seenia export v4" or undefined
if (argv.file)
  file = `${dir}${argv.file}.txt`;
else {
  file = fs.readdirSync(dir).reduce((all, filename, index) => {
    let [name, ext] = filename.split('.');
    if (ext === 'txt') all = `${dir}${filename}`;
    return all;
  }, '');
}

console.log(`Reading export file: ${file}.`);
let stories = fs.readFileSync(file)
  .toString()
  .split('-----\n--------\n')
  .reduce((all, story, index) => {
    if (story.trim().length) {
      let chunks = story.split('-----\n');
      all.push({
        fm: readFrontmatter(chunks[0]),
        body: readBody(chunks[1]),
        comments: readComments(chunks.slice(2))
      });
    }
    return all;
  }, []);

stories.map((story) => {
  validFmTestcases(story);
  validBodyTestcases(story);
  validCommentsTestcases(story);
});
