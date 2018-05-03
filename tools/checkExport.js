/**
 * checkExport
 * ===========
 * 
 */
const argv = require('yargs').argv;
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const request = require('request-promise-native');
const validFmTestcases = require('./checks/validFm');
const validBodyTestcases = require('./checks/validBody');
const validCommentsTestcases = require('./checks/validComments');
const fixNiceUrls = require('./checks/fixNiceUrls');

const readFrontmatter = (chunk) => {
  let fm = chunk.split('\n').reduce((all, line, index) => {
    let parts = line.split(': ');
    let key = parts[0].toLowerCase().replace(/\s/g, '');
    if (key.length) all[key] = parts.slice(1).join(': ');
    return all;
  }, {});
  let i = fm.basename.lastIndexOf('-');
  if (i >= 0) {
    fm.slug = fm.basename.substr(0, i);
    fm.id = fm.basename.substr(i + 1);
  }
  console.log(`Read basename: ${fm.basename}.`);
  return fm;
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
        default: comment[parts[0].toLowerCase()] = parts.slice(1).join(': ');
      }
    }
    comment.body = lines.slice(4).join('\n');
    all.push(comment);
    return all;
  }, []);
};

const getTopics = (blog => {
  return new Promise((resolve, reject) => {
    request.get({
      uri: `https://${blog}.twoday.net/topics/`,
      transform: body => cheerio.load(body)
    })
      .then($ => {
        let topics = [];
        $('.listItem td>a').each(function () {
          topics.push(this.attribs.href.split('/').reverse()[1]);
        });
        resolve(topics);
      })
      .catch(err => {
        reject(err);
      });
  });
});

const getSortedStoryIDs = () => {
  return stories
    .reduce((all, story, index) => {
      all.push(story.fm.id);
      return all;
    }, [])
    .sort();
};

if (!argv.blog) {
  console.log('Blogname must be specified with --blog=blogname or -b blogname.');
  return;
}
var blog = argv.blog.toLowerCase();
var dir = (!!argv.dir ? path.resolve(process.cwd(), argv.dir, blog) : '.');
console.log(`Using output directory: ${dir}.`);

let file; // --file="seenia export vx" or undefined
if (argv.file)
  file = `${dir}/${argv.file}.txt`;
else {
  file = fs.readdirSync(dir).reduce((all, filename, index) => {
    let ext = filename.split('.').pop();
    if (ext === 'txt') all = `${dir}/${filename}`;
    return all;
  }, '');
}

console.log(`Reading export file: ${file}.`);
var stories = fs.readFileSync(file)
  .toString()
  .split('\n-----\n--------\n')
  .reduce((all, story, index) => {
    if (story.trim().length) {
      let chunks = story.split('\n-----\n');
      all.push({
        fm: readFrontmatter(chunks[0]),
        body: readBody(chunks[1]),
        comments: readComments(chunks.slice(2))
      });
    }
    return all;
  }, []);

var global = {
  blog,
  dir,
  monthLinks: {},
  regAlphaNumericStoryId: new RegExp('https?://' + blog + '\\.twoday\\.net/stories/[^0-9]+'),
  regMonthLink: new RegExp('https?://' + blog + '\\.twoday\\.net/month\\?date=(\\d{6})', 'i'),
  regNumericStoryId: new RegExp('https?://' + blog + '\\.twoday\\.net/stories/[0-9]+[/"]', 'gi'),
  regStaticResources: new RegExp('https?://static\\.twoday\\.net/' + blog + '/(files|images)/'),
  regStaticImages: new RegExp('https?://static\\.twoday\\.net/' + blog + '/images/'),
  regTopicLinks: new RegExp('https?://' + blog + '\\.twoday\\.net/topics/.*?[/"]', 'gi'),
  storyIDs: getSortedStoryIDs(),
  stories,
  xrefs: {}
};

describe(`validating ${blog} stories...`, () => {

  before(async () => {  // jshint ignore:line
    global.topics = await getTopics(blog); // jshint ignore:line
  }); // jshint ignore:line

  stories.forEach((story) => {
    validFmTestcases(story, global);
    validBodyTestcases(story, global);
    validCommentsTestcases(story, global);
  });

  fixNiceUrls(global);

});
