const { assert } = require('chai');
const fs = require('node:fs');

module.exports = (global) => {

  describe(`fixing ${global.xrefs.length} niceurl-links`, () => {

    it('should fix all links', () => {

      function getStoryIDFromSlug(slug, global) {
        let id = null;
        for (let story of global.stories) {
          if ('slug' in story.fm) {
            if (story.fm.slug === slug) { id = story.fm.id; break; }
          } else
            console.log(`>>basename without slug: ${story.fm.basename}`);
        }
        return id;
      };

      let mUrl = `https?://${global.blog}\\.twoday\\.net/month\\?date=`;
      let sUrl = `https?://${global.blog}\\.twoday\\.net/stories/`;
      let rUrl = `https://${global.blog}.twoday.net/stories/`;

      console.log('\n');
      let rulesToFixLinks = Object.keys(global.xrefs).reduce((all, slug, index) => {
        let id = getStoryIDFromSlug(slug, global);
        if (id) all.push({ search: `${sUrl}${slug}`, flags: 'gi', replace: `${rUrl}${id}` });
        console.log(`Slug: ${slug} ${id ? 'is story ' + id : 'not found!!'}`);
        return all;
      }, []);

      rulesToFixLinks = Object.keys(global.monthLinks).reduce((all, month, index) => {
        let relUrl = `/${month.slice(0,4)}/${month.slice(4)}`;
        all.push({ search: `${mUrl}${month}`, flags: 'gi', replace: relUrl });
        console.log(`Month link: "${month}" changed.`);
        return all;
      }, rulesToFixLinks);
      
      fs.writeFileSync(`${global.dir}/${global.blog} hotReplaceLinks.json`, JSON.stringify(rulesToFixLinks));

    });

  });

}