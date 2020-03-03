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
      if (snake.body.length > myBody.length + 1 && snake.name != myName) {
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
      if (food.x - 1 >= 0 && board[food.y][food.x - 1] === 1) {
        if (food.x + 1 < width && board[food.y][food.x + 1] === 1) {
          board[food.y][food.x] = 1;
          console.log(`Made food at ${food.x}, ${food.y} unavailable`);
        }
      }

      // Same for food.x's
      if (food.y - 1 >= 0 && board[food.y - 1][food.x] === 1) {
        if (food.y + 1 < height && board[food.y + 1][food.x] === 1) {
          board[food.y][food.x] = 1;
          console.log(`Made food at ${food.x}, ${food.y} unavailable`);
        }
      }
    }
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
  function findClosestFood(foodArray, futureCheck = false) {
    console.log("9. Entered findClosestFood()");
    if (foodArray.length === 0) return 0;

    // if futureCheck, create temp array, filter to remove current closest, return second closest
    if (futureCheck) {
      console.log("futureCheck was true");
      let currentClosest = foodArray.indexOf(Math.min(...foodArray));

      let tempArray = foodArray.filter(values => {
        return values != currentClosest;
      });

      const secondClosest = tempArray.indexOf(Math.min(...tempArray));

      console.log(`10. Outputted the element at index (${secondClosest}) as next closest option.`);
      return secondClosest;

      // else just return closest
    } else {
      const index = foodArray.indexOf(Math.min(...foodArray));
      console.log(`10. Outputted the element at index (${index}) as closest option.`);

      return index;
    }
  }

  /* Utilizes 4 callback methods.
  1. Creates an array of food move distances
  2. Finds the closest food available and runs Easystar.js
  3. If it cannot find a path it removes that option from the array and tries the next closest.
  4. If no food paths can be found it enters a "Survival Mode," checking adjacent tiles for available moves
  */
  function selectMove(calculateClosest, moveDistances, runEasyStar, changeTile) {
    let nextMove = {};
    let pathFound = false;

    const mySnakeHead = request.body.you.body[0];
    const currentTurn = request.body.turn;
    console.log("4. Intializing selectMove Function");

    const foodMoves = moveDistances(playingBoard);
    console.log(`7. Returned back to selectMove with distances array: (${foodMoves})`);

    const indexOfClosest = calculateClosest(foodMoves);
    const closestFood = request.body.board.food[indexOfClosest];

    // For first 5 turns just go for food regularly
    while (currentTurn < 5 && foodMoves.length > 0) {
      let moveOption = runEasyStar(mySnakeHead, closestFood);

      if (Object.entries(moveOption).length == 0) {
        console.log("LOOP: Could not find path to closest food. Trying next closest.");
        foodMoves.splice(indexOfClosest, 1);
        console.log(`LOOP: Length of food array is now: (${foodMoves.length})`);
      } else {
        console.log("Returned with move.");
        nextMove = moveOption;
        pathFound = true;
        console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
      }
    }
    // Food move loop
    while (pathFound === false && foodMoves.length > 1) {
      console.log("8. Entering food loop.");
      // const indexOfClosest = calculateClosest(foodMoves);
      // const closestFood = request.body.board.food[indexOfClosest];

      let moveOption = runEasyStar(mySnakeHead, closestFood);

      // If move object returns empty, remove closest option
      if (Object.entries(moveOption).length == 0) {
        console.log("LOOP: Could not find path to closest food. Trying next closest.");
        foodMoves.splice(indexOfClosest, 1);
        console.log(`LOOP: Length of food array is now: (${foodMoves.length})`);
      } else {
        // If easyStar returns with move, continue to future check
        console.log("Entered futureMove check");

        // Getting coordinates of nextClosestFood
        const indexOfNextClosest = calculateClosest(foodMoves, true);
        const nextClosestFood = request.body.board.food[indexOfNextClosest];

        // Change move temporarily to an unplayable tile to make sure I'm not cutting myself off
        changeTile(playingBoard, moveOption);
        // Check to see if there's a path from food to next available food
        let futureMove = runEasyStar(closestFood, nextClosestFood);
        // Change move back to playable tile
        changeTile(playingBoard, moveOption);
        console.log("Returned with futureMove");

        if (Object.entries(futureMove).length == 0) {
          console.log("LOOP: Could not find path from foodMove to futureFood");
          foodMoves.splice(indexOfClosest, 1);
          console.log(`LOOP: Length of food array is now: (${foodMoves.length})`);
        } else {
          console.log("Returned with move.");
          nextMove = moveOption;
          pathFound = true;
          console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
        }
      }
    }

    // Chase self survival mode
    if (foodMoves.length <= 1 && pathFound === false) {
      console.log("Entered chaseSelfMode");
      // snakes[0] is always me
      const snake = request.body.board.snakes[0].body;
      let index = 1;

      while (pathFound === false) {
        chaseSelfMove = snake[snake.length - index];
        console.log(`chaseSelfMove: ${chaseSelfMove.x}, ${chaseSelfMove.y}`);

        // Change move temporarily to an playable tile
        changeTile(playingBoard, chaseSelfMove);
        let moveOption = runEasyStar(mySnakeHead, chaseSelfMove);
        // Change back to unplayable tile
        changeTile(playingBoard, chaseSelfMove);

        if (Object.entries(moveOption).length === 0) {
          console.log("LOOP: Could not find path, trying next body part.");
          index++;
        } else {
          console.log("Returned with move.");
          nextMove = moveOption;
          pathFound = true;
          console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
        }
      }
    }

    console.log("Exited loop and returned a move");
    return nextMove;
  }

  // function checkAvailableSpace(playingBoard, closestFoodMove) {
  //   // Determine size of grid to check
  //   // if head is above food, row starts at food and vice versa
  //   // if head to the right of food, column starts at food and vice versa
  //   // Start from bottom-left corner of matrix
  //   // Store count of 0's in the matrix
  //   //
  //   // while col < gridWidth
  //   // while (mat[row][col] > 0)
  //   // if zero is not found in current column,
  //   // we are done
  //   // if (--row < 0)
  //   // 	return count;
  //   // add 0s present in current column to result
  //   // 	count += (row + 1);
  //   // 	// move right to next column
  //   // 	col++;
  //   // return count;
  // }

  function changeTile(board, coordinates) {
    console.log("Entered changeTile");
    if (board[coordinates.y][coordinates.x] === 1) {
      board[coordinates.y][coordinates.x] = 0;
      console.log(`Swapped x:${coordinates.x} y:${coordinates.y} to 0`);
    } else {
      board[coordinates.y][coordinates.x] = 1;
      console.log(`Swapped x:${coordinates.x} y:${coordinates.y} to 1`);
    }
  }

  function runEasyStar(startingPoint, destination) {
    let viableMove = {};

    easystar.findPath(startingPoint.x, startingPoint.y, destination.x, destination.y, function(
      path
    ) {
      if (path === null) {
        console.log("Path not found, returned empty object");
      } else {
        viableMove = path[1];
        console.log(`Found path at ${viableMove.x}, ${viableMove.y}`);
      }
    });
    easystar.calculate();

    return viableMove;
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
  console.table(playingBoard);

  const easystar = new easystarjs.js();
  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  easystar.enableSync(); // required to work

  // TODO: Place this into a move function
  console.log("3. Selecting move");
  const theMove = selectMove(findClosestFood, findFoodDistances, runEasyStar, changeTile);
  //checkAdjacentTiles

  // TODO: Have it pick up down left right based on the coordinate itself, should always be one away from snake head

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
