Hooks.once("ready", async function () {
  game.effectMacroTorg = {
    torgBuff,
    simpleDefense,
    dramaVision,
    dramaFlashback,
    torgB,
    playerPlayback,
    viewMode: true,
  };
});

//When the turn taken button is hit, delete "until end of turn" effects (stymied/vulnerable)
Hooks.on(
  "updateCombatant",
  async (torgCombatant, dataFlags, dataDiff, userId) => {
    if (game.user.hasRole(4)) {
      if (dataFlags.flags.world.turnTaken) {
        let myActor = torgCombatant.actor;
        for (const ef of myActor.effects.filter(
          (e) => e.duration.type === "turns"
        )) {
          await myActor.updateEmbeddedDocuments("ActiveEffect", [
            {
              _id: ef.id,
              "duration.turns": ef.duration.turns - 1,
              "duration.rounds": ef.duration.rounds - 1,
            },
          ]);
          if (!ef.duration.remaining) await ef.delete();
        }
      }
    }
  }
);

//When a "non-vehicle actor" is drop on a "vehicle actor", proposes to replace the driver and his skill value
Hooks.on("dropActorSheetData", async (myVehicle, mySheet, myPassenger) => {
  if (
    (myVehicle.type !== "vehicle") |
    (fromUuidSync(myPassenger.uuid).type === "vehicle")
  )
    return;
  let driver = fromUuidSync(myPassenger.uuid);
  let skill = myVehicle.system.type.toLowerCase();
  let skillValue = driver.system.skills[skill + "Vehicles"].value;

  await Dialog.confirm({
    title: game.i18n.localize("EffectMacroTorg.newDriver"),
    content: game.i18n.localize("EffectMacroTorg.confirmDriver"),
    yes: () => {
      if (skillValue > 0) {
        myVehicle.update({
          "system.operator.name": driver.name,
          "system.operator.skillValue": skillValue,
        });
      } else {
        ui.notifications.warn(
          driver.name + game.i18n.localize("EffectMacroTorg.noCapacity")
        );
      }
    },
    no: () => {},
    render: () => {},
    defaultYes: true,
    rejectClose: false,
  });
});

//START OF MACROS
//Show next 1-3 drama cards to a selection of players (much of this code is stolen in others macros)
async function dramaVision() {
  if (!game.user.isGM) {
    return;
  }
  if (
    game.combats.map((ccc) => ccc.round === 0)[0] ||
    game.combats.size === 0
  ) {
    return ui.notifications.warn(game.i18n.localize("EffectMacroTorg.noFight"));
  }

  let applyChanges = false;
  let users = game.users.filter((user) => user.active && !user.isGM);
  let checkOptions = "";
  let playerTokenIds = users
    .map((u) => u.character?.id)
    .filter((id) => id !== undefined);
  let selectedPlayerIds = canvas.tokens.controlled.map((token) => {
    if (playerTokenIds.includes(token.actor.id)) return token.actor.id;
  });

  // Build checkbox list for all active players
  users.forEach((user) => {
    let checked =
      !!user.character &&
      selectedPlayerIds.includes(user.character.id) &&
      "checked";
    checkOptions += `
        <br>
        <input type="checkbox" name="${user.id}" id="${user.id}" value="${user.name}" ${checked}>\n
        <label for="${user.id}">${user.name}</label>
    `;
  });

  // Choose the nb of cards to show
  const mychoice = new Promise((resolve, reject) => {
    new Dialog({
      title: game.i18n.localize("EffectMacroTorg.nbCards"),
      content: game.i18n.localize("EffectMacroTorg.nbCardsValue"),
      buttons: {
        1: {
          label: 1,
          callback: async (html) => {
            resolve(1);
          },
        },
        2: {
          label: 2,
          callback: async (html) => {
            resolve(2);
          },
        },
        3: {
          label: 3,
          callback: async (html) => {
            resolve(3);
          },
        },
      },
    }).render(true);
  });

  let nbc = await mychoice.then((nbc) => {
    return nbc;
  });

  //Find the Drama Deck
  let dram = game.cards.get(
    game.settings.get("torgeternity", "deckSetting").dramaDeck
  );
  // Find ?? the index of the Active Drama Card in the Drama Deck
  let ind = game.cards.get(
    game.settings.get("torgeternity", "deckSetting").dramaActive
  )._source.cards[0].sort;

  new Dialog({
    title: game.i18n.localize("EffectMacroTorg.recipient"),
    content: `${game.i18n.localize(
      "EffectMacroTorg.whisper"
    )} ${checkOptions} <br>`,
    buttons: {
      whisper: {
        label: game.i18n.localize("EffectMacroTorg.apply"),
        callback: (html) => createMessage(html),
      },
    },
  }).render(true);

  function createMessage(html) {
    let targets = [];
    // build list of selected players ids for whispers target
    for (let user of users) {
      if (html.find('[name="' + user.id + '"]')[0].checked) {
        applyChanges = true;
        targets.push(user.id);
      }
    }
    if (!applyChanges) return;
    for (let j = 0; j < nbc; j++) {
      let card = dram.cards.find((i) => i.sort === ind + j + 1);
      ChatMessage.create({
        whisper: targets,
        content: `<div class="card-draw flexrow"><span class="card-chat-tooltip"><img class="card-face" src="${
          card.img
        }"/><span><img src="${
          card.img
        }"></span></span><span class="card-name"> ${game.i18n.localize(
          "EffectMacroTorg.show"
        )} ${card.name}</span>
                    </div>`,
      });
    }
  }
}

//If you need to get back with activeDramaCard
async function dramaFlashback() {
  if (!game.user.isGM) {
    return;
  }
  const dramaDeck = game.cards.get(
    game.settings.get("torgeternity", "deckSetting").dramaDeck
  );
  const dramaDiscard = game.cards.get(
    game.settings.get("torgeternity", "deckSetting").dramaDiscard
  );
  const dramaActive = game.cards.get(
    game.settings.get("torgeternity", "deckSetting").dramaActive
  );
  let restoreOldActive = Array.from(dramaDiscard.cards).pop();
  let removeActiveCard = Array.from(dramaActive.cards).pop();
  removeActiveCard.pass(dramaDeck);
  restoreOldActive.pass(dramaActive);
  let activeCard = dramaActive.cards.contents[0];
  let activeImage = restoreOldActive.faces[0].img;
  game.combats.active.setFlag("torgeternity", "activeCard", activeImage);
}

//If you need to cancel a card a player just played
//works if the card to get back is the last message in ChatLog, and if player owns only one hand
async function playerPlayback() {
  if (!game.user.isGM) {
    return;
  }
  let applyChanges = false;
  let users = game.users.filter((user) => user.active && !user.isGM);
  let checkOptions = "";
  let playerTokenIds = users
    .map((u) => u.character?.id)
    .filter((id) => id !== undefined);
  let selectedPlayerIds = canvas.tokens.controlled.map((token) => {
    if (playerTokenIds.includes(token.actor.id)) return token.actor.id;
  });
  // Build checkbox list for all active players
  users.forEach((user) => {
    let checked =
      !!user.character &&
      selectedPlayerIds.includes(user.character.id) &&
      "checked";
    checkOptions += `
            <br>
            <input type="checkbox" name="${user.id}" id="${user.id}" value="${user.name}" ${checked}>\n
            <label for="${user.id}">${user.name}</label>
        `;
  });
  new Dialog({
    title: game.i18n.localize("EffectMacroTorg.cardBack"),
    content: `${game.i18n.localize(
      "EffectMacroTorg.cardOwner"
    )} ${checkOptions} <br>`,
    buttons: {
      whisper: {
        label: game.i18n.localize("EffectMacroTorg.apply"),
        callback: (html) => createMessage(html),
      },
    },
  }).render(true);

  function createMessage(html) {
    let target;
    // build list of selected players ids for whispers target
    for (let user of users) {
      if (html.find('[name="' + user.id + '"]')[0].checked) {
        applyChanges = true;
        target = user;
      }
    }
    if (!applyChanges) {
      return;
    } else {
      const destinyDiscard = game.cards.get(
        game.settings.get("torgeternity", "deckSetting").destinyDiscard
      );
      const lastCard = destinyDiscard.cards.contents.pop();
      const parentHand = target.character.getDefaultHand();
      const listMessage = game.messages.contents;
      let filtre = listMessage.filter((m) => m._source.user === target.id);
      let lastMessage = filtre.pop();
      lastCard.pass(parentHand);
      if (lastCard) {
        ChatMessage.deleteDocuments([lastMessage.id]);
      }
    }
  }
}

//active defense on multi selection, not compliant with possibilities/up/drama, any reroll.
async function simpleDefense() {
  let targets = canvas.tokens.controlled;
  if (targets.length === 0) {
    ui.notifications.error("You must select a token!");
    return;
  }
  targets.forEach((element) => {
    let myActor = element.actor;
    console.log(myActor);
    if (!myActor) {
      ui.notifications.error("You must select a token!");
    } else {
      let oldAD = myActor.effects.find(
        (a) => a.name === game.i18n.localize("EffectMacroTorg.AD")
      );

      if (!oldAD) {
        let jet = new Roll("1d20x10x20").evaluate({ async: false });
        let bo = Math.max(1, game.effectMacroTorg.torgB(jet.total));
        let AD = {
          speaker: ChatMessage.getSpeaker(),
          content: game.i18n.localize("EffectMacroTorg.AD") + "+" + bo,
        };
        ChatMessage.create(AD);

        let NewActiveDefense = {
          name: game.i18n.localize("EffectMacroTorg.AD"),
          icon: "icons/equipment/shield/heater-crystal-blue.webp",
          duration: { rounds: 1, turns: 1 },
          changes: [
            {
              key: "system.dodgeDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.intimidationDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.maneuverDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.meleeWeaponsDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.tauntDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.trickDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
            {
              key: "system.unarmedCombatDefenseMod",
              value: bo,
              priority: 20,
              mode: 2,
            },
          ],
          disabled: false,
        };
        myActor.createEmbeddedDocuments("ActiveEffect", [NewActiveDefense]);
      }
      if (oldAD) {
        let RAD = {
          speaker: ChatMessage.getSpeaker(),
          content: game.i18n.localize(
            "torgeternity.chatText.check.result.resetDefense"
          ),
        };
        ChatMessage.create(RAD).then(
          myActor.effects
            .find((a) => a.name === game.i18n.localize("EffectMacroTorg.AD"))
            .delete()
        );
      }
    }
  });
}

//create effects related with your choice, Defense/specific Attribute/All attributes
//if any value change (attribute or add or limitation) erase the effects and redo it
async function torgBuff() {
  //target is the selected token, mandatory for the GM, or the player's character if no selection
  let actorID = _token?.actor.id ?? game.user.character.id;

  let attr, bonu, dur; //the attribute key, the bonus expected, the duration expected

  // Choose the attribute you want to modify
  const mychoice = new Promise((resolve, reject) => {
    new Dialog({
      title: game.i18n.localize("EffectMacroTorg.choice"),
      content: game.i18n.localize("EffectMacroTorg.choose"),
      buttons: {
        mind: {
          label: game.i18n.localize("EffectMacroTorg.mind"),
          callback: async (html) => {
            resolve("mind");
          },
        },
        strength: {
          label: game.i18n.localize("EffectMacroTorg.strength"),
          callback: async (html) => {
            resolve("strength");
          },
        },
        charisma: {
          label: game.i18n.localize("EffectMacroTorg.charisma"),
          callback: async (html) => {
            resolve("charisma");
          },
        },
        spirit: {
          label: game.i18n.localize("EffectMacroTorg.spirit"),
          callback: async (html) => {
            resolve("spirit");
          },
        },
        dexterity: {
          label: game.i18n.localize("EffectMacroTorg.dexterity"),
          callback: async (html) => {
            resolve("dexterity");
          },
        },
        curse: {
          label: game.i18n.localize("EffectMacroTorg.curse"),
          callback: async (html) => {
            resolve("all");
          },
        },
        physicalDefense: {
          label: game.i18n.localize("EffectMacroTorg.physicalDefense"),
          callback: async (html) => {
            resolve("physicalDefense");
          },
        },
        defense: {
          label: game.i18n.localize("EffectMacroTorg.defense"),
          callback: async (html) => {
            resolve("defense");
          },
        },
      },
    }).render(true);
  });
  attr = await mychoice.then((attr) => {
    return attr;
  });

  //choose the bonus you expect
  const mybonus = new Promise((resolve, reject) => {
    new Dialog({
      title: game.i18n.localize("EffectMacroTorg.bonusTitle"),
      content: `<div>${game.i18n.localize(
        "EffectMacroTorg.value"
      )} <input name="bonu" value=1 style="width:50px"/></div>`,
      buttons: {
        1: {
          label: game.i18n.localize("EffectMacroTorg.apply"),
          callback: (html) => {
            let bonu = parseInt(html.find("[name=bonu]")[0].value);
            resolve(bonu);
          },
        },
      },
    }).render(true);
  });
  bonu = await mybonus.then((bonu) => {
    return bonu;
  });

  //choose the duration of the effect
  const mytime = new Promise((resolve, reject) => {
    new Dialog({
      title: game.i18n.localize("EffectMacroTorg.timeLabel"),
      content: `<div>${game.i18n.localize(
        "EffectMacroTorg.time"
      )} <input name="dur" value=1 style="width:50px"/></div>`,
      buttons: {
        1: {
          label: game.i18n.localize("EffectMacroTorg.apply"),
          callback: (html) => {
            let dur = parseInt(html.find("[name=dur]")[0].value);
            resolve(dur);
          },
        },
      },
    }).render(true);
  });
  dur = await mytime.then((dur) => {
    return dur;
  });

  if (attr === "defense") {
    //only Defenses, but ALL defenses
    let newEffect = {
      name:
        game.i18n.localize("EffectMacroTorg.defense") +
        " / " +
        bonu +
        " / " +
        dur +
        "rd(s)",
      duration: { rounds: dur, turns: dur },
      changes: [
        {
          key: "system.dodgeDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.meleeWeaponsDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.unarmedCombatDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.intimidationDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.maneuverDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.tauntDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.trickDefenseMod",
          value: bonu,
          mode: 2,
        },
      ],
      disabled: false,
    };
    // Aspect modifications related to bonus/malus
    switch (bonu < 0) {
      case true:
        newEffect.tint = "#ff0000";
        newEffect.icon = "icons/svg/downgrade.svg";
        break;
      default:
        newEffect.tint = "#00ff00";
        newEffect.icon = "icons/svg/upgrade.svg";
    }
    await game.actors
      .get(actorID)
      .createEmbeddedDocuments("ActiveEffect", [newEffect]);
  } /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  else if (attr === "physicalDefense") {
    //only physical Defenses
    let newEffect = {
      name:
        game.i18n.localize("EffectMacroTorg.defense") +
        " / " +
        bonu +
        " / " +
        dur +
        "rd(s)",
      duration: { rounds: dur, turns: dur },
      changes: [
        {
          key: "system.dodgeDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.meleeWeaponsDefenseMod",
          value: bonu,
          mode: 2,
        },
        {
          key: "system.unarmedCombatDefenseMod",
          value: bonu,
          mode: 2,
        },
      ],
      disabled: false,
    };
    // Aspect modifications related to bonus/malus
    switch (bonu < 0) {
      case true:
        newEffect.tint = "#ff0000";
        newEffect.icon = "icons/svg/downgrade.svg";
        break;
      default:
        newEffect.tint = "#00ff00";
        newEffect.icon = "icons/svg/upgrade.svg";
    }
    await game.actors
      .get(actorID)
      .createEmbeddedDocuments("ActiveEffect", [newEffect]);
  } /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  else if (attr === "all") {
      //preparation of attribute effect
      let newEffect = {
        name:
          game.i18n.localize("EffectMacroTorg.curse") +
          " / " +
          bonu +
          " / " +
          dur +
          "rd(s)",
        duration: { rounds: dur, turns: dur },
        changes: [
          {
            key: "system.attributes.mind.value",
            value: bonu,
            mode: 2,
          },
          {
            key: "system.attributes.spirit.value",
            value: bonu,
            mode: 2,
          },
          {
            key: "system.attributes.strength.value",
            value: bonu,
            mode: 2,
          },
          {
            key: "system.attributes.dexterity.value",
            value: bonu,
            mode: 2,
          },
          {
            key: "system.attributes.charisma.value",
            value: bonu,
            mode: 2,
          },
        ],
        disabled: false,
      };
      // Aspect modifications related to bonus/malus
      switch (bonu < 0) {
        case true:
          newEffect.tint = "#ff0000";
          newEffect.icon = "icons/svg/downgrade.svg";
          break;
        default:
          newEffect.tint = "#00ff00";
          newEffect.icon = "icons/svg/upgrade.svg";
      }

    //at least, create the effect
    await game.actors
      .get(actorID)
      .createEmbeddedDocuments("ActiveEffect", [newEffect]);
  } else {
    //One attribute
    //preparation of attribute effect
    let newEffect = {
      name:
        game.i18n.localize("EffectMacroTorg." + attr) +
        " / " +
        bonu +
        " / " +
        dur +
        "rd(s)",
      duration: { rounds: dur, turns: dur },
      changes: [
        {
          key: "system.attributes." + attr + ".value",
          value: bonu,
          mode: 2,
        },
      ],
      disabled: false,
    };

    // Aspect modifications related to bonus/malus
    switch (bonu < 0) {
      case true:
        newEffect.tint = "#ff0000";
        newEffect.icon = "icons/svg/downgrade.svg";
        break;
      default:
        newEffect.tint = "#00ff00";
        newEffect.icon = "icons/svg/upgrade.svg";
    }

    //at least, create the effect
    await game.actors
      .get(actorID)
      .createEmbeddedDocuments("ActiveEffect", [newEffect]);
  }
}

//the bonus table, copied from the core torg
function torgB(rollTotal) {
  let bonu;
  if (rollTotal == 1) {
    bonu = -10;
  } else if (rollTotal == 2) {
    bonu = -8;
  } else if (rollTotal <= 4) {
    bonu = -6;
  } else if (rollTotal <= 6) {
    bonu = -4;
  } else if (rollTotal <= 8) {
    bonu = -2;
  } else if (rollTotal <= 10) {
    bonu = -1;
  } else if (rollTotal <= 12) {
    bonu = 0;
  } else if (rollTotal <= 14) {
    bonu = 1;
  } else if (rollTotal == 15) {
    bonu = 2;
  } else if (rollTotal == 16) {
    bonu = 3;
  } else if (rollTotal == 17) {
    bonu = 4;
  } else if (rollTotal == 18) {
    bonu = 5;
  } else if (rollTotal == 19) {
    bonu = 6;
  } else if (rollTotal == 20) {
    bonu = 7;
  } else if (rollTotal >= 21) {
    bonu = 7 + Math.ceil((rollTotal - 20) / 5);
  }
  return bonu;
}
