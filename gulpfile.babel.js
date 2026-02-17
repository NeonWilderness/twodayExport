'use strict';

import color from 'ansi-colors';
import fs from 'node:fs';
import gulp from 'gulp';
import plugins from 'gulp-load-plugins';
import semver from 'semver';
import minimist from 'minimist';

// Load all Gulp plugins into one variable
const $ = plugins();

const argv = minimist(process.argv.slice(2));

// Check for --production flag
const PRODUCTION = !!(argv.production);
if (PRODUCTION) console.log(color.inverse.cyan('--- Production version in progress ---'));

const hint = () => {
  gulp.src('./twoday-export.js')
    .pipe($.jshint(require('./.jshintrc'))) // ES5 (target is Browser)
    .pipe($.jshint.reporter('jshint-stylish', { beep: true }));
  return gulp.src(['./tools/res*.js', './tools/checkExport.js'])
    .pipe($.jshint(Object.assign(
      {}, 
      require('./.jshintrc'),
      { esversion: 6, browser: false, latedef: false, node: true }
    ))) // ES6 (target is Node)
    .pipe($.jshint.reporter('jshint-stylish', { beep: false }));
};

const build = () => {
  let js = fs.readFileSync('./twoday-export.js', 'utf-8');
  return gulp.src(['./twoday-export.html'])
    .pipe($.replace('{{twodayExport-js}}', js))
    .pipe($.htmlmin({
      collapseWhitespace: true,
      conservativeCollapse: true,
      html5: true,
      keepClosingSlash: true,
      minifyCSS: PRODUCTION,
      minifyJS: PRODUCTION,
      preserveLineBreaks: true,
      processScripts: ['text/html', 'text/x-mustache-html']
    }))
    .pipe($.replace('{{scriptversion}}', getShortVersion()))
    .pipe(gulp.dest('dist'));
}

const getShortVersion = () => {
  let version = getPackageJson().version;
  return version.slice(0, version.lastIndexOf('.'));
};

const getPackageJson = () => {
  return JSON.parse(fs.readFileSync('./package.json'));
};

/**
 * Bump minor version and update package.json and version.json
 */
const bump = (bumpVersion = true) => {
  let pkg = getPackageJson();
  let newVersion;
  let releaseDate = new Date().toISOString().slice(0, 10).split('-').reverse().join('.');
  if (bumpVersion) {
    newVersion = semver.inc(pkg.version, 'minor');
    console.log('Bumping to new version...');
    gulp.src(['./package.json'])
      .pipe($.bump({ version: newVersion }))
      .pipe(gulp.dest('./'));
  } else {
    newVersion = pkg.version;
    console.log('Setting new release date only...');
  }

  return gulp.src(['./version.json'])
    .pipe($.replace('{{versionID}}', `v${newVersion.replace(/\./g, '')}`))
    .pipe($.replace('{{version}}', newVersion))
    .pipe($.replace('{{date}}', releaseDate))
    .pipe(gulp.dest('dist'));
}

gulp.task('default', build);
gulp.task('bump', bump);
gulp.task('hint', hint);
gulp.task('release', (done) => { bump(false); done(); });
