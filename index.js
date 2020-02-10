const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const easystarjs = require('easystarjs')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    "color": "#ff00ff",
    "headType": "bendr",
    "tailType": "pixel",
  }

  return response.json(data)
})

// Handle POST request to '/move'
app.post('/move', (request, response) => {
  const easystar = new easystarjs.js();

  // Draw board array
  let board = Array(request.body.board.height).fill().map(
    () => Array(request.body.board.width).fill(0));

  // find food coords and place on board
  nextMoveToFood = [];
  const food = request.body.board.food[0];

  // find coords for my snake's head
  const mySnakeHead = request.body.you.body[0];

  // find length and coords of my snake's body
  const mySnakeBody = request.body.you.body.splice(1);

  // place my snake's body on board
  mySnakeBody.forEach(element => {
    board[element.y][element.x] = 1;
  });

  // place enemy snakes on board
  const enemySnakes = request.body.board.snakes;

  enemySnakes.array.forEach(element => {
    board[element.y][element.x] = 1;
  });

  console.table(board);

  easystar.setGrid(board);
  easystar.setAcceptableTiles([0]);
  easystar.enableSync();

  easystar.findPath(mySnakeHead.x, mySnakeHead.y, food.x, food.y, function (path) {
    if (path === null) {
      console.log("The path to the destination point was not found.");
    } else {
      nextMoveToFood = path;
      console.log("First move should be: " + path[1].x + " " + path[1].y);
    }
  });

  easystar.calculate();

  const data = {
    move: 'left' // one of: ['up','down','left','right']
  }

  if (mySnakeHead.x > nextMoveToFood[1].x) {
    data.move = 'left';
  } else if (mySnakeHead.x < nextMoveToFood[1].x) {
    data.move = 'right';
  } else if (mySnakeHead.y < nextMoveToFood[1].y) {
    data.move = 'down';
  } else if (mySnakeHead.y > nextMoveToFood[1].y) {
    data.move = 'up';
  }
  console.log("I moved " + data.move + " on turn " + request.body.turn);
  return response.json(data);
})

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({})
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})