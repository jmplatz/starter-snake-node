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

  const data = {
    move: 'up' // default to up
  };

  // Draw 2D Array with obstacles
  function createPlayingBoard(createMySnake, createMyOpponents) {
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    const board = Array(boardHeight).fill().map(
      () => Array(boardWidth).fill(0));

    const mySnake = request.body.you.body;
    const mySnakeBody = mySnake.splice(1);
    const myTail = mySnake.splice(0, mySnake.length - 1);
    const myOpponentSnakes = request.body.board.snakes;

    createMySnake(mySnakeBody, myTail, board);
    createMyOpponents(myOpponentSnakes, board);

    return board;
  }

  function drawMySnake(mySnakeBody, myTail, board) {
    mySnakeBody.forEach(element => {
      board[element.y][element.x] = 1;
    });
    board[myTail.y][myTail.x] = 5;
  }

  function drawOpponents(opponentSnakeBodies, board) {
    opponentSnakeBodies.forEach(snakes => {
      snakes.body.forEach(element => {
        board[element.y][element.x] = 1;
      });
    });
  }

  /* 
  TODO: Create function that creates expensive tiles around enemy snake heads
  */

  const playingBoard = createPlayingBoard(drawMySnake, drawOpponents);
  console.table(playingBoard);

  // for (let i = 0; i < board.length; i++) {
  //   for (let k = 0; k < board[i].length; k++) {
  //     if (i == 0 || k == 0)
  //       board[i][k] = 1;
  //     else if (i == boardHeight - 1 || k == boardWidth - 1)
  //       board[i][k] = 1;
  //   }
  // }

  // coords for my snake's head
  const mySnakeHead = request.body.you.body[0];

  function findClosestFood() {
    const foodArray = [];
    const foodLocations = request.body.board.food;

    for (let i = 0; i < foodLocations.length; i++) {
      let moveDistance = Math.abs(mySnakeHead.x - foodLocations[i].x) + Math.abs(mySnakeHead.y - foodLocations[i].y);
      foodArray.push(moveDistance);
    }
    // Finds index of shortest distance and passes to food
    let indexOfMinValue = foodArray.indexOf(Math.min(...foodArray));

    return indexOfMinValue;
  }

  // finds closest food object
  const closestFood = request.body.board.food[findClosestFood()];

  // will hold move towards food


  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  // easystar.setTileCost(1, 2)
  easystar.enableSync(); // required to work

  let nextMove = [];
  easystar.findPath(mySnakeHead.x, mySnakeHead.y, closestFood.x, closestFood.y, function (path) {
    if (path === null) {
      console.log("Could not find path to closest food. Activate panic mode.");
    } else {
      nextMove = path;
    }
  });

  easystar.calculate();

  // Returns move
  if (mySnakeHead.x > nextMove[1].x) {
    data.move = 'left';
  } else if (mySnakeHead.x < nextMove[1].x) {
    data.move = 'right';
  } else if (mySnakeHead.y < nextMove[1].y) {
    data.move = 'down';
  } else if (mySnakeHead.y > nextMove[1].y) {
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