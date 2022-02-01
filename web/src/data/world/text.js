const text_consts = {
  "app_name": "NEAR Karts",
  "nft_name": "NEAR Kart",
  "nft_short_name": "Kart"
}

const text_battle = {
  "en": {
    "text_battle_attack_general_1": `{aggressor} tries to ram {victim}`,
    "text_battle_attack_general_2": `{aggressor} drives menacingly towards {victim}`,
    "text_battle_attack_general_3": `{aggressor} goes in on {victim}`,
    "text_battle_attack_general_4": `{aggressor} tries to bump {victim} like it's dodgems`,
    "text_battle_attack_general_5": `{aggressor} goes for a direct hit`,
    "text_battle_attack_laser_1": `{aggressor} fires their "L A S E R"`,
    "text_battle_attack_rocket_1": `{aggressor} launches a rocket`,
    "text_battle_attack_fist_1": `{aggressor} throws some nuts`,
    "text_battle_attack_flamethrower_1": `{aggressor} lights up the arena with their flamethrower`,
    "text_battle_attack_aceed_1": `{aggressor} pumps out some hardcore acid`,
    "text_battle_attack_flipper_1": "{aggressor} gets in close and trys the flipper",
    "text_battle_attack_sword_1": "{aggressor} strikes with the sword",
    "text_battle_attack_axe_1": "{aggressor} brings the axe crashing down on {victim}",
    "text_battle_attack_hammer_1": "{aggressor} tries to pound {victim} with the hammer",

    "text_battle_hittype_flamethrower_1": "sizzled",
    "text_battle_hittype_flamethrower_2": "toasted",

    "text_battle_hit_general_1": `{victim} suffers damage`,
    "text_battle_hit_general_2": `{victim} looks bashed up`,
    "text_battle_hit_general_3": `It puts a dent in {victim}`,
    "text_battle_hit_laser_1": `The laser cuts through {victim}`,
    "text_battle_hit_rocket_1": `It explodes on {victim}`,
    "text_battle_hit_fist_1": `The workings of {victim} are compromised`,
    "text_battle_hit_fist_2": `{victim} got filled with nut shape holes`,
    "text_battle_hit_flamethrower_1": `{victim}'s kart is {hittyped} by flamethrower`,
    "text_battle_hit_aceed_1": `{victim} got a face full`,
    "text_battle_hit_aceed_2": `{victim} got squelched by 303 millilitres of aceed`,
    "text_battle_hit_aceed_3": `{victim} feels a bit melty`,
    "text_battle_hit_flipper_1": `{victim} spins and crashes to the ground`,
    "text_battle_hit_flipper_2": `{victim} goes flying`,
    "text_battle_hit_sword_1": `It cuts through {victim}'s kart like a knife through butter`,
    "text_battle_hit_sword_2": `{victim} got sliced like a loaf`,
    "text_battle_hit_axe_1": `It takes a piece out of {victim}`,
    "text_battle_hit_axe_2": `{victim} got chopped`,
    "text_battle_hit_hammer_1": `{victim} gets squashed`,

    "text_battle_color_aceed_1": 'That was naughty, very naughty',
    "text_battle_color_aceed_2": 'Acieed... Acieed',
    "text_battle_color_aceed_3": '{victim} is not looking smiley',
    "text_battle_color_flamethrower_1": '{victim} is on fire today... But not in a good way',
    "text_battle_color_flamethrower_2": "It's getting hot in here",
    "text_battle_color_fist_1": "Thunderfist!",
    "text_battle_color_fist_2": "{victim} looks screwed up",
    "text_battle_color_general_1": 'That was cold blooded',
    "text_battle_color_general_2": 'That was brutal',
    "text_battle_color_general_3": 'Holy cow',
    "text_battle_color_general_4": 'How did {victim} survive that',
    "text_battle_color_general_5": 'Epic',

    "text_battle_shield_evade_1": "{aggressor}'s aim is off",
    "text_battle_shield_evade_2": "{victim} dodges",
    "text_battle_shield_evade_3": "{victim} executes an evasive manouvre",
    "text_battle_shield_evade_4": "{victim}'s body work holds steady",

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
    "text_battle_loading": `Arena is being prepared for battle...`,
    "text_battle_arena": `Battle Arena`,
    "text_battle": `Battle`,
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
let lang = langs[0];

for(let lang of langs) {
  Object.assign(text[lang], text_battle[lang]);
}

export default function getText(id) {
  return text[lang][id] || id;
}

export function getBattleText() {
  return text_battle[lang];
}

export function exclamation(text) {
  return text + '!!';
}