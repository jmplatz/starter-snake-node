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
  function createPlayingBoard(createMySnake, createOpponents, createSnakeHeads, dangerousFood) {
    // createSnakeHeads
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    const board = Array(boardHeight)
      .fill()
      .map(() => Array(boardWidth).fill(0));

    const mySnake = request.body.you.body;
    const mySnakeBody = mySnake.splice(1);
    const mySnakeName = request.body.you.name;
    const myOpponentSnakes = request.body.board.snakes;

    const foodLocations = request.body.board.food;
    console.log("Creating My Snake");
    createMySnake(mySnakeBody, board);
    console.log("Creating Opponent Snakes");
    createOpponents(myOpponentSnakes, board);
    console.log("Marking Larger Snakes");
    createSnakeHeads(myOpponentSnakes, mySnakeBody, mySnakeName, boardHeight, boardWidth, board);
    console.log("Removing Dangerous Food Options");
    dangerousFood(foodLocations, boardHeight, boardWidth, board);
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

  // If snake is larger than mine puts 1's around the head
  function drawLargerSnakeHeads(opponents, myBody, myName, height, width, board) {
    for (const snake of opponents) {
      if (snake.body.length >= myBody.length + 1 && snake.name != myName) {
        if (snake.body[0].y + 1 < height) {
          board[snake.body[0].y + 1][snake.body[0].x] = 1;
        }
        if (snake.body[0].y - 1 >= 0) {
          board[snake.body[0].y - 1][snake.body[0].x] = 1;
        }
        if (snake.body[0].x + 1 < width) {
          board[snake.body[0].y][snake.body[0].x + 1] = 1;
        }
        if (snake.body[0].x - 1 >= 0) {
          board[snake.body[0].y][snake.body[0].x - 1] = 1;
        }
      }
    }
  }

  // TODO: Need to implement function that prevents targetting food that kills me 1-2 turns later
  function removeDangerousFood(foodLocations, height, width, board) {
    for (const food of foodLocations) {
      // if both food.x +/- 1 == 1, make y +/- 1 also == 1
      if (food.x - 1 >= 0 && board[food.y][food.x - 1] == 1) {
        if (food.x + 1 < width && board[food.y][food.x + 1] == 1) {
          board[food.y][food.x] = 1;
          console.log(`Made food at ${food.x}, ${food.y} unavailable`);
        }
      }

      // Same for food.x's
      if (food.y - 1 >= 0 && board[food.y - 1][food.x] == 1) {
        if (food.y + 1 < height && board[food.y + 1][food.x] == 1) {
          board[food.y][food.x] = 1;
          console.log(`Made food at ${food.x}, ${food.y} unavailable`);
        }
      }
    }
  }

  function checkAdjacentTiles(board) {
    let availableMove = {
      x: null,
      y: null
    };

    const mySnakeHead = request.body.you.body[0];
    const boardWidth = request.body.board.width;
    const boardHeight = request.body.board.height;

    let leftValid = false;
    let upValid = false;
    let rightValid = false;
    let downValid = false;

    let leftUpCheck = false;
    let leftDownCheck = false;

    let upRightCheck = false;
    let upLeftCheck = false;

    let rightUpCheck = false;
    let rightDownCheck = false;

    let downRightCheck = false;
    let downLeftCheck = false;

    // FIXME: Need to add edge case of picking a "safe" option that won't kill me 1-2 turns later
    console.log("SURVIVAL MODE: Checking available tiles");
    // Left Checks
    if (mySnakeHead.x - 1 >= 0 && board[mySnakeHead.y][mySnakeHead.x - 1] != 1) {
      leftValid = true;
      if (board[mySnakeHead.y - 1][mySnakeHead.x - 1] != 1 && mySnakeHead.y - 1 >= 0)
        leftUpCheck = true;
      if (board[mySnakeHead.y + 1][mySnakeHead.x - 1] != 1 && mySnakeHead.y + 1 < boardHeight)
        leftDownCheck = true;
    }
    console.log(`Left: ${leftValid}, leftUpCheck: ${leftUpCheck}, leftDownCheck ${leftDownCheck}`);

    // Up Checks
    if (mySnakeHead.y - 1 >= 0 && board[mySnakeHead.y - 1][mySnakeHead.x] != 1) {
      upValid = true;
      if (board[mySnakeHead.y - 1][mySnakeHead.x + 1] != 1 && mySnakeHead.x + 1 < boardWidth)
        upRightCheck = true;
      if (board[mySnakeHead.y - 1][mySnakeHead.x - 1] != 1 && mySnakeHead.x - 1 >= 0)
        upLeftCheck = true;
    }
    console.log(`Up: ${upValid}, upLeftCheck: ${upLeftCheck}, upRightCheck ${upRightCheck}`);

    // Right Checks
    if (mySnakeHead.x + 1 < boardWidth && board[mySnakeHead.y][mySnakeHead.x + 1] != 1) {
      rightValid = true;
      if (board[mySnakeHead.y - 1][mySnakeHead.x + 1] != 1 && mySnakeHead.y - 1 >= 0)
        rightUpCheck = true;
      if (board[mySnakeHead.y + 1][mySnakeHead.x + 1] != 1 && mySnakeHead.y + 1 < boardHeight)
        rightDownCheck = true;
    }
    console.log(
      `Right: ${rightValid}, rightUpCheck: ${rightUpCheck}, rightDownCheck ${rightDownCheck}`
    );

    // Down Checks
    if (mySnakeHead.y + 1 < boardHeight && board[mySnakeHead.y + 1][mySnakeHead.x] != 1) {
      downValid = true;
      if (board[mySnakeHead.y + 1][mySnakeHead.x + 1] != 1 && mySnakeHead.x + 1 < boardWidth)
        downRightCheck = true;
      if (board[mySnakeHead.y + 1][mySnakeHead.x - 1] != 1 && mySnakeHead.x - 1 >= 0)
        downLeftCheck = true;
    }
    console.log(
      `Down: ${downValid}, downLeftCheck: ${downLeftCheck}, downRightCheck ${downRightCheck}`
    );

    // if valid move, check to see if below/above or right/left are available. If both checks fail don't move that direction
    if (leftValid == true && leftUpCheck == true && leftDownCheck == true) {
      availableMove.x = mySnakeHead.x - 1;
      availableMove.y = mySnakeHead.y;
      console.log("Left passes all checks");
    } else if (upValid == true && upLeftCheck == true && upRightCheck == true) {
      availableMove.x = mySnakeHead.x;
      availableMove.y = mySnakeHead.y - 1;
      console.log("Up passes all checks");
    } else if (rightValid == true && rightUpCheck == true && rightDownCheck == true) {
      availableMove.x = mySnakeHead.x + 1;
      availableMove.y = mySnakeHead.y;
      console.log("Right passes all checks");
    } else if (downValid == true && downLeftCheck == true && downRightCheck == true) {
      availableMove.x = mySnakeHead.x;
      availableMove.y = mySnakeHead.y + 1;
      console.log("Down passes all checks");
    } else {
      console.log("Safest moves unavailable. Checking less safe options");
      if (leftValid == true && (leftUpCheck == true || leftDownCheck == true)) {
        availableMove.x = mySnakeHead.x - 1;
        availableMove.y = mySnakeHead.y;
        console.log("Left passes");
      } else if (upValid == true && (upLeftCheck == true || upRightCheck == true)) {
        availableMove.x = mySnakeHead.x;
        availableMove.y = mySnakeHead.y - 1;
        console.log("Up passes");
      } else if (rightValid == true && (rightUpCheck == true || rightDownCheck == true)) {
        availableMove.x = mySnakeHead.x + 1;
        availableMove.y = mySnakeHead.y;
        console.log("Right passes");
      } else if (downValid == true && (downLeftCheck == true || downRightCheck == true)) {
        availableMove.x = mySnakeHead.x;
        availableMove.y = mySnakeHead.y + 1;
        console.log("Down passes");
      }
    }

    return availableMove;
  }

  // Creates an array of possible food moves based on distance away from snakehead
  function findFoodDistances(board) {
    console.log("5. Entered findFoodDistances()");
    const foodMovesArray = [];
    const mySnakeHead = request.body.you.body[0];
    const foodLocations = request.body.board.food;

    for (let i = 0; i < foodLocations.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - foodLocations[i].x) + Math.abs(mySnakeHead.y - foodLocations[i].y);
      if (board[foodLocations[i].y][foodLocations[i].x] != 1) {
        foodMovesArray.push(moveDistance);
      }
    }
    console.log(`6. Outputted array with (${foodMovesArray.length}) total moves`);
    return foodMovesArray;
  }

  /* FIXME: Need to deal with edge case of two moves with equal distances, might be removing incorrect one from array? */

  // Passed the array of food moves, returns the index of the shortest move
  function findClosestFood(foodArray) {
    console.log("9. Entered findClosestFood()");
    if (foodArray.length == 0) return 0;
    else {
      const index = foodArray.indexOf(Math.min(...foodArray));
      console.log(`10. Outputted the element at index (${index}) as closest option.`);
      return index;
    }
  }

  /* Utilizes 3 callbacks.
  1. Creates an array of food move distances
  2. Finds the closest food available and runs Easystar.js
  3. If it cannot find a path it removes that option from the array and tries the next closest, etc.
  4. If no food paths can be found it enters a "Survival Mode," checking adjacent tiles for available moves
  */
  function selectMove(calculateClosest, moveDistances, checkAdjacent) {
    let nextMove = [];
    let pathFound = false;
    const mySnakeHead = request.body.you.body[0];
    console.log("4. Intializing selectMove Function");

    const foodMoves = moveDistances(playingBoard);
    console.log(`7. Returned back to selectMove with distances array: (${foodMoves})`);

    while (pathFound == false) {
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

  console.log("1. Creating Board");
  const playingBoard = createPlayingBoard(
    drawMySnake,
    drawOpponents,
    drawLargerSnakeHeads,
    removeDangerousFood
  );
  console.log("2. Board Created");

  const easystar = new easystarjs.js();
  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  easystar.enableSync(); // required to work

  // TODO: Place this into a move function
  console.log("3. Selecting move");
  const theMove = selectMove(findClosestFood, findFoodDistances, checkAdjacentTiles);

  // Returns move
  console.log(`Move Selected: ${theMove.x}, ${theMove.y}`);
  if (mySnakeHead.y > theMove.y) {
    data.move = "up";
    console.log("Chose Up");
  } else if (mySnakeHead.y < theMove.y) {
    data.move = "down";
    console.log("Chose Down");
  } else if (mySnakeHead.x > theMove.x) {
    data.move = "left";
    console.log("Chose Left");
  } else if (mySnakeHead.x < theMove.x) {
    data.move = "right";
    console.log("Chose Right");
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
