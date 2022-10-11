export function torgBonus(rollTotal) {
    let bonus;
    if (rollTotal == 1) {
        bonus = -10
    } else if (rollTotal == 2) {
        bonus = -8
    } else if (rollTotal <= 4) {
        bonus = -6
    } else if (rollTotal <= 6) {
        bonus = -4
    } else if (rollTotal <= 8) {
        bonus = -2
    } else if (rollTotal <= 10) {
        bonus = -1
    } else if (rollTotal <= 12) {
        bonus = 0
    } else if (rollTotal <= 14) {
        bonus = 1
    } else if (rollTotal == 15) {
        bonus = 2
    } else if (rollTotal == 16) {
        bonus = 3
    } else if (rollTotal == 17) {
        bonus = 4
    } else if (rollTotal == 18) {
        bonus = 5
    } else if (rollTotal == 19) {
        bonus = 6
    } else if (rollTotal == 20) {
        bonus = 7
    } else if (rollTotal >= 21) {
        bonus = 7 + Math.ceil((rollTotal - 20) / 5)
    }
    return bonus

}
