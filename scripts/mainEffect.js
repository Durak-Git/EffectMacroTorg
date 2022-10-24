Hooks.once("init", async function () {
    game.effectMacroTorg = {
        torgB,
        viewMode: true
    };
});
function torgB(rollTotal) {
    let bonu;
    if (rollTotal == 1) {
        bonu = -10
    } else if (rollTotal == 2) {
        bonu = -8
    } else if (rollTotal <= 4) {
        bonu = -6
    } else if (rollTotal <= 6) {
        bonu = -4
    } else if (rollTotal <= 8) {
        bonu = -2
    } else if (rollTotal <= 10) {
        bonu = -1
    } else if (rollTotal <= 12) {
        bonu = 0
    } else if (rollTotal <= 14) {
        bonu = 1
    } else if (rollTotal == 15) {
        bonu = 2
    } else if (rollTotal == 16) {
        bonu = 3
    } else if (rollTotal == 17) {
        bonu = 4
    } else if (rollTotal == 18) {
        bonu = 5
    } else if (rollTotal == 19) {
        bonu = 6
    } else if (rollTotal == 20) {
        bonu = 7
    } else if (rollTotal >= 21) {
        bonu = 7 + Math.ceil((rollTotal - 20) / 5)
    }
    return bonu
}
//Hooks.on(itemDropActorSheet)
