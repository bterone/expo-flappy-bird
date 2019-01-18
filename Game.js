import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Files from "./Files";
import * as THREE from "three"; // 0.88.0
import Expo from "expo";
import { Group, Node, Sprite, SpriteView } from "./GameKit";

const SPEED = 1.6;
const GRAVITY = 1100;
const FLAP = 320;
const SPAWN_RATE = 2600;
const OPENING = 120;
const GROUND_HEIGHT = 64;

export default class Game extends React.Component {
 
  componentWillMount() {
  }

  // Parent Node for all pipe nodes
  pipes = new Group();
  
  // Holds all pipes that moved off screen for recycling
  deadPipeTops = [];
  deadPipeBottoms = [];

  // Seeing if we should spawn a pipe or recycle
  setupPipe = async ({ key, y }) => {
    const size = {
      width: 52,
      height: 320,
    };
  
    // Defining the dictionary for the images
    const tbs = {
      top: Files.sprites.pipe_top,
      bottom: Files.sprites.pipe_bottom,
    };
    const pipe = await this.setupStaticNode({
      image: tbs[key],
      size,
      name: key,
    });

    // Giving a pipe a reference to size
    pipe.size = size;
    pipe.y = y;
  
    return pipe;
  }

  spawnPipe = async (openPos, flipped) => {

    // Getting random positions for pipes
    let pipeY;
    if (flipped) {
      pipeY = Math.floor(openPos - OPENING / 2 - 320);
    } else {
      pipeY = Math.floor(openPos + OPENING / 2);
    }

    // Determining whether pipe is top or bottom based on input variable
    let pipeKey = flipped ? 'bottom' : 'top';
    let pipe;

    // Setting the initial position of the pipe off screen
    const end = this.scene.bounds.right + 26;

    // Checking dead pipes for repositoning
    if (this.deadPipeTops.length > 0 && pipeKey === 'top') {
      pipe = this.deadPipeTops.pop().revive();
      pipe.reset(end, pipeY);
    } else if (this.deadPipeBottoms.length > 0 && pipeKey === 'bottom') {
      pipe = this.deadPipeBottoms.pop().revive();
      pipe.reset(end, pipeY);
    } else {

      // If there aren't any dead pipes, create new ones
      pipe = await this.setupPipe({
        y: pipeY,
        key: pipeKey,
      });
      pipe.x = end;
      this.pipes.add(pipe);
    }
    // Set the pipes velocity so it knows how fast to go
    pipe.velocity = -SPEED;
    return pipe;
  }

  // Chooses a random position for pipes and spawn them at the right off screen
  spawnPipes = () => {
    // Flags each off screen pipe as dead for recycling
    this.pipes.forEachAlive(pipe => {
      if (pipe.size && pipe.x + pipe.width < this.scene.bounds.left) {
        if (pipe.name === 'top') {
          this.deadPipeTops.push(pipe.kill());
        }
        if (pipe.name === 'bottom') {
          this.deadPipeBottoms.push(pipe.kill());
        }
      }
    })

    // Gives a random spot for the center between two pipes
    const pipeY = 
      this.scene.size.height / 2 +
      (Math.random() - 0.5) * this.scene.size.height * 0.2;

    this.spawnPipe(pipeY);
    this.spawnPipe(pipeY, true);
  };

  onSetup = async ({ scene }) => {
    // Give us global reference to the scene
    // Then the scene can be called by any other function
    this.scene = scene;
    this.scene.add(this.pipes);
    await this.setupBackground();
    await this.setupGround();
    await this.setupPlayer();
    this.reset();
  };

  setupBackground = async () => {
    // Getting a reference to screen and screen size
    const { scene } = this;
    const { size } = scene;

    // Passes the background image and name for referencing
    const bg = await this.setupStaticNode({
      image: Files.sprites.bg,
      size,
      name: 'bg',
    });

    // Adds background to scene
    scene.add(bg);
  };

  setupGround = async () => {
    const { scene } = this;
    const size = {
      width: scene.size.width,
      height: scene.size.width * 0.333333333
    };
    this.groundNode = new Group();

    // Looping the ground as they go off screen using two copies
    const node = await this.setupStaticNode({
      image: Files.sprites.ground,
      size,
      name: "ground"
    });

    const nodeB = await this.setupStaticNode({
      image: Files.sprites.ground,
      size,
      name: "ground"
    });
    nodeB.x = size.width; // adds x to nodeB with the screen's width???

    this.groundNode.add(node);
    this.groundNode.add(nodeB);

    // Setting the groundNode group's location to appear at the bottom of the screen
    this.groundNode.position.y =
    (scene.size.height + (size.height - GROUND_HEIGHT)) * -0.5;

    // Save a reference to the top of the ground for collision purposes
    this.groundNode.top = this.groundNode.position.y + size.height / 2;

    // Moving the ground on the z-axis so it appears on top of pipes
    this.groundNode.position.z = 0.01;
    scene.add(this.groundNode);
  };

  setupPlayer = async () => {
    // Create the player display size
    // Under the sprites/bird.png, there are 3 tiles. Display size is divided by 3 (108/3)
    const size = {
      width: 36,
      height: 26,
    };

    /* Creates a sprite with animation
       tilesHoriz: How many tiles across (3)
       tilesVert: Tiles vertical (1)
       numTiles: Total tiles (3)
       tilesDispDuration: Display duration
       Size defined previously */
    const sprite = new Sprite();
    await sprite.setup({
      image: Files.sprites.bird,
      tilesHoriz: 3,
      tilesVert: 1,
      numTiles: 3,
      tileDispDuration: 75,
      size
    });

    this.player = new Node({
      sprite
    });
    this.scene.add(this.player);
  }

  // Helper function that creates a static node containing the sprite
  setupStaticNode = async ({ image, size, name }) => {
    // Creates a new Sprite and sets image and size
    const sprite = new Sprite();

    await sprite.setup({
      image,
      size,
    });

    // Initializes a node with the Sprite and gives it a reference
    const node = new Node({
      sprite,
    });
    node.name = name;

    return node;
  };

  gameStarted = false;

  setGameOver = () => {
    // Toggles gameover to true and stops pipes from spawning
    this.gameOver = true;
    clearInterval(this.pillarInterval);
  }

  updateGame = delta => {
    if (this.gameStarted) {

      // Adding delta * GRAVITY to velocity
      this.velocity -= GRAVITY * delta;

      const target = this.groundNode.top;

      if (!this.gameOver) {

        // Creates the collision box for bird
        const playerBox = new THREE.Box3().setFromObject(this.player);

        // Iterates over all pipes and moves them left
        this.pipes.forEachAlive(pipe => {

          // Creates the collision box for pipes
          const pipeBox = new THREE.Box3().setFromObject(pipe);

          // Checks if user has collided with any pipes
          if (pipeBox.intersectsBox(playerBox)) {
            this.setGameOver();
          }

          pipe.x += pipe.velocity;

          // If user passed pipe, it adds to score
          if (
              pipe.name === "bottom" &&
              !pipe.passed &&
              pipe.x < this.player.x
              ) {
              pipe.passed = true;
              this.addScore();
          }
        });

        // Only moves the floor when the player is alive
        this.groundNode.children.map((node, index) => {

          // Moving the floor at the same speed as the rest of the world
          node.x -= SPEED;
          
          // If the child ground node is off screen then use the next child ground node to show on screen
          if (node.x < this.scene.size.width * -1) {
            let nextIndex = index + 1;
            if (nextIndex === this.groundNode.children.length) {
              nextIndex = 0;
            }
            const nextNode = this.groundNode.children[nextIndex];

            // Get the position of the last node and move the current node behind it
            node.x = nextNode.x + this.scene.size.width - 1.55;
          }
        });

        // Causes gameover if bird is lower or at the floor
        if (this.player.y <= target) {
          this.setGameOver();
        }
      }// End of if NOT GAMEOVER;

      // Adjusts the bird's rotation in radians
      this.player.angle = Math.min(
        Math.PI / 4,
        Math.max(-Math.PI / 2, (FLAP + this.velocity) / FLAP)
      );

      // Adds an instance of bird flapping animation during play
      this.player.update(delta);

      // Applies velocity to bird
      this.player.y += this.velocity * delta;

      // During a gameover, bird continues to fall to the floor
      if (this.player.y <= target) {
        this.player.angle = -Math.PI / 2;
        this.player.y = target;
        this.velocity = 0;
      }

    } else {
      this.player.update(delta);
      this.player.y = 8 * Math.cos(Date.now() / 200);
      this.player.angle = 0
    }// End of if GAME STARTED else
  };

  // Resets the game back to its initial state
  reset = () => {
    this.gameStarted = false;
    this.gameOver = false;
    this.setState({ score: 0});

    this.player.reset(this.scene.size.width * -0.3, 0);
    this.player.angle = 0;
    this.pipes.removeAll();
  };

  velocity = 0;

  tap = () => {
    // Tapping to start the game
    if (!this.gameStarted) {
      this.gameStarted = true;
      // Building a timer to spawn pipes
      this.pillarInterval = setInterval(this.spawnPipes, SPAWN_RATE);
    }
    
    if (!this.gameOver) {
      // If the game is not over, the player's velocity is set to the constant
      this.velocity = FLAP;
    } else {
      // At game end, it resets
      this.reset();
    }
  }

  state = {
    score: 0
  };

  addScore = () => {
    this.setState({ score: this.state.score + 1});
    console.log(this.state.score);
  };

  renderScore = () => {
    <Text
        style={{
          textAlign: "center",
          fontSize: 64,
          position: "absolute",
          left: 0,
          right: 0,
          color: "white",
          top: 64,
          backgroundColor: "transparent"
        }}>
        {this.state.score}
        </Text>
  };

  render() {
    //@(Evan Bacon) This is a dope SpriteView based on SpriteKit that surfaces touches, render, and setup!
    return (
      <View style={StyleSheet.absoluteFill}>
        <SpriteView
          touchDown={({ x, y }) => this.tap()}
          touchMoved={({ x, y }) => {}}
          touchUp={({ x, y }) => {}}
          update={this.updateGame}
          onSetup={this.onSetup}
        />
        {this.renderScore()}
      </View>
    );
  }
}
