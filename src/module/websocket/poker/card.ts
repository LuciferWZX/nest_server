import { PokerIndex, PokerSign } from './type';

export class Card {
  sign: PokerSign;
  index: PokerIndex;
  show: boolean;
  constructor(sign: PokerSign, index: PokerIndex, show = false) {
    this.sign = sign;
    this.index = index;
    this.show = show;
  }
}
