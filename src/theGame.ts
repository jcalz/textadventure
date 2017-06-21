"use strict";

function storageAvailable(type: keyof Window) {
  try {
    var storage = window[type],
      x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
}
var hasLocalStorage = storageAvailable('localStorage');

interface HTMLInputElement {
  createTextRange?(): Range;
}
interface Range {
  select?(): void;
}
// USER INTERFACE
function moveCaretToEnd(el: HTMLInputElement) {
  if (typeof el.selectionStart == "number") {
    el.selectionStart = el.selectionEnd = el.value.length;
  } else if (typeof el.createTextRange != "undefined") {
    el.focus();
    var range = el.createTextRange();
    range.collapse(false);
    range.select();
  }
}

// NEVER ALLOW THE FOCUS TO LEAVE THE INPUT BOX!  (seems evil)
$('#input').blur(function() {
  window.setTimeout(function() {
    $('#input').focus();
  }, 0);
});
// IMPLEMENT COMMAND HISTORY WITH UP AND DOWN ARROWS		
var commandHistory = function() {
  var history: string[] = [];
  var localHistory = [''];
  var index = 0;
  var add = function add(command: string) {
    // don't add duplicates, don't add blanks		
    if (command.length && (!history.length || history[history.length - 1] !== command)) {
      history.push(command);
    }
    index = history.length;
    localHistory = history.slice();
    localHistory.push('');
  };
  var arrow = function arrow(up: boolean, command: string) {
    localHistory[index] = command;
    if (up) {
      index = Math.max(index - 1, 0);
    } else {
      index = Math.min(index + 1, history.length);
    }
    return localHistory[index];
  };
  return {
    add: add,
    arrow: arrow
  };
}();
var KEYCODE_UP = 38;
var KEYCODE_DOWN = 40;
$('#input').keydown(function(e) {
  if (e.which == KEYCODE_UP || e.which == KEYCODE_DOWN) {
    var inputText = $('#input').val() as string;
    var selectedCommand = commandHistory.arrow(e.which == KEYCODE_UP, inputText);
    $('#input').val(selectedCommand);
    moveCaretToEnd($('#input').get(0) as HTMLInputElement);
    e.preventDefault();
  }
});

function output(str: string, classNames?: string) {
  classNames = classNames || 'output-text';
  $('#output').queue(function(next) {
    //console.log(str);
    var outputSpan = $('<span>').addClass(classNames);
    outputSpan.text(str + '\n');
    var o = $('#output');
    o.scrollTop(o.get(0).scrollHeight);
    var startTop = o.scrollTop();
    o.append(outputSpan);
    var millisPerWindow = 500;
    var pixelsPerMilli = $(window).height() / millisPerWindow;
    var start: number = null;
    var step = function step(time: number) {
      if (!start) start = time;
      var top = startTop + pixelsPerMilli * (time - start);
      o.scrollTop(top);
      if (Math.abs(o.scrollTop() - top) < 1) {
        window.requestAnimationFrame(step);
      } else {
        next();
      }
    };
    window.requestAnimationFrame(step);
  });
}

function processInput(ioFunction: (i: string) => string) {
  try {
    var inputText = $('#input').val() as string;
    commandHistory.add(inputText);
    $('#input').val('');
    output('>>\xA0' + inputText, 'input-text');
    var outputText = ioFunction(inputText);
    output(outputText + '\n');
  } catch (e) {
    output('ERROR: ' + JSON.stringify(e, Object.getOwnPropertyNames(e)) + '\n', 'error-text');
    if ("console" in window) console.log(e);
  }
}

function durationString(millis: number) {
  if (millis < 0) return null;
  var units = ['millisecond', 'second', 'minute', 'hour', 'day', 'week'];
  var divisors = [1000, 60, 60, 24, 7, 3];
  var t = millis;
  for (var i = 0; i < units.length; i++) {
    if (t < divisors[i]) {
      t = Math.floor(t);
      return t + ' ' + units[i] + (t == 1 ? '' : 's');
    }
    t = t / divisors[i];
  }
  return null;
};

function dateString(millis: number) {
  var date = new Date(millis);
  if (Intl && Intl.DateTimeFormat) {
    return (new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })).format(date);
  }
  return date.toString();
};

var gameVersion = '-thegame-v0.0.2';
var autosaveKey = 'autosave' + gameVersion;

$(function() {

  var processInputNormally = function() {
    $('#adventure-form').off('submit').submit(function() {
      processInput(function(inputText) {
        return you.adventure.respond(you, inputText);
      });
      if (hasLocalStorage) {
        localStorage.setItem(autosaveKey, adventure.serialize());
        localStorage.setItem(autosaveKey + '-time', Date.now().toString());
      }
      return false;
    });

  }

  if (previouslySavedState) {
    output(
      '\n--------------------------------------PREVIOUS GAME AVAILABLE!--------------------------------------',
      'alert-text');
    var timestamp = parseInt(localStorage.getItem(autosaveKey + '-time'), 10);
    var ds = durationString(Date.now() - timestamp);
    var when = (timestamp) ? ((ds) ? (ds + ' ago') : ('on ' + dateString(timestamp))) : '';
    output('It looks like you left a game in progress ' + when + '.\n');
    output('Would you like to continue that game?');
    output('If you type "YES", you will continue the previous game where you left off.');
    output('If you type "NO", you will start a new game, and the previous game will be erased.');
    output('\nPlease type "YES" or "NO".\n');
    $('#adventure-form').submit(function() {
      processInput(function(inputText) {
        var i = inputText.replace(/[\s"']/g, '').toLowerCase();
        if ((i !== 'yes') && (i !== 'no'))
          return 'Please type \"YES\" or \"NO\".';
        var ret;
        if (i === 'yes') {
          adventure.deserialize(previouslySavedState);
          ret = '\n' + 'Okay, continuing the previous game...\n\n';
          you.look();
          ret += you.consumeInformationQueue();
        } else {
          ret = '\nOkay, starting a new game...\n\n';
          you.start();
          ret += you.consumeInformationQueue();
          localStorage.removeItem(autosaveKey);
        }
        processInputNormally();
        return ret;
      });
      return false;
    });

  } else {
    you.start();
    output('\n' + you.consumeInformationQueue());
    processInputNormally();
  }

  $('#input').focus();

});

///////////// SPECIFIC STUFF /////////////////
var A = Adventure;
var adventure = A.newAdventure();
var tell = adventure.tell.bind(adventure);

// silly template language: 
// "use %i1" means "use" followed by an ITEM, to be passed as FIRST parameter to the function.
// "give %i1 to %i2", means "give"
// "go %d1" // d means DIRECTION
adventure.newCommand({
  methodName: "read",
  templates: ["read %i1"],
  help: "Read something.",
  command: {
    objectMethodName: "beReadBy"
  }
});
namespace Adventure {
  export interface Person {
    read(item: Item): void;
  }
  export interface Item {
    beReadBy?(subject: Person): void;
  }
}

adventure.newCommand({
  methodName: "eat",
  templates: ["eat %i1"],
  command: {
    objectMethodName: "beEatenBy"
  }
});
namespace Adventure {
  export interface Person {
    eat(item: Item): void;
  }
  export interface Item {
    beEatenBy?(subject: Person): void;
  }
}

adventure.newCommand({
  methodName: "open",
  templates: ["open %i1", "open %i1 with|using %i2", "use|u %i2 to open %i1"],
  command: {
    objectMethodName: "beOpenedBy"
  }
});
namespace Adventure {
  export interface Person {
    open(item: Item, instrument?: Item): void;
  }
  export interface Item {
    beOpenedBy?(subject: Person, instrument?: Item): void;
  }
}

adventure.newCommand({
  methodName: "close",
  templates: "close|shut %i1",
  command: {
    objectMethodName: "beClosedBy"
  }
});
namespace Adventure {
  export interface Person {
    close(item: Item): void;
  }
  export interface Item {
    beClosedBy?(subject: Person): void;
  }
}

adventure.newCommand({
  methodName: "unlock",
  templates: ["unlock %i1", "unlock %i1 with|using %i2", "use|u %i2 to unlock %i1"],
  command: {
    objectMethodName: "beUnlockedBy"
  }
});
namespace Adventure {
  export interface Person {
    unlock(item: Item, instrument?: Item): void;
  }
  export interface Item {
    beUnlockedBy?(subject: Person, instrument?: Item): void;
  }
}

adventure.newCommand({
  methodName: "lock",
  templates: ["lock %i1", "lock %i1 with|using %i2", "use|u %i2 to lock %i1"],
  command: {
    objectMethodName: "beLockedBy"
  }
});
namespace Adventure {
  export interface Person {
    lock(item: Item, instrument?: Item): void;
  }
  export interface Item {
    beLockedBy?(subject: Person, instrument?: Item): void;
  }
}

adventure.newCommand({
  methodName: "move",
  templates: ["move %i1"],
  command: {
    objectMethodName: "beMovedBy"
  }
});
namespace Adventure {
  export interface Person {
    move(item: Item): void;
  }
  export interface Item {
    beMovedBy?(subject: Person): void;
  }
}

adventure.newCommand({
  methodName: "push",
  templates: ["push|shove|press %i1", "push|press on %i1"],
  command: {
    objectMethodName: "bePushedBy",
    youCant: "Pushing %i1 doesn't do anything."
  }
});
namespace Adventure {
  export interface Person {
    push(item: Item): void;
  }
  export interface Item {
    bePushedBy?(subject: Person): void;
  }
}

adventure.newCommand({
  methodName: "pull",
  templates: "pull|tug|yank |on| %i1",
  command: {
    objectMethodName: "bePulledBy"
  }
});
namespace Adventure {
  export interface Person {
    pull(item: Item): void;
  }
  export interface Item {
    bePulledBy?(subject: Person): void;
  }
}
var give = adventure.getCommand('give');
adventure.newCommand({
  methodName: "putInto",
  templates: ["put|place %i1 into|in|inside|on|onto %i2"],
  command: function(item, loc) {
    give.call(this, item, loc);
  }
});
namespace Adventure {
  export interface Person {
    putInto(item: Item, recipient?: Item): void;
  }
}
var started = false;

var you = adventure.newPerson({
  id: 'adventurer',
  name: 'Ms. Adventurer',
  keywords: ['adventurer', 'ms adventurer'],
  pronoun: 'she'
}, {
    start: function() {
      var ret = "";
      if (started) {
        ret += "Okay, restarting the game from the beginning...\n\n";
        adventure.deserialize(initialState);
      }
      started = true;
      ret +=
        "You have walked into a humongous house.  As you walk into a room, the door slams shut behind you and is now gone." +
        "  Welcome to the game.\n";
      you.learn(ret);
      you.look();
    }
  });

// PLACES
var room = adventure.newPlace({
  id: 'room',
  description: 'You are standing in a room with four walls, no furniture, and no windows.'
});

var closet = adventure.newPlace({
  id: 'closet',
  description: 'You are standing inside of a closet. It is dim in here.  There is a heavy ' +
  'boulder up against the eastern wall.'
});

var tunnel = adventure.newPlace({
  name: "underground tunnel",
  id: "tunnel",
  description: 'You find yourself in an underground tunnel that you can stand in and walk. ' +
  'The walls of the tunnel are made out of stone.',
  keywords: ["tunnel", "underground tunnel"]

});

var pit = adventure.newPlace({
  id: "pit",
  description: 'You are now at the bottom of a pit.  This pit is very deep.  The walls of the pit are also made of stone.'
});

var bedroom = adventure.newPlace({
  id: "bedroom",
  description: 'This room is big, with a huge bed covered in pink blankets.',
});

// EXITS
adventure.newExit(Object.assign({}, Adventure.openableExitOptions, {
  name: 'door',
  keywords: ['door', 'exit'],
  location: room,
  direction: 'north',
  destination: closet
}));

adventure.newExit(Object.assign({}, Adventure.openableExitOptions, {
  name: 'door',
  keywords: ['door', 'exit'],
  location: bedroom,
  direction: 'north',
  destination: room
}));

var holeInTheWall = adventure.newExit({
  id: 'holeInTheWall',
  name: 'hole',
  keywords: ['hole', 'exit'],
  description: 'It\'s just a large hole in the wall; no big deal.',
  location: closet,
  direction: 'east',
  destination: tunnel,
  hidden: true
});

adventure.newExit({
  location: tunnel,
  name: 'ramp',
  keywords: ['ramp', 'exit'],
  direction: 'east',
  destination: pit,
  reverse: 'up'
});

you.location = room;

// ITEMS

var canOpener = adventure.newItem({
  id: 'can opener',
  keywords: ['can opener', 'opener'],
  beUsedBy: function(subject, object) {
    var opener = this;

    if (!object) {
      if (subject.has(soup)) {
        subject.open(soup, this);
        return;
      }
      if (!subject.has(this)) {
        tell(subject, "You don't have " + subject.nameFor(opener) + ".");
        return;
      }
      tell(subject, "You can't use " + subject.nameFor(opener) + " now.");
      return;
    }
    subject.open(object, this);
  },
  location: tunnel
});

var soup = adventure.newItem({
  id: 'can of soup',
  keywords: ['can of soup', 'can', 'soup', 'soup can', 'soupcan'],
  beExaminedBy: function(subject) {
    if (!subject.has(this)) {
      tell(subject,
        "It just looks like a can of soup from here.  Maybe you can examine it more closely if you pick it up."
      );
      return;
    }
    var ret = "The can is labeled \"NASS-TEE Split Pea Soup\". ";
    if (soup.closed) {
      ret += 'It is sealed shut.';
    } else if (soup.full) {
      ret += 'It is open and full of soup.';
    } else {
      ret += 'It is empty.';
    }
    tell(subject, ret);
  },
  beOpenedBy: function(subject, instrument) {
    var soup = this;
    if (!subject.has(this)) {
      tell(subject, "You don't have " + subject.nameFor(soup) + ".");
      return;
    }
    if (!this.closed) {
      tell(subject, A.capitalize(subject.nameFor(soup)) + " has already been opened.");
      return;
    }
    if (!instrument) {
      tell(subject, "You try to rip the soup can open with your bare hands, but you can't.");
      return;
    }
    var instrumentName = subject.nameFor(instrument);
    if (instrument !== canOpener) {
      tell(subject, "You can't use " + instrumentName + " to open " + subject.nameFor(soup) + ".");
      return;
    }
    if (!subject.has(instrument)) {
      tell(subject, "You don't have " + instrumentName + ".");
      return;
    }
    this.closed = false;
    tell(subject, "You successfully use " + instrumentName + " to open the can of soup.",
      function(witness: Adventure.Person) {
        return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('open') + ' ' + witness.nameFor(soup) +
          ' with ' +
          witness.nameFor(instrument) + '.';
      }
    );
    return;
  },
  beReadBy: function(subject) {
    if (!subject.has(this)) {
      tell(subject, "It looks like there's writing on it, but you can't read it from here.");
      return;
    }
    tell(subject, 'The soup can label is partially ripped off.  The part that\'s still there reads:\n' +
      '"NASS-TEE Split Pea Soup\n\n  If you like squished-up peas, you\'re sure to love these!\n' +
      '  Plop it in a bowl, or eat the can whole!\n' + '  It goes in as soup, but comes out as "');
    return;
  },
  beUsedBy: function(subject, instrument) {
    if (!subject.has(this)) {
      tell(subject, "You don't have " + subject.nameFor(soup) + ".");
      return;
    }
    if (this.closed) {
      this.beOpenedBy(subject, instrument);
      return;
    }
    if (!this.full) {
      tell(subject, "You can't use the empty soup can.");
      return;
    }
    this.beEatenBy(subject, instrument);
    return;
  },
  beEatenBy: function(subject) {
    if (!subject.has(this)) {
      tell(subject, "You have to pick up " + subject.nameFor(soup) + " to eat it.");
      return;
    }
    if (this.closed) {
      tell(subject, "You can't eat the sealed can.");
      return;
    }
    if (this.full) {
      this.full = false;
      tell(subject, "You eat the soup.  Yum, tasty room-temperature soup!", function(witness: Adventure.Person) {
        return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('eat') + ' ' + witness.nameFor(
          soup) +
          '.';
      });
      return;
    }
    tell(subject, "You can't eat it; the can is empty.");
    return;
  },
  location: closet
}, {
    closed: true,
    full: true,
  });

var note = adventure.newItem({
  'id': 'note',
  location: pit,
  beExaminedBy: function(subject) {
    if (!subject.has(this)) {
      tell(subject, "It appears to have some writing on it, but you can't read it if you don't have it.");
      return;
    }
    tell(subject, "There's definitely writing on it.");
    return;
  },
  beReadBy: function(subj) {
    if (!subj.has(this)) {
      tell(subj, "You can't read it if you don't have it.");
      return;
    }
    tell(subj, "The note reads:\n\n" +
      "\"Dear Mom,\n\nPlease do not eat the yummy NASS-TEE Split Pea Soup. I am saving it for dinner.\n" +
      "Love,\nElla.\"");
    return;
  }
});

var bed = adventure.newItem({
  id: 'bed',
  unlisted: true,
  beExaminedBy: function(subject) {
    var ret = 'The bed is huge with pink blankets and purple pillows.';
    if (teddyBear.location === bed.location) {
      teddyBear.hidden = false; // reveal the teddy bear
      subject.setKnown(teddyBear);
      ret += ' There is a teddy bear on the bed.';
    }
    tell(subject, ret);
    return;
  },
  canBeTaken: false,
  beUsedBy: function(subject) {
    tell(subject, "You lie down on the bed and fall asleep for a few minutes.  You wake up feeling refreshed.",
      function(witness: Adventure.Person) {
        return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('lie') + ' down on the bed and ' +
          subject.verb(
            'sleep') + ' for a few minutes and then ' + subject.verb('get') + ' up.';
      }
    );
    return;
  },
  location: bedroom
});

bedroom.newBackgroundItem({
  name: 'pillows',
  pronoun: 'they',
  keywords: ['pillow', 'pillows']
});
bedroom.newBackgroundItem({
  name: 'blankets',
  pronoun: 'they',
  keywords: ['blanket', 'blankets']
});

var teddyBear = adventure.newItem({
  id: 'teddy bear',
  keywords: ['teddy bear', 'teddybear', 'teddy', 'bear'],
  hidden: true,
  beExaminedBy: function(subject) {
    if (!subject.has(teddyBear)) {
      tell(subject,
        'The teddy bear is brown and wearing green overalls. You can\'t tell anything else about it from here.'
      );
      return;
    }
    var ret = 'The teddy bear is brown and furry.  ' +
      'It is wearing green corduroy overalls with a pocket in the front.';
    if (key.location === this) {
      ret += ' You notice a key sticking out of the pocket.';
      subject.setKnown(key);
    }
    tell(subject, ret);
    return;
  },
  location: bedroom
});

var key = adventure.newItem({
  id: 'key',
  keywords: ['key'],
  beUsedBy: function(subject, object) {
    if (!object) {
      tell(subject, "I don't know how you want to use the key.  Try using it on something.");
      return;
    }
    if (!subject.canSee(object)) {
      tell(subject, "You can't see " + subject.nameFor(object) + ".");
      return;
    }
    if (object === cabinet) {
      if (cabinet.locked) {
        subject.unlock(object, this);
        return;
      }
      tell(subject, "The cabinet is already unlocked.");
      return;
    }
    tell(subject, "You try to use the key on " + subject.nameFor(object) + " but it doesn't do anything.");
    return;
  },
  location: teddyBear
});

var cabinetBeOpenedBy = function(subject: Adventure.Person, instrument?: Adventure.Item) {
  if (!cabinet.closed) {
    tell(subject, "The cabinet is already open.");
    return;
  }
  if (!cabinet.locked) {
    cabinet.closed = false;
    cabinet.allContents().forEach(function(it: Adventure.Item) {
      it.hidden = false;
    });
    tell(subject, "You open the cabinet.");
    return;
  }
  if (!instrument) {
    tell(subject, "You try to open the cabinet but it is locked.");
    return;
  }
  if (!subject.has(instrument)) {
    tell(subject, "You don't have " + subject.nameFor(instrument) + ".");
    return;
  }
  if (instrument !== key) {
    tell(subject, "You try to unlock the cabinet with " + subject.nameFor(instrument) +
      " but it remains locked.");
    return;
  }
  cabinet.locked = false;
  cabinet.closed = false;
  cabinet.allContents().forEach(function(it: Adventure.Item) {
    it.hidden = false;
  });
  tell(subject, "You turn the key in the cabinet's lock until you hear a click.  The cabinet springs open!",
    function(witness: Adventure.Person) {
      return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('open') + ' the cabinet with ' +
        witness.nameFor(
          key) + '.';
    });
  return;
};

var cabinet: Adventure.Item & { closed: boolean; locked: boolean; } = adventure.newItem({
  id: 'cabinet',
  keywords: ['cabinet'],
  canBeTaken: false,
  beExaminedBy: function(subject) {
    var ret = 'The cabinet is made out of wood.';
    if (cabinet.closed) {
      ret += ' It is closed and ' + (cabinet.locked ? '' : 'un') + 'locked.';
    } else {
      ret += ' It is open ';
      var items = cabinet.listContents(subject).map(function(it: Adventure.Item) {
        return subject.nameFor(it, it.indefiniteName, 'you');
      });
      if (items.length == 0) {
        ret += 'and empty.';
      } else {
        ret += 'and contains ' + A.series(items) + ".";
      }
    }
    tell(subject, ret);
  },
  beOpenedBy: cabinetBeOpenedBy,
  beUnlockedBy: cabinetBeOpenedBy,
  bePulledBy: cabinetBeOpenedBy,
  beClosedBy: function(subject) {
    if (cabinet.closed) {
      tell(subject, "The cabinet is already closed.");
      return;
    }
    cabinet.closed = true;
    cabinet.allContents().forEach(function(it: Adventure.Item) {
      it.hidden = true;
    });
    tell(subject, "You have closed the cabinet.", function(witness: Adventure.Person) {
      return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('has') +
        ' closed the cabinet.';
    });
    return;
  },
  beAskedToTake: function(item, subject, doTell) {
    if (!cabinet.closed) {
      var info = function(witness: Adventure.Person) {
        return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('has') + ' put ' + witness.nameFor(
          item) +
          ' into the cabinet.';
      };
      if (doTell) tell(subject, info, info);
      return true;
    }
    if (doTell) tell(subject, "You can't do that.  The cabinet is closed.");
    return false;
  },
  beAskedToGive: function(item, subject, doTell) {
    if (!cabinet.closed) {
      return cabinet.superMethod('beAskedToGive')(item, subject, doTell);
    }
    if (doTell) tell(subject, "You can't do that.  The cabinet is closed.");
    return false;
  },
  location: bedroom
}, {
    closed: true,
    locked: true
  });

var diary = adventure.newItem({
  id: 'diary',
  keywords: ['diary'],
  description: 'The cover is labelled "Ella\'s Diary: PRIVATE, DO NOT READ!"',
  beReadBy: function(subject) {
    if (!subject.has(this)) {
      tell(subject, 'You can\'t read it from here.');
      return;
    }
    tell(subject, "You open the diary and begin to read.  It says:\n" +
      "  \"Dear Diary,\n" +
      "   I'm really excited.  I'm going to my friend's house.  My friend is Emma Watson." +
      " I don't think my friend's parents like me very much. But they seemed very excited " +
      "when I told them I was rich.\"");
    return;
  },
  location: cabinet,
  hidden: true
});

var boulderBeMovedBy = function(subject: Adventure.Person) {
  var ret = "";
  if (!boulder.budged) {
    boulder.budged = true;
    holeInTheWall.hidden = false;
    subject.setKnown(holeInTheWall);
    tell(subject, "You bend down and push the boulder as hard as you can.  At first, it won't budge. " +
      "Finally, it starts moving along the wall, little by little.  Eventually you push it into " +
      "the corner where it stays.  You can't move it any further, and now you're sweaty and tired. " +
      "Why did you do this again?\n\nAnnoyed with yourself, you step back from the boulder and stand " +
      "up again... to see that the boulder had been blocking a large hole in the eastern wall, which is now " +
      "revealed!",
      function(witness: Adventure.Person) {
        witness.setKnown(holeInTheWall);
        return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('push') +
          ' the boulder along the wall, revealing a large hole leading east.';
      });
    return;
  }
  tell(subject, "The boulder is completely wedged in the corner now.  It's not going anywhere.");
  return;
}

var boulder = adventure.newItem({
  id: 'boulder',
  keywords: ['boulder', 'bolder', 'rock', 'heavy boulder'],
  unlisted: true,
  canBeTaken: false,
  description: "This boulder is much too heavy for you to pick up.  " +
  "You might be able to move it a little, but that's about it.",
  beMovedBy: boulderBeMovedBy,
  bePushedBy: boulderBeMovedBy,
  bePulledBy: boulderBeMovedBy,
  location: closet
}, {
    budged: false
  });

// okay let's do something
var batman = adventure.newPerson({
  name: 'Batman',
  keywords: ['bat man', 'batman', 'dark knight'],
  pronoun: 'he',
  location: pit
});

var cage = adventure.newItem({
  name: 'cage',
  location: batman,

  beExaminedBy: function(subject) {
    this.superMethod('beExaminedBy')(subject);
    tell(subject, '\b It is ' + (this.closed ? 'closed' : 'open') + '.');
  },
  beAskedToTake: function(item, subject, doTell) {
    if (!this.closed) {

      if (doTell) {
        var info = function(witness: Adventure.Person) {
          return A.capitalize(witness.nameFor(subject)) + ' ' + subject.verb('have') + ' put ' + witness.nameFor(
            item) + ' into ' + witness.nameFor(cage) + '.';
        };
        tell(subject, info, info);
      }
      return true;
    }
    if (doTell) tell(subject, "You can't put " + subject.nameFor(item) + " into the closed cage.");
    return false;
  },
  beAskedToGive: function(item, subject, doTell) {
    if (!this.closed || item === this) {
      return this.superMethod('beAskedToGive')(item, subject, doTell);
    }
    if (doTell) tell(subject, "You can't take anything out of the cage when it is closed.");
    return false;
  }
}, {
    closed: true
  });

// item? or person?
var cat = adventure.newItem({
  name: 'cat',
  location: cage,
  alive: true
});

var collar = adventure.newItem({
  name: 'collar',
  location: cat
});

var initialState = adventure.serialize();
var previouslySavedState = hasLocalStorage && localStorage.getItem(autosaveKey);