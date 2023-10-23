/**
 * checkDates
 * ==========
 * 
 */
const argv = require('yargs').argv;
const fs = require('fs');
const path = require('path');

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
let date1 = null, date2 = null, basename = null, second = 0, total = 0;
let pos = 1; // 1=inFrontmatter, 2=inComment/Reply
let lines = fs.readFileSync(file)
  .toString()
  .split('\n')
  .map((line) => {
    if (line.slice(0,10) === 'BASENAME: ') { 
      pos = 1;
      basename = line.slice(10);
    }
    if (line.slice(0,9) === 'COMMENT: ') pos = 2;
    if (line.slice(0,6) === 'DATE: ' && pos === 1) {
      date2 = line.slice(6);
      if (date2 !== date1) {
        date1 = date2;
        second = 0;
      }
      else {
        second++;
        total++;
        let newDate = `${line}:${second.toString().padStart(2, '0')}`;
        console.log(`${total}. Basename: ${basename}, new ${newDate}`);
        return newDate;
      } 
    }
    return line;
  });

// and write updated export file
fs.writeFileSync(file.replace('.txt', '@d.txt'), lines.join('\n'));
console.log(`Finished date amendments; new content file written.`);  
