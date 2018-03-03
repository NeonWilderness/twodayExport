const { assert } = require('chai');
const cheerio = require('cheerio');
const isUri = require('isuri');

module.exports = (story, global) => {

  describe(`checking body of story basename: ${story.fm.basename} @ https://${global.blog}.twoday.net/stories/${story.fm.id}`, () => {
    var $;

    // strip chars " and / from the end of the link
    const sanitizeLink = (link => {
      for (var i = link.length - 1; i >= 0; i--) {
        if (link[i] !== '/' && link[i] !== '"') break;
      };
      return link.substr(0, i + 1).split('/').pop();
    });

    before(() => {
      $ = cheerio.load(story.body);
    });

    it('should not be empty', () => {
      assert.notEqual(story.fm.title.length + story.body.length, 0, 'empty story body');
    });

    it('should have valid link urls', function () {
      $('a').each(function (index, el) {
        var link = $(el).attr('href');
        assert.isTrue(isUri.isValid(link), `invalid link url: ${link}`);
        assert.notMatch(link, global.regAlphaNumericStoryId,
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
      assert.notMatch(story.body, /<%\s*.*\s*%>/, 'unconverted Twoday macro');
    });

    it('should not have any empty moblog images', function () {
      $('.moblog_image').each(function (index, el) {
        assert.notEqual($(el).html().length, 0, 'empty .moblog_image');
      });
    });

    it('should have valid topic id in topic links', function () {
      let topicLinks = story.body.match(global.regTopicLinks);
      if (topicLinks)
        topicLinks.forEach((topicLink) => {
          let topicID = sanitizeLink(topicLink);
          assert.include(global.topics, topicID, `linked topic ${topicID} does not exist`);
        });
    });

    it('should have a valid story id in story links', function () {
      let storyLinks = story.body.match(global.regNumericStoryId);
      if (storyLinks)
        storyLinks.forEach((storyLink) => {
          let storyID = sanitizeLink(storyLink);
          assert.include(global.storyIDs, storyID, `linked storyID ${storyID} does not exist`);
        });
    });

  });

}