const text_consts = {
  "app_name": "NEAR Karts",
  "nft_name": "NEAR Kart"
}

const text = {
  "en": {
    "text_kart_name_label": `Enter ${text_consts.nft_name} name...`,
    "text_battle_started": `Battle has commenced!!`,

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
}

export default function getText(id, lang="en") {
  return text[lang][id] || id;
}