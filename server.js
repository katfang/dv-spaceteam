/**
 * @license
 * Everything in this repo is MIT License unless otherwise specified.
 *
 * Copyright (c) Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen  Sawchuk, Google, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

	// set up ========================
	var express  = require('express');
	var app      = express(); 								// create our app w/ express
	var mongoose = require('mongoose'); 					// mongoose for mongodb
	var morgan = require('morgan'); 			// log requests to the console (express4)
	var bodyParser = require('body-parser'); 	// pull information from HTML POST (express4)
	var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
	var argv = require('optimist').argv;
  var Firebase = require('firebase');

	// configuration =================

	// mongoose.connect('mongodb://' + argv.be_ip + ':80/my_database');

  app.use('/js', express.static(__dirname + '/js'));
  app.use('/bower_components', express.static(__dirname + '/bower_components'));
	app.use(morgan('dev')); 										// log every request to the console
	app.use(bodyParser.urlencoded({'extended':'true'})); 			// parse application/x-www-form-urlencoded
	app.use(bodyParser.json()); 									// parse application/json
	app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
	app.use(methodOverride());

	// define model =================
  /*
	var Todo = mongoose.model('Todo', {
		title : String,
		completed: Boolean
	});
  */
  var GADGETS_PER_USER = 5;

	// routes ======================================================================

	// api ---------------------------------------------------------------------
	// get all todos
	app.get('/api/todos', function(req, res) {
    res.json({"something":"fake?"});

		// use mongoose to get all todos in the database
    /*
		Todo.find(function(err, todos) {

			// if there is an error retrieving, send the error. nothing after res.send(err) will execute
			if (err)
				res.send(err)

			res.json(todos); // return all todos in JSON format
		});*/
	});
  
  app.options("*", function(req, res) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:8000');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.send();
  });

  app.post('/roomgen', function(req, res) {
    var roomKey = req.body.key;
    var roomLevel = req.body.level;
    var rootRef = new Firebase("https://google-spaceteam.firebaseio.com");
    var roomRef = rootRef.child(roomKey);
    var gadgetsRef = rootRef.child("-gadgets");
    var usersRef = roomRef.child("users");
    var levelRef = roomRef.child("level").child(roomLevel);

    // set room state w/ transaction
    var generateRoom = function() {
      levelRef.child("state").transaction(function(currentData) {
        if (currentData === null) {
          return "generating";
        } else {
          return undefined;
        }
      }, function(error, committed, snapshot) {
        if (committed === true) {
          getUsersThenGadgets();
        }
      });
    };

    // grab users
    var getUsersThenGadgets = function() {
      var usersCallback = function(snap) {
        if (snap !== null) {
          var users = snap.val();
          usersRef.off('value', usersCallback);
          getGadgets(function(gadgets) {
            genLevelGadgets(users, gadgets);
          });
        }
      };
      usersRef.on('value', usersCallback);
    };

    // once have users -> get gadgets
    var getGadgets = function(callback) {
      var gadgetsCallback = function(snap) {
        if (snap != null) {
          var gadgets = snap.val();
          gadgetsRef.off('value', gadgetsCallback);
          callback(gadgets);
        }
      };
      gadgetsRef.on('value', gadgetsCallback);
    };

    // generate gadgets for each user
    var genLevelGadgets = function(users, gadgets) {
      var levelGadgets = {};
      var numUsers = Object.keys(users).length; 
      var gadgetKeys = Object.keys(gadgets);
      var maxNumGadgets = gadgetKeys.length;
      var gadgetsPerUser = Math.min(GADGETS_PER_USER, Math.floor(maxNumGadgets / numUsers));
      for (var i = 0; i < gadgetsPerUser; i++) {
        for (var u in users) {
          var randNum = Math.floor(Math.random() * gadgetKeys.length);
          var gadgetKey = gadgetKeys[randNum];
          gadgetKeys.splice(gadgetKey,1);
          var gadget = gadgets[gadgetKey];
          gadget.user = u;
          levelGadgets[gadgetKey] = gadget;
        }
      }
      levelRef.child("gadgets").set(levelGadgets, function(error) {
        if (error !== null) { 
          console.log("Error setting gadgets", roomKey, roomLevel, error);
        } else {
          initTasks();
        }
      });
    };

    // TODO gen instructions (maybe)
    
    // initialize task count 
    var initTasks = function() {
      levelRef.child("tasks").set({"completed":0, "failed":0}, function(error) {
        if (error !== null) {
          console.log("Error setting tasks", roomKey, roomLevel, error);
        } else {
          finalizeLevel();
        }
      });
    };

    // set state to ready
    var finalizeLevel = function() {
      levelRef.child("state").set("ready");
    }
    
    generateRoom();
    // the following calls represent the flow, but they are all called inside one another 
    // getUsersThenGadgets()
    // getGadgets()
    // genLevelGadgets()
    // initTasks()
    // finalizeLevel()
    res.header('Access-Control-Allow-Origin', 'http://localhost:8000');
    res.send(req.body.random);
  });

  /*
	// create todo and send back all todos after creation
	app.post('/api/todos', function(req, res) {

		// create a todo, information comes from AJAX request from Angular
		Todo.create({
			title : req.body.title,
			completed : false
		}, function(err, todo) {
			if (err)
				res.send(err);

			// get and return all the todos after you create another
			Todo.find(function(err, todos) {
				if (err)
					res.send(err)
				res.json(todos);
			});
		});

	});

	app.put('/api/todos/:todo_id', function(req, res){
	  return Todo.findById(req.params.todo_id, function(err, todo) {
	    todo.title = req.body.title;
	    todo.completed = req.body.completed;
	    return todo.save(function(err) {
	      if (err) {
	        res.send(err);
	      }
	      return res.send(todo);
	    });
	  });
	});

	// delete a todo
	app.delete('/api/todos/:todo_id', function(req, res) {
		Todo.remove({
			_id : req.params.todo_id
		}, function(err, todo) {
			if (err)
				res.send(err);

			// get and return all the todos after you create another
			Todo.find(function(err, todos) {
				if (err)
					res.send(err)
				res.json(todos);
			});
		});
	});
  */

	// application -------------------------------------------------------------
	app.get('/', function(req, res) {
		res.sendfile('index.html'); // load the single view file (angular will handle the page changes on the front-end)
	});

	// listen (start app with node server.js) ======================================
	app.listen(8080, argv.fe_ip);
	console.log("App listening on port 8080");
