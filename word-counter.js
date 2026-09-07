/* ============================================================
   Word & Character Counter — runs entirely client-side.
   Pure JavaScript text analysis, no external dependencies.
   Text is counted locally and never leaves the browser.
   ============================================================ */

(function () {
  "use strict";

  var textInput = document.getElementById("textInput");
  var statWords = document.getElementById("statWords");
  var statChars = document.getElementById("statChars");
  var statCharsNoSpace = document.getElementById("statCharsNoSpace");
  var statSentences = document.getElementById("statSentences");
  var statParagraphs = document.getElementById("statParagraphs");
  var statReadTime = document.getElementById("statReadTime");
  var statSpeakTime = document.getElementById("statSpeakTime");
  var copyBtn = document.getElementById("copyBtn");
  var clearBtn = document.getElementById("clearBtn");
  var freqWrap = document.getElementById("freqWrap");
  var freqList = document.getElementById("freqList");

  if (!textInput) return; // this script only runs on the tool page

  var STOPWORDS = {
    a:1,an:1,the:1,and:1,or:1,but:1,if:1,so:1,of:1,to:1,in:1,on:1,at:1,for:1,
    with:1,by:1,from:1,up:1,down:1,out:1,off:1,over:1,under:1,is:1,are:1,was:1,
    were:1,be:1,been:1,being:1,it:1,its:1,this:1,that:1,these:1,those:1,i:1,
    you:1,he:1,she:1,we:1,they:1,them:1,his:1,her:1,our:1,your:1,their:1,
    as:1,not:1,no:1,do:1,does:1,did:1,have:1,has:1,had:1,will:1,would:1,
    can:1,could:1,should:1,than:1,then:1,there:1,here:1,which:1,who:1,what:1,
    when:1,where:1,why:1,how:1,all:1,any:1,each:1,into:1,about:1,also:1
  };

  function formatTime(minutes) {
    var totalSeconds = Math.round(minutes * 60);
    if (totalSeconds < 60) return totalSeconds + " sec";
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return mins + " min" + (secs > 0 ? " " + secs + " sec" : "");
  }

  function getWords(text) {
    var trimmed = text.trim();
    if (!trimmed) return [];
    return trimmed.split(/\s+/);
  }

  function countSentences(text) {
    var trimmed = text.trim();
    if (!trimmed) return 0;
    var matches = trimmed.match(/[^.!?]+[.!?]+/g);
    if (matches && matches.length) return matches.length;
    return 1; // text with no terminal punctuation still counts as one sentence
  }

  function countParagraphs(text) {
    var trimmed = text.trim();
    if (!trimmed) return 0;
    var blocks = trimmed.split(/\n\s*\n/).filter(function (b) { return b.trim().length > 0; });
    return blocks.length || 1;
  }

  function topWords(words, limit) {
    var freq = {};
    words.forEach(function (w) {
      var clean = w.toLowerCase().replace(/[^a-z0-9'-]/g, "");
      if (!clean || STOPWORDS[clean]) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
    return Object.keys(freq)
      .map(function (w) { return { word: w, count: freq[w] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, limit);
  }

  function update() {
    var text = textInput.value;
    var words = getWords(text);
    var wordCount = words.length;

    statWords.textContent = wordCount.toLocaleString();
    statChars.textContent = text.length.toLocaleString();
    statCharsNoSpace.textContent = text.replace(/\s/g, "").length.toLocaleString();
    statSentences.textContent = countSentences(text).toLocaleString();
    statParagraphs.textContent = countParagraphs(text).toLocaleString();
    statReadTime.textContent = formatTime(wordCount / 200);
    statSpeakTime.textContent = formatTime(wordCount / 130);

    if (wordCount >= 5) {
      var top = topWords(words, 10);
      if (top.length) {
        freqList.innerHTML = "";
        top.forEach(function (item) {
          var li = document.createElement("li");
          var w = document.createElement("span");
          w.className = "w";
          w.textContent = item.word;
          var n = document.createElement("span");
          n.className = "n";
          n.textContent = item.count;
          li.appendChild(w);
          li.appendChild(n);
          freqList.appendChild(li);
        });
        freqWrap.classList.add("show");
      } else {
        freqWrap.classList.remove("show");
      }
    } else {
      freqWrap.classList.remove("show");
    }
  }

  textInput.addEventListener("input", update);

  clearBtn.addEventListener("click", function () {
    textInput.value = "";
    textInput.focus();
    update();
  });

  copyBtn.addEventListener("click", function () {
    if (!textInput.value) return;
    textInput.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textInput.value).catch(function () {});
    } else {
      document.execCommand("copy");
    }
  });

  update();
})();
