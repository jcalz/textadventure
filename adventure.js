"use strict";

//TODO limit to inventory?
//TODO make parsing items try to find exits or items by checking for direction words plus item name
//   e.g., dir: north, item: door: "the northern door" or "north door", or "door to the north", or "door leading north", etc
//TODO maybe ambiguous items should be a warning error rather than first-found...
//TODO "jump"
//TODO "put ___ in/on ____"

function Adventure() {

  var A = this;

  A.maxNesting = 256;

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

  function MutabilityMarker(mutable, object) {
    this.mutable = mutable;
    this.object = object;
  }

  function mutable(obj, enforceIfWrapped) {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(true, obj);
  }
  A.mutable = mutable;

  function immutable(obj, enforceIfWrapped) {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(false, obj);
  }
  A.immutable = immutable;

  function unwrap(obj) {
    if (obj instanceof MutabilityMarker)
      return obj.object;
    return obj;
  }

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

  var oppositeDirections = {
    north: 'south',
    east: 'west',
    northeast: 'southwest',
    northwest: 'southeast',
    up: 'down'
  }
  Object.keys(oppositeDirections).forEach(function(dir) {
    oppositeDirections[oppositeDirections[dir]] = dir;
  });

  // KEEP A MAP OF ALL ITEMS IN THE ADVENTURE
  var itemMap = {};

  var getNewId = function(id) {
    var cnt = 0;
    var testId = id;
    while (testId in itemMap) {
      testId = id + '' + cnt;
      cnt++;
    }
    return testId;
  }

  var allItems = function() {
    return objectValues(itemMap);
  }
  A.itemMap = itemMap;
  A.allItems = allItems;

  // serialize adventure
  var serialize = function() {
    var serializedMap = {};
    Object.keys(itemMap).forEach(function(k) {
      serializedMap[k] = itemMap[k].serialize();
    });
    return JSON.stringify(serializedMap);
  };
  A.serialize = serialize;

  // restore to state given by state string.  
  // this CANNOT BE USED to add or remove items form the world. 
  // TODO... somehow deal with that?
  var deserialize = function(state) {
    var serializedMap = JSON.parse(state);
    if (typeof serializedMap !== 'object') throw new Error('invalid state string');
    Object.keys(serializedMap).forEach(function(k) {
      var item = itemMap[k];
      // if bad item, ignore it?  TODO
      if (item) {
        item.deserialize(serializedMap[k]);
      }
    });
  };
  A.deserialize = deserialize;

  function Item(options) {
    var item = this;
    this.adventure = A;
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});

    var name = unwrap(options.name) || unwrap(options.id) || 'item';
    options.name = immutable(options.name || name);

    if (options.id && unwrap(options.id) in itemMap) throw new Error('cannot reuse id "' + unwrap(options.id) + '"');

    var baseId = unwrap(options.id) || name || 'item';
    var id = getNewId(baseId);
    options.id = immutable(id);

    itemMap[id] = this;

    // prevent a property from being saved/loaded as state or modified
    var immutableProperties = {};

    this.getImmutableProperties = function() {
      return immutableProperties;
    };

    var plural = unwrap(options.plural);

    var pluralName = name;
    if (plural) {
      pluralName = name;
    } else if ((/[^aeiou]y$/i).test(name)) {
      pluralName = name.substring(0, name.length - 1) + 'ies';
    } else if ((/(s|x|z|ch|sh)$/i).test(name)) {
      pluralName = name + 'es';
    } else {
      pluralName = name + 's';
    }

    options.description = immutable(options.description || null);
    options.keywords = immutable(options.keywords || [name]);
    options.plural = immutable('plural' in options ? options.plural : false);
    options.definiteName = immutable(options.definiteName || ('the ' + name));
    options.indefiniteName = immutable(options.indefiniteName || (plural ? name : ('aeiou'.indexOf(name.charAt(0).toLowerCase()) >=
      0 ? 'an ' :
      'a ') + name));
    options.pluralName = immutable(options.pluralName || pluralName);
    options.it = immutable(options.it || (plural ? 'they' : 'it'));
    options.canBeTaken = immutable('canBeTaken' in options ? options.canBeTaken : true);
    options.location = mutable(options.location || null);
    options.known = mutable('known' in options ? options.known : false);
    options.hidden = mutable('hidden' in options ? options.hidden : false);

    Object.keys(options).forEach(function(prop) {
      var v = options[prop];
      var immutable = false;
      if (v instanceof MutabilityMarker) {
        immutable = !v.mutable;
        v = v.object;
      }
      if (immutable) {
        immutableProperties[prop] = true;
      }
      item[prop] = v;
    });

    var o = {
      configurable: false,
      enumerable: true,
      writable: false
    };
    // make immutable properties immutable
    Object.keys(immutableProperties).forEach(function(prop) {
      if (prop === 'location') return;
      Object.defineProperty(item, prop, o);
    });

    var location = item.location;
    o = {
      configurable: false,
      enumerable: true,
      get: function() {
        var ret = location;
        if (typeof location === 'string') ret = itemMap[location];
        if (!ret) ret = null;
        return ret;
      }
    };
    if (!immutableProperties.location) {
      o.set = function(l) {
        location = l;
      };
    }

    Object.defineProperty(item, 'location', o);

  };

  Item.prototype.getExits = function() {
    var here = this;
    return allItems().filter(function(it) {
      return (it instanceof Exit) && (it.location === here) && (!it.hidden);
    });
  };

  Item.prototype.beTakenBy = function(subject) {
    if (!this.canBeTaken) {
      return "You can't pick up " + this.definiteName + ".";
    }
    if (subject.has(this)) {
      return "You already have " + this.definiteName + ".";
    }
    this.location = subject;
    return "You have picked up " + this.definiteName + ".";
  };

  Item.prototype.beDroppedBy = function(subject) {
    if (!subject.has(this)) {
      return "You don't have " + this.definiteName + ".";
    }
    this.location = subject.location;
    return "You have dropped " + this.definiteName + ".";
  };

  Item.prototype.beExaminedBy = function(subject) {
    var here = this;
    var ret = '';
    if (subject.location === here) {
      ret += titleCase(this.name) + '\n';
    }
    ret += (this.description || capitalize(this.it) + (this.plural ? "'re" : "'s") + ' just ' + this.indefiniteName +
      '.');

    // describe exits
    var exits = this.getExits();
    if (exits.length > 0) {
      var exitTypes = {};
      exits.forEach(function(ex) {
        var type = ex.pluralName;
        if (!(type in exitTypes)) {
          exitTypes[type] = {
            single: ex.indefiniteName,
            multiple: ex.pluralName,
            directions: []
          };
        }
        exitTypes[type].directions.push(ex.direction);
      });
      Object.keys(exitTypes).forEach(function(type) {
        if (subject.location === here) {
          ret += ' There ';
          ret += exitTypes[type].directions.length == 1 ? 'is ' + exitTypes[type].single : 'are ' + exitTypes[
            type].multiple;
        } else {
          ret += ' ' + capitalize(this.it) + ' ' + (this.plural ? ' have ' : ' has ');
          ret += exitTypes[type].directions.length == 1 ? exitTypes[type].single : exitTypes[type].multiple;
        }
        ret += ' leading ';
        ret += series(exitTypes[type].directions);
        ret += '.';
      });
    }

    // describe non-exits
    var items = this.listContents().filter(function(it) {
      return !(it instanceof Exit);
    });
    var itemNames = items.map(function(it) {
      return it.indefiniteName;
    });
    if (items.length > 0) {
      if (subject.location === here) {
        ret += ' ' + capitalize(series(itemNames)) + ((items.length > 1 || items[0].plural) ? ' are' : ' is') +
          ' here.';
      } else {
        ret += ' ' + capitalize(this.it) + ' contain' + (this.plural ? '' : 's') + ' ' + series(itemNames) + '.';
      }
    }
    return ret;
  };

  Item.prototype.listContents = function() {
    var here = this;
    var items = allItems().filter(function(it) {
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

  Item.prototype.ultimatelyContains = function(item) {
    var cnt = 0;
    for (var loc = item.location; loc; loc = loc.location) {
      cnt++;
      if (cnt > A.maxNesting) {
        throw new Error('Location nesting of more than ' + A.maxNesting + ' exceeded!');
      }
      if (loc === this) return true;
    }
    return false;
  };

  Item.prototype.ultimateLocation = function() {
    var cnt = 0;
    for (var loc = this; loc.location; loc = loc.location) {
      cnt++;
      if (cnt > A.maxNesting) {
        throw new Error('Location nesting of more than ' + A.maxNesting + ' exceeded!');
      }
    }
    return loc;
  };
  Item.prototype.canSee = function(item) {
    return !item.hidden && (this.ultimateLocation() === item.ultimateLocation());
  };
  Item.prototype.has = function(item) {
    return !item.hidden && item.location === this; //(this.ultimatelyContains(item));
  };
  Item.prototype.appearsInInventoryOf = function(subject) {
    return subject.has(this);
  };

  Item.prototype.beExitedBy = function(subject, dir) {
    var exit = this.getExits().find(function(ex) {
      return ex.direction === dir;
    });
    if (!exit)
      return "You can't go " + dir + " from here.";
    return subject.use(exit);
  };

  Item.prototype.superMethod = function(name) {
    return Item.prototype[name].bind(this);
  };

  // copy the state of this item into a string
  var serializationPrefix = 'ITEM!';

  // return a string representing the current state of this item
  Item.prototype.serialize = function() {
    var item = this;
    return JSON.stringify(this, function(k, v) {
      if ((this === item) && (k in this.getImmutableProperties())) return; // don't serialize immutables
      if (v === A) return; // don't serialize the adventure object
      if (k && v && (v.adventure === A)) { // serialize another Item/Place/Person as its id string  
        return serializationPrefix + '#' + v.id;
      }
      if (typeof v === 'string' && v.startsWith(serializationPrefix)) { // if, somehow, a name collision comes in, escape it
        return serializationPrefix + '?' + v;
      }
      return v;
    });
  };

  // restore this item to the state represented by the passed-in string  
  Item.prototype.deserialize = function(state) {
    var stateObject = JSON.parse(state, function(k, v) {
      if ((typeof v === 'string') && (v.startsWith(serializationPrefix))) {
        var c = v.charAt(serializationPrefix.length);
        var s = v.substring(serializationPrefix.length + 1);
        if (c == '#') {
          return itemMap[s];
        } else {
          return s;
        }
      }
      return v;
    });
    var item = this;
    Object.keys(stateObject).forEach(function(k) {
      if (!(k in item.getImmutableProperties())) {
        item[k] = stateObject[k];
      }
    });
  };

  Item.prototype.newBackgroundItem = function(options) {
    options = options || {};
    if (!('unlisted' in options))
      options.unlisted = true;
    if (!('canBeTaken' in options))
      options.canBeTaken = false;
    if (!('location' in options))
      options.location = this;
    return new Item(options);
  };

  A.newItem = function(options) {
    return new Item(options)
  };

  function Place(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'place';
    options.name = immutable(options.name || name);
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    Item.call(this, options);
  }
  Place.prototype = Object.create(Item.prototype);
  A.newPlace = function(options) {
    return new Place(options)
  };

  function Person(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'person';
    options.name = immutable(options.name || name);
    if (!('indefiniteName' in options)) {
      options.indefiniteName = immutable(options.name);
    }
    if (!('definiteName' in options)) {
      options.definiteName = immutable(options.name);
    }
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    if (!('it' in options)) {
      options.it = immutable('she');
    }
    Item.call(this, options);

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
      return this.location.beExitedBy(this, dir);
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
      var items = allItems().filter(function(item) {
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
      ret += 'Need help?  Here are some commands:\n\n';
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
      ret += '\n\nThere are other commands not listed here.  Try stuff out.  Good luck!';
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

    this.addCommand('use', 'beUsedBy', ['use ?i1', 'use ?i1 with ?i2', 'use ?i1 on ?i2'], 'Use an item in some way.');

  }
  Person.prototype = Object.create(Item.prototype);
  A.newPerson = function(options) {
    return new Person(options)
  };

  var exitReverseProperties = {
    id: 'reverseId',
    location: 'destination',
    direction: 'reverseDirection',
    isForwardExit: 'isReverseExit'
  };
  Object.keys(exitReverseProperties).forEach(function(k) {
    exitReverseProperties[exitReverseProperties[k]] = k;
  });

  var exitReverseHandler = {

    get: function get(target, name) {

    },

    set: function set(target, name, value) {
      target[exitReverseProperties[name] || name] = value;
      return true;
    }
  };

  function Exit(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'exit';
    options.name = immutable(options.name || name);
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    options.location = immutable(options.location);
    options.direction = immutable(options.direction);
    options.destination = immutable(options.destination);

    var reverseDirection = unwrap(options.reverseDirection);
    if (reverseDirection) {
      options.reverseDirection = immutable(typeof reverseDirection === 'boolean' ? oppositeDirections[unwrap(options.direction)] :
        options.reverseDirection);

      if (('reverseId' in options) && (unwrap(options.reverseid) in itemMap)) throw new Error('Cannot reuse id ' +
        unwrap(options.reverseId) + ' for reverseId');
      options.reverseId = immutable(options.reverseId || getNewId(name + '-reverse'));

      // these are not touchable
      options.isForwardExit = immutable(true);
      options.isReverseExit = immutable(false);

      options.forwardExit = immutable(this);

      var proxyType = function() {};
      proxyType.prototype = this;
      var reverseExit = new proxyType();

      options.reverseExit = immutable(reverseExit);
    }

    Item.call(this, options);

    if (reverseDirection) {

      var reverseExit = this.reverseExit;
      var forwardExit = this;

      Object.keys(this).forEach(function(k) {
        var rk = exitReverseProperties[k] || k;
        var h = {
          enumerable: true,
          configurable: false,
          get: function() {
            return forwardExit[rk];
          },
          set: function(v) {
            forwardExit[rk] = v;
          }
        };
        Object.defineProperty(reverseExit, k, h);
      });

      reverseExit.serialize = function() {
        return '';
      };
      reverseExit.deserialize = function() {};
      Object.seal(reverseExit);

      itemMap[this.reverseId] = reverseExit;
    }

  }

  Exit.prototype = Object.create(Item.prototype);
  Exit.prototype.beUsedBy = function(subject) {
    var ret = 'You use ' + this.definiteName + ' leading ' + this.direction + '.\n\n';
    subject.location = this.destination;
    return ret + subject.look();
  };
  A.newExit = function(options) {
    return new Exit(options)
  };

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
    var knownItems = flatten(allItems().filter(function(x) {
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