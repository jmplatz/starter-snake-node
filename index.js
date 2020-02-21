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
    move: "up"
  };

  const mySnakeHead = request.body.you.body[0];
  // const mySnake = {
  //   head: request.body.you.body[0],
  //   body: request.body.you.body.splice(1),
  //   tail: request.body.you.body.splice()
  // };

  // Draw 2D Array with obstacles
  function createPlayingBoard(createMySnake, createOpponents, createSnakeHeads) {
    // createSnakeHeads
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
    createSnakeHeads(myOpponentSnakes);

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
  TODO: Create a function that puts 1's around larger snake's heads
  */
  function drawLargerSnakeHeads(opponents) {
    for (const name of opponents) {
      console.log(name);
    }
  }

  // if (opponents.body.length >= mySnakeBody.length + 1) {
  //   if (head.y + 1 < height) {
  //     board[head.y + 1][head.x] = 1;
  //   }
  //   if (head.y - 1 >= 0) {
  //     board[head.y - 1][head.x] = 1;
  //   }
  //   if (head.x + 1 < width) {
  //     board[head.y][head.x + 1] = 1;
  //   }
  //   if (head.x - 1 >= 0) {
  //     board[head.y][head.x - 1] = 1;
  //   }
  // }

  function checkAdjacentTiles(board) {
    let availableMove = {
      x: null,
      y: null
    };

    const mySnakeHead = request.body.you.body[0];
    const boardWidth = request.body.board.width;

    // FIXME: Need to add edge case of picking "safe" option that kills snake 1-2 turns later
    console.log("SURVIVAL MODE: Checking available tiles");
    if (board[mySnakeHead.y][mySnakeHead.x - 1] != 1 && mySnakeHead.x - 1 > 0) {
      availableMove.x = mySnakeHead.x - 1;
      availableMove.y = mySnakeHead.y;
      console.log("Left is Available");
    } else if (board[mySnakeHead.y - 1][mySnakeHead.x] != 1 && mySnakeHead.y - 1 > 0) {
      availableMove.x = mySnakeHead.x;
      availableMove.y = mySnakeHead.y - 1;
      console.log("Up is Available");
    } else if (board[mySnakeHead.y][mySnakeHead.x + 1] != 1 && mySnakeHead.x + 1 < boardWidth) {
      availableMove.x = mySnakeHead.x + 1;
      availableMove.y = mySnakeHead.y;
      console.log("Right is Available");
    } else {
      availableMove.x = mySnakeHead.x;
      availableMove.y = mySnakeHead.y + 1;
      console.log("Down is Available");
    }

    return availableMove;
  }

  function findFoodDistances() {
    console.log("5. Entered findFoodDistances()");
    const mySnakeHead = request.body.you.body[0];
    const foodMovesArray = [];
    const foodLocations = request.body.board.food;

    for (let i = 0; i < foodLocations.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - foodLocations[i].x) + Math.abs(mySnakeHead.y - foodLocations[i].y);
      foodMovesArray.push(moveDistance);
    }
    console.log(`6. Outputted array with ${foodMovesArray.length} total moves to selectMove`);
    return foodMovesArray;
  }

  /* FIXME: Need to deal with edge case of two moves with equal distances */

  function findClosestFood(foodArray) {
    console.log("9. Entered findClosestFood()");
    const index = foodArray.indexOf(Math.min(...foodArray));
    console.log(`10. Outputted the element at index ${index} as closest option.`);
    return index;
  }

  function selectMove(calculateClosest, distances, checkAdjacent) {
    let nextMove = [];
    let pathFound = false;
    const mySnakeHead = request.body.you.body[0];
    console.log("4. Intializing selectMove Function");

    const foodMoves = distances();
    console.log(`7. Returned back to selectMove with distances array: ${foodMoves}`);

    while (foodMoves.length > 0 && pathFound == false) {
      console.log("8. Entering while loop.");
      const indexOfClosest = calculateClosest(foodMoves);
      const closestFood = request.body.board.food[indexOfClosest];
      easystar.findPath(mySnakeHead.x, mySnakeHead.y, closestFood.x, closestFood.y, function(path) {
        if (path === null) {
          console.log("LOOP: Could not find path to closest food. Trying next closest.");
          foodMoves.splice(indexOfClosest, 1);
          console.log(`LOOP: Length of food array is now: (${foodMoves.length})`);
          if (foodMoves.length == 0) {
            const survivalMove = checkAdjacent(playingBoard);
            nextMove = survivalMove;
            pathFound = true;
          }
        } else {
          nextMove = path[1];
          console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
          pathFound = true;
        }
      });
      easystar.calculate();
    }
    return nextMove;
  }

  // TODO: Place these into an initialize function?
  console.log(`Turn ${request.body.turn}`);
  console.log("1. Board Created");
  const playingBoard = createPlayingBoard(drawMySnake, drawOpponents, drawLargerSnakeHeads);

  console.log("2. Initializing easyStar API");
  const easystar = new easystarjs.js();
  console.table(playingBoard);
  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  // easystar.setTileCost(1, 2)
  easystar.enableSync(); // required to work

  // TODO: Place this into a move function
  console.log("3. Selecting move");
  const theMove = selectMove(findClosestFood, findFoodDistances, checkAdjacentTiles);

  // Returns move
  console.log(`Submitted move: ${theMove.x}, ${theMove.y}`);
  if (mySnakeHead.x > theMove.x) {
    data.move = "left";
    console.log("Chose Left");
  } else if (mySnakeHead.y > theMove.y) {
    data.move = "up";
    console.log("Chose Up");
  } else if (mySnakeHead.x < theMove.x) {
    data.move = "right";
    console.log("Chose Right");
  } else if (mySnakeHead.y < theMove.y) {
    data.move = "down";
    console.log("Chose Down");
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
