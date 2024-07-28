import { BlackjackAction } from "../types/Action";
import { DealerHandClassification, PlayerHandClassification } from "../types/HandClassification";

export function getPreferredAction(
    phc: PlayerHandClassification,
    dhc: DealerHandClassification
): BlackjackAction {

    // Player has a total of 8
    if (
        phc >= PlayerHandClassification.FIVE && 
        phc <= PlayerHandClassification.EIGHT
    ) return BlackjackAction.HIT;

    // Player has a total of 9
    else if (phc === PlayerHandClassification.NINE) return (
        dhc >= DealerHandClassification.THREE && 
        dhc <= DealerHandClassification.SIX ?
        BlackjackAction.DOUBLE : BlackjackAction.HIT
    )

    // Player has a total of 10
    else if (phc === PlayerHandClassification.TEN) return (
        dhc <= DealerHandClassification.NINE ? BlackjackAction.DOUBLE : BlackjackAction.HIT
    );

    // Player has a total of 11
    else if (phc === PlayerHandClassification.ELEVEN) return (
        dhc <= DealerHandClassification.TEN ? BlackjackAction.DOUBLE : BlackjackAction.HIT

    )
    return BlackjackAction.STAND;
}
