"use strict";
//TODO limit to inventory?
//TODO maybe ambiguous items should be a warning error rather than first-found?
//TODO "jump"
//TODO "put ___ on ____"?
//TODO allow for multiple subjects 
//TODO add timed events with some kind of 'tick' handler or some other system

var Adventure = (function() {

  var A = {};
  A.newAdventure = function() {
    return new Adventure();
  };

  var objectValues = function(o, includeProto) {
    if (includeProto) {
      var ret = [];
      for (var k in o) {
        ret.push(o[k]);
      }
      return ret;
    }
    return Object.keys(o).map(function(k) {
      return o[k];
    });
  };

  // string/grammar manipulation functions    
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

  var gram = function(v) {
    var f = function(nom) {
      if (!nom) {
        var o = {};
        objectValues(v).forEach(function(k) {
          o[k] = true;
        });
        return Object.keys(o).join('|');
      }
      if (typeof nom === 'object')
        nom = nom.pronoun;

      nom = nom.toLowerCase();
      if (nom in v) return v[nom];
      return v.it;
    };
    return f;
  };

  function addS(name) {
    if ((/[^aeiou]y$/i).test(name)) {
      return name.substring(0, name.length - 1) + 'ies';
    } else if ((/(s|x|z|ch|sh|[^aeiou]o)$/i).test(name)) {
      return name + 'es';
    } else {
      return name + 's';
    }
  }

  var are = gram({
    i: 'am',
    we: 'are',
    you: 'are',
    he: 'is',
    she: 'is',
    it: 'is',
    they: 'are'
  });
  var have = gram({
    i: 'have',
    we: 'have',
    you: 'have',
    he: 'has',
    she: 'has',
    it: 'has',
    they: 'have'
  });
  var re = gram({
    i: 'm',
    we: 're',
    you: 're',
    he: 's',
    she: 's',
    it: 's',
    they: 're'
  });
  var ve = gram({
    i: 've',
    we: 've',
    you: 've',
    he: 's',
    she: 's',
    it: 's',
    they: 've'
  });

  var thirdSing = gram({
    i: false,
    we: false,
    you: false,
    he: true,
    she: true,
    it: true,
    they: false
  });
  var verb = function(vb, nom) {
    if (typeof vb !== 'string') return '';
    var vbl = vb.toLowerCase();
    if (vbl == 'are') return are(nom);
    if (vbl == 'have') return have(nom);
    if (vbl === 're') return re(nom);
    if (vbl === 've') return ve(nom);
    if (vbl === "'re") return "'" + re(nom);
    if (vbl === "'ve") return "'" + ve(nom);
    if (!nom) return vb + '|' + addS(vb);
    if (thirdSing(nom)) return addS(vb);
    return vb;
  }

  var grammar = {
    they: gram({
      i: 'I',
      we: 'we',
      you: 'you',
      he: 'he',
      she: 'she',
      it: 'it',
      they: 'they'
    }),
    them: gram({
      i: 'me',
      we: 'us',
      you: 'you',
      he: 'him',
      she: 'her',
      it: 'it',
      they: 'them'
    }),
    their: gram({
      i: 'my',
      we: 'our',
      you: 'your',
      he: 'his',
      she: 'her',
      it: 'its',
      they: 'their'
    }),
    theirs: gram({
      i: 'mine',
      we: 'ours',
      you: 'yours',
      he: 'his',
      she: 'hers',
      it: 'its',
      they: 'theirs'
    }),
    themselves: gram({
      i: 'myself',
      we: 'ourselves',
      you: 'yourself',
      he: 'himself',
      she: 'herself',
      it: 'itself',
      they: 'themselves'
    }),
    verb: verb,
    are: are,
    have: have,
    re: re,
    ve: ve,
    theyre: function(x) {
      return grammar.they(x) + "'" + grammar.re(x);
    },
    theyve: function(x) {
      return grammar.they(x) + "'" + grammar.ve(x);
    },
    toPlural: gram({
      i: 'we',
      we: 'we',
      you: 'you',
      he: 'they',
      she: 'they',
      it: 'they',
      they: 'they'
    }),
    isPlural: gram({
      i: false,
      we: true,
      you: false,
      he: false,
      she: false,
      it: false,
      they: true
    })
  };
  A.grammar = grammar;

  // mutability for options
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

  function enforceItemPropertyImmutability(item, options) {
    var immutableProperties = {};
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
      Object.defineProperty(item, prop, o);
    });
    return immutableProperties;
  }

  // default names for an item and its pronoun
  function getDefaultNames(name, pronoun) {
    var ret = {};
    var isPlural = A.grammar.isPlural(pronoun)
    ret.pluralName = isPlural ? name : addS(name);
    ret.keywords = [name.toLowerCase().replace(/[^a-z0-9 ]/g, '')];
    ret.definiteName = 'the ' + name;
    ret.indefiniteName = isPlural ? name : ('aeiou'.indexOf(name.charAt(0).toLowerCase()) >=
      0 ? 'an ' :
      'a ') + name;
    return ret;
  };

  function Adventure() {

    var a = this;

    a.maxNesting = 256;

    // KEEP A MAP OF ALL DIRECTIONS IN THE ADVENTURE
    var directions = {};
    //var oppositeDirections = {};
    //var dirRegExps = {};
    a.directions = directions;

    var directionName = function(dir) {
      if (dir in directions) return directions[dir].name;
      return dir;
    }

    var directionRegExps = function(dir, keywords) {
      if (dir in directions) return directions[dir].regExps;
      keywords = keywords || [dir];
      var re = '(?:leading )?(?:on |to |toward )?(?:the |a |an )?(?:' + keywords.join('|') + ')';
      return {
        start: new RegExp('^' + re + '(?:^|\\s+)(.*)$', 'i'),
        end: new RegExp('^(.*?)(?:^|\\s+)' + re + '$', 'i')
      };
    }

    a.newDirection = function(options) {
      if (!('name' in options) && (!('id' in options))) throw new Error('a direction needs a name');
      if (!('name' in options)) options.name = options.id;
      if (!('id' in options)) {
        var i = 0;
        var id = name;
        while (id in options) {
          i++;
          id = name + i;
        }
        options.id = id;
      }
      if (options.id in directions) throw new Error('ID conflict with direction ' + options.id);
      var direction = {};
      direction.id = options.id;
      direction.name = options.name;
      direction.keywords = options.keywords || [direction.name];
      direction.oppositeId = false;
      if (options.opposite) {
        var oppositeOptions = Object.assign({}, options.opposite);
        delete oppositeOptions.opposite;
        var opposite = a.newDirection(oppositeOptions);
        direction.oppositeId = opposite.id;
        opposite.oppositeId = direction.id;
      }
      direction.regExps = directionRegExps(options.id, direction.keywords);
      directions[options.id] = direction;
      return direction;
    };

    a.newDirection({
      id: 'north',
      keywords: ['north', 'n', 'northern', 'northward', 'northwards'],
      opposite: {
        id: 'south',
        keywords: ['south', 's', 'southern', 'southward', 'southwards']
      }
    });
    a.newDirection({
      id: 'east',
      keywords: ['east', 'e', 'eastern', 'eastward', 'eastwards'],
      opposite: {
        id: 'west',
        keywords: ['west', 'w', 'western', 'westward', 'westwards']
      }
    });
    a.newDirection({
      id: 'northeast',
      keywords: ['northeast', 'ne', 'northeastern', 'northeastward', 'northeastwards'],
      opposite: {
        id: 'southwest',
        keywords: ['southwest', 'sw', 'southwestern', 'southwestward', 'southwestwards']
      }
    });
    a.newDirection({
      id: 'northwest',
      keywords: ['northwest', 'nw', 'northwestern', 'northwestward', 'northwestwards'],
      opposite: {
        id: 'southeast',
        keywords: ['southeast', 'se', 'southeastern', 'southeastward', 'southeastwards']
      }
    });
    a.newDirection({
      id: 'up',
      keywords: ['up', 'u', 'upper', 'upward', 'upwards', 'above', 'high', 'higher', 'highest', 'over', 'top'],
      opposite: {
        id: 'down',
        keywords: ['down', 'd', 'lower', 'downward', 'downwards', 'below', 'lower', 'low', 'lowest', 'under',
          'beneath',
          'underneath',
          'bottom'
        ]
      }
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
    a.itemMap = itemMap;
    a.allItems = allItems;

    // KEEP A LIST OF ALL COMMANDS IN THE ADVENTURE
    var commands = [];
    a.commands = commands;

    // serialize adventure
    var serialize = function() {
      var serializedMap = {};
      Object.keys(itemMap).forEach(function(k) {
        var serialized = itemMap[k].serialize();
        if (serialized) serializedMap[k] = serialized;
      });
      return JSON.stringify(serializedMap);
    };
    a.serialize = serialize;

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
    a.deserialize = deserialize;

    function Item(options) {
      var item = this;
      this.adventure = a;
      if (typeof options === 'string') {
        options = {
          id: options
        };
      }
      options = Object.assign({}, options || {});

      var name = unwrap(options.name) || unwrap(options.id) || 'item';
      options.name = immutable(options.name || name);

      if (options.id && unwrap(options.id) in itemMap) throw new Error('cannot reuse id "' + unwrap(options.id) +
        '"');

      var baseId = unwrap(options.id) || name || 'item';
      var id = getNewId(baseId);
      options.id = immutable(id);

      itemMap[id] = this;

      // prevent a property from being saved/loaded as state or modified
      var immutableProperties = {};

      this.getImmutableProperties = function() {
        return immutableProperties;
      };

      var pronoun = unwrap(options.pronoun) || 'it';
      var defaultNames = getDefaultNames(name, pronoun);
      options.description = immutable(options.description || null);
      options.keywords = immutable(options.keywords || defaultNames.keywords);
      options.definiteName = immutable(options.definiteName || defaultNames.definiteName);
      options.indefiniteName = immutable(options.indefiniteName || defaultNames.indefiniteName);
      options.pluralName = immutable(options.pluralName || defaultNames.pluralName);
      options.pronoun = immutable(options.pronoun || pronoun);
      options.canBeTaken = immutable('canBeTaken' in options ? options.canBeTaken : true);
      options.location = (unwrap(options.canBeTaken) ? mutable : immutable)(options.location || null);
      options.hidden = 'hidden' in options ? mutable(options.hidden) : mutable(false);
      options.unlisted = immutable('unlisted' in options ? options.unlisted : false);
      options.isItem = immutable(true);

      var location = options.location;
      delete options.location;
      immutableProperties = enforceItemPropertyImmutability(item, options);
      if ((location instanceof MutabilityMarker) && !(location.mutable)) immutableProperties.location = true;
      location = unwrap(location);
      var o = {
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

    Object.keys(grammar).forEach(function(k) {
      if (k === 'verb') return;
      Object.defineProperty(Item.prototype, k, {
        enumerable: true,
        configurable: false,
        get: function() {
          var args = Array.from(arguments);
          args.push(this);
          return grammar[k].apply(null, args);
        }
      });
    });

    Item.prototype.verb = function(vb) {
      return grammar.verb(vb, this);
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
      this.location = subject.location;
      return "You have dropped " + this.definiteName + ".";
    };

    Item.prototype.beExaminedBy = function(subject) {
      var here = this;
      var ret = '';
      if (subject.location === here) {
        ret += titleCase(this.name) + '\n';
      }
      ret += (this.description || capitalize(this.theyre) + ' just ' + this.indefiniteName + '.');

      // describe exits with directions
      var exits = this.getExits().filter(function(ex) {
        return ex.direction;
      });
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
          exitTypes[type].directions.push(directionName(ex.direction));
        });
        Object.keys(exitTypes).forEach(function(type) {
          if (subject.location === here) {
            ret += ' There ';
            ret += exitTypes[type].directions.length == 1 ? 'is ' + exitTypes[type].single : 'are ' +
              exitTypes[
                type].multiple;
          } else {
            ret += ' ' + capitalize(this.they) + ' ' + this.have;
            ret += exitTypes[type].directions.length == 1 ? exitTypes[type].single : exitTypes[type].multiple;
          }
          ret += ' leading ';
          ret += series(exitTypes[type].directions);
          ret += '.';
        });
      }

      // describe non-exits or exits with no direction
      var items = this.listContents(subject).filter(function(it) {
        return (!(it instanceof Exit) || (!it.direction));
      });
      var itemNames = items.map(function(it) {
        return it.indefiniteName;
      });
      if (items.length > 0) {
        if (subject.location === here) {
          ret += ' ' + capitalize(series(itemNames)) + ' ' + ((items.length > 1) ? 'are' : items[0].are) +
            ' here.';
        } else {
          ret += ' ' + capitalize(this.pronoun) + ' ' + ((this instanceof Person) ? this.have : this.verb(
              'contain')) +
            ' ' + series(itemNames) + '.';
        }
      }
      return ret;
    };

    Item.prototype.allContents = function() {
      var here = this;
      return allItems().filter(function(it) {
        return it.location === here;
      });
    };

    Item.prototype.listContents = function(subject) {
      var here = this;
      var items = allItems().filter(function(it) {
        return it.location === here && !it.hidden;
      });
      items.forEach(function(i) {
        subject.setKnown(i);
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
        if (cnt > a.maxNesting) {
          throw new Error('Location nesting of more than ' + a.maxNesting + ' exceeded!');
        }
        if (loc === this) return true;
      }
      return false;
    };

    Item.prototype.ultimateLocation = function() {
      var cnt = 0;
      for (var loc = this; loc.location; loc = loc.location) {
        cnt++;
        if (cnt > a.maxNesting) {
          throw new Error('Location nesting of more than ' + a.maxNesting + ' exceeded!');
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

    Item.prototype.superMethod = function(name) {
      var method = this[name];
      var proto = Object.getPrototypeOf(this);
      while (true) {
        var superMethod = proto[name];
        if (!superMethod) return superMethod;
        if (superMethod !== method) return superMethod.bind(this);
        proto = Object.getPrototypeOf(proto);
        if (!proto) return void(0);
      }
    };

    // copy the state of this item into a string
    var serializationPrefix = 'I!';

    // return a string representing the current state of this item, or falsy value if no state to serialize
    Item.prototype.serialize = function() {
      var item = this;
      var ret = JSON.stringify(this, function(k, v) {
        if ((typeof this.getImmutableProperties === 'function') && (k in this.getImmutableProperties()))
          return; // don't serialize immutables
        if (v === a) return; // don't serialize the adventure object
        if (k && v && (v.adventure === a)) { // serialize another Item/Place/Person as its id string  
          return serializationPrefix + '#' + v.id;
        }
        if (typeof v === 'string' && v.startsWith(serializationPrefix)) { // if, somehow, a name collision comes in, escape it
          return serializationPrefix + '?' + v;
        }
        return v;
      });
      if (ret !== '{}') return ret;
      return false;
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
        options.unlisted = immutable(true);
      if (!('hidden' in options))
        options.hidden = immutable(false);
      if (!('canBeTaken' in options))
        options.canBeTaken = immutable(false);
      if (!('location' in options))
        options.location = immutable(this);
      return new Item(options);
    };

    a.newItem = function(options) {
      return new Item(options)
    };

    var addMethodFactory = function(typeName, constructor) {
      return function(name, method) {
        if (name in constructor.prototype) throw new Error(typeName +
          " prototype already has a property named \"" + name + "\".");
        constructor.prototype[name] = method;
      };
    };

    a.addItemMethod = addMethodFactory('Item', Item);

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
      if (!('hidden' in options)) {
        options.hidden = immutable(false);
      }
      options.location = immutable(options.location);
      options.isPlace = immutable(true);
      Item.call(this, options);
    }
    Place.prototype = Object.create(Item.prototype);
    a.newPlace = function(options) {
      return new Place(options)
    };
    a.addPlaceMethod = addMethodFactory('Place', Place);

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
      options.location = mutable(options.location); // people default to mobile
      if (!('pronoun' in options)) {
        options.pronoun = immutable('she');
      }
      options.isPerson = immutable(true);
      options.knownItems = [this];
      Item.call(this, options);

    }

    Person.prototype = Object.create(Item.prototype);

    Person.prototype.setKnown = function(object, value) {
      if (typeof value === 'undefined') value = true;
      this.knownItems = this.knownItems.filter(function(it) {
        return it !== object;
      });
      if (value) this.knownItems.push(object);
    };

    Person.prototype.isKnown = function(object) {
      return tbis.knownItems.indexOf(object) != -1;
    };

    a.newPerson = function(options) {
      return new Person(options)
    };
    a.addPersonMethod = addMethodFactory('Person', Person);

    var expandTemplates = function(templates) {
      if (!templates.length) return [];
      var expandTemplate = function expandTemplate(t) {
        t = t.replace(/\|+/g, '|').replace(/\s\|\s/g, '').replace(/[^a-z0-9|%\s]/gi, '').
        replace(/([^\s|])%/g, '$1').replace(/%(?![id]\d*([\s|]|$))/gi, '').replace(/\s+/g, ' ').trim();
        var b = t.indexOf('|');
        if (b < 0) {
          var ret = {};
          ret[t] = true;
          return ret;
        }
        var s1 = t.substring(0, b).lastIndexOf(' ') + 1;
        var s2 = (t + ' ').indexOf(' ', b);
        var t1 = t.substring(0, s1) + t.substring(b + 1);
        var t2 = t.substring(0, b) + t.substring(s2);
        return Object.assign(expandTemplate(t2), expandTemplate(t1));
      };
      return Object.keys(Object.assign.apply({}, templates.map(expandTemplate)));

    };

    a.newCommand = function(options) {
      options = Object.assign({}, options);
      if (!options.methodName) throw new Error('The command needs a methodName');
      if (typeof options.templates == 'string') options.templates = [options.templates];
      if (!options.templates || !options.templates.length) throw new Error('The command needs templates');
      options.templates = expandTemplates(Array.from(options.templates));
      var command;
      if (typeof options.command == 'function') {
        command = options.command;
      } else if (typeof options.command == 'object') {
        var youCant = options.command.youCant;
        if (!youCant) {
          var commandName = options.templates[0].toLowerCase().replace(/%[id]1?[^0-9]*$/, '').trim().replace(
            /%[id]\d+/, 'anything');
          youCant = "You can't " + commandName + " %i1.";
        }
        var mustSee = ('mustSee' in options.command) ? !!options.command.mustSee : true; // default true
        var mustHave = !!options.command.mustHave; // default false
        var objectMethodName = options.command.objectMethodName || false;
        command = function(object) {
          if (object && mustHave && !this.has(object)) {
            return "You don't have " + object.definiteName + ".";
          }
          if (object && mustSee && !this.canSee(object)) {
            return "You can't see " + object.definiteName + " here.";
          }
          if (!object) {
            return youCant.replace(/%[id][0-9]*/gi, '').replace(/\s+/g, ' ');
          }
          if (!objectMethodName || !(objectMethodName in object)) {
            return youCant.replace(/%[id][0-9]*/gi, object.definiteName).replace(/\s+/g, ' ');
          }
          var args = Array.from(arguments);
          args[0] = this;
          return object[objectMethodName].apply(object, args);
        };
      } else {
        throw new Error('The command needs either a command function or command options object');
      }
      command.templates = options.templates;
      if (options.help) {
        command.help = options.help;
      }
      Person.prototype[options.methodName] = command;
      commands.push(command);
      return command; // why not
    };

    a.newCommand({
      methodName: "go",
      templates: 'go|move|walk| %d1',
      help: 'Go in the specified direction, like North or South.',
      command: function(exit) {
        if (exit.noExit) {
          return "You can't go " + directionName(exit.direction) + " from here.";
        }
        return this.use(exit);
      }
    });

    a.newCommand({
      methodName: "climb",
      templates: 'climb |%d1',
      command: function(dir) {
        if (!dir) {
          var dir = this.location.getExits().find(function(ex) {
            return ex.direction == 'up';
          }) || noExit.up
        }
        return this.go(dir);
      }
    });

    a.newCommand({
      methodName: "look",
      templates: 'look|l',
      help: 'Look around you.',
      command: function look() {
        this.setKnown(this.location);
        return this.location.beExaminedBy(this);
      }
    });

    a.newCommand({
      methodName: "take",
      templates: ["take|t|get|pickup %i1", "pick up %i1", "pick %i1 up"],
      help: "Pick up an item.",
      command: {
        objectMethodName: "beTakenBy"
      }
    });

    a.newCommand({
      methodName: "drop",
      templates: ["drop|d|release %i1", "put down %i1", "put %i1 down", "let %i1 go", "let go |of| %i1"],
      help: "Put down an item.",
      command: {
        objectMethodName: "beDroppedBy",
        mustHave: true
      }
    });

    a.newCommand({
      methodName: "inventory",
      templates: 'inventory|i',
      help: 'List the items in your possession.',
      command: function inventory() {
        var subject = this;
        var items = allItems().filter(function(item) {
          return item.appearsInInventoryOf(subject);
        }).map(function(i) {
          return i.indefiniteName;
        });
        if (!items.length) return "You don't have anything.";
        return "You have " + series(items) + ".";
      }
    });

    a.newCommand({
      methodName: "help",
      command: function help() {
        var ret = '';
        ret += 'Need help?  Here are some commands:\n\n';
        ret += commands.filter(function(c) {
          return c.help;
        }).map(function(c) {
          var shortcut = c.templates.find(function(t) {
            return t.split(/\s+/)[0].length == 1;
          });
          return '"' + c.templates[0].toLowerCase().split(/\s+/).map(function(x) {
            return x.startsWith('%i') ? '[ITEM]' : x.startsWith('%d') ? '[DIRECTION]' : capitalize(x);
          }).join(' ') + '": ' + c.help + (shortcut ? ' (Shortcut: "' + shortcut.charAt(0).toUpperCase() +
            '")' :
            '');
        }).join('\n');
        ret += '\n\nThere are other commands not listed here.  Try stuff out.  Good luck!';
        return ret;
      },
      templates: ['help|h', 'help me'],
      help: 'Read these words.'
    });

    a.newCommand({
      methodName: "examine",
      templates: ["examine|x %i1", "look|l |at %i1"],
      help: "Examine an item.",
      command: {
        objectMethodName: "beExaminedBy"
      }
    });

    a.newCommand({
      methodName: "use",
      templates: ["use|u %i1", "use|u %i1 with|on %i2"],
      help: "Use an item in some way.",
      command: {
        objectMethodName: "beUsedBy"
      }
    });

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
      if (!('hidden' in options)) {
        options.hidden = immutable(false);
      }

      options.location = immutable(options.location);
      options.direction = immutable(options.direction);
      options.isExit = immutable(true);
      // destination should be managed as a getter/setter that takes objects or ids, like location
      var destination = immutable(options.destination);
      delete options.destination;
      var destinationImmutable = !(destination.mutable);
      destination = unwrap(destination);
      var o = {
        configurable: false,
        enumerable: true,
        get: function() {
          var ret = destination;
          if (typeof destination === 'string') ret = itemMap[destination];
          if (!ret) ret = null;
          return ret;
        }
      };
      if (!destinationImmutable) {
        o.set = function(l) {
          destination = l;
        };
      }
      Object.defineProperty(this, 'destination', o);

      var reverse = unwrap(options.reverse);

      var exit = this;

      function makeThisAnItem() {
        Item.call(exit, options);
        if (destinationImmutable) exit.getImmutableProperties().destination = true;
      }

      if (!reverse) {
        makeThisAnItem();
        return;
      }

      delete options.reverse;

      if (reverse === true) {
        reverse = {};
      } else if (typeof reverse == 'string') {
        reverse = {
          direction: reverse
        };
      }

      reverse.direction = immutable(reverse.direction || (directions[unwrap(options.direction)] || {}).oppositeId);

      if (('id' in reverse) && (unwrap(reverse.id) in itemMap)) throw new Error('Cannot reuse id ' + unwrap(reverse
          .id) +
        ' for reverse.id');

      reverse.id = immutable(reverse.id || getNewId((unwrap(reverse.name) || name) + '-reverse'));

      var reversePronoun = ('pronoun' in reverse) ? unwrap(reverse.pronoun) : (('pronoun' in options) ? unwrap(
          options.pronoun) :
        'it');

      if ('name' in reverse) {
        reverse.name = immutable(reverse.name);
        var defaultNames = getDefaultNames(unwrap(reverse.name), reversePronoun);
        reverse.keywords = immutable(reverse.keywords || defaultNames.keywords);
        reverse.definiteName = immutable(reverse.definiteName || defaultNames.definiteName);
        reverse.indefiniteName = immutable(reverse.indefiniteName || defaultNames.indefiniteName);
        reverse.pluralName = immutable(reverse.pluralName || defaultNames.pluralName);
        reverse.pronoun = immutable(reverse.pronoun || defaultNames.pronoun);
      }

      ['description', 'keywords', 'definiteName', 'indefiniteName', 'pluralName', 'pronoun', 'canBeTaken',
        'hidden',
        'unlisted'
      ].forEach(function(k) {
        if (k in reverse) reverse[k] = immutable(reverse[k]);
      });

      // unchangable options
      options.isForwardExit = immutable(true);
      options.isReverseExit = immutable(false);
      reverse.isForwardExit = immutable(false);
      reverse.isReverseExit = immutable(true);
      options.forwardExit = immutable(this);

      var proxyType = function() {};
      proxyType.prototype = this;
      var reverseExit = new proxyType();

      options.reverseExit = immutable(reverseExit);

      if ('location' in reverse) throw new Error(
        'Do not specify location of reverse exit; it will automatically be the same as the exit destination');
      if ('destination' in reverse) throw new Error(
        'Do not specify destination of reverse exit; it will automatically be the same as the exit location');

      var immutableProperties = enforceItemPropertyImmutability(reverse, reverse);
      // as of now, reverse is an object holding onto these properties

      makeThisAnItem();

      itemMap[reverse.id] = reverseExit;

      var forwardExit = this;
      reverse.serialize = this.serialize.bind(reverse);
      reverse.deserialize = this.deserialize.bind(reverse);
      reverse.getImmutableProperties = function() {
        return immutableProperties;
      };

      Object.defineProperty(reverseExit, 'location', {
        enumerable: true,
        configurable: false,
        get: function() {
          return forwardExit.destination;
        },
        set: function(v) {
          forwardExit.destination = v;
        }
      });
      Object.defineProperty(reverseExit, 'destination', {
        enumerable: true,
        configurable: false,
        get: function() {
          return forwardExit.location;
        },
        set: function(v) {
          forwardExit.location = v;
        }
      });

      var mergedKeyObj = {};
      Object.keys(this).forEach(function(k) {
        mergedKeyObj[k] = true;
      });
      Object.keys(reverse).forEach(function(k) {
        mergedKeyObj[k] = true;
      });

      Object.keys(mergedKeyObj).forEach(function(k) {
        if ((k == 'location') || (k == 'destination')) return;
        var get;
        var set;
        if (k in reverse) {
          get = function() {
            return reverse[k];
          };
          set = function(v) {
            reverse[k] = v;
          };
        } else {
          get = function() {
            return forwardExit[k];
          };
          set = function(v) {
            forwardExit[k] = v;
          };
        }

        Object.defineProperty(reverseExit, k, {
          enumerable: true,
          configurable: false,
          get: get,
          set: set
        });
      });

      Object.seal(reverseExit);

    }
    Exit.prototype = Object.create(Item.prototype);
    Exit.prototype.getDistinguishingName = function(indefinite) {
      var ret = indefinite ? this.indefiniteName : this.definiteName;
      if (!this.location) return ret;
      if (!this.direction) return ret;
      var name = this.name;
      var exitsOfSameType = this.location.getExits().filter(function(ex) {
        return ex.name === name;
      });
      if (exitsOfSameType.length < 2) return ret;
      ret += ' leading ' + directionName(this.direction);
      return ret;
    };
    Exit.prototype.beUsedBy = function(subject) {
      var ret = 'You use ' + this.definiteName + (this.direction ? ' leading ' + directionName(this.direction) :
        '') + '.\n\n';
      subject.location = this.destination;
      return ret + subject.look();
    };
    Exit.prototype.beExaminedBy = function(subject) {
      if (this.description) return this.description;
      return capitalize(this.theyre) + ' ' + this.getDistinguishingName(true) + '.';
    };

    a.newExit = function(options) {
      return new Exit(options);
    };
    a.addExitMethod = addMethodFactory('Exit', Exit);

    var noExit = {};
    Object.keys(directions).forEach(function(k) {
      noExit[k] = new Exit({
        id: 'no-exit-' + k,
        name: 'exit leading ' + directionName(k),
        definiteName: 'an exit leading ' + directionName(k),
        keywords: ['exit', 'door'],
        direction: k,
        location: null,
        destination: null,
        noExit: immutable(true),
        hidden: immutable(true)
      });
    });

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
      if (interpretation.success) {
        return interpretation.func.apply(subject, interpretation.parameters);
      }
      // okay, we didn't understand.  So let's be humorous?
      if (str.length == 0) {
        if (!curBlankResponses.length) curBlankResponses = blankResponses.slice();
        return curBlankResponses.splice(Math.floor(Math.random() * curBlankResponses.length), 1)[0];
      }

      var confused = interpretation.confusingInput ? ('"' + interpretation.confusingInput + '"') : 'that';
      return "Sorry, I don't understand " + confused + ".  Type \"help\" for help."

    }
    a.respond = respond;

    function getCommandMatches(subject, str) {
      str = str.replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, ' ').trim();
      str = str.replace(/(\b|^)please( |$)/g, '').trim(); // no need to be polite;
      var argRe = /%[id]\d*/g;
      var allMatches = [];
      commands.forEach(function(command) {
        command.templates.forEach(function(template) {
          var lens = [];
          while (true) {
            // build a regular expression to match this template to the string, making sure to preclude
            // any previous matches by limiting the length of the matches
            var i = 0;
            var func = function(str, offset) {
              var ret = (typeof lens[i] === 'number') ? ('\\b(.{1,' + lens[i] + '})\\b') : '\\b(.+)\\b';
              i++;
              return ret;
            };
            var re = new RegExp('^(?:' + template.replace(argRe, func) + ')$', 'i');
            var matches = str.match(re);
            if (matches) {
              matches = matches.slice(1);
              var args = [];
              var params = (template.match(argRe) || []);
              var unknownArg = 1;
              for (var j = 0; j < matches.length; j++) {
                var param = params[j];
                var match = matches[j];
                var type = param.charAt(1);
                var argNum = (parseInt(param.substring(2), 10) || unknownArg) - 1;
                unknownArg = argNum + 2;
                args[argNum] = {
                  type: type,
                  str: match
                };
              }
              lens = matches.map(function(m) {
                return m.length;
              });
              var totalMatchedLength = lens.reduce(function(s, l) {
                return s + l;
              }, 0);
              allMatches.push({
                command: command,
                template: template,
                args: args,
                totalMatchedLength: totalMatchedLength
              });

            } else {
              lens.pop();
            }
            while (true) {
              var lenlen = lens.length;
              if (!lenlen) return;
              lenlen--;
              lens[lenlen]--;
              if (lens[lenlen] > 0) {
                break;
              }
              lens.pop();
            }
          }
        });
      });
      allMatches.sort(function(x, y) {
        return x.totalMatchedLength - y.totalMatchedLength;
      });
      allMatches.forEach(function(m) {
        delete m.totalMatchedLength;
      });
      return allMatches;
    }

    function matchStringToItem(subject, str, item) {
      // assume that string is alphanumeric separated by single spaces  
      // check to see if item is a nearby exit specified by direction
      if ((item instanceof Exit) && (item.noExit || (item.location === subject.location)) && item.direction) {
        var regExps = directionRegExps(item.direction);
        var matches = str.match(regExps.start) || str.match(regExps.end);
        if (matches) {
          str = matches[1]; // strip direction specifier off
          if (!str) return true; //specifying just the direction is considered a match                    
        }
      }
      // see if it matches any of the item's keywords
      str = str.toLowerCase().replace(/^(the|a|an) /i, '').trim(); // strip off articles
      for (var i = 0; i < item.keywords.length; i++) {
        if (str === item.keywords[i].toLowerCase())
          return true;
      }
      return false; // didn't match any keywords or direction... it's not a match.
    }

    function interpretInput(subject, str) {

      var commandMatches = getCommandMatches(subject, str);

      if (!commandMatches.length) return {
        success: false,
        confusingInput: str
      };

      var exits = null;
      var getExits = function() {
        if (!exits) {
          exits = subject.knownItems.filter(function(it) {
            return (it instanceof Exit) && (it.location === subject.location);
          });
          exits.push.apply(exits, objectValues(noExit));
        }
        return exits;
      };
      var items = null;
      var getItems = function() {
        if (!items) {
          items = subject.knownItems.slice();
          items.sort(function(x, y) {
            return +subject.canSee(y) - subject.canSee(x);
          });
          items.push.apply(items, objectValues(noExit));
        }
        return items;
      };

      var confusingArgNumber = -1;
      var confusingInput = null;
      commandLoop: for (var i = 0; i < commandMatches.length; i++) {
        var commandMatch = commandMatches[i];
        var params = [];
        argLoop: for (var j = 0; j < commandMatch.args.length; j++) {
          var arg = commandMatch.args[j];
          var itemsToSearch = (arg.type.toLowerCase() == 'd') ? getExits() : getItems();
          itemLoop: for (var k = 0; k < itemsToSearch.length; k++) {
            var itemToSearch = itemsToSearch[k];
            if (matchStringToItem(subject, arg.str, itemToSearch)) {
              params[j] = itemToSearch;
              continue argLoop;
            }
          }
          if (j > confusingArgNumber) {
            confusingInput = arg.str;
            confusingArgNumber = j;
          }
          // the string doesn't match any item so maybe this isn't the right command        
          continue commandLoop;
        }
        return {
          success: true,
          func: commandMatch.command,
          parameters: params
        };
      }
      return {
        success: false,
        confusingInput: confusingInput
      };

    };

  };

  // some nice defaults?
  A.openableExitOptions = {
    open: true,
    beOpenedBy: function(subject) {
      if (this.open) return "It's already open.";
      this.open = true;
      return "You have opened " + this.getDistinguishingName() + ".";
    },
    beClosedBy: function(subject) {
      if (!this.open) return "It's already closed.";
      this.open = false;
      return "You have closed " + this.getDistinguishingName() + ".";
    },
    beUsedBy: function(subject) {
      if (!this.open) return A.capitalize(this.getDistinguishingName()) +
        " is closed.";
      return this.superMethod('beUsedBy')(subject);
    },
    beExaminedBy: function(subject) {
      var description = this.superMethod('beExaminedBy')(subject);
      return description + ' ' + A.capitalize(this.they) + ' ' + this.are + ' ' + (this.open ? 'open' :
        'closed') + '.';
    },
    beUnlockedBy: function(subject) {
      return "There's no lock.";
    },
    beLockedBy: function(subject) {
      return "It doesn't lock.";
    },
    bePulledBy: function(subject) {
      return (this.isForwardExit) ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    },
    bePushedBy: function(subject) {
      return (this.isReverseExit) ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    }
  };

  A.lockableExitOptions = {
    unlocked: true,
    beOpenedBy: function(subject) {
      if (this.unlocked) return A.openableExitOptions.beOpenedBy.call(this, subject);
      return A.capitalize(this.getDistinguishingName()) + " is locked.";
    },
    beUsedBy: function(subject) {
      if (!this.unlocked) return A.capitalize(this.getDistinguishingName()) +
        " is locked.";
      return A.openableExitOptions.beUsedBy.call(this, subject);
    },
    beExaminedBy: function(subject) {
      var ret = this.superMethod('beExaminedBy')(subject);
      ret += ' ' + A.capitalize(this.they) + ' ' + they.are + ' ' + (this.open ? 'open' : ('closed and ' + (
        this.unlocked ?
        'un' : ''))) + 'locked.';
      ret += ' ' + A.capitalize(this.they) + ' ' + (this.unlocked ? '' : 'un') + this.verb('lock') + ' from ' +
        (this.isForwardExit ?
          'this' : 'the other') + ' side.';
      return ret;
    },
    beUnlockedBy: function(subject) {
      if (this.unlocked) return capitalize(this.theyre) + " already unlocked.";
      if (this.isReverseExit) return "You can't unlock " + this.them + " from this side.";
      this.unlocked = true;
      return "You have unlocked " + this.definiteName + '.';
    },
    beLockedBy: function(subject) {
      if (this.open) return "You have to close " + this.them + " first.";
      if (!this.unlocked) return A.capitalize(this.theyre) + " already locked.";
      if (this.isReverseExit) return "You can't lock " + this.them + " from this side.";
      this.unlocked = false;
      return "You have locked " + this.definiteName + '.';
    }
  };

  return A;
})();