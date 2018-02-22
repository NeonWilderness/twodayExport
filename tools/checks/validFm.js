const { assert } = require('chai');

module.exports = (story) => {

  describe(`checking frontmatter of story ${story.fm.basename}`, () => {

    it('should have a category', () => {
      assert.notEqual(story.fm.category.length, 0, 'missing category');
    });

    it('should have a basename', () => {
      assert.notEqual(story.fm.basename.length, 0, 'missing basename');
      if (story.fm.title.length === 0)
        assert.equal(story.fm.basename.split('-')[0], 'notitle', 'unmatching basename on empty title');
    });

    it('should have a numeric story id at the end of the basename', () => {
      assert.isNotNaN(story.fm.basename.split('-').pop(), 'invalid story id in basename');
    });

    it('should have a valid date', () => {
      assert.match(story.fm.date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'invalid story date');
    });

    it('should have an author', () => {
      assert.notEqual(story.fm.author.length, 0, 'missing author');
    });

    it('should have an url', () => {
      assert.notEqual(story.fm.url.length, 0, 'missing url');
    });

    it('should have a status', () => {
      assert.notEqual(story.fm.status.length, 0, 'missing status');
    });

    it('should have a status of publish or draft', () => {
      assert.isTrue(story.fm.status === 'publish' || story.fm.status === 'draft', 'status not publish or draft');
    });

    it('should allow/disallow comments', () => {
      assert.isTrue(story.fm.allowcomments === '0' || story.fm.allowcomments === '1', 'invalid allowcomments');
    });

  });

}