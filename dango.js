'use strict'

// function require (file) {
//  return window[file.replace(/^\.[\/\\]/,'').replace(/.js$/,'')];
// }
function handleCardInfo() {
  // var defaultValueMap = {
  //  "rarity": "LR",
  //  "cardType": "SIGNI",
  //  "color": "white",
  //  "level": 0,
  //  "limit": 0,
  //  "power": 0,
  //  "limiting": "",
  //  "classes": [],
  //  "costWhite": 0,
  //  "costBlack": 0,
  //  "costRed": 0,
  //  "costBlue": 0,
  //  "costGreen": 0,
  //  "costColorless": 0,
  //  "guardFlag": false,
  //  "multiEner": false,
  // };
  for (var x in CardInfo) {
    var info = CardInfo[x];
    delete info.timestamp;
    delete info.kana;
    delete info.imgUrl;
    delete info.cardText;
    delete info.cardText_zh_CN;
    delete info.cardText_en;
    delete info.constEffects;
    delete info.actionEffects;
    delete info.startUpEffects;
    delete info.spellEffect;
    delete info.artsEffect;
    delete info.burstEffect
    delete info.faqs;
    delete info.cardSkills;
    delete info.growCondition;
    delete info.useCondition;
    delete info.costChange;
    delete info.costChangeBeforeUseAsyn;
    delete info.resonaPhase;
    delete info.resonaCondition;
    delete info.resonaAsyn;
    delete info.encore;
    delete info.bettedCost;
    if (info.rise) info.rise = true;
    // for (var key in defaultValueMap) {
    //  if (info[key] === defaultValueMap[key]) {
    //    delete info[key];
    //  }
    // }
  }
  // var textarea = document.createElement('textarea');
  // textarea.value = JSON.stringify(CardInfo);
  // document.body.appendChild(textarea);
  // textarea.select();
}

function handleCardInfo_ko(min, max) {
  var props = [
    "name",
    "actionEffectTexts",
    "constEffectTexts",
    "startUpEffectTexts",
    "spellEffectTexts",
    "artsEffectTexts",
    "burstEffectTexts",
    "attachedEffectTexts",
    "extraTexts",
  ];
  var suffix = [
    "",
    "_zh_CN",
    "_en"
  ]
  var arr = [];
  for (var x in CardInfo) {
    // if (x <= 1762) continue;
    if (x < min || x > max) continue;
    var info = CardInfo[x];
    var obj = {
      pid: info.pid,
      wxid: info.wxid,
    };
    props.forEach(function(rawprop) {
      // suffix.forEach(function (suf) {
      //  var prop = rawprop + suf;
      //  if (!info[prop]) return;
      //  obj[prop] = info[prop];
      // });
      obj[rawprop + "_ko"] = info[rawprop + "_en"];
    });
    arr.push(obj);
  }
  down(arr, `${min}-${max}.json`)
}

function fetchAndHandleRuJson(url) {
  let CardInfo_ru = {};
  fetch(url).then(res => res.json()).then(arr => {
    arr.forEach(info => {
      let info_ru = {};
      for (let prop in info) {
        if (!prop.match(/_ru$/)) continue;
        info_ru[prop] = info[prop];
      }
      CardInfo_ru[info.pid] = info_ru;
    });
    window.ru = JSON.stringify(CardInfo_ru);
  });
}

function getPrCards() {
  let ids = [];
  for (let pid in CardInfo) {
    let card = CardInfo[pid];
    let id = +card.wxid.replace('PR-', '');
    if (id) ids.push(id);
  }
  ids.sort((a, b) => a - b);
  let ranges = [];
  let start = ids[0];
  let end = ids[0];
  ids.slice(1).concat(0).forEach(id => {
    if ((id - end) === 1) {
      end = id;
    } else {
      let range = `${('000'+start).slice(-3)}-${('000'+end).slice(-3)}`;
      if (start === end) range = ('000' + start).slice(-3);
      ranges.push(range);
      start = end = id;
    }
  })
  return ranges;
}

function getUntestedPr() {
  let ids = [];
  for (let pid in CardInfo) {
    if (pid <= 1762) continue;
    let card = CardInfo[pid];
    if (card.pid !== card.cid) continue;
    if (/^PR-/.test(card.wxid)) ids.push(card.wxid);
  }
  return ids;
}

function getNewCardNames() {
  let names = [];
  for (let pid in CardInfo) {
    if (pid <= 1762) continue;
    let card = CardInfo[pid];
    if (card.pid !== card.cid) continue;
    names.push(card.name_zh_CN);
  }
  return names;
}

function down(content, filename = 'down.txt') {
  if (typeof content === 'object') {
    content = JSON.stringify(content, null, '  ')
  }
  let blob = new Blob([content], {
    type: 'application/octet-stream'
  })
  let url = URL.createObjectURL(blob)
  let link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}
