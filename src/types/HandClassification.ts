export interface PlayerHandClassificationEntry {
    values: number[];
    label: string;
}

export enum PlayerHandClassification {
    FIVE = "5",
    SIX = "6",
    SEVEN = "7",
    EIGHT = "8",
    NINE = "9",
    TEN = "10",
    ELEVEN = "11",
    TWELVE = "12",
    THIRTEEN = "13",
    FOURTEEN = "14",
    FIFTEEN = "15",
    SIXTEEN = "16",
    SEVENTEEN = "17",
    EIGHTEEN = "18",
    NINETEEN = "19",
    ACE_TWO = "A2",
    ACE_THREE = "A3",
    ACE_FOUR = "A4",
    ACE_FIVE = "A5",
    ACE_SIX = "A6",
    ACE_SEVEN = "A7",
    ACE_EIGHT = "A8",
    ACE_NINE = "A9",
    TWOS_PAIR = "22",
    THREES_PAIR = "33",
    FOURS_PAIR = "44",
    FIVES_PAIR = "55",
    SIXES_PAIR = "66",
    SEVENS_PAIR = "77",
    EIGHTS_PAIR = "88",
    NINES_PAIR = "99",
    TENS_PAIR = "TT",
    ACES_PAIR = "AA"
}

export enum DealerHandClassification {
    TWO = "2",
    THREE = "3",
    FOUR = "4",
    FIVE = "5",
    SIX = "6",
    SEVEN = "7",
    EIGHT = "8",
    NINE = "9",
    TEN = "T",
    ACE = "A"
}

export enum HandType {
    HARD = "Hard",
    SOFT = "Soft",
    PAIR = "Pair"
}

export interface HandClassification {
    type: HandType;
    value: number;
    symbol: string;
}

// I think this^ covers everything?
// ex. "soft 16", "pair of Ts", "hard 13"
// sometimes it won't matter, ex. distinction between
// "soft" and "hard" 21