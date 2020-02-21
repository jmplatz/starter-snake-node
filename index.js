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
    move: ""
  };

  const mySnakeHead = request.body.you.body[0];
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

  function checkAdjacentTiles(board) {
    let availableMove;
    const left = [mySnakeHead.y, mySnakeHead.x - 1];
    const up = [mySnakeHead.y - 1, mySnakeHead.x];
    const right = [mySnakeHead.y, mySnakeHead.x + 1];
    const down = [mySnakeHead.y + 1, mySnakeHead.x];

    if (board[mySnakeHead.y][mySnakeHead.x - 1] != 1) {
      availableMove = left;
    } else if (board[mySnakeHead.y - 1][mySnakeHead.x] != 1) {
      availableMove = up;
    } else if (board[mySnakeHead.y][mySnakeHead.x + 1] != 1) {
      availableMove = right;
    } else availableMove = down;

    return availableMove;
  }

  /* 
  TODO: Create function that creates expensive tiles around enemy snake heads
  */

  function findFoodDistances() {
    console.log("5. Entered findFoodDistances()");
    const mySnakeHead = request.body.you.body[0];
    const foodMovesArray = [];
    const foodLocations = request.body.board.food;

    for (let i = 0; i < foodLocations.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - foodLocations[i].x) +
        Math.abs(mySnakeHead.y - foodLocations[i].y);
      foodMovesArray.push(moveDistance);
    }
    console.log(
      `6. Outputted array with ${foodMovesArray.length} total moves to selectMove`
    );
    return foodMovesArray;
  }

  function findClosestFood(foodArray) {
    console.log("9. Entered findClosestFood()");
    const index = foodArray.indexOf(Math.min(...foodArray));
    console.log(`10. Outputted the element at index ${index} as closest.`);
    return index;
  }

  console.log("1. Board Created");
  const playingBoard = createPlayingBoard(drawMySnake, drawOpponents);

  console.log("2. Initializing easyStar API");
  const easystar = new easystarjs.js();
  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  // easystar.setTileCost(1, 2)
  easystar.enableSync(); // required to work

  // Need to create array of moves. Function that loops through all food options and then panic mode to finish.
  // Maybe starts with shortest, if returns null removes from array and tries next shortest, etc..
  // If length == 0 then activate chasing tail.

  function selectMove(calculateClosest, distances, checkAdjacent) {
    let nextMove = [];
    let pathFound = false;
    const mySnakeHead = request.body.you.body[0];
    console.log("4. Intializing selectMove Function");

    const foodMoves = distances();
    console.log(
      `7. Returned back to selectMove with distances array: ${foodMoves}`
    );

    while (foodMoves.length > 0 && pathFound == false) {
      console.log("8. Entering while loop.");
      const indexOfClosest = calculateClosest(foodMoves);
      const closestFood = request.body.board.food[indexOfClosest];
      easystar.findPath(
        mySnakeHead.x,
        mySnakeHead.y,
        closestFood.x,
        closestFood.y,
        function(path) {
          if (path === null) {
            console.log(
              "LOOP: Could not find path to closest food. Trying next closest."
            );
            foodMoves.splice(indexOfClosest, 1);
            console.log(`LOOP: Length of array is now ${foodMoves.length}`);
            if (foodMoves.length == 0) {
              // append panic mode coordinates
              console.log("Invoked checkAdjacentTiles()");
              const move = checkAdjacent(playingBoard);
              console.log(`Returned next move: ${move}`);
              return move;
            }
          } else {
            nextMove = path[1];
            console.log("Path found, returning nextMove");
            pathFound = true;
          }
        }
      );
      easystar.calculate();
    }
    return nextMove;
  }

  console.log("3. Selecting move");
  const theMove = selectMove(
    findClosestFood,
    findFoodDistances,
    checkAdjacentTiles
  );

  // Returns move
  console.log("Submitted move.");
  if (mySnakeHead.x > theMove[0].x) {
    data.move = "left";
  } else if (mySnakeHead.y > theMove[0].y) {
    data.move = "up";
  } else if (mySnakeHead.x < theMove[0].x) {
    data.move = "right";
  } else if (mySnakeHead.y < theMove[0].y) {
    data.move = "down";
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
