export interface Card {
    suit: CardSuit;
    rank: CardRankImpl;
}

export interface CardSuit {
    letter: string;
    symbol: string;
    word: string;
}

export enum CardSuitValue {
    CLUBS,
    DIAMONDS,
    SPADES,
    HEARTS
}

export interface CardRankImpl {
    symbol: string;
    longWord: string;
    values: number[];
    pairSymbol: string;
}

export interface Hand {
    cards: Card[];
}
