// Where the rules' board sits in the 3D world. One cell is 2 m. The board runs from x = -15 to +15, west
// to east; the rows run north (the leaves, z = -12) to south (the sidewalk, z = +12), so the camera looks
// north across the lanes. Heights are in metres above the road.
import { CELL, COLS } from './game.mjs';

export const M = 2 / CELL; // metres per rules unit
export const CW = 2; // one cell, in metres
export const HALF = COLS; // the board's half width, in metres
export const wx = (u) => u * M - HALF; // rules x to world x
export const wz = (row) => (row - 6) * CW; // the middle of a row
export const ROAD_Y = 0, WALK_Y = 0.16, ISLAND_Y = 0.22, WATER_Y = -0.62, BANK_Y = 0.08;
