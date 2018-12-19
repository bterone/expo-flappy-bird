import React from "react";
import { StyleSheet, View } from "react-native";
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
    const pipe = 
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
    await this.setupPlayer();
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

  updateGame = delta => {
    if (this.gameStarted) {
      // To be continued
    } else {
      this.player.update(delta);
      this.player.y = 8 * Math.cos(Date.now() / 200);
      this.player.angle = 0
    }
  };

  tap = () => {
    // Tapping to start the game
    if (!this.gameStarted) {
        this.gameStarted = true;
        // 2
        this.pillarInterval = setInterval(this.spawnPipes, SPAWN_RATE);
    }
  }

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
      </View>
    );
  }
}
