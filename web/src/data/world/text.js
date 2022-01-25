const text = {
  "en": {
    "icon_drink_strange_juice": "Strange Juice",
    "icon_electrify": "Electrify",
    "icon_scavenge_in_bin": "Rubbish Bin"
  }
}

export default function getText(id, lang="en") {
  return text[lang][id] || id;
}