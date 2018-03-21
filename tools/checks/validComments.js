const { assert } = require('chai');
const cheerio = require('cheerio');
const isUri = require('isuri');

module.exports = (story, global) => {

  describe(`checking comments of story basename: ${story.fm.basename} @ https://${global.blog}.twoday.net/stories/${story.fm.id}`, () => {

    story.comments.map((comment, index) => {

      describe(`validating comment ${index}`, () => {
        var $;

        // strip chars " and / from the end of the link
        const sanitizeLink = (link => {
          for (var i = link.length - 1; i >= 0; i--) {
            if (link[i] !== '/' && link[i] !== '"') break;
          };
          return link.substr(0, i + 1).split('/').pop();
        });

        before(() => {
          $ = cheerio.load(comment.body);
        });

        it('should be a valid comment type', () => {
          assert.isTrue(comment.type === 'C' || comment.type === 'R', 'invalid comment type');
        });

        it('should not be empty', () => {
          assert.notEqual(comment.body.length, 0, 'empty comment body');
        });

        it('should have a valid date', () => {
          assert.match(comment.date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'invalid comment date');
        });

        it('should have an author', () => {
          assert.notEqual(comment.author.length, 0, 'missing author');
        });

        it('should have valid link urls', function () {
          $('a').each(function (index, el) {
            var $el = $(el);
            var link = $el.attr('href') || '';
            if (link.substr(0, 1) === '#' ||
              /[äüöß]/.test(link) ||
              link.substr(0, 2) === '//' ||
              link.substr(0, 11) === 'javascript:' ||
              $el.hasClass('tip') ||
              $el.hasClass('googledrive') ||
              $el.hasClass('close-reveal-modal')) return true;
            assert.isTrue(isUri.isValid(link), `invalid link url: ${link || 'no href!'}`);
            if (link.match(global.regAlphaNumericStoryId)) {
              var baseurl = link.match(/\/stories\/(.*)\/?/), basename;
              if (baseurl) {
                basename = baseurl[1].split('#')[0]; // eliminate comment-ID
                basename = basename.split('?')[0];   // eliminate query params
                basename = basename.split('/')[0];   // eliminate /main or /edit additions
                global.xrefs[basename] = true;
              }
              //assert.notMatch(link, global.regAlphaNumericStoryId, `link to non-numeric story id: ${link}`);
            }
          });
        });

        it('should not have links to static Twoday resources', function () {
          $('a').each(function (index, el) {
            var link = $(el).attr('href');
            assert.notMatch(link, global.regStaticResources, `unconverted static img/file link: ${link}`);
          });
        });

        it('should not have image sources from static Twoday images', function () {
          $('img').each(function (index, el) {
            var src = $(el).attr('src');
            assert.notMatch(src, global.regStaticImages, `unconverted static img link: ${src}`);
          });
        });

        it('should not have any remaining Twoday macros', () => {
          assert.notMatch(comment.body, /<%\s*.*\s*%>/, 'unconverted Twoday macro');
        });

        it('should not have any empty moblog images', function () {
          $('.moblog_image').each(function (index, el) {
            assert.notEqual($(el).html().length, 0, 'empty .moblog_image');
          });
        });

        it('should have valid topic id in topic links', function () {
          let topicLinks = comment.body.match(global.regTopicLinks);
          if (topicLinks)
            topicLinks.forEach((topicLink) => {
              let topicID = sanitizeLink(topicLink);
              assert.include(global.topics, topicID, `linked topic ${topicID} does not exist`);
            });
        });

        it('should have a valid story id in story links', function () {
          let storyLinks = comment.body.match(global.regNumericStoryId);
          if (storyLinks)
            storyLinks.forEach((storyLink) => {
              let storyID = sanitizeLink(storyLink);
              assert.include(global.storyIDs, storyID, `linked storyID ${storyID} does not exist`);
            });
        });

      });

    });

  });

}