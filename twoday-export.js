(function () {
  "use strict";
  // core object of the blog export function
  var twodayExport = {

    // check if user is an admin
    isUserAdministrator: function () {
      var node = document.getElementById('exportLoginStatus'),
        text = node.textContent || node.innerText,
        role = text.match(/\((.*)\)/);
      return (role ? role[1] === "Administrator" : false);
    },

    // check if the Font Awesome css is already loaded
    isFontAwesomePresent: function () {
      var isLoaded = false;
      $.each(document.styleSheets, function () {
        isLoaded = ((this.href || "").indexOf("font-awesome.min.css") >= 0);
        return !isLoaded; // isLoaded=false: next iteration(=continue); isLoaded=true: quits each-loop(=break)
      });
      return isLoaded;
    },

    // data models for the mustache templating process
    musSelectionScreen: {
      alias: "<% site.alias %>",
      blog: "<% site.href %>",
      version: "{{scriptversion}}", // will be set during dev/build stage
      categories: []
    },

    musStatusScreen: {
      pubArtRead: 0,
      pubArtSelected: 0,
      pubArtWrite: 0,
      offArtRead: 0,
      offArtSelected: 0,
      offArtWrite: 0,
      styRead: 0,
      styWrite: 0,
      comRead: 0,
      comWrite: 0,
      repRead: 0,
      repWrite: 0,
      filenameExport: "<% site.alias %> export.txt",
      filenameResourceList: "<% site.alias %> url liste.html",
      init: function (isTestRun) {
        this.pubArtRead = 0;
        this.pubArtSelected = 0;
        this.pubArtWrite = 0;
        this.offArtRead = 0;
        this.offArtSelected = 0;
        this.offArtWrite = 0;
        this.styRead = 0;
        this.styWrite = 0;
        this.comRead = 0;
        this.comWrite = 0;
        this.repRead = 0;
        this.repWrite = 0;
        this.startTime = new Date().getTime();
        this.isTestRun = isTestRun;
      },
      incValue: function (id, cnt) {
        var add = (typeof cnt === "undefined" ? 1 : cnt);
        this[id] += add;
        document.getElementById(id).innerText = this[id];
      },
      startTime: null,
      timeUsed: function () {
        var secInt = Math.floor((new Date().getTime() - this.startTime) / 1000),
          hrs = Math.floor(secInt / 3600),
          min = Math.floor((secInt - (hrs * 3600)) / 60),
          sec = secInt - (hrs * 3600) - (min * 60);
        if (hrs < 10) { hrs = "0" + hrs; }
        if (min < 10) { min = "0" + min; }
        if (sec < 10) { sec = "0" + sec; }
        return hrs + ':' + min + ':' + sec;
      }
    },

    // hold the mustache templates for a story and comment/reply (mustache partial)
    musStory: "",
    musPartials: {},

    // output data
    filelen: 0,
    stories: [],
    blobList: [],
    resourceList: [],
    xrefs: {},

    // timeout-specs for recursive ajax reads (milliseconds) to avoid twoday server returning 403-forbidden errors
    timeoutStories: 500,
    timeoutBody: 5,
    timeoutComments: 5,

    // Autolinker instance (from Greg Jacobs, https://github.com/gregjacobs/Autolinker.js)
    autoLinker: null,

    // gets the input date's longint from pickadate js
    getPicker: function (selector) {
      var $input = $(selector).pickadate(),
        picker = $input.pickadate("picker"),
        item = picker.get("select");
      return (item === null ? 0 : item.pick);
    },

    // selection screen input validation
    validateSelectionParams: function (params) {
      var selMessage = "",
        //----- list of potential error messages
        txtMessages = {
          properDates: "Bitte geben Sie bei gewählter Zeiteingrenzung ein gültiges Von- und Bis-Datum ein!",
          validDates: "Das Bis-Datum muss größer als das Von-Datum sein!",
          validCatNum: "Bitte wählen Sie mindestens eine Kategorie aus (z.B. 'Alle')!",
          validCatMix: "Entfernen Sie die 'Alle'-Kategorie, wenn Sie einzelne Kategorien selektieren wollen!",
          validMaxNumber: "Bitte geben Sie bei gewählter Anzahlbegrenzung eine gültige <b>Beitragsanzahl</b> ein!",
          validFromNumber: "Bitte geben Sie bei gewählter Anzahlbegrenzung eine gültige <b>Startnummer</b> ein!",
          validBlogUrl: "Zur Adressanpassung der Twoday-Bilder bitte eine gültige neue Blogadresse eingeben!"
        };
      // validate user selection parameters and set related message key
      if (!params.properDates()) selMessage = "properDates";
      else if (!params.validDates()) selMessage = "validDates";
      else if (!params.validCategoryNum()) selMessage = "validCatNum";
      else if (!params.validCategoryMix()) selMessage = "validCatMix";
      else if (!params.validMaxNumber()) selMessage = "validMaxNumber";
      else if (!params.validFromNumber()) selMessage = "validFromNumber";
      else if (!params.validBlogUrl()) selMessage = "validBlogUrl";
      if (selMessage.length > 0) {
        $("#selMessage").html(txtMessages[selMessage]).show();
        return false;
      }
      else {
        $("#selMessage").html("").hide();
        return true;
      }
    },

    // renders the mustache template to the screen
    renderScreen: function (id) {
      var html = Mustache.render($("#" + id).html(), this[id]);
      $("#selScreen").html(html);
      $("#btnIntro").on("click", function (e) {
        e.preventDefault();
        var self = $(this);
        if (self.hasClass("onSelect")) {
          $("#selMessage").html("").attr("class", "").hide();
          $("#selOptions").toggle(0);
        }
        $("#selIntro").toggle(0);
        self.find("i").toggleClass("fa-question fa-times");
      });
    },

    // filters/excludes stories based on given user selection criteria
    filterStory: function (story) {
      // make a positive assumption
      var isExcluded = false, sDate;
      // 1st check: is the story within the given date range if date selection was requested?
      if (this.params.selDate) {
        sDate = Date.parse(story.date);
        isExcluded = sDate < this.params.fromDate || sDate > this.params.toDate;
      }
      // 2nd check: check if only public stories are to be selected
      if (!isExcluded && this.params.selStatus === "mystories") {
        isExcluded = (story.status === "draft");
      }
      // 3rd check: does story have a relevant category?
      if (!isExcluded) {
        isExcluded = !this.params.isSelectedCategory(story.category);
      }
      return isExcluded;
    },

    //- folds the overlay screen
    closeOverlay: function () {
      $(document).off("keyup");
      $("#selOverlay").hide(400);
    },

    //- renders a message text
    renderMessage: function (msgText, msgClass) {
      $("#selMessage>span:first")
        .text(msgText)
        .parent()
        .addClass(msgClass)
        .show(400);
      $("#btnOK").on("click", function (e) {
        e.preventDefault();
        twodayExport.closeOverlay();
      });
    },

    //- renders a warning that no stories were selected due to given selection constraints
    renderWarning: function () {
      this.renderMessage("Für die gewählten Filterkriterien wurden keine Beiträge gefunden!", "bgYellow");
    },

    //- renders an error caused by an ajax read issue
    renderError: function (errMsg) {
      this.renderMessage(errMsg, "");
    },

    //- recursively reads story overview pages and extracts core story data
    recursiveStories: function (currPage, stories) {
      var pageUrl = "/stories/" + this.params.selStatus + "?page=" + currPage;
      var xhr = $.get(pageUrl, function (data) {
        var $admin = $(data).find(".admin"), lastPage, totalFiles, x, y;
        if (twodayExport.params.debugMode) console.log("Read story overview page: ", pageUrl);
        $admin.find(".listItem").each(function () {
          var $this = $(this), $leftCol = $this.find(".leftCol"), story = {};
          story.title = $.trim($this.find("tr>td>b").text());
          x = $leftCol.text();
          story.id = x.match(/id="(.*)"/)[1];
          y = x.match(/Status: (.*)\s/)[1].split(",")[0].split(" in ");
          story.status = (y[0] === "online" ? "publish" : "draft");
          x = $leftCol.find("a[href*=topics]").eq(0).text();
          story.category = (x.length > 0 ? x : (story.status === "publish" ? "Unkategorisiert" : "Unveröffentlicht"));
          x = $leftCol.find(">span").eq(2);
          y = x.text();
          story.author = y.match(/erstellt von (.*) am/)[1];
          if (twodayExport.params.delGuest) story.author = story.author.replace(" (Gast)", "");
          y = y.match(/ am (.*)/)[1];
          story.date = y.substr(6, 4) + "-" + y.substr(3, 2) + "-" + y.substr(0, 2) + y.substr(10);
          y = x.find(">a");
          story.url = (y.length > 0 ? y.attr("href") : "");
          twodayExport.musStatusScreen.incValue(story.status === "publish" ? "pubArtRead" : "offArtRead");
          if (!twodayExport.filterStory(story)) stories.push(story);
        });
        var $navSummary = $admin.find(".pageNavSummary:first");
        if ($navSummary.length === 0) {
          lastPage = 0;
        } else {
          totalFiles = parseInt($navSummary.text().split(" ")[3], 10);
          lastPage = Math.floor(totalFiles / 20);
        }
        if (currPage < lastPage) {
          setTimeout(function () { return twodayExport.recursiveStories(currPage + 1, stories); }, twodayExport.timeoutStories);
        } else if (stories.length > 0) {
          // sorts storyarray descending (newest to the top)
          stories.sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); });
          // crunch down the stories array to the requested number package (if so requested)
          if (twodayExport.params.selNumber) twodayExport.stories = stories.slice(twodayExport.params.sliceFrom(), twodayExport.params.sliceTo());
          return twodayExport.recursiveBody(0, twodayExport.stories);
        } else {
          twodayExport.renderWarning();
        }
      })
        .fail(function () {
          if (twodayExport.params.debugMode) console.log(">>>Fail to read storyPage: ", pageUrl, xhr.status, xhr.statusText);
          twodayExport.renderError("Fehler beim Lesen der Beitragsübersichtsseite: " + pageUrl + ", status: " + xhr.status + ", text: " + xhr.statusText);
        });
    },

    //- converts niceurl story references back to a plain story-id reference (so that they can later be refactored to wordpress urls by means of the import plugin)
    convertNiceUrlToStoryID: function (slug, xref) { // example: slug="videodemo", xref={ storyID: "12345678", refIdx: [ 5, 20, 49 ] }
      // do the replacement only if there is a valid storyID
      if (!('storyID' in xref)) {
        console.log('>>> Missing storyID field in: ' + slug + ' - xref-Object: ' + JSON.stringify(xref));
        return;
      }
      if (xref.storyID.length > 0) {
        var story,
          regNiceUrl = new RegExp('/stories/' + slug, 'gi'),
          strStoryidUrl = '/stories/' + xref.storyID;
        // for each of the found references for the same slug: get the story's body and replace slug for storyid
        for (var i = 0, arr = xref.refIdx, len = arr.length; i < len; ++i) {
          story = twodayExport.stories[arr[i]];
          story.body = story.body.replace(regNiceUrl, strStoryidUrl);
        }
      }
      if (twodayExport.params.debugMode) { console.log("convertNiceUrlToStoryID: slug=" + slug + ", storyID=" + xref.storyID + ", #stories=" + xref.refIdx.length); }
    },

    //- find the remaining storyIDs of stories not included in this export package, i.e. explicitely read the story via ajax
    addMissingNiceUrlStoryIDs: function (currXrefIdx, xrefKeys) {
      var slug = xrefKeys[currXrefIdx],
        xref = twodayExport.xrefs[slug];
      if (xref.storyID.length > 0) {
        twodayExport.convertNiceUrlToStoryID(slug, xref);
        currXrefIdx += 1;
        if (currXrefIdx < xrefKeys.length) {
          return twodayExport.addMissingNiceUrlStoryIDs(currXrefIdx, xrefKeys);
        } else {
          return twodayExport.renderStories();
        }
      } else {
        var xrefUrl = '/stories/' + slug,
          xhr = $.get(xrefUrl, function (data) {
            var $story = $(data).find(".story");
            xref.storyID = $story.attr("data-storyid");
            twodayExport.convertNiceUrlToStoryID(slug, xref);
            currXrefIdx += 1;
            if (currXrefIdx < xrefKeys.length) {
              setTimeout(function () { return twodayExport.addMissingNiceUrlStoryIDs(currXrefIdx, xrefKeys); }, twodayExport.timeoutBody);
            } else {
              return twodayExport.renderStories();
            }
          })
            .fail(function () {
              if (twodayExport.params.debugMode) console.log(">>>Fail to read source story: ", xrefUrl, xhr.status, xhr.statusText);
              currXrefIdx += 1;
              if (currXrefIdx < xrefKeys.length) {
                setTimeout(function () { return twodayExport.addMissingNiceUrlStoryIDs(currXrefIdx, xrefKeys); }, twodayExport.timeoutBody);
              } else {
                return twodayExport.renderStories();
              }
            });
      }
    },

    //- assigns the numeric storyID to all saved alpha (niceUrls) cross referenced stories
    assignNiceUrlsStoryID: function () {
      // pointer to the xref object that holds all cross referenced story urls
      var xrefs = this.xrefs;
      // were any alpha xrefs used (and saved)? if no, then return without action
      var lenXrefs = Object.keys(xrefs).length;
      if (lenXrefs === 0) return;
      // loop over all stories
      var found = 0;
      $.each(this.stories, function (index, story) {
        // extract the slug (basename-string without the story-id)
        var slug = story.basename.substr(0, story.basename.lastIndexOf("-"));
        // has this slug been used as an internal cross reference link? yes, then add the numeric story.id to the entry
        if (typeof xrefs[slug] !== "undefined") {
          xrefs[slug].storyID = story.id;
          found++;
        }
      });
      if (twodayExport.params.debugMode) console.log("End of assignNiceUrlsStoryID: #xrefs=", lenXrefs, "#IDs found=", found);
    },

    //- save all identified nice url cross references to other stories to a global xref array for later processing
    saveNiceUrlXrefs: function (story, index) {
      var match, niceUrl, i, l, xref;
      // find all internal story cross references in this story.body
      $("<div>").html(story.body).find('a[href*="<% site.alias %>.twoday.net/stories/"]').each(function () {
        // extract the last part of the url
        match = this.href.match(/\/stories\/(.*)\/?/);
        if (match === null) return true;
        // save as niceUrl and reduce urls such as 'stories/6116682/' or 'stories/6116682/main' or 'stories/6116682#6117220' ==> 6116682
        niceUrl = match[1].split('#')[0]; // eliminate comment-IDs
        niceUrl = niceUrl.split('?')[0];  // eliminate query params
        niceUrl = niceUrl.split('/')[0];  // eliminate /main or /edit additions
        // if it is not a number (i.e. the plain Twoday storyID) but a real alphanumeric niceurl instead
        if (niceUrl.length > 0 && !$.isNumeric(niceUrl)) {
          // then check if this is the first xref for this niceurl
          if (typeof twodayExport.xrefs[niceUrl] === "undefined") {
            // yes, then put initial entry and index reference to the story where it occured
            twodayExport.xrefs[niceUrl] = { storyID: '', refIdx: [index] };
            if (twodayExport.params.debugMode) console.log("Init xref: " + niceUrl + " in basename: " + story.basename);
          } else {
            // it has been found before: then check if it is a new story index
            for (i = 0, xref = twodayExport.xrefs[niceUrl], l = xref.refIdx.length; i < l; ++i) {
              if (xref.refIdx[i] === index) break;
            }
            // if the index number is new, then add the reference to the existing entry
            if (i >= l) twodayExport.xrefs[niceUrl].refIdx.push(index);
          }
        }
      });
    },

    //- make sure only legit characters are part of the basename (a-z 0-9 _ -)
    legitSlugChars: function (slug) {
      return slug
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^\w ]+/g, '')
        .trim()
        .replace(/ +/g, '-');
    },

    // converts all html5video-class element to real iframes for target plattform
    transformVideoloadRefs: function (body) {
      // early exit if no videoload usage
      if (body.indexOf('html5video') < 0) return body;
      // allocate work div for videoload iframe generation
      var $work = $('#workDiv');
      // make body a jquery element
      var $body = $("<div>").html(body);
      // search and process all video refs
      var $vids = $body.find('.html5video');
      $vids.each(function (index, item) {
        var widthClass = item.className.match(/width-[0-9]+/);
        var newWidth = 'width-' + twodayExport.params.videowidth;
        if (widthClass) {
          item.className.replace(widthClass[0], newWidth);
        } else {
          item.className += ' ' + newWidth;
        }
        $work.append($(item).clone());
      });
      window.video2day.run({ exportRun: true });
      $work
        .find('.html5video')
        .each(function (index, item) {
          $vids.eq(index).html(item.dataset.content);
        });
      $work.empty();
      return $body.html();
    },

    //- reads the body html of all selected stories
    recursiveBody: function (currStoryIdx, stories) {
      var story = stories[currStoryIdx],
        storyEditUrl = "/stories/" + story.id + "/edit";
      this.musStatusScreen.incValue(story.status === "publish" ? "pubArtSelected" : "offArtSelected");
      var xhr = $.get(storyEditUrl, function (data) {
        var $admin = $(data).find(".admin"),
          slug = $admin.find("#modNiceUrlsText").text();
        story.body = $admin.find(".formText").text();
        if (twodayExport.params.debugMode) console.log("Read source of story: ", storyEditUrl);
        story.body = story.body.replace(/http:\/\/static\.twoday\.net/gi, 'https://static.twoday.net');
        if (twodayExport.params.videowidth > 0) story.body = twodayExport.transformVideoloadRefs(story.body);
        if (twodayExport.params.autoLink) story.body = twodayExport.autoLinker.link(story.body);
        if (slug.length === 0) slug = (story.title.length ? twodayExport.legitSlugChars(story.title) : 'notitle');
        story.basename = slug + "-" + story.id;
        story.allowcomments = Math.abs(!$admin.find("#discussions").prop("checked") - 1).toString();
        twodayExport.saveNiceUrlXrefs(story, currStoryIdx);
        twodayExport.musStatusScreen.incValue("styRead");
        currStoryIdx += 1;
        if (currStoryIdx < stories.length) {
          setTimeout(function () { return twodayExport.recursiveBody(currStoryIdx, stories); }, twodayExport.timeoutBody);
        } else {
          if (twodayExport.params.debugMode) console.log('>>> xrefs:', JSON.stringify(twodayExport.xrefs, null, 2));
          return twodayExport.recursiveComments(0, stories);
        }
      })
        .fail(function () {
          if (twodayExport.params.debugMode) console.log(">>>Fail to read source story: ", storyEditUrl, xhr.status, xhr.statusText);
          twodayExport.renderError("Fehler beim Lesen des Beitrags: " + storyEditUrl + ", status: " + xhr.status + ", text: " + xhr.statusText);
        });

    },

    //- comment data extraction selectors/functions for plain twoday standard
    selectorsStandard: {
      set: "Standard",
      comments: ".comments",
      commentDate: ">.commentDate|text",
      commentAuthor: ">.commentDate>a|text",
      commentUrl: ">.commentDate>a|href",
      commentTitle: ">h4|text",
      commentBody: ">div:nth-child(3)|html",
      reply: ">.reply",
      d2: function (digit) { return (("" + digit).length < 2 ? "0" + digit : "" + digit); },
      months: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
      getMonth: function (strMonth) { return $.inArray(strMonth, this.months) + 1; },
      extractDate: function (dateStr, storyDate) {
        var x = dateStr.split(" - ")[1],
          day = x.match(/(.*)\./)[1],
          month = this.getMonth(x.match(/\s(.*)\,/)[1]),
          year = storyDate.substr(0, 4),
          time = x.match(/\, (.*)/)[1];
        x = year + "-" + this.d2(month) + "-" + this.d2(day) + " " + time;
        return ((Date.parse(x) < Date.parse(storyDate)) ? (parseInt(year, 10) + 1).toString() + x.substr(4) : x);
      },
      anonymousAuthor: function ($item) { return ($item.find(">.commentDate").text().split(" - ")[0]); }
    },

    //- comment data extraction selectors/functions for imported export layout usage
    selectorsLayout: {
      set: "Layout",
      comments: ".comments",
      commentDate: ">.commentDate|text",
      commentAuthor: ">.commentDate>a|text",
      commentUrl: ">.commentDate>a|href",
      commentTitle: ">h4|text",
      commentBody: ">div:nth-child(3)|html",
      reply: ">.reply",
      extractDate: function (dateStr) {
        return dateStr.split(" - ")[1];
      },
      anonymousAuthor: function ($item) { return ($item.find(">.commentDate").text().split(" - ")[0]); }
    },

    //- comment data extraction selectors/functions for a foundation blog
    selectorsFoundation: {
      set: "Foundation",
      comments: ".comments",
      commentDate: ".commentDate:first>span|title",
      commentAuthor: ".commentUser:first>a|text",
      commentUrl: ".commentUser:first>a|href",
      commentTitle: ".commentTitle:first|text",
      commentBody: ".commentText:first|html",
      reply: ">.reply",
      extractDate: function (dateStr) {
        return dateStr.substr(0, 16);
      },
      anonymousAuthor: function ($item) { return ($item.find(".commentUser:first").text().match(/(.*)\s/)[1]); }
    },

    //- define the relevant jquery selectors to extract data from comments and replies
    commentSelectors: {
      //----- define different sets and how to recognize them in the core domain html
      sets: [
        { id: "Layout", checkfor: "#exportLayout" },
        { id: "Foundation", checkfor: "#f5Body" },
        { id: "Standard", checkfor: "" }
      ],
      //----- determine the set type for this blog and integrate the related selector set
      initSet: function () {
        $.each(this.sets, function () {
          if (this.checkfor.length === 0 || $(this.checkfor).length > 0) {
            $.extend(twodayExport.commentSelectors, twodayExport["selectors" + this.id]);
            return false;
          }
        });
      },
      //----- retrieve a selectors first element content: text, html or specific attribute
      retrieveDOMValue: function ($item, selector) {
        var select = this[selector].split("|"),
          elem = $item.find(select[0]).eq(0);
        if (elem.length > 0) {
          switch (select[1]) {
            case "text": return elem.text();
            case "html": return elem.html();
            default: return elem.attr(select[1]);
          }
        } else {
          return "";
        }
      }
    },

    //- reads the body/date of comments and replies of all selected stories
    recursiveComments: function (currStoryIdx, stories) {

      var story = stories[currStoryIdx],
        storyMainUrl = "/stories/" + story.id,
        s = this.commentSelectors,
        p = this.params;

      function getFullImgName(imgName) {
        // check if alias name was used, e.g. name="seenia/IMG_12345"
        if (imgName.indexOf('/') >= 0) {
          var imgParts = imgName.split('/');
          if (imgParts[0] === '<% site.alias %>')
            imgName = imgParts[1];
          else
            // return if alias is not self
            return '';
        }
        // finds the full image name (incl. extension) or returns an empty string
        for (var i = 0, len = story.images.length, fullname; i < len; ++i) {
          fullname = story.images[i];
          if (imgName === fullname.split('.')[0]) { return fullname; }
        }
        return '';
      }

      function buildFileTag(fromMacro) {
        var nameMatch = fromMacro.match(/name="(.*?)"/i);
        if (nameMatch && story.files.hasOwnProperty(nameMatch[1])) {
          var fileName = nameMatch[1];
          var file = story.files[fileName];
          return '<a target="_blank" href="' + file.url + '">' + fileName + ' (' + file.ext + ')</a>';
        } else return '';
      }

      function buildImageTag(fromMacro) {
        //--------- mustache img template string with vars
        var musImgTag = '{{#linkTo}}<a target="_blank" href="{{&linkTo}}">{{/linkTo}}<img src="{{&staticImgUrl}}{{&imgName}}"{{&class}}{{&align}}{{&width}}{{&height}}{{&border}}>{{#linkTo}}</a>{{/linkTo}}',
          musTagVars = {
            align: '',
            border: '',
            class: '',
            height: '',
            imgName: '',
            linkTo: '',
            staticImgUrl: p.staticImgUrl,
            width: ''
          },
          imgAttr, attr, value;
        //--------- split image macro along space delimiter and inspect parts
        $.each(fromMacro.split(' '), function () {
          //------------- skip parts that don't feature a relevant attribute
          if (this.indexOf('=') < 0) return true;
          //------------- split the attribute at the equal sign
          imgAttr = this.split('=');
          //------------- sanitize parts
          attr = imgAttr[0].toLowerCase();
          value = (imgAttr[1] || '').replace(/["”']/g, '');
          //------------- now check the 1st attribute part and save the mustache template variable
          switch (attr) {
            case 'align':
            case 'border': musTagVars[attr] = ' ' + this; break;
            case 'class': if (value.indexOf('autolink') < 0) musTagVars.class = ' ' + this; break;
            case 'height': musTagVars.height = ' height="' + value + '"'; break;
            case 'name': musTagVars.imgName = getFullImgName(value); break;
            case 'linkto':
            case 'href': musTagVars.linkTo = value; break;
            case 'width': musTagVars.width = ' width="' + value + '"'; break;
          }
        });
        //--------- return the rendered mustache template if the full image name was found
        return (musTagVars.imgName.length > 0 ? Mustache.render(musImgTag, musTagVars) : '');
      }

      //----- change all twoday file macros <% image name="xyz" %> to genuine a/href tags (file macros are only allowed in body text, not in a comment text)
      function changeFileMacros(body) {
        var macroStart, macroEnd, fileMacro;
        // locate a Twoday resource macro <% resource ... %>
        macroStart = body.search(/<\% file(.*?)\%>/);
        // as long as there is an resource macro in the body
        while (macroStart >= 0) {
          // find the end of this macro
          macroEnd = body.indexOf("%>", macroStart + 7);
          // and copy it for further inspection
          fileMacro = body.slice(macroStart, macroEnd + 2);
          // build the file element as the replacement for the resource macro
          body = body.replace(fileMacro, buildFileTag(fileMacro));
          // check again, if there are any more resource macros
          macroStart = body.search(/<\% file(.*?)\%>/);
        }
        return body;
      }

      //----- change all twoday image macros <% image name="xyz" %> to genuine img tags (image macros are only allowed in body text, not in a comment text)
      function changeImgMacros(body) {
        var macroStart, macroEnd, imgMacro;
        //--------- locates a Twoday image macro <% image ... %>
        macroStart = body.search(/<\% image(.*?)\%>/);
        //--------- as long as there is an image macro in the body
        while (macroStart >= 0) {
          //------------- find the end of this macro
          macroEnd = body.indexOf("%>", macroStart + 8);
          //------------- and copy it for further inspection
          imgMacro = body.slice(macroStart, macroEnd + 2);
          //------------- build the img element as the replacement for the image macro
          body = body.replace(imgMacro, buildImageTag(imgMacro));
          //------------- check again, if there are any more image macros
          macroStart = body.search(/<\% image(.*?)\%>/);
        }
        return body;
      }

      function changeStaticImgUrls(body) {
        // change all actual static img references if user requested an URL change
        return (p.imgUrlChange ? body.replace(p.regStaticImg, p.wpMediaUrl) : body);
      }

      function changeStaticFileUrls(body) {
        // change all actual static file references if user requested an URL change
        return (p.imgUrlChange ? body.replace(p.regStaticFile, p.wpMediaUrl) : body);
      }

      //----- change <% image %> and <% file %> macros, then adapt static URLs
      function changeMacros(body) {
        body = changeImgMacros(body);
        body = changeFileMacros(body);
        body = changeStaticImgUrls(body);
        return changeStaticFileUrls(body);
      }

      //----- processes a comment or reply block and extracts relevant information
      function processCommentOrReply($item, type, counter) {
        var comment = {},
          title = s.retrieveDOMValue($item, 'commentTitle'),
          body = s.retrieveDOMValue($item, 'commentBody'),
          dateStr;
        dateStr = s.retrieveDOMValue($item, 'commentDate');
        comment.date = s.extractDate(dateStr, story.date);
        comment.type = type;
        comment.author = s.retrieveDOMValue($item, 'commentAuthor');
        if (comment.author.length === 0) comment.author = s.anonymousAuthor($item);
        if (p.delGuest) comment.author = comment.author.replace(' (Gast)', '');
        comment.url = s.retrieveDOMValue($item, 'commentUrl');
        comment.body = changeStaticImgUrls(title.length > 0 ? title + ' ' + body : body);
        if (p.videowidth > 0) comment.body = twodayExport.transformVideoloadRefs(comment.body);
        twodayExport.musStatusScreen.incValue(counter === 'C' ? 'comRead' : 'repRead');
        return comment;
      }

      //----- checks if a comment is a Trackback-URL or a list of actual trackbacks; these will be skipped
      function isTrackbackComment($comment) {
        return (($comment.text().indexOf('/modTrackback') >= 0) || ($comment.find('a[name="trackbacks"]').length > 0));
      }

      //----- reads the story (now in rendered mode) to take over comments and replies
      var xhr = $.get(storyMainUrl, function (data) {
        var $content = $(data).find('#content');

        if (twodayExport.params.debugMode) console.log('Read rendered story: ', storyMainUrl);
        //--------- find all static images and remember their filenames (once for multiple references)
        var imgUrl, imgFile;
        story.images = [];
        $content.find('img').each(function () {
          imgUrl = this.src || '';
          if (imgUrl.match(p.regStaticImg)) {
            // eliminates the "_small"-suffix for thumbnail/popup-images
            imgFile = imgUrl.substr(imgUrl.lastIndexOf('/') + 1).replace('_small.', '.');
            if (story.images.indexOf(imgFile) < 0) story.images.push(imgFile);
          }
        });

        //--------- find all static files and remember their data (once for multiple references)
        story.files = {};
        $content.find('.fileMacro').each(function () {
          story.files[this.dataset.name] = { url: this.dataset.url, ext: this.dataset.ext };
        });

        //--------- change the url of static resources (img/files) in the story's body
        story.body = changeMacros(story.body);

        //--------- save processed comments/replies
        story.comments = [];
        var $comments = $content.find(s.comments);
        story.cntComments = $comments.length;
        story.cntReplies = 0;
        $comments.each(function () {
          var $comment = $(this);
          if (!isTrackbackComment($comment)) {
            story.comments.push(processCommentOrReply($comment, 'COMMENT', 'C'));
            var $replies = $comment.find(s.reply);
            story.cntReplies += $replies.length;
            $replies.each(function () {
              var $reply = $(this);
              story.comments.push(processCommentOrReply($reply, p.typeReply, 'R'));
            });
          }
        });

        //--------- recursively process all stories
        currStoryIdx += 1;
        if (currStoryIdx < stories.length) {
          setTimeout(function () { return twodayExport.recursiveComments(currStoryIdx, stories); }, twodayExport.timeoutComments);
        } else {
          twodayExport.assignNiceUrlsStoryID();
          var xrefKeys = Object.keys(twodayExport.xrefs);
          if (xrefKeys.length > 0) {
            return twodayExport.addMissingNiceUrlStoryIDs(0, xrefKeys);
          } else {
            return twodayExport.renderStories();
          }
        }
      })
        .fail(function () {
          if (twodayExport.params.debugMode) console.log('>>>Fail to read rendered story: ', storyMainUrl, xhr.status, xhr.statusText);
          twodayExport.renderError('Fehler beim Lesen der Beitrags: ' + storyMainUrl + ', status: ' + xhr.status + ', text: ' + xhr.statusText);
        });

    },

    //- render a single story including all comments and replies as a mustache partial and update total output length
    renderStory: function (story) {
      var output = Mustache.render(this.musStory, story, this.musPartials);
      this.filelen += output.length;
      if (twodayExport.params.debugMode) console.log('Render export for story: ', story.basename, 'FileLen: ', this.filelen);
      return output;
    },

    mergeImageAndFileResources: function (story) {
      var resources = [];
      story.images.map(function (imageName) {
        resources.push({ isImage: true, name: imageName, source: this.params.staticImgUrl + imageName });
      }, this);
      Object.keys(story.files).map(function (fileName) {
        resources.push({ isImage: false, name: fileName, source: story.files[fileName].url });
      });
      return resources;
    },

    //- render the list of static twoday images as a html report
    renderResourceList: function (story) {
      var musResources = '<p><div>Beitrag: <a target="_blank" href="<% site.href %>stories/{{id}}">{{title}}</a> vom {{date}}:</div><ol>{{#resources}}{{>resource}}{{/resources}}</ol></p>',
        dataResources = {
          id: story.id,
          title: story.title,
          date: story.date,
          resources: this.mergeImageAndFileResources(story)
        },
        partials = { resource: '<li><a class="resource {{#isImage}}image{{/isImage}}{{^isImage}}file{{/isImage}}" target="_blank" href="{{source}}">{{name}}</a>' + (this.params.imgUrlChange ? ' geändert in ' + this.params.wpMediaUrl + '{{name}}' : '') + '</li>' },
        output = Mustache.render(musResources, dataResources, partials);
      this.resourceList.push(output);
    },

    //- renders all stories into the extended movable type format and pushes the output text into a blob array
    renderStories: function () {
      var output,
        blobs = this.blobList,
        status = this.musStatusScreen,
        isExportRun = !status.isTestRun;
      //----- renders sorted stories
      $.each(this.stories, function () {
        output = twodayExport.renderStory(this);
        if (isExportRun) {
          blobs.push(output);
          status.incValue(this.status === 'publish' ? 'pubArtWrite' : 'offArtWrite');
          status.incValue('styWrite');
          status.incValue('comWrite', this.cntComments);
          status.incValue('repWrite', this.cntReplies);
        }
        if (this.images.length || this.files.length) twodayExport.renderResourceList(this);
      });
      //----- displays final wrap-up message
      this.renderInfoMessage();
    },

    //- write the blob array to a file by using "saveAs" provided by the awesome FileSaver.js
    writeExportFile: function () {
      var blob = new Blob([this.blobList.join('')], { type: 'text/plain;charset=utf-8' });
      window.saveAs(blob, this.musStatusScreen.filenameExport);

      var musResourceList = $('#musResourceList').html(), docList, resList,
        listParams = $.extend({}, this.musSelectionScreen, {
          storyResources: this.resourceList
        }, this.params);
      if (this.resourceList.length === 0) this.resourceList.push('<p>*** Keine statischen Twoday-Bildadressen gefunden. ***</p>');
      docList = Mustache.render(musResourceList, listParams);
      resList = new Blob([docList], { type: 'text/html;charset=utf-8' });
      window.saveAs(resList, this.musStatusScreen.filenameResourceList);
    },

    //- render the final status message along with processing time, calculated size of output file
    renderInfoMessage: function () {
      var tmpl = 'Export{{#isTestRun}}testlauf{{/isTestRun}} ohne Fehler beendet nach {{timeUsed}} (hh:mm:ss), ',
        html = Mustache.render(tmpl + Math.round(this.filelen / 1024) + ' KB', this.musStatusScreen);
      $('#selMessage>span:first').html(html).parent().addClass('bgGreen').show(400);
      if (twodayExport.params.debugMode) console.log('--------------- End of blog export process ---------------');
      //----- load Filesaver.js and do the file export if this is not a test run
      if (!this.musStatusScreen.isTestRun) {
        yepnope([
          {
            test: (typeof window.saveAs === 'undefined'),
            yep: ['https://static.twoday.net/cdn/files/filesaver-min-js.js'],
            complete: function () {
              $('#selHint, #btnFile').show();
              $('#btnFile').on('click', function (e) {
                e.preventDefault();
                twodayExport.writeExportFile();
              });
            }
          }
        ]);
      }
      //----- activate OK button, close screen once clicked and free up used space from the big arrays
      $('#btnOK').on('click', function (e) {
        e.preventDefault();
        twodayExport.closeOverlay();
        twodayExport.stories.length = 0;
        twodayExport.blobList.length = 0;
      });
    },

    //- get/validate selection screen parameters and prepare export procedure
    exportArticlesAndComments: function (isTestRun) {
      //----- initialize counters and set the start time
      this.musStatusScreen.init(isTestRun);
      //----- save user selection parameters and define validation functions
      var selParams = {
        autoLink: $('#chkAutolink').prop('checked'),
        delGuest: $('#chkDelGuest').prop('checked'),
        typeReply: ($('#chkWrdPress').prop('checked') ? 'COMMENT' : 'REPLY'),
        debugMode: $('#chkDebug').prop('checked'),
        videowidth: parseInt($('#txtVideoWidth').val()),
        timeouts: $('#txtTimeouts').val(),
        selDate: ($('input[name=selDate]:checked').val() === 'dates'),
        fromDate: this.getPicker('#txtFromDate'),
        toDate: this.getPicker('#txtToDate'),
        selStatus: $('input[name=selStatus]:checked').val(),
        selCategories: $(".chooseCategory").chosen().val() || [],
        isSelectedCategory: function (category) {
          var isIncluded = false;
          $.each(this.selCategories, function () {
            if (category === this || this === 'Alle') {
              isIncluded = true;
              return false;
            }
          });
          return isIncluded;
        },
        selNumber: ($('input[name=selNumber]:checked').val() === 'max'),
        cntNumber: 0,
        maxNumber: $('#txtNumberMax').val(),
        fromNumber: $('#txtNumberFrom').val(),
        imgUrlChange: $('#chkImgUrlChange').prop('checked'),
        newBlogUrl: $('#txtNewBlogUrl').val(),
        staticImgUrl: '<% staticURL %><% site.alias %>/images/',
        staticFileUrl: '<% staticURL %><% site.alias %>/files/',
        wpMediaUrl: "",
        sliceFrom: function () { return (parseInt(this.fromNumber, 10) - 1); },
        sliceTo: function () { return (parseInt(this.maxNumber, 10) + this.sliceFrom()); },
        properDates: function () { return (this.selDate ? this.fromDate > 0 && this.toDate > 0 : true); },
        validDates: function () { return (!this.selDate || this.fromDate < this.toDate); },
        validCategoryNum: function () { return (this.selCategories.length > 0); },
        validCategoryMix: function () { return !($.inArray('Alle', this.selCategories) >= 0 && this.selCategories.length > 1); },
        validMaxNumber: function () { return (!this.selNumber || !isNaN(parseInt(this.maxNumber, 10))); },
        validFromNumber: function () { return (!this.selNumber || !isNaN(parseInt(this.fromNumber, 10))); },
        validBlogUrl: function () {
          return !this.imgUrlChange || (/^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/.test(this.newBlogUrl));
        },
      };
      selParams.regStaticImg = new RegExp(selParams.staticImgUrl
        .replace('https:', 'https?:')
        .replace(/\//gi, '\\/'), 'gi');
      selParams.regStaticFile = new RegExp(selParams.staticFileUrl
        .replace('https:', 'https?:')
        .replace(/\//gi, '\\/'), 'gi');
      selParams.staticLen = selParams.staticImgUrl.length;
      //----- validate parameters and exit if input check has raised errors
      if (!this.validateSelectionParams(selParams)) return false;
      //----- modify timeout-specs if user has entered individual values
      if (selParams.timeouts.length > 0) {
        var msTimeout = selParams.timeouts.split('/');
        $.each(msTimeout, function (index, value) {
          switch (index) {
            case 0: twodayExport.timeoutStories = parseInt(value, 10); break;
            case 1: twodayExport.timeoutBody = parseInt(value, 10); break;
            case 2: twodayExport.timeoutComments = parseInt(value, 10); break;
          }
        });
      }
      //----- derive wordpress media upload url from new blog address
      if (selParams.imgUrlChange) {
        if (selParams.newBlogUrl.substr(selParams.newBlogUrl.length - 1) !== '/') selParams.newBlogUrl += '/';
        selParams.wpMediaUrl = selParams.newBlogUrl;
      }
      //----- put validated params into the object's top level
      this.params = selParams;
      //----- we're good to go: now deactivate actionButtons
      $('#btnIntro, .btnContainer .actionButton').off('click');
      //----- and render export status screen
      this.musStatusScreen.blog = this.musSelectionScreen.blog;
      this.renderScreen('musStatusScreen');
      //----- get the mustache templates for the movable type export layout
      this.musStory = $('#musStory').text();
      this.musPartials.musComment = $('#musComment').text();
      //----- initialize output data
      this.filelen = 0;
      this.stories.length = 0;
      this.blobList.length = 0;
      this.resourceList.length = 0;
      Object.keys(this.xrefs).forEach(function (key) { delete twodayExport.xrefs[key]; });
      //----- change selectors depending on the actual type of blog (e.g. standard vs foundation)
      this.commentSelectors.initSet();
      //----- Log timeouts when debugMode
      if (this.params.debugMode) {
        console.log('--------------- Start of blog export process ---------------');
        console.log('timeoutStories:', twodayExport.timeoutStories, 'timeoutBody:', twodayExport.timeoutBody, 'timeoutComments:', twodayExport.timeoutComments);
        console.log('--------------- Parameter ---------------');
        console.log(JSON.stringify(this.params));
        console.log('--------------- URL progress ---------------');
      }
      //----- start to read and analyze stories
      this.recursiveStories(0, this.stories);
    },

    //- adds a "blog export"-button to either the layout test message, the twoday menu, the wrapper id or the body, depending on what is found first
    addExportMenuButton: function () {
      var btnPlaces = [
        { test: '.message>a', appendTo: 'parent' },    // tested layout scenario
        { test: '.modToolbarLeft', appendTo: 'self' }, // embedded as individual skin and twoday toolbar is present
        { test: '#wrapper', appendTo: 'self' },        // no toolbar found, then use wrapper container
        { test: 'body', appendTo: 'self' }             // no wrapper found, then use body
      ], btnPlace, btnAppend;
      $.each(btnPlaces, function () {
        btnPlace = $(this.test);
        if (btnPlace.length > 0) {
          btnAppend = (this.appendTo === 'self' ? btnPlace.eq(0) : btnPlace.eq(0).parent());
          switch (this.test.substr(0, 3)) {
            case '.me': btnAppend.append('<button id="msgButton" class="startExport actionButton">Blog exportieren...</button>'); break;
            case '.mo': btnAppend.append('<span style="display:inline-block;margin-left:30px">&dArr;<a href="#" id="modToolbar-export" class="startExport" style="margin-left:6px">Blog exportieren</a></span>'); break;
            default: btnAppend.append('<button id="btnExport" class="startExport actionButton">&or;</button>'); break;
          }
          return false;
        }
      });
    },

    //- displays export selection screen after having loaded font awesome css, chosen.js and pickadate.js script
    showSelectionScreen: function () {
      yepnope([
        {
          test: twodayExport.isFontAwesomePresent(),
          nope: 'https://maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css'
        },
        {
          test: ('videoload' in window),
          nope: 'https://static.twoday.net/cdn/files/videoload2-export-min-js.js'
        },
        {
          test: (typeof Autolinker === 'undefined'),
          yep: 'https://cdnjs.cloudflare.com/ajax/libs/autolinker/1.6.2/Autolinker.min.js',
          complete: function () {
            twodayExport.autoLinker = new Autolinker({
              stripPrefix: false,
              className: 'autolinker'
            });
          }
        },
        {
          test: (typeof $.fn.chosen === 'undefined'),
          yep: [
            'https://cdnjs.cloudflare.com/ajax/libs/chosen/1.1.0/chosen.min.css',
            'https://cdnjs.cloudflare.com/ajax/libs/chosen/1.1.0/chosen.jquery.min.js'
          ],
          complete: function () {
            var xhr = $.get('/topics', function (data) {
              twodayExport.musSelectionScreen.categories.length = 0;
              $(data).find('.listItem td>a').each(function () {
                twodayExport.musSelectionScreen.categories.push($(this).text());
              });
              twodayExport.renderScreen('musSelectionScreen');
              $(".chooseCategory").chosen({ width: '100%' });
              yepnope({
                test: (typeof $.fn.pickadate === 'undefined'),
                yep: [ // bump version from 3.5.3 to 3.5.6
                  'https://cdnjs.cloudflare.com/ajax/libs/pickadate.js/3.5.6/compressed/themes/classic.css',
                  'https://cdnjs.cloudflare.com/ajax/libs/pickadate.js/3.5.6/compressed/themes/classic.date.css',
                  'https://cdnjs.cloudflare.com/ajax/libs/pickadate.js/3.5.6/compressed/picker.js',
                  'https://cdnjs.cloudflare.com/ajax/libs/pickadate.js/3.5.6/compressed/picker.date.js'
                ],
                complete: function () {
                  $(".datepicker").pickadate({
                    monthsFull: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
                    monthsShort: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
                    weekdaysFull: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
                    weekdaysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
                    today: "Heute",
                    clear: "Löschen",
                    close: "Schließen",
                    firstDay: 1,
                    format: "dd.mm.yyyy",
                    formatSubmit: "yyyy/mm/dd",
                    labelMonthNext: "Nächster Monat",
                    labelMonthPrev: "Vorheriger Monat",
                    labelMonthSelect: "Bitte Monat auswählen",
                    labelYearSelect: "Bitte Jahr auswählen",
                    selectMonths: true,
                    selectYears: true
                  });
                }
              });
              $('#btnVersion').on('click', function () {
                var package = 'https://rawgit.com/NeonWilderness/twodayExport/master/dist/version.json';
                $.getJSON(package, function (data) {
                  var newVersion = false, release, msgClass, msgText;
                  $.each(data.packages, function () {
                    if (this.name === 'twodayExport') {
                      newVersion = (parseFloat(this.version) > parseFloat(twodayExport.musSelectionScreen.version));
                      release = this;
                      return false;
                    }
                  });
                  if (newVersion) {
                    msgClass = 'bgYellow';
                    msgText = Mustache.render('<i class="fa fa-info-circle"></i>Es existiert eine neuere Version {{version}} vom {{released}}! Bitte <a target="_blank" href="{{url}}">laden</a> Sie die gepackte Layout-Datei herunter, löschen dann das bisherige Layout "twodayExport" und importieren danach die neue Version!', release);
                  } else {
                    msgClass = 'bgGreen';
                    msgText = '<i class="fa fa-check"></i>Es gibt keine neuere Exportversion!';
                  }
                  $("#selMessage").html(msgText).addClass(msgClass).show(0);
                })
                  .fail(function () {
                    var msgText = '<i class="fa fa-medkit"></i>Versionsinfos konnten nicht geladen werden.';
                    $("#selMessage").html(msgText).addClass('bgRed').show(0);
                  });
              });
              $('.btnContainer .actionButton').on('click', function (e) {
                e.preventDefault();
                switch (e.target.id) {
                  case "btnCancel": twodayExport.closeOverlay(); break;
                  default: twodayExport.exportArticlesAndComments(e.target.id === 'btnInfosOnly');
                }
              });
              $(document).on('keyup', function (e) {
                if (e.which === 27) {
                  twodayExport.closeOverlay();
                }
              });
              $('#selOverlay').show(200);
            })
              .fail(function () {
                alert('Fehler beim Lesen der Themenseite: \topics' + ', status: ' + xhr.status + ', text: ' + xhr.statusText);
              });

          }
        }
      ]);
    },

    // enables the blog export feature and establishes related button click event
    enableExportFeature: function () {
      // adds an additional menu button for blog export
      this.addExportMenuButton();
      // inserts the core export screen into the DOM
      $('body').append($('#mainExport').html());
      // activates click function to show the selection screen
      $('.startExport').on('click', function (e) {
        e.preventDefault();
        twodayExport.showSelectionScreen();
      });
    }
  };

  // called when yepnope becomes available
  function yepnopeIsLoaded() {
    // load necessary scripts for blog export function: jQuery & mustache templating
    yepnope([
      {
        test: (typeof jQuery === 'undefined'),
        yep: ['https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js'],
        complete: function () {
          yepnope([
            {
              test: (typeof Mustache === 'undefined'),
              yep: ['https://cdnjs.cloudflare.com/ajax/libs/mustache.js/0.8.1/mustache.min.js'],
              complete: function () {
                // now enable the export feature and wait for further user action
                twodayExport.enableExportFeature();
              }
            }
          ]);
        }
      }
    ]);
  }

  //- do nothing if user is not an administrator of this blog
  if (!twodayExport.isUserAdministrator()) {
    return false;
  }
  //- load yepnope if not already active
  if (typeof yepnope === 'undefined') {
    var head = document.getElementsByTagName('head')[0], yn = document.createElement('script');
    yn.type = 'text/javascript';
    yn.src = 'https://cdnjs.cloudflare.com/ajax/libs/yepnope/1.5.4/yepnope.min.js';
    yn.onload = yepnopeIsLoaded;
    head.appendChild(yn);
  } else {
    yepnopeIsLoaded();
  }
})();