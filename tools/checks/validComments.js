const { assert } = require('chai');
const cheerio = require('cheerio');
const isUri = require('isuri');

module.exports = (story, global) => {

  describe(`checking comments of story basename: ${story.fm.basename} @ https://${global.blog}.twoday.net/stories/${story.fm.id}`, () => {

    story.comments.map( (comment, index) => {

      describe(`validating comment ${index}`, () => {
        var $;

        before(() => {
          $ = cheerio.load(comment.body);
        });
    
        it('should be a valid comment type', () => {
          assert.isTrue(comment.type==='C' || comment.type==='R', 'invalid comment type');
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
            var link = $(el).attr('href');
            assert.isTrue(isUri.isValid(link), `invalid link url: ${link}`);
            assert.notMatch(link, global.regNumericStoryId,
              `link to non-numeric story id: ${link}`);
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
                    
      });

    });

  });

}