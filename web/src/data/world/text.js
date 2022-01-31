const text_consts = {
  "app_name": "NEAR Karts",
  "nft_name": "NEAR Kart",
  "nft_short_name": "Kart"
}

const text_battle = {
  "en": {
    "text_battle_attack_general_1": `{aggressor} tries to ram {victim}`,
    "text_battle_attack_laser_1": `{aggressor} fires their "L A S E R"`,
    "text_battle_attack_rocket_1": `{aggressor} launches a rocket`,
    "text_battle_attack_fist_1": `{aggressor} throws some nuts`,
    "text_battle_attack_flamethrower_1": `{aggressor} lights up the arena with their flamethrower`,
    "text_battle_attack_aceed_1": `{victim} pumps out some hardcore aceed`,
    "text_battle_attack_flipper_1": "{aggressor} gets in close and trys the flipper",
    "text_battle_attack_sword_1": "{aggressor} strikes with the sword",
    "text_battle_attack_axe_1": "{aggressor} brings the axe crashing down on {victim}",
    "text_battle_attack_hammer_1": "{aggressor} tries to crush {victim} with the hammer",

    "text_battle_flamethrower_hittyped_1": "sizzled",
    "text_battle_flamethrower_hittyped_2": "toasted",

    "text_battle_hit_general_1": `{victim} suffers damage`,
    "text_battle_hit_laser_1": `The laser cuts through {victim}`,
    "text_battle_hit_rocket_1": `It explodes on {victim}`,
    "text_battle_hit_fist_1": `The workings of {victim} are compromised`,
    "text_battle_hit_flamethrower_1": `{victim}'s kart is {hittyped} by flamethrower`,
    "text_battle_hit_aceed_1": `{victim} got a face full`,
    "text_battle_hit_aceed_2": `{victim} got squelched by 303ml of aceed`,
    "text_battle_hit_flipper_1": `{aggressor} flips {victims}'s cart through the air`,
    "text_battle_hit_sword_1": `It rips through {victim}'s kart like a knife through butter`,
    "text_battle_hit_axe_1": `It takes a piece out of {victim}`,
    "text_battle_hit_hammer_1": `{victim} gets squashed`,

    "text_battle_color_aceed_naughty": 'That was naughty, very naughty',
    "text_battle_color_aceed_aceed": 'Acieed... Acieed!!',

    "text_battle_color_general_1": 'That was cold blooded',

    "text_battle_evade_off": "{aggressor}'s aim is off",
    "text_battle_evade_dodge": "{victim} dodges",
    "text_battle_evade_evasive": "{victim} executes an evasive manouvre",

    "text_battle_shield_general_1": "{victim}'s body handles it",
    "text_battle_shield_fluffykitten_1": "{victim}'s fluffy kitten paws it away",
    "text_battle_shield_kevlar_1": "{victim}'s kevlar shield blocks the attack",

    "text_battle_battle_won": `{winner} wins the battle!!`,
  }
};

const text = {
  "en": {
    "text_kart_name_label": `Enter ${text_consts.nft_name} name...`,
    "text_battle_started": `Battle has commenced!!`,
    "text_no_battle": `No battle to watch`,
    "text_battle_arena": `Battle Arena`,
    "text_your_kart": `Your ${text_consts.nft_short_name}`,
    "text_opponent_kart": `Opponent ${text_consts.nft_short_name}`,
    "text_vs": `Vs`,

    "success_save_kart": `${text_consts.nft_name} saved!!`,

    "error_save_kart": `Error saving ${text_consts.nft_name}`,
    "error_no_active_kart": `No ${text_consts.nft_name} is active`,
    "error_check_console": "Check console for details",
    "error_mint_kart": `Error minting ${text_consts.nft_name}`,
    "error_starting_battle": `Error starting battle`,
    "error_no_opponent_selected": `Error no opponent selected`,
    "error_no_battle_self": `Error ${text_consts.nft_name} cannot battle self`,
    "error_no_kart_name": `No name supplied for ${text_consts.nft_name}`
  }
};

const langs = ["en"];

for(let lang of langs) {
  Object.assign(text[lang], text_battle[lang]);
}

export default function getText(id, lang="en") {
  return text[lang][id] || id;
}

export function getBattleText() {
  return text_battle;
}