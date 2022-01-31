import { cloneObj } from "./helpers";
import getText from "../../data/world/text";

export default class Battle {
  constructor(battleResult) {
    this.battleResult = cloneObj(battleResult);
    this.kartIDs = [this.battleResult.home_token_id, this.battleResult.away_token_id];
    this.kartNames = [this.kartName(this.battleResult.metadata[0].title), this.kartName(this.battleResult.metadata[1].title)];
    this.kartImages = [this.battleResult.metadata[0].media, this.battleResult.metadata[1].media]
    this.karts = [this.battleResult.karts[0], this.battleResult.karts[1]];
    this.winnerName = this.kartNames[this.battleResult.winner];
    this.finished = false;
    this.text = [];
    this.textIndex = 0;
    this.generate();
  }

  kartName(kartTitle) {
    return kartTitle.replace('A NEAR Kart Called ', '');
  }

  generate() {
    let line = getText('text_battle_battle_won').replace('{winner}', this.winnerName);
    this.text.push(line);
  }

  next() {
    let text = this.text[this.textIndex];

    if(++this.textIndex >= this.text.length) {
      this.finished = true;
    }

    return text;
  }

  ended() {
    this.finished = true;
  }
}

