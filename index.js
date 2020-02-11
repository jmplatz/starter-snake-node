const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');
const easystarjs = require('easystarjs');
const app = express();
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js');

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001));

app.enable('verbose errors');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(poweredByHandler);

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    "color": "#ff00ff",
    "headType": "bendr",
    "tailType": "pixel",
  };

  return response.json(data);
});

// Handle POST request to '/move'
app.post('/move', (request, response) => {
  const easystar = new easystarjs.js();

  // Draw board 2darray
  let board = Array(request.body.board.height).fill().map(
    () => Array(request.body.board.width).fill(0));

  /*
  TODO: create a function that finds the closest food 
  to snakehead and passes that to easystar each round.
  
  If path can't be found for closest, iterate through other options
  */

  // finds first food object
  const food = request.body.board.food[0];
  // will hold move towards food
  let nextMoveToFood = [];

  // coords for my snake's head
  const mySnakeHead = request.body.you.body[0];

  // coords of my snake's body
  const mySnakeBody = request.body.you.body.splice(1);

  // let foodArray = [];
  // let foodLocations = request.body.board.food;
  // let leastMovesRequired = 100;
  // let moveDistance;
  // for (let i = 0; i < foodLocations.length; i++) {
  //   moveDistance = Math.abs(mySnakeHead.x - foodLocations[i].x) + Math.abs(mySnakeHead.y - foodLocations[i].y);
  //   foodArray[i] = moveDistance;

  //   if (moveDistance < leastMovesRequired) {
  //     leastMovesRequired = moveDistance;
  //   }
  // }

  let foodArray = [];
  const foodLocations = request.body.board.food;
  for (let i = 0; i < foodLocations.length; i++) {
    let moveDistance = Math.abs(mySnakeHead.x - foodLocations[i].x) + Math.abs(mySnakeHead.y - foodLocations[i].y);
    foodArray.push(moveDistance);
  }

  let indexOfMinValue = foodArray.indexOf(Math.min(...foodArray));
  console.log("This is the closest food: " + indexOfMinValue);
  foodArray = [];

  // place my snake's body on board
  mySnakeBody.forEach(element => {
    board[element.y][element.x] = 1;
  });

  /* 
  TODO: Add opponent snakes to the board, consider their next move
  Maybe create artificially larger head for opponent snakes??
  */

  console.table(board);

  // Running easystar library passing in board array
  easystar.setGrid(board);
  easystar.setAcceptableTiles([0]);
  easystar.enableSync();

  easystar.findPath(mySnakeHead.x, mySnakeHead.y, food.x, food.y, function (path) {
    if (path === null) {
      console.log("The path to the destination point was not found.");
    } else {
      nextMoveToFood = path;
    }
  });

  easystar.calculate();

  const data = {
    move: 'up' // default to up
  };

  // For now just uses first food object coords. nextMoveToFood[0] is current coords
  // TODO: Implement system for handling priority between L R U D
  if (mySnakeHead.x > nextMoveToFood[1].x) {
    data.move = 'left';
  } else if (mySnakeHead.x < nextMoveToFood[1].x) {
    data.move = 'right';
  } else if (mySnakeHead.y < nextMoveToFood[1].y) {
    data.move = 'down';
  } else if (mySnakeHead.y > nextMoveToFood[1].y) {
    data.move = 'up';
  }

  return response.json(data);
});

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({});
});

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
});

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'));
});