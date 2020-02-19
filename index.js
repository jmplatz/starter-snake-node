/** @format */

const bodyParser = require("body-parser");
const express = require("express");
const logger = require("morgan");
const easystarjs = require("easystarjs");
const app = express();
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require("./handlers.js");

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set("port", process.env.PORT || 9001);

app.enable("verbose errors");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(poweredByHandler);

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post("/start", (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    color: "#ff00ff",
    headType: "bendr",
    tailType: "pixel"
  };

  return response.json(data);
});

// Handle POST request to '/move'
app.post("/move", (request, response) => {
  const data = {
    move: "up" // default to up
  };

  // const mySnake = {
  //   head: request.body.you.body[0],
  //   body: request.body.you.body.splice(1),
  //   tail: request.body.you.body.splice()
  // };

  // Draw 2D Array with obstacles
  function createPlayingBoard(createMySnake, createOpponents) {
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    const board = Array(boardHeight)
      .fill()
      .map(() => Array(boardWidth).fill(0));

    const mySnake = request.body.you.body;
    const mySnakeBody = mySnake.splice(1);
    const myOpponentSnakes = request.body.board.snakes;

    createMySnake(mySnakeBody, board);
    createOpponents(myOpponentSnakes, board);

    return board;
  }

  function drawMySnake(mySnakeBody, board) {
    mySnakeBody.forEach(element => {
      board[element.y][element.x] = 1;
    });
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

  console.table(playingBoard);

  // for (let i = 0; i < board.length; i++) {
  //   for (let k = 0; k < board[i].length; k++) {
  //     if (i == 0 || k == 0)
  //       board[i][k] = 1;
  //     else if (i == boardHeight - 1 || k == boardWidth - 1)
  //       board[i][k] = 1;
  //   }
  // }

  function findFoodDistances() {
    const foodMoveDistances = [];
    const foodLocations = request.body.board.food;

    for (let i = 0; i < foodLocations.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - foodLocations[i].x) +
        Math.abs(mySnakeHead.y - foodLocations[i].y);
      foodMoveDistances.push(moveDistance);
    }
    return foodMoveDistances;
  }

  function findClosestFood(findFoodDistances) {
    const closestFood = findFoodDistances();
    return closestFood.indexOf(Math.min(...closestFood));
  }

  function decidePath(findFoodDistances) {
    const playingBoard = createPlayingBoard(drawMySnake, drawOpponents);
    const easystar = new easystarjs.js();
    easystar.setGrid(playingBoard);
    easystar.setAcceptableTiles([0]);
    // easystar.setTileCost(1, 2)
    easystar.enableSync(); // required to work

    const mySnakeHead = request.body.you.body[0];
    const indexOfClosest = findClosestFood(findFoodDistances);
    const closestFood = request.body.board.food[indexOfClosest];
    let nextMove = [];

    easystar.findPath(
      mySnakeHead.x,
      mySnakeHead.y,
      closestFood.x,
      closestFood.y,
      function(path) {
        if (path === null) {
          console.log(
            "Could not find path to closest food. Activate panic mode."
          );
        } else {
          nextMove = path;
        }
      }
    );

    easystar.calculate();

    return nextMove[1];
  }

  const nextMove = decidePath(findFoodDistances);

  // Returns move
  if (mySnakeHead.x > nextMove.x) {
    data.move = "left";
  } else if (mySnakeHead.x < nextMove.x) {
    data.move = "right";
  } else if (mySnakeHead.y < nextMove.y) {
    data.move = "down";
  } else if (mySnakeHead.y > nextMove.y) {
    data.move = "up";
  }

  return response.json(data);
});

app.post("/end", (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({});
});

app.post("/ping", (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
});

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use("*", fallbackHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

app.listen(app.get("port"), () => {
  console.log("Server listening on port %s", app.get("port"));
});
