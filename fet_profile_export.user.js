/**
 * This is a Greasemonkey script and must be run using a Greasemonkey-compatible browser.
 *
 * @author blackdiamonds <blackdiamonds6219@gmail.com>
 */
// ==UserScript==
// @name           FetLife Profile Export to BlackDiamonds
// @version        0.1
// @description    Allows you to export profile for FetLife user to the BlackDiamonds group.
// @require        https://code.jquery.com/jquery-2.1.4.min.js
// @include        https://fetlife.com/*
// @exclude        https://fetlife.com/adgear/*
// @exclude        https://fetlife.com/chat/*
// @exclude        https://fetlife.com/im_sessions*
// @exclude        https://fetlife.com/polling/*
// @connect        script.google.com
// @grant          GM_log
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_openInTab
// ==/UserScript==

FL_ASL = {}; // FetLife ASL Search module
FL_ASL.CONFIG = {
    'debug': true, // switch to true to debug.
    'gasapp_url': 'https://script.google.com/macros/s/AKfycbxzs-oEtl4zZc0IthOTcOx4REregBmAHlou8gd5bCpCIagSNYVoJN99rj0Y07SNrR-G7w/exec',
    'gasapp_url_development': 'https://script.google.com/macros/s/AKfycbxOTFhjbVvzPLnTdv6ATLkwn8QtGW1XNUmWzSTdnRLl/dev'
};

// Utility debugging function.
FL_ASL.log = function (msg) {
    if (!FL_ASL.CONFIG.debug) { return; }
    GM_log('FETLIFE ASL SEARCH: ' + msg);
};

// XPath Helper function
// @see http://wiki.greasespot.net/XPath_Helper
function $x() { 
  var x='';
  var node=document;
  var type=0;
  var fix=true;
  var i=0;
  var cur;

  function toArray(xp) {
    var final=[], next;
    while (next=xp.iterateNext()) {
      final.push(next);
    }
    return final;
  }

  while (cur=arguments[i++]) {
    switch (typeof cur) {
      case "string": x+=(x=='') ? cur : " | " + cur; continue;
      case "number": type=cur; continue;
      case "object": node=cur; continue;
      case "boolean": fix=cur; continue;
    }
  }

  if (fix) {
    if (type==6) type=4;
    if (type==7) type=5;
  }

  // selection mistake helper
  if (!/^\//.test(x)) x="//"+x;

  // context mistake helper
  if (node!=document && !/^\./.test(x)) x="."+x;

  var result=document.evaluate(x, node, null, type, null);
  if (fix) {
    // automatically return special type
    switch (type) {
      case 1: return result.numberValue;
      case 2: return result.stringValue;
      case 3: return result.booleanValue;
      case 8:
      case 9: return result.singleNodeValue;
    }
  }

  return fix ? toArray(result) : result;
};

// Initializations.
var uw = (unsafeWindow) ? unsafeWindow : window ; // Help with Chrome compatibility?

FL_ASL.init = function () {
    FL_ASL.CONFIG.search_form = document.querySelector('form[action="/search"]').parentNode;
    if (FL_ASL.getUserProfileHtml()) {
        FL_ASL.main();
    } else {
        FL_ASL.loadUserProfileHtml(FL_ASL.main);
    }
};
jQuery(document).ready(function () {
    FL_ASL.init();
});


FL_ASL.getUserProfileHtml = function () {
    return GM_getValue('currentUser.profile_html', false);
};

FL_ASL.loadUserProfileHtml = function (callback, id) {
    var id = id || uw.FL.user.id;
    FL_ASL.log('Fetching profile for user ID ' + id.toString());
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': 'https://fetlife.com/users/' + id.toString(),
        'onload': function (response) {
            GM_setValue('currentUser.profile_html', response.responseText);
            callback();
        }
    });
};
// ****************************************************
//
// Google Apps Script interface
//
// ****************************************************
FL_ASL.GAS = {};
FL_ASL.GAS.ajaxPost = function (data)  {
    FL_ASL.log('POSTing profile data ' + data);
    var url = (FL_ASL.CONFIG.debug)
        ? FL_ASL.CONFIG.gasapp_url_development
        : FL_ASL.CONFIG.gasapp_url;    
    FL_ASL.log('Url ' + url)
    GM_xmlhttpRequest({
        'method': 'POST',
        'crossDomain': true,
        'url': url,
        'data': 'post_data=' + encodeURIComponent(JSON.stringify(data)),
        'dataType': "jsonp",
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        'onload': function (response) {
            FL_ASL.log('POST response received: ' + response.responseText);
        },
        'onerror': function (response) {
            FL_ASL.log('Error POSTing to ' + url + ', response received: ' + response.responseText);
        }
    });
};

// ****************************************************
//
// Scrapers
//
// ****************************************************
FL_ASL.ProfileScraper = {};
FL_ASL.ProfileScraper.getNickname = function () {
    return jQuery('#main_content h2').first().text().split(' ')[0];
};
FL_ASL.ProfileScraper.getAge = function () {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret;
    if (x.length) {
        y = x[0].textContent.match(/^\d+/);
        if (y) {
            ret = y[0];
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getGender = function () {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret = '';
    if (x.length) {
        y = x[0].textContent.match(/[^\d ]+/);
        if (y) {
            ret = y[0];
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getRole = function (body) {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret = '';
    if (x.length) {
        y = x[0].textContent.match(/ .+/);
        if (y) {
            ret = y[0].trim();
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getFriendCount = function (body) {
    var x = $x('//h4[starts-with(., "Friends")]');
    var ret = 0;
    if (x.length) {
        ret = x[0].textContent.match(/\(([\d,]+)\)/)[1].replace(',', '');
    }
    return ret;
};
FL_ASL.ProfileScraper.isPaidAccount = function () {
    return (document.querySelector('.fl-badge')) ? true : false;
};
FL_ASL.ProfileScraper.getLocation = function (dom) {
    var dom = dom || document;
    var x = $x('//h2[@class="bottom"]/following-sibling::p//a', dom);
    var ret = {
        'locality': '',
        'region': '',
        'country': ''
    };
    if (3 === x.length) {
        ret['country'] = x[2].textContent;
        ret['region'] = x[1].textContent;
        ret['locality'] = x[0].textContent;
    } else if (2 === x.length) {
        ret['country'] = x[1].textContent;
        ret['region'] = x[0].textContent;
    } else if (1 === x.length) {
        ret['country'] = x[0].textContent;
    }
    return ret;
};
FL_ASL.ProfileScraper.getAvatar = function () {
    var el = document.querySelector('.pan');
    var ret;
    if (el) {
        ret = el.src;
    }
    return ret;
};
FL_ASL.ProfileScraper.getSexualOrientation = function () {
    var x = $x('//table//th[starts-with(., "orientation")]/following-sibling::td');
    var ret = '';
    if (x.length) {
        ret = x[0].textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getInterestLevel = function () {
    var x = $x('//table//th[starts-with(., "active")]/following-sibling::td');
    var ret = [];
    if (x.length) {
        ret = x[0].textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getLookingFor = function () {
    var x = $x('//table//th[starts-with(., "is looking for")]/following-sibling::td');
    var ret = [];
    if (x.length) {
        ret = x[0].innerHTML.split('<br>');
    }
    return ret;
};
FL_ASL.ProfileScraper.getRelationships = function () {
    var x = $x('//table//th[starts-with(., "relationship status")]/following-sibling::td//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].href.match(/\d+$/)[0]);
    }
    return ret;
};
FL_ASL.ProfileScraper.getDsRelationships = function () {
    var x = $x('//table//th[starts-with(., "D/s relationship status")]/following-sibling::td//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].href.match(/\d+$/)[0]);
    }
    return ret;
};
FL_ASL.ProfileScraper.getBio = function () {
    var html = '';
    jQuery($x('//h3[@class][starts-with(., "About me")]')).nextUntil('h3.bottom').each(function () {
        html += jQuery(this).html();
    });
    return html;
};
FL_ASL.ProfileScraper.getWebsites = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Websites")]/following-sibling::ul[1]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getLastActivity = function () {
    // TODO: Convert this relative date string to a timestamp
    var x = document.querySelector('#mini_feed .quiet');
    var ret;
    if (x) {
        ret = x.textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getFetishesInto = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Fetishes")]/following-sibling::p[1]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getFetishesCuriousAbout = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Fetishes")]/following-sibling::p[2]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getPicturesCount = function () {
    var el = document.getElementById('user_pictures_link');
    var ret = 0;
    if (el) {
        ret = el.nextSibling.textContent.match(/\d+/)[0];
    }
    return ret;
};
FL_ASL.ProfileScraper.getVideosCount = function () {
    var el = document.getElementById('user_videos_link');
    var ret = 0;
    if (el) {
        ret = el.nextSibling.textContent.match(/\d+/)[0];
    }
    return ret;
};
FL_ASL.ProfileScraper.getLatestPosts = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getGroupsLead = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getGroupsMemberOf = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getEventsGoingTo = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getEventsMaybeGoingTo = function () {
    // TODO:
};

FL_ASL.scrapeProfile = function (user_id) {
    if (!window.location.pathname.endsWith(user_id)) {
        FL_ASL.log('Profile page does not match ' + user_id);
        return false;
    }
    var profile_data = {
        'user_id': user_id,
        'nickname': FL_ASL.ProfileScraper.getNickname(),
        'age': FL_ASL.ProfileScraper.getAge(),
        'gender': FL_ASL.ProfileScraper.getGender(),
        'role': FL_ASL.ProfileScraper.getRole(),
        'friend_count': FL_ASL.ProfileScraper.getFriendCount(),
        'paid_account': FL_ASL.ProfileScraper.isPaidAccount(),
        'location_locality': FL_ASL.ProfileScraper.getLocation().locality,
        'location_region': FL_ASL.ProfileScraper.getLocation().region,
        'location_country': FL_ASL.ProfileScraper.getLocation().country,
        'avatar_url': FL_ASL.ProfileScraper.getAvatar(),
        'sexual_orientation': FL_ASL.ProfileScraper.getSexualOrientation(),
        'interest_level': FL_ASL.ProfileScraper.getInterestLevel(),
        'looking_for': FL_ASL.ProfileScraper.getLookingFor(),
        'relationships': FL_ASL.ProfileScraper.getRelationships(),
        'ds_relationships': FL_ASL.ProfileScraper.getDsRelationships(),
        'bio': FL_ASL.ProfileScraper.getBio(),
        'websites': FL_ASL.ProfileScraper.getWebsites(),
        'last_activity': FL_ASL.ProfileScraper.getLastActivity(),
        'fetishes_into': FL_ASL.ProfileScraper.getFetishesInto(),
        'fetishes_curious_about': FL_ASL.ProfileScraper.getFetishesCuriousAbout(),
        'num_pics': FL_ASL.ProfileScraper.getPicturesCount(),
        'num_vids': FL_ASL.ProfileScraper.getVideosCount(),
        'latest_posts': FL_ASL.ProfileScraper.getLatestPosts(),
        'groups_lead': FL_ASL.ProfileScraper.getGroupsLead(),
        'groups_member_of': FL_ASL.ProfileScraper.getGroupsMemberOf(),
        'events_going_to': FL_ASL.ProfileScraper.getEventsGoingTo(),
        'events_maybe_going_to': FL_ASL.ProfileScraper.getEventsMaybeGoingTo()
    };
    return profile_data;
}
FL_ASL.scrapeUserInList = function (node) {
    // Deal with location inconsistencies.
    var loc_parts = jQuery(node).find('.fl-member-card__location').first().text().split(', ');
    var locality = ''; var region = ''; var country = '';
    if (2 === loc_parts.length) {
        locality = loc_parts[0];
        region   = loc_parts[1];
    } else if (1 === loc_parts.length) {
        country = loc_parts[0];
    }
    var profile_data = {
        'user_id': jQuery(node).find('a').first().attr('href').match(/\d+$/)[0],
        'nickname': jQuery(node).find('img').first().attr('alt'),
        'location_locality': locality.trim(),
        'location_region': region.trim(),
        'location_country': country.trim(),
        'avatar_url': jQuery(node).find('img').first().attr('src')
    };
    var member_info = jQuery(node).find('.fl-member-card__info').text().trim();
    if (member_info.match(/^\d+/) instanceof Array) {
        profile_data['age'] = member_info.match(/^\d+/)[0].trim();
    }
    if (member_info.match(/[^\d ]+/) instanceof Array) {
        profile_data['gender'] = member_info.match(/[^\d ]+/)[0].trim();
    }
    if (member_info.match(/ (.*)$/) instanceof Array) {
        profile_data['role'] = member_info.match(/ (.*)$/)[1].trim();
    }
    for (var k in profile_data) {
        if ('' === profile_data[k]) {
            delete profile_data[k];
        }
    }
    return profile_data;
};
FL_ASL.scrapeAnchoredAvatar = function (node) {
    var profile_data = {
        'user_id': jQuery(node).attr('href').match(/\d+$/)[0],
        'nickname': jQuery(node).find('img').first().attr('alt'),
        'avatar_url': jQuery(node).find('img').first().attr('src')
    };
    return profile_data;
};

// This is the main() function, executed on page load.
FL_ASL.main = function () {
    var m;
    if (m = window.location.pathname.match(/users\/(\d+)/)) {
        FL_ASL.log('Scraping profile ' + m[1]);
        FL_ASL.GAS.ajaxPost(FL_ASL.scrapeProfile(m[1]));
    }
};

// The following is required for Chrome compatibility, as we need "text/html" parsing.
/*
 * DOMParser HTML extension
 * 2012-09-04
 *
 * By Eli Grey, http://eligrey.com
 * Public domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

/*! @source https://gist.github.com/1129031 */
/*global document, DOMParser*/

(function(DOMParser) {
	"use strict";

	var
	  DOMParser_proto = DOMParser.prototype
	, real_parseFromString = DOMParser_proto.parseFromString
	;

	// Firefox/Opera/IE throw errors on unsupported types
	try {
		// WebKit returns null on unsupported types
		if ((new DOMParser).parseFromString("", "text/html")) {
			// text/html parsing is natively supported
			return;
		}
	} catch (ex) {}

	DOMParser_proto.parseFromString = function(markup, type) {
		if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
			var
			  doc = document.implementation.createHTMLDocument("")
			;

			doc.body.innerHTML = markup;
			return doc;
		} else {
			return real_parseFromString.apply(this, arguments);
		}
	};
}(DOMParser));