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
  // Default move
  const data = {
    move: "up"
  };

  // Necessary until I place move into a function, currently "global"
  const mySnakeHead = request.body.you.body[0];

  // Draw the board, draw unplayable tiles
  function createPlayingBoard(createMySnake, createOpponents, createSnakeHeads) {
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    const board = Array(boardHeight)
      .fill()
      .map(() => Array(boardWidth).fill(0));

    const mySnake = request.body.you.body;
    const mySnakeBody = mySnake.splice(1);
    const mySnakeName = request.body.you.name;
    const myOpponentSnakes = request.body.board.snakes;

    console.log("Creating My Snake");
    createMySnake(mySnakeBody, board);
    console.log("Creating Opponent Snakes");
    createOpponents(myOpponentSnakes, board);
    console.log("Marking Larger Snakes");
    createSnakeHeads(myOpponentSnakes, mySnakeBody, mySnakeName, boardHeight, boardWidth, board);

    return board;
  }

  // TODO: Test to see if this is redundant
  function drawMySnake(mySnakeBody, board) {
    mySnakeBody.forEach(element => {
      board[element.y][element.x] = 1;
    });
  }

  // TODO: Rename to just draw snake if drawMySnake() isn't necessary
  function drawOpponents(opponentSnakeBodies, board) {
    opponentSnakeBodies.forEach(snakes => {
      snakes.body.forEach(element => {
        board[element.y][element.x] = 1;
      });
    });
  }

  // If other snake is >= mySnake puts 1's around it's head
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

  // Creates an array of possible targets based on move distance away from snakehead
  function findDistances(mySnakeHead, targets) {
    console.log("5. Entered findDistances()");
    const distancesArray = [];

    for (let i = 0; i < targets.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - targets[i].x) + Math.abs(mySnakeHead.y - targets[i].y);
      distancesArray.push(moveDistance);
    }
    console.log(`6. Outputted array with (${distancesArray.length}) total moves`);

    return distancesArray;
  }

  function findSnakeHeadDistances(mySnakeHead, theSnakes) {
    console.log("5. Entered findSnakeHeadDistances()");
    const distancesArray = [];

    for (let i = 0; i < theSnakes.length; i++) {
      let moveDistance =
        Math.abs(mySnakeHead.x - theSnakes[i].body[0].x) +
        Math.abs(mySnakeHead.y - theSnakes[i].body[0].y);
      distancesArray.push(moveDistance);
      console.log(`Snake head at: ${theSnakes[i].body[0].x}, ${theSnakes[i].body[0].y}`);
    }
    console.log(`6. Outputted array with (${distancesArray.length}) total moves`);

    return distancesArray;
  }

  // Passed the array of food moves, returns the index of the closet or next closest move
  function findClosestFood(foodArray, futureCheck = false) {
    console.log("9. Entered findClosestFood()");
    let index;

    // if futureCheck, return the second closest food move
    if (futureCheck) {
      console.log("futureCheck was true");
      let currentClosest = Math.min(...foodArray);
      let nextClosest = Math.max(...foodArray);

      // If they happen to be the same, choose the second one
      if (currentClosest === nextClosest) {
        index = foodArray.lastIndexOf(Math.max(...foodArray));
        // else find the second closest
      } else {
        for (let i = 0; i < foodArray.length; i++) {
          if (foodArray[i] > currentClosest && foodArray[i] <= nextClosest) {
            nextClosest = foodArray[i];
          }
        }
        index = foodArray.indexOf(nextClosest);
      }
      console.log(`Outputted the element at index (${index}) as next closest option.`);
      // If in outer loop just return closest
    } else {
      index = foodArray.indexOf(Math.min(...foodArray));
      console.log(`10. Outputted the element at index (${index}) as closest option.`);
    }
    return index;
  }

  /*
  1. Create an array of food move distances
  2. Find the closest food available and run Easystar.js
  3. If Easystar cannot find a path, remove that option from the array and try the next closest.
  4. If Easystar finds a viable move, check to see if there is a path from that food to another piece of food
  5. If no future moves can be found, enter a temporary "Survival Mode" 
  6. First, chase tail. Second, chase a reachable part of the body. Last, just move to an available tile.
  */
  function selectMove(calculateClosest, moveDistances, runEasyStar) {
    let nextMove = {};
    let pathFound = false;
    const currentTurn = request.body.turn;
    const mySnakeHead = request.body.you.body[0];
    const mySnakeName = request.body.you.name;
    const theSnakes = request.body.board.snakes;
    const foodLocations = request.body.board.food;

    // Used for chase tail mode, finds index of my snake
    let mySnakeBody;
    for (let i = 0; i < theSnakes.length; i++) {
      if (theSnakes[i].name == mySnakeName) {
        mySnakeBody = theSnakes[i].body;
      }
    }

    // Create parallel arrays: 1.Food Distances 2.Indexes of food objects
    const foodMoves = moveDistances(mySnakeHead, foodLocations);
    const foodMovesIndexes = [];

    for (let i = 0; i < foodMoves.length; i++) {
      foodMovesIndexes.push(i);
    }

    console.log(`7. Returned back to selectMove with distances array: (${foodMoves})`);

    // For first X turns just go for food regularly
    while (currentTurn < 5 && foodMoves.length > 0 && pathFound === false) {
      console.log("8. Entering food decision loop.");
      const indexOfClosest = calculateClosest(foodMoves);
      const closestFood = request.body.board.food[foodMovesIndexes[indexOfClosest]];

      let moveOption = runEasyStar(mySnakeHead, closestFood);

      // If move object returns empty, remove that option from food array
      if (Object.entries(moveOption).length == 0) {
        console.log("LOOP: Could not find path to closest food. Trying next closest.");
        foodMoves.splice(indexOfClosest, 1);
        foodMovesIndexes.splice(indexOfClosest, 1);
        console.log(`LOOP: Length of food array is now: (${foodMoves.length})`);
      } else {
        nextMove = moveOption;
        pathFound = true;
        console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
      }
    }

    // First, choose the closest food and see if there is a viable path
    while (pathFound === false && foodMoves.length > 1) {
      console.log("8. Entering food decision loop.");
      const indexOfClosest = calculateClosest(foodMoves);
      const closestFood = request.body.board.food[foodMovesIndexes[indexOfClosest]];

      let moveOption = runEasyStar(mySnakeHead, closestFood);

      // If move object returns empty, remove that option from array
      if (Object.entries(moveOption).length == 0) {
        console.log("OUTER LOOP: Could not find path to closest food. Trying next closest.");
        foodMoves.splice(indexOfClosest, 1);
        foodMovesIndexes.splice(indexOfClosest, 1);
        console.log(`OUTER LOOP: Length of food array is now: (${foodMoves.length})`);
      } else {
        // If there is a path to the closest food, see if there is a move to future food
        // First create copies of food arrays
        let foodMovesCopy = foodMoves;
        let foodMovesIndexesCopy = foodMovesIndexes;

        while (pathFound === false && foodMovesCopy.length > 1) {
          console.log("INNER LOOP: Entered futureMove check");
          console.log(`INNER LOOP: Current distances array: (${foodMovesCopy}), created copy`);
          // Getting coordinates of next closest food, futureCheck == true
          const indexOfNextClosest = calculateClosest(foodMovesCopy, true);
          const nextClosestFood = request.body.board.food[foodMovesIndexesCopy[indexOfNextClosest]];

          // Check to see if there's a path from closest food to next closest food
          console.log(
            `INNER LOOP: Running easyStar with closest x:${closestFood.x} y:${closestFood.y} and nextClosest: x:${nextClosestFood.x} y:${nextClosestFood.y}`
          );

          // Change move temporarily to an playable tile to make sure it doesn't cut us off
          changeTile(playingBoard, moveOption);
          let futureMove = runEasyStar(closestFood, nextClosestFood);
          // Change back
          changeTile(playingBoard, moveOption);
          console.log("INNER LOOP: Returned from futureMove");

          // If move object returns empty, remove next closest option from array
          if (Object.entries(futureMove).length == 0) {
            console.log("INNER LOOP: Could not find path from foodMove to futureFood");
            foodMovesCopy.splice(indexOfNextClosest, 1);
            foodMovesIndexesCopy.splice(indexOfNextClosest, 1);
            console.log(`INNER LOOP: Length of food array is now: (${foodMovesCopy.length})`);
          } else {
            nextMove = moveOption;
            pathFound = true;
            console.log(`INNER LOOP: Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
          }

          // If no future moves are available, remove original food move and reenter outer loop
          if (foodMovesCopy.length == 1) {
            console.log(
              "INNER LOOP: No viable moves from closest to next closest, removing that option from foodMoves"
            );
            foodMoves.splice(indexOfClosest, 1);
            foodMovesIndexes.splice(indexOfClosest, 1);
          }
        }
      }
    }

    // Chase self survival mode. Chase tail, if that isn't pathable, move up body until one is.
    if (currentTurn >= 5 && foodMoves.length <= 1) {
      nextMove = chaseSelfMode(mySnakeBody, playingBoard, currentTurn);
      console.log(nextMove);
    }

    // Test for future function to deal with undefined moves
    if (typeof nextMove.x === "undefined") {
      console.log("Move was undefined, trying to remove larger snake heads");
      const closestSnakes = findSnakeHeadDistances(mySnakeHead, theSnakes);
      console.log(`Returned with array: ${closestSnakes}`);

      revertLargerSnakeHead(closestSnakes, theSnakes, playingBoard);
      console.table(playingBoard);
      console.log("Rerunning chaseSelfMode");
      nextMove = chaseSelfMode(mySnakeBody, playingBoard, currentTurn);
    }

    console.log("Exited loops and returned a move");
    return nextMove;
  }

  // Chase self survival mode. Chase tail, if that isn't pathable, move up body until one is.
  // Eventually call changeTile, runEasyStar and willTheNextMoveKillMe as callbacks
  function chaseSelfMode(mySnakeBody, board, currentTurn) {
    console.log("Entered chaseSelfMode ()");
    let moveOption;
    let nextMove;
    let pathFound = false;
    let index = 1;
    let chaseSelfMove;

    while (pathFound === false && chaseSelfMove != mySnakeBody[0]) {
      chaseSelfMove = mySnakeBody[mySnakeBody.length - index];
      console.log(`chaseSelfMove: ${chaseSelfMove.x}, ${chaseSelfMove.y}`);

      // Change move temporarily to an playable tile
      changeTile(board, chaseSelfMove);
      moveOption = runEasyStar(mySnakeHead, chaseSelfMove);
      // Change back to unplayable tile
      changeTile(board, chaseSelfMove);

      // If move object is empty, move up one body part
      if (Object.entries(moveOption).length == 0) {
        console.log("LOOP: Could not find path, trying next furthest body part.");
        index++;
      } else {
        // If it returns with move, check to see if it might kill me
        console.log("Checking if next move will kill me");
        let mightDie = willTheNextMoveKillMe(moveOption, board);
        console.log(`Will the next move kill me...survey says: ${mightDie}!`);

        // if true, see if it's my tail and if it isn't move somewhere else
        if (mightDie) {
          console.log("I AM DEAD SNAKE?");
          let thisIsMyTail = jsonEqual(moveOption, mySnakeBody[mySnakeBody.length - 1]);

          if (!thisIsMyTail) {
            //TODO: first try an index++??
            console.log(`What do we say to the god of Death, not turn ${currentTurn}!`);
            nextMove = stayingAlive(board);
          } else {
            nextMove = moveOption;
          }
        } else {
          nextMove = moveOption;
        }
        pathFound = true;
        console.log(`Path found, returning nextMove: ${nextMove.x}, ${nextMove.y}`);
      }
    }
    return nextMove;
  }

  // Return boolean if next move is going to kill me
  function willTheNextMoveKillMe(moveOption, board) {
    return board[moveOption.y][moveOption.x] == 1;
  }

  // Returns boolean if objects have same properties
  function jsonEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Find an available tile
  function stayingAlive(board) {
    console.log("Ah, ha, ha, ha, stayin' alive, stayin' alive!");
    let panicMove = {};
    const mySnakeHead = request.body.you.body[0];
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    // Try to always move left first, if not cycle through other move directions
    if (board[mySnakeHead.y][mySnakeHead.x - 1] != 1 && mySnakeHead.x - 1 >= 0) {
      panicMove = { x: mySnakeHead.x - 1, y: mySnakeHead.y };
      // Up
    } else if (board[mySnakeHead.y - 1][mySnakeHead.x] != 1 && mySnakeHead.y - 1 >= 0) {
      panicMove = { x: mySnakeHead.x, y: mySnakeHead.y - 1 };
      // Right
    } else if (board[mySnakeHead.y][mySnakeHead.x + 1] != 1 && mySnakeHead.x + 1 < boardWidth) {
      panicMove = { x: mySnakeHead.x + 1, y: mySnakeHead.y };
      // Down
    } else if (board[mySnakeHead.y + 1][mySnakeHead.x] != 1 && mySnakeHead.y + 1 < boardHeight) {
      panicMove = { x: mySnakeHead.x, y: mySnakeHead.y + 1 };
    }

    return panicMove;
  }

  // Dynamically swap tiles playable/unplayable
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

  // If move returns undefined, temporarily return closest snake heads to normal
  function revertLargerSnakeHead(snakeHeadArray, theSnakes, board) {
    console.log("Reverting closest snake head temporarily");
    const boardHeight = request.body.board.height;
    const boardWidth = request.body.board.width;

    // TODO: If food is one tile away, leave that unplayable
    for (let i = 0; i < snakeHeadArray.length; i++) {
      if (snakeHeadArray[i] == 2) {
        // down
        if (
          theSnakes[i].body[0].y + 1 < boardHeight &&
          theSnakes[i].body[0].y + 1 != theSnakes[i].body[1].y
        ) {
          board[theSnakes[i].body[0].y + 1][theSnakes[i].body[0].x] = 0;
        }
        // up
        if (
          theSnakes[i].body[0].y - 1 >= 0 &&
          theSnakes[i].body[0].y - 1 != theSnakes[i].body[1].y
        ) {
          board[theSnakes[i].body[0].y - 1][theSnakes[i].body[0].x] = 0;
        }
        // right
        if (
          theSnakes[i].body[0].x + 1 < boardWidth &&
          theSnakes[i].body[0].x + 1 != theSnakes[i].body[1].x
        ) {
          board[theSnakes[i].body[0].y][theSnakes[i].body[0].x + 1] = 0;
        }
        // left
        if (
          theSnakes[i].body[0].x - 1 >= 0 &&
          theSnakes[i].body[0].x - 1 != theSnakes[i].body[1].x
        ) {
          board[theSnakes[i].body[0].y][theSnakes[i].body[0].x - 1] = 0;
        }
      }
    }
  }

  // Runs the easyStar algorithm, returns a viable next move or an empty object
  function runEasyStar(startingPoint, destination) {
    let viableMove = {};
    console.log("Entered easyStar");
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
  const playingBoard = createPlayingBoard(drawMySnake, drawOpponents, drawLargerSnakeHeads);
  console.log("1. Board Created");

  const easystar = new easystarjs.js();
  easystar.setGrid(playingBoard);
  easystar.setAcceptableTiles([0]);
  easystar.enableSync(); // required to work
  console.log("2. Initialized easyStar");

  // TODO: Place this into a move function
  console.log("3. Selecting move");
  const theMove = selectMove(findClosestFood, findDistances, runEasyStar, changeTile);

  // Returns move to response
  console.log(`Move Selected: ${theMove.x}, ${theMove.y}`);
  if (mySnakeHead.y - 1 == theMove.y) {
    data.move = "up";
    console.log("Chose Up");
  } else if (mySnakeHead.y + 1 == theMove.y) {
    data.move = "down";
    console.log("Chose Down");
  } else if (mySnakeHead.x - 1 == theMove.x) {
    data.move = "left";
    console.log("Chose Left");
  } else if (mySnakeHead.x + 1 == theMove.x) {
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
