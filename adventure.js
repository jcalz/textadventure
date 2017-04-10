"use strict";
//TODO state storage
//TODO flesh out exits: description, hidden, etc
//TODO "put ___ in/on ____"
//TODO default bidirectional exits.
//TODO limit to inventory?
//TODO "jump"

function Adventure() {
  
  var A = this;

  // Object.values polyfill
  var objectValues = Object.values || function(o) {
    return Object.keys(o).map(function(k) {
      return o[k];
    });
  };

  // string manipulation functions    
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  A.capitalize = capitalize;

  function titleCase(str) {
    return str.toLowerCase().split(" ").map(capitalize).join(" ");
  }
  A.titleCase = titleCase;

  function series(strs, conjunction) {
    conjunction = conjunction || 'and';
    if (strs.length < 3) return strs.join(' ' + conjunction + ' ');
    return strs.slice(0, -1).join(', ') + ', ' + conjunction + ' ' + strs[strs.length - 1];
  }
  A.series = series;

  var directions = {
    north: ['n'],
    south: ['s'],
    east: ['e'],
    west: ['w'],
    northeast: ['ne'],
    southeast: ['se'],
    northwest: ['nw'],
    southwest: ['sw'],
    up: ['u'],
    down: ['d']
  };
  var dirs = {};
  Object.keys(directions).forEach(function(k) {
    dirs[k] = k;
    directions[k].forEach(function(v) {
      dirs[v] = k;
    });
  });

  var itemMap = {};
  var world = {
    add: function add(item) {
      var id = item.name.toLowerCase().replace(/[^a-z0-9_ ]/g, '').trim().replace(/\s+/g, '_');
      var cnt = 0;
      while (id in itemMap) {
        id = id + "" + cnt;
        cnt++;
      }
      itemMap[id] = item;
      item.id = id;
    },
    get items() {
      return objectValues(itemMap);
    },
    get itemMap() {
      return itemMap;
    },
    maxNesting: 256
  };

  function Item(name) {
    this.adventure = A;
    name = name || "item";
    this.name = name; // base name without definite/indefinite articles, lower case if possible.  try to make it unique.
    world.add(this);
    this.description = null; // optional string representing the verbose/examine description of the item.
    this.keywords = [this.name]; // list of words to identify this item.  try to make them unique.        
    this.definiteName = 'the ' + this.name; // definite version of the name
    this.indefiniteName = ('aeiou'.indexOf(this.name.charAt(0).toLowerCase()) >= 0 ? "an " : "a ") + this.name;
    this.canBeTaken = true; // can you pick this up? 	  
    
    this.locationId = null;     
    Object.defineProperty(this, 'location',{
      get: function() {
        return (this.locationId && (this.locationId in world.itemMap)) ? world.itemMap[this.locationId] : null;
      },
      set: function(location) {
        this.locationId = (location && location.id) ? location.id : null;
      }
    });
    
    this.known = false; // part of the state
    this.hidden = false; // if it is hidden, you can't see it even if you're in the same room with it.
    this.exits = {}; // a list of mapping from directions to other places (uh, directions are strings?)

    this.beTakenBy = function(subject) {
      if (!this.canBeTaken) {
        return "You can't pick up " + this.definiteName + ".";
      }
      if (subject.has(this)) {
        return "You already have " + this.definiteName + ".";
      }
      this.location = subject;
      return "You have picked up " + this.definiteName + ".";
    };

    this.beDroppedBy = function(subject) {
      if (!subject.has(this)) {
        return "You don't have " + this.definiteName + ".";
      }
      this.location = subject.location;
      return "You have dropped " + this.definiteName + ".";
    };

    this.beExaminedBy = function(subject) {
      var here = this;
      var ret = '';
      if (subject.location === here) {
        ret += titleCase(this.name) + '\n';
      }
      ret += (this.description || 'It\'s just ' + this.indefiniteName + '.');
      if (this.exits && Object.keys(this.exits).length > 0) {
        var es = Object.keys(this.exits);
        if (subject.location === here) {
          ret += ' There ';
          ret += es.length == 1 ? 'is an exit' : 'are exits';
        } else {
          ret += ' It has ';
          ret += es.length == 1 ? 'an exit' : 'exits';
        }
        ret += ' leading ';
        ret += series(es);
        ret += '.';
      }
      var items = this.listContents().map(function(it) {
        return it.indefiniteName;
      });
      if (items.length > 0) {
        if (subject.location === here) {
          ret += ' ' + capitalize(series(items)) + (items.length > 1 ? ' are' : ' is') + ' here.';
        } else {
          ret += ' It contains ' + series(items) + '.';
        }
      }
      return ret;
    };

    this.listContents = function() {
      var here = this;
      var items = world.items.filter(function(it) {
        return it.location === here && !it.hidden;
      });
      items.forEach(function(i) {
        i.known = true;
      });
      items = items.filter(function(it) {
        return !(it.unlisted)
      });
      return items;
    };

    this.ultimatelyContains = function(item) {
      var cnt = 0;
      for (var loc = item.location; loc; loc = loc.location) {
        cnt++;
        if (cnt > world.maxNesting) {
          throw new Error('Location nesting of more than ' + world.maxNesting + ' exceeded!');
        }
        if (loc === this) return true;
      }
      return false;
    };
    this.ultimateLocation = function() {
      var cnt = 0;
      for (var loc = this; loc.location; loc = loc.location) {
        cnt++;
        if (cnt > world.maxNesting) {
          throw new Error('Location nesting of more than ' + world.maxNesting + ' exceeded!');
        }
      }
      return loc;
    };
    this.canSee = function(item) {
      return !item.hidden && (this.ultimateLocation() === item.ultimateLocation());
    };
    this.has = function(item) {
      return !item.hidden && item.location === this; //(this.ultimatelyContains(item));
    };
    this.appearsInInventoryOf = function(subject) {
      return subject.has(this);
    };

    this.exitedBy = function(subject, dir) {
      if (!this.exits || !(dir in this.exits)) {
        return "You can't go " + dir + " from here.";
      }
      subject.location = this.exits[dir];
      return subject.look();
    };

    // copy the state of this item into a string
    this.serialize = function() {
      //TODO			
    };
    // restore this item to the state represented by the passed-in string  
    this.deserialize = function(state) {
      //TODO
    };

    // newfunc takes an extra first parameter for superfunction
    this.extendMethod = function(methodName, newMethod) {
      var object = this;
      var superMethod = object[methodName].bind(object);
      object[methodName] = function() {
        var args = Array.from(arguments);
        args.unshift(superMethod);
        return newMethod.apply(object, args);
      };
    }

    this.newBackgroundItem = function(name, keywords) {
      var item = new Item(name);
      if (keywords) item.keywords = keywords;
      item.location = this;
      item.unlisted = true;
      item.canBeTaken = false;
      return item;
    };

  }
  A.Item = Item;

  function Place(name) {
    name = name || "place";
    Item.call(this, name);
    this.canBeTaken = false; // by default you can't pick up a place
  }
  A.Place = Place;

  function Person(name) {
    name = name || "person";
    Item.call(this, name);
    this.indefiniteName = name;
    this.definiteName = name;
    this.canBeTaken = false; // can't pick up a person

    this.addCommand = function(subjectCommandName, objectCommandName, templates, help) {
      var command = function command(object) {
        if (!this.canSee(object)) {
          return "You can't see " + object.definiteName + " here.";
        }
        if (!(objectCommandName in object)) {
          // okay let's use the first template
          var commandName = templates[0].split(/\s+/)[0].toLowerCase();
          return "You can't " + commandName + " " + object.definiteName + ".";
        }
        var args = Array.from(arguments);
        args[0] = this;
        return object[objectCommandName].apply(object, args);
      };
      command.templates = templates;
      if (help) {
        command.help = help;
      }
      this[subjectCommandName] = command;
    };

    var go = function(dir) {
      if (!this.location) {
        return "You can't go " + dir + " from here.";
      }
      return this.location.exitedBy(this, dir);
    }
    go.templates = ['go ?d1', '?d1', 'move ?d1', 'walk ?d1'];
    go.help = 'Go in the specified direction, like North or South.';
    this.go = go;
    var climb = function() {
      return this.go('up');
    };
    climb.templates = ['climb', 'climb up'];
    this.climb = climb;

    var climbDown = function() {
      return this.go('down');
    };
    climbDown.templates = ['climb down'];
    this.climbDown = climbDown;

    var look = function look() {
      this.location.known = true;
      return this.location.beExaminedBy(this);
    };
    look.templates = ['look', 'l'];
    look.help = 'Look around you.';
    this.look = look;

    this.addCommand('take', 'beTakenBy', ['take ?i1', 't ?i1', 'get ?i1', 'pick up ?i1', 'pickup ?i1',
        'pick ?i1 up'
      ],
      'Pick up an item.');

    this.addCommand('drop', 'beDroppedBy', ['drop ?i1', 'dr ?i1', 'put down ?i1', 'put ?i1 down', 'let ?i1 go',
      'let go of ?i1',
      'let go ?i1', 'release ?i1'
    ], 'Put down an item.');

    var inventory = function inventory() {
      var subject = this;
      var items = world.items.filter(function(item) {
        return item.appearsInInventoryOf(subject);
      }).map(function(i) {
        return i.indefiniteName;
      });
      if (!items.length) return "You don't have anything.";
      return "You have " + series(items) + ".";
    }
    inventory.templates = ['inventory', 'i'];
    inventory.help = 'List the items in your possession.';
    this.inventory = inventory;

    var help = function help() {
      var ret = '';
      ret += 'Need help?  Here are some commands:\n';
      ret += this.commands().filter(function(c) {
        return c.help;
      }).map(function(c) {
        var shortcut = c.templates.find(function(t) {
          return t.split(/\s+/)[0].length == 1;
        });
        return '"' + c.templates[0].toLowerCase().split(/\s+/).map(function(x) {
          return x.startsWith('?i') ? '[ITEM]' : x.startsWith('?d') ? '[DIRECTION]' : capitalize(x);
        }).join(' ') + '": ' + c.help + (shortcut ? ' (Shortcut: "' + shortcut.charAt(0).toUpperCase() +
          '")' :
          '');
      }).join('\n');
      ret += '\nGood luck!';
      return ret;
    };
    help.templates = ['help', 'h', 'help me'];
    help.help = 'Read these words.';
    this.help = help;
    this.commands = function() {
      return objectValues(this).filter(function(v) {
        return typeof v == 'function' && 'templates' in v && v.templates.length > 0;
      });
    };

    this.addCommand('examine', 'beExaminedBy', ['examine ?i1', 'x ?i1', 'look ?i1', 'look at ?i1', 'l ?i1',
        'l at ?i1'
      ],
      'Examine an item.');
  }
  A.Person = Person;

  function interpretInput(subject, str) {
    str = str.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/\bplease( |$)/g, '').trim(); // no need to be polite 
    // sort templates by length
    if (!interpretInput.templates) {
      interpretInput.templates = flatten(subject.commands().map(function(c) {
        return c.templates.map(function(t) {
          return {
            func: c,
            pattern: t.toLowerCase().split(/\s+/)
          };
        });
      }));
      interpretInput.templates.sort(function(x, y) {
        return y.pattern.length - x.pattern.length;
      });
      //TODO maybe they should be ordered by number of item/dirs, or length of words?
    }
    templateLoop: for (var i = 0; i < interpretInput.templates.length; i++) {
      var template = interpretInput.templates[i];
      var m = str;
      var ret = {
        func: template.func,
        parameters: [],
        template: template.pattern.join(' ')
      };
      for (var j = 0; j < template.pattern.length; j++) {
        var token = template.pattern[j];
        if (token.charAt(0) == '?') {
          var paramIndex = parseInt(token.substring(2), 10) - 1;
          if (!(paramIndex >= 0)) {
            console.log('bad pattern index in: ' + template.pattern.join(' '));
            continue templateLoop;
          }
          var result;
          if (token.charAt(1) == 'i') {
            // interpret as an item
            result = parseItemAndRemainder(subject, m);
            if (!result) continue templateLoop; // not an item
            ret.parameters[paramIndex] = result.item;
          } else if (token.charAt(1) == 'd') {
            // interpret as direction
            result = parseDirectionAndRemainder(m);
            if (!result) continue templateLoop; // not a direction
            ret.parameters[paramIndex] = result.direction;
          } else {
            // don't recognize the type of pattern word
            console.log('bad pattern type in: ' + template.pattern.join(' '));
            continue templateLoop;
          }
          m = result.remainder;
        } else {
          if (!(m + ' ').startsWith(token)) {
            // doesn't match
            continue templateLoop;
          }
          m = m.substring(token.length + 1); // remove a space or go off the end, which is fine				
        }
      }
      // we made it!  Or did we?  If there's stuff after the match, it's not a match
      if (m.length == 0) {
        return ret;
      }
    }
    return null; // no match
  }

  function flatten(arrayOfArray) {
    return [].concat.apply([], arrayOfArray);
  }

  function parseDirectionAndRemainder(str) {
    str = str.toLowerCase().replace(/^(the|a|an) /i, '').trim(); // strip off articles
    // TODO strip off "to" or "toward"?
    var space = (str + ' ').indexOf(' ');
    if (!space) return null; // no words
    var word = str.substring(0, space);
    var remainder = str.substring(space + 1);
    if (word in dirs) {
      return {
        direction: dirs[word],
        remainder: str.substring(space + 1)
      };
    }
    return null; // couldn't find direction
  }

  function parseItemAndRemainder(subject, str) {
    str = str.toLowerCase().replace(/^(the|a|an) /i, ''); // strip off articles
    // get keywords for all known items
    var knownItems = flatten(world.items.filter(function(x) {
      return x.known;
    }).map(function(x) {
      return x.keywords.map(function(k) {
        return {
          keyword: k.toLowerCase(),
          canSee: subject.canSee(x),
          item: x
        };
      });
    }));

    // sort these items so that nearby items are more likely to be identified,
    // and do the longest match first
    knownItems.sort(function(x, y) {
      if (x.canSee != y.canSee) {
        return x.canSee ? -1 : 1;
      }
      return y.keyword.length - x.keyword.length;
    });
    var found = knownItems.find(function(x) {
      return str.startsWith(x.keyword);
    });
    if (!found) return null;
    return {
      item: found.item,
      remainder: str.substring(found.keyword.length).trim()
    };
  }
  var blankResponses = ["What?", "Come again?", "Sorry, I didn't hear you.", "Did you say something?",
    "Are you confused?  Type \"help\" for help.", "I don't follow.", "You should probably type something.",
    "Sorry, I don't speak mime.", "Try using words to express yourself.",
    "I like short commands, but that's too short."
  ];
  var curBlankResponses = [];

  function respond(subject, str) {
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/^"\s*(.*)\s*"$/, '$1');
    str = str.replace(/^'\s*(.*)\s*'$/, '$1');
    var interpretation = interpretInput(subject, str);
    if (interpretation) {
      return interpretation.func.apply(subject, interpretation.parameters);
    }
    // okay, we didn't understand.  So let's be humorous?
    if (str.length == 0) {
      if (!curBlankResponses.length) curBlankResponses = blankResponses.slice();
      return curBlankResponses.splice(Math.floor(Math.random() * curBlankResponses.length), 1)[0];
    }
    return "Sorry, I don't understand \"" + str + "\". Type \"help\" for help.";
  }
  A.respond = respond;

 
};