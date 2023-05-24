Hooks.once("init", async function () {
    game.effectMacroTorg = {
        torgBuff,
        simpleDefense,
        dramaVision,
        dramaFlashback,
        torgB,
        playerPlayback,
        viewMode: true
    };
});

Hooks.on("deleteCombat", async (combat, dataUpdate) => {
    var listCombatants = [];
    var listHandsReset =[];
    //listing of actors in the closing combat
    combat.combatants.filter(sk => sk.actor.type === "stormknight").forEach(fighter => listCombatants.push(fighter.actorId));
    //listing of hands' actors in closing combat, with test for existing hand
    listCombatants.forEach(i => {if (!!game.actors.get(i).getDefaultHand()) {listHandsReset.push(game.actors.get(i).getDefaultHand())}});
    //delete the flag that give the pooled condition
    listHandsReset.forEach(hand => hand.cards.forEach(card => card.unsetFlag("torgeternity", "pooled")));
})

Hooks.on("preUpdateCombatant", async (torgCombatant, dataFlags, dataDiff, userId) => {
    var myActor = torgCombatant.actor; //game.actors.get(torgCombatant.actorId);
    var oldStymied = myActor.effects.find(a => a.label === (game.i18n.localize("torgeternity.statusEffects.stymied")));
    var oldVulnerable = myActor.effects.find(a => a.label === (game.i18n.localize("torgeternity.statusEffects.vulnerable")));
    var oldVStymied = myActor.effects.find(a => a.label === (game.i18n.localize("torgeternity.statusEffects.veryStymied")));
    var oldVVulnerable = myActor.effects.find(a => a.label === (game.i18n.localize("torgeternity.statusEffects.veryVulnerable")));
    if (!!oldStymied & dataFlags.flags.world.turnTaken) oldStymied.delete();
    if (!!oldVulnerable & dataFlags.flags.world.turnTaken) oldVulnerable.delete();
    if (!!oldVStymied & dataFlags.flags.world.turnTaken) oldVStymied.delete();
    if (!!oldVVulnerable & dataFlags.flags.world.turnTaken) oldVVulnerable.delete();
})

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

//active defense on multi selection, not compliant with possibilities/up/drama, any reroll.
async function simpleDefense() {
    var targets = canvas.tokens.controlled;
    if (targets.length === 0){
        ui.notifications.error("You must select a token!");
        return
    };
    targets.forEach(element => {
        var myActor = element.actor;
        console.log(myActor);
    if (!myActor) {
    ui.notifications.error("You must select a token!");    
    } else {
    var oldAD = myActor.effects.find(a => a.label === "ActiveDefense");

    if (!oldAD) {
    var jet = new Roll("1d20x10x20").evaluate({ async: false });
    var bo = Math.max(1,game.effectMacroTorg.torgB(jet.total));
    let AD = {
                    speaker: ChatMessage.getSpeaker(),
                    content: "Active defense +"+ bo
                };
    ChatMessage.create(AD);

                let NewActiveDefense = {
                    label : "ActiveDefense",         
                    icon : "icons/equipment/shield/heater-crystal-blue.webp",   
                    duration : {"rounds" : 1},
                    changes : [{  
                            "key": "system.dodgeDefense",  
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.intimidationDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.maneuverDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.meleeWeaponsDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.tauntDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.trickDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                            },{
                            "key": "system.unarmedCombatDefense",
                            "value": bo,
                            "priority": 20,
                            "mode": 2
                        }],
                    disabled : false
                };
                myActor.createEmbeddedDocuments("ActiveEffect",[NewActiveDefense]);

            };
    if (oldAD) {
    let RAD = {
                    speaker: ChatMessage.getSpeaker(),
                    content: game.i18n.localize('torgeternity.chatText.check.result.resetDefense')
                };
    ChatMessage.create(RAD);
    myActor.effects.find(a => a.label === "ActiveDefense").delete();
    }};
    });
}

//create effects related with your choice, Defense/specific Attribute/All attributes
//and creates all the effects related with skills, can be done by player
//if any value change (attribute or add or limitation) erase the effects and redo it
async function torgBuff() {
    //target is the selected token, mandatory for the GM, or the player's character if no selection
    let actorID = _token?.actor.id ?? game.user.character.id;

    var attr, bonu, dur;    //the attribute key, the bonus expected, the duration expected
    var couleur, ic, newLabel;  //icon/name customization
    var prevBonus = 0;
    var maxAttr = 99;
    var minAttr = 0;
    const listSkills = game.actors.get(actorID).system.skills;

    // Choose the attribute you want to modify
    const mychoice = new Promise((resolve, reject) => {
        new Dialog({
        title: game.i18n.localize("EffectMacroTorg.choice"),
        content: game.i18n.localize("EffectMacroTorg.choose"),
        buttons: {
            mind: {
                label: game.i18n.localize("EffectMacroTorg.mind"),
                callback: async html => {
                    resolve("mind");
                    }
                },
            strength: {
                label: game.i18n.localize("EffectMacroTorg.strength"),
                callback: async html => {
                resolve("strength");
                    }
                },
            charisma: {
                label: game.i18n.localize("EffectMacroTorg.charisma"),
                callback: async html => {
                resolve("charisma");
                    }
                },
            spirit: {
                label: game.i18n.localize("EffectMacroTorg.spirit"),
                callback: async html => {
                resolve("spirit");
                    }
                },
            dexterity: {
                label: game.i18n.localize("EffectMacroTorg.dexterity"),
                callback: async html => {
                resolve("dexterity");
                    }
                },
            curse: {
                label: game.i18n.localize("EffectMacroTorg.curse"),
                callback: async html => {
                    resolve("all");
                    }
                },
            physicalDefense: {
                label: game.i18n.localize("EffectMacroTorg.physicalDefense"),
                callback: async html => {
                    resolve("physicalDefense");
                    }
                },
            defense: {
                label: game.i18n.localize("EffectMacroTorg.defense"),
                callback: async html => {
                    resolve("defense");
                    }
                }
            }
    }).render(true);
    });
    attr = await mychoice
        .then (attr => {return attr;});

    //choose the bonus you expect
    const mybonus = new Promise((resolve, reject) => {
    new Dialog({
        title: game.i18n.localize("EffectMacroTorg.bonusTitle"),
        content: `<div>${game.i18n.localize("EffectMacroTorg.value")} <input name="bonu" value=1 style="width:50px"/></div>`,
        buttons: {
            1: {
            label: game.i18n.localize("EffectMacroTorg.apply"),
            callback: html => {
            let bonu = parseInt(html.find("[name=bonu]")[0].value);
            resolve(bonu);
                }
            }
        },
    }).render(true);
    });
    bonu = await mybonus
        .then (bonu => {return bonu;});

    //choose the duration of the effect
    const mytime = new Promise((resolve, reject) => {
    new Dialog({
        title: game.i18n.localize("EffectMacroTorg.timeLabel"),
        content: `<div>${game.i18n.localize("EffectMacroTorg.time")} <input name="dur" value=1 style="width:50px"/></div>`,
        buttons: {
            1: {
            label: game.i18n.localize("EffectMacroTorg.apply"),
            callback: html => {
            let dur = parseInt(html.find("[name=dur]")[0].value);
            resolve(dur);
                }
            }
        },
    }).render(true);
    });
    dur = await mytime
    .then (dur => {return dur;});

    if (attr === "defense") {//only Defenses, but ALL defenses
    let NewEffect = {
        label : game.i18n.localize("EffectMacroTorg.defense")+" / "+bonu+" / "+dur+"rd(s)",
        duration : {"rounds" : dur},
        changes : [{
        "key": "system.dodgeDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.meleeWeaponsDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.unarmedCombatDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.intimidationDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.maneuverDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.tauntDefense",
        "value": bonu,
        "mode": 2
        },{
        "key": "system.trickDefense",
        "value": bonu,
        "mode": 2
        }],
        disabled : false,
        tint : "#00ff00",
        icon : "icons/svg/upgrade.svg"
    };
    game.actors.get(actorID).createEmbeddedDocuments("ActiveEffect",[NewEffect]);
    }/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    else if (attr === "physicalDefense") {//only physical Defenses
        let NewEffect = {
            label : game.i18n.localize("EffectMacroTorg.defense")+" / "+bonu+" / "+dur+"rd(s)",
            duration : {"rounds" : dur},
            changes : [{
            "key": "system.dodgeDefense",
            "value": bonu,
            "mode": 2
            },{
            "key": "system.meleeWeaponsDefense",
            "value": bonu,
            "mode": 2
            },{
            "key": "system.unarmedCombatDefense",
            "value": bonu,
            "mode": 2
            }],
            disabled : false,
            tint : "#00ff00",
            icon : "icons/svg/upgrade.svg"
        };
        game.actors.get(actorID).createEmbeddedDocuments("ActiveEffect",[NewEffect]);
        }/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    else if (attr === "all") {//affect ALL attributes
    ["mind", "charisma", "strength", "spirit", "dexterity"].forEach(att =>  {
    // Search for a limitation value and bonus correction
    var tout = [];  //array of already existing effects related to the attribute
    for (var i of game.actors.get(actorID).effects) {
        tout = tout.concat(i.changes.filter(va => va.key === "system.attributes."+att));
    };


    for (var i of tout) {
        if (i.mode === 2) {prevBonus += Number.parseInt(i.value);}  //bonus already existing
        else if (i.mode === 3) {maxAttr = Math.min(maxAttr, Number.parseInt(i.value));} //search for a downgrade effect
        else if (i.mode === 4)  {minAttr = Math.max(minAttr, Number.parseInt(i.value));}//search for an upgrade effect
        else if (i.mode === 5)  {                                                       //search for an overide value
            minAttr = Math.max(minAttr, Number.parseInt(i.value));
            maxAttr = Math.min(maxAttr, Number.parseInt(i.value));
        }
    };

    console.log("Downgrade ->"+maxAttr +"/Upgrade->"+ minAttr +"/oldBonus->"+ prevBonus);

    //bonus modification to match the max/min/override information
    var unModified = game.actors.get(actorID)._source.system.attributes[att];//unmodified base attribute
    if ((unModified + bonu + prevBonus) >= maxAttr) {
        bonu = maxAttr - unModified - prevBonus;
        ChatMessage.create({content: `${game.i18n.localize("EffectMacroTorg.mod")}`});
    };
    if ((unModified + bonu + prevBonus) <= minAttr) {
        bonu = minAttr - unModified - prevBonus;
        ChatMessage.create({content: `${game.i18n.localize("EffectMacroTorg.mod")}`});
    };
    //need comments if modifications ?

    //preparation of attribute effect, "template" for following skills effect
    let NewEffect = {
                    label : "---",
                    duration : {"rounds" : dur},
                    changes : [{
                            "key": "system.attributes."+att,
                            "value": bonu,
                            "mode": 2
                            }],
                    disabled : false
                };

    // Aspect modifications related to bonus/malus
    switch (bonu < 0) {
    case true:
        NewEffect.tint = "#ff0000";
        NewEffect.icon = "icons/svg/downgrade.svg";
    break;
    default:
        NewEffect.tint = "#00ff00";
        NewEffect.icon = "icons/svg/upgrade.svg";
    }
    NewEffect.label = game.i18n.localize("EffectMacroTorg."+att)+ game.i18n.localize("EffectMacroTorg.curse")+" / "+bonu+" / "+dur+"rd(s)";

    //browsing skills, create the effects related to the attribute (code seems ugly, by I dare not touch it)
    const oldChange = NewEffect.changes;
    var newChange = oldChange;
    for (var skillAttr in listSkills) {
        if ((listSkills[skillAttr].baseAttribute === att) && (listSkills[skillAttr].value >= 0)) {
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.skills."+skillAttr+".value";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        };
    };

    // Defense modifications if necessary
    switch (att) {
        case "mind" :
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.trickDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "spirit":
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.intimidationDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "charisma":
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.tauntDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "dexterity":
            var createOne = [duplicate(oldChange[0])];
            createOne[0].key = "system.dodgeDefense";
            createOne[0].value = bonu;
            newChange = newChange.concat(createOne);
            var createTwo = [duplicate(oldChange[0])];
            createTwo[0].key = "system.meleeWeaponsDefense";
            createTwo[0].value = bonu;
            newChange = newChange.concat(createTwo);
            var createThree = [duplicate(oldChange[0])];
            createThree[0].key = "system.unarmedCombatDefense";
            createThree[0].value = bonu;
            newChange = newChange.concat(createThree);
            var createFour = [duplicate(oldChange[0])];
            createFour[0].key = "system.maneuverDefense";
            createFour[0].value = bonu;
            newChange = newChange.concat(createFour);
        break;
        default:
    };
    NewEffect.changes = newChange;
    console.log(NewEffect);
    //at least, create the effect
    game.actors.get(actorID).createEmbeddedDocuments("ActiveEffect",[NewEffect]);
    //////////////////////////////////////////////////////////////////////////////////////////////
    })} else {//One attribute
    // Search for a limitation value and bonus correction
    var tout = [];  //array of already existing effects related to the attribute
    for (var i of game.actors.get(actorID).effects) {
        tout = tout.concat(i.changes.filter(va => va.key === "system.attributes."+attr));
    };


    for (var i of tout) {
        if (i.mode === 2) {prevBonus += Number.parseInt(i.value);}  //bonus already existing
        else if (i.mode === 3) {maxAttr = Math.min(maxAttr, Number.parseInt(i.value));} //search for a downgrade effect
        else if (i.mode === 4)  {minAttr = Math.max(minAttr, Number.parseInt(i.value));}//search for an upgrade effect
        else if (i.mode === 5)  {                                                       //search for an overide value
            minAttr = Math.max(minAttr, Number.parseInt(i.value));
            maxAttr = Math.min(maxAttr, Number.parseInt(i.value));
        }
    };

    console.log("Downgrade ->"+maxAttr +"/Upgrade->"+ minAttr +"/oldBonus->"+ prevBonus);

    //bonus modification to match the max/min/override information
    var unModified = game.actors.get(actorID)._source.system.attributes[attr];//unmodified base attribute
    if ((unModified + bonu + prevBonus) >= maxAttr) {
        bonu = maxAttr - unModified - prevBonus;
        ChatMessage.create({content: `${game.i18n.localize("EffectMacroTorg.mod")}`});
    };
    if ((unModified + bonu + prevBonus) <= minAttr) {
        bonu = minAttr - unModified - prevBonus;
        ChatMessage.create({content: `${game.i18n.localize("EffectMacroTorg.mod")}`});
    };
    //need comments if modifications ?

    //preparation of attribute effect, "template" for following skills effect
    let NewEffect = {
                    label : "---",
                    duration : {"rounds" : dur},
                    changes : [{
                            "key": "system.attributes."+attr,
                            "value": bonu,
                            "mode": 2
                            }],
                    disabled : false
                };


    // Aspect modifications related to bonus/malus
    switch (bonu < 0) {
    case true:
        NewEffect.tint = "#ff0000";
        NewEffect.icon = "icons/svg/downgrade.svg";
    break;
    default:
        NewEffect.tint = "#00ff00";
        NewEffect.icon = "icons/svg/upgrade.svg";
    }
    NewEffect.label = game.i18n.localize("EffectMacroTorg."+attr)+" / "+bonu+" / "+dur+"rd(s)";

    //browsing skills, create the effects related to the attribute (code seems ugly, by I dare not touch it)
    const oldChange = NewEffect.changes;
    var newChange = oldChange;
    for (var skillAttr in listSkills) {
        if ((listSkills[skillAttr].baseAttribute === attr) && (listSkills[skillAttr].value >= 0)) {
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.skills."+skillAttr+".value";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        };
    };

    // Defense modifications if necessary
    switch (attr) {
        case "mind" :
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.trickDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "spirit":
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.intimidationDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "charisma":
            var createNew = [duplicate(oldChange[0])];
            createNew[0].key = "system.tauntDefense";
            createNew[0].value = bonu;
            newChange = newChange.concat(createNew);
        break;
        case "dexterity":
            var createOne = [duplicate(oldChange[0])];
            createOne[0].key = "system.dodgeDefense";
            createOne[0].value = bonu;
            newChange = newChange.concat(createOne);
            var createTwo = [duplicate(oldChange[0])];
            createTwo[0].key = "system.meleeWeaponsDefense";
            createTwo[0].value = bonu;
            newChange = newChange.concat(createTwo);
            var createThree = [duplicate(oldChange[0])];
            createThree[0].key = "system.unarmedCombatDefense";
            createThree[0].value = bonu;
            newChange = newChange.concat(createThree);
            var createFour = [duplicate(oldChange[0])];
            createFour[0].key = "system.maneuverDefense";
            createFour[0].value = bonu;
            newChange = newChange.concat(createFour);
        break;
        default:
    };
    NewEffect.changes = newChange;
    console.log(NewEffect);
    //at least, create the effect
    game.actors.get(actorID).createEmbeddedDocuments("ActiveEffect",[NewEffect]);
    }
}

//Show next 1-3 drama cards to a selection of players
async function dramaVision(){
    if (!game.user.isGM) {return};
    if (game.combats.map(ccc => ccc.round === 0)[0] || game.combats.size === 0) {return console.log(game.i18n.localize("EffectMacroTorg.noFight"))};

    let applyChanges = false;
    let users = game.users.filter(user => user.active && !user.isGM);
    let checkOptions = ""
    let playerTokenIds = users.map(u => u.character?.id).filter(id => id !== undefined);
    let selectedPlayerIds = canvas.tokens.controlled.map(token => {
    if (playerTokenIds.includes(token.actor.id)) return token.actor.id;
    });

    // Build checkbox list for all active players
    users.forEach(user => {
    let checked = !!user.character && selectedPlayerIds.includes(user.character.id) && 'checked';
    checkOptions+=`
        <br>
        <input type="checkbox" name="${user.id}" id="${user.id}" value="${user.name}" ${checked}>\n
        <label for="${user.id}">${user.name}</label>
    `
    });

    // Choose the nb of cards to show
    const mychoice = new Promise((resolve, reject) => {
    new Dialog({
        title: game.i18n.localize("EffectMacroTorg.nbCards"),
        content: game.i18n.localize("EffectMacroTorg.nbCardsValue"),
        buttons: {
            1: {label: 1,
                callback: async html => {resolve(1);}},
            2: {label: 2,
                callback: async html => {resolve(2);}},
            3: {label: 3,
                callback: async html => {resolve(3);}}
            }
    }).render(true);
    });

    let nbc= await mychoice
        .then (nbc=> {return nbc;});

    //Find the Drama Deck
    let dram = game.cards.get(game.settings.get("torgeternity", "deckSetting").dramaDeck);
    // Find ?? the index of the Active Drama Card in the Drama Deck
    var ind = game.cards.get(game.settings.get("torgeternity", "deckSetting").dramaActive).data._source.cards[0].sort;

    new Dialog({
    title: game.i18n.localize("EffectMacroTorg.recipient"),
    content:`${game.i18n.localize("EffectMacroTorg.whisper")} ${checkOptions} <br>`,
        buttons:{
        whisper:{   
        label:game.i18n.localize("EffectMacroTorg.apply"),
        callback: (html) => createMessage(html)
        }
    }
    }).render(true);

    function createMessage(html) {
    var targets = [];
    // build list of selected players ids for whispers target
    for ( let user of users ) {
        if (html.find('[name="'+user.id+'"]')[0].checked){
        applyChanges=true;
        targets.push(user.id);
        }        
    }
    if(!applyChanges)return;
    for (let j = 0; j < nbc; j++) {
    let card = dram.cards.find(i => i.sort === ind+j+1);
        ChatMessage.create({
        whisper: targets,
        content: `<div class="card-draw flexrow"><span class="card-chat-tooltip"><img class="card-face" src="${card.img}"/><span><img src="${card.img}"></span></span><span class="card-name"> ${game.i18n.localize("EffectMacroTorg.show")} ${card.name}</span>
                    </div>`,        
        });
    }
    }
}

//If you need to get back with activeDramaCard
async function dramaFlashback(){
    const dramaDeck = game.cards.get(game.settings.get("torgeternity", "deckSetting").dramaDeck);
    const dramaDiscard = game.cards.get(game.settings.get("torgeternity", "deckSetting").dramaDiscard);
    const dramaActive = game.cards.get(game.settings.get("torgeternity", "deckSetting").dramaActive);
    let restoreOldActive = Array.from(dramaDiscard.cards).pop();
    let removeActiveCard = Array.from(dramaActive.cards).pop();
    removeActiveCard.pass(dramaDeck);
    restoreOldActive.pass(dramaActive);
    let activeCard = dramaActive.cards.contents[0];
    let activeImage = restoreOldActive.faces[0].img;
    game.combats.active.setFlag("torgeternity", "activeCard", activeImage);
}

//If you need to cancel a card a player just played
// works if the card to get back is the last message in ChatLog
// and if player owns only one hand
async function playerPlayback() {
    ///////////////////////////////////////////
    // test with a dialog to choose "to who" give a card back
    if (!game.user.isGM) {return};
    let applyChanges = false;
    let users = game.users.filter(user => user.active && !user.isGM);
    let checkOptions = ""
    let playerTokenIds = users.map(u => u.character?.id).filter(id => id !== undefined);
    let selectedPlayerIds = canvas.tokens.controlled.map(token => {
    if (playerTokenIds.includes(token.actor.id)) return token.actor.id;
        });
    // Build checkbox list for all active players
    users.forEach(user => {
        let checked = !!user.character && selectedPlayerIds.includes(user.character.id) && 'checked';
        checkOptions+=`
            <br>
            <input type="checkbox" name="${user.id}" id="${user.id}" value="${user.name}" ${checked}>\n
            <label for="${user.id}">${user.name}</label>
        `
        });
    new Dialog({
        title: game.i18n.localize("EffectMacroTorg.cardBack"),
        content:`${game.i18n.localize("EffectMacroTorg.cardOwner")} ${checkOptions} <br>`,
            buttons:{
            whisper:{   
            label:game.i18n.localize("EffectMacroTorg.apply"),
            callback: (html) => createMessage(html)
            }
        }
    }).render(true);

    function createMessage(html) {
        var target;
        // build list of selected players ids for whispers target
        for ( let user of users ) {
            if (html.find('[name="'+user.id+'"]')[0].checked){
                applyChanges=true;
                target = user;
            }        
        }
        if(!applyChanges) {
            return;
        } else {
            const destinyDiscard = game.cards.get(game.settings.get("torgeternity", "deckSetting").destinyDiscard);
            const lastCard = destinyDiscard.cards.contents.pop();
            const parentHand = target.character.getDefaultHand();
            const listMessage = game.messages.contents;
            var filtre = listMessage.filter(m => m._source.user === target.id);
            var lastMessage = filtre.pop();
            lastCard.pass(parentHand);
            if (lastCard) {ChatMessage.deleteDocuments([lastMessage.id]);}
        }
    }
}

//Hooks.on(itemDropActorSheet)
