import { cloneObj } from "./helpers";
import getText from "../../data/world/text";
import seedrandom from 'seedrandom';
import { getRandomInt, shuffleArray } from "./math";

export default class Battle {
  constructor(battleResult) {
    console.log('in battle constructor');
    this.battleResult = cloneObj(battleResult);
    this.kartIDs = [this.battleResult.home_token_id, this.battleResult.away_token_id];
    this.kartNames = [this.kartName(this.battleResult.metadata[0].title), this.kartName(this.battleResult.metadata[1].title)];
    this.kartImages = [this.battleResult.metadata[0].media, this.battleResult.metadata[1].media]
    this.karts = [this.battleResult.karts[0], this.battleResult.karts[1]];
    this.winnerName = this.kartNames[this.battleResult.winner];
    this.finished = false;
    this.rounds = [];
    this.roundIndex = 0;
    console.log('in battle constructor 2');
    this._initWeapons();
    console.log('in battle constructor 3');
    this.generate();
    console.log('in battle constructor 4');
  }

  _initWeapons() {
    console.log('in init weapons')
    let weapons = [[], []];
    let shields = [[], []];

    for(let i = 0; i < 2; i++) {
      let kartConfig = this.battleResult.kartConfigs[i];

      for(let part of ['left', 'right', 'front']) {
        if(kartConfig[part] && !kartConfig[part].endsWith('Empty')) {
          if(kartConfig[part].startsWith('Weapon')) {
            weapons[i].push(kartConfig[part].replace('Weapon', '').toLowerCase());
          }
          else if(kartConfig[part].startsWith('Shield')) {
            shields[i].push(kartConfig[part].replace('Shield', '').toLowerCase());
          }
        }
      }
    }

    this.kartWeapons = weapons;
    this.kartShields = shields;
  }

  kartName(kartTitle) {
    return kartTitle.replace('A NEAR Kart Called ', '');
  }

  generate() {
    console.log('in generate');
    this.rng = seedrandom(this.battleResult.battle.toString());

    this.rounds = [];
    let winner = this.battleResult.winner;
    let loser = 1 - winner;

    let score1 = 0;
    let roundScores1 = [];
    let score2= 0;
    let roundScores2 = [];

    let roundIndex = 0;

    do {
      let roundScore = 0;
      let miss1 = getRandomInt(0, 6, this.rng) === 0;

      if(!miss1) {
        roundScore = getRandomInt(10, 25, this.rng);
        score1 += roundScore;
      }

      roundScores1[roundIndex++] = { aggressor: winner, score: roundScore };

    } while(score1 < 100);

    roundIndex = 0;
    do {
      let roundScore = 0;
      let miss1 = getRandomInt(0, 6, this.rng) === 0;

      if(!miss1) {
        roundScore = getRandomInt(10, 25, this.rng);
        score2 += roundScore;
      }

      roundScores2[roundIndex++] = { aggressor: loser, score: roundScore }; 

    } while(score2 < 100);

    roundScores2.pop();

    let winningRound = roundScores1.pop();

    let rounds = [...roundScores1, ...roundScores2];
    shuffleArray(rounds, this.rng);
    rounds.push(winningRound);

    console.log('rounds', rounds);

    let playIndex = 0;
    let totals = [0, 0];

    for(let round of rounds) {
      let text = '';

      totals[round.aggressor] += round.score;
      round.totals = [...totals];

      if(++playIndex === rounds.length) {
        text = getText('text_battle_battle_won').replace('{winner}', this.winnerName);
      }
      else {
        text = '';
      }

      text += ' ' + JSON.stringify(round);
      this.rounds.push({ text, data: round });
    }

    let line = getText('text_battle_battle_won').replace('{winner}', this.winnerName);
    this.rounds.push(line);
  }

  next() {
    let round = this.rounds[this.roundIndex];
    console.log('next round', round);

    if(++this.roundIndex >= this.rounds.length) {
      this.finished = true;
    }

    return round;
  }

  ended() {
    this.finished = true;
  }
}

