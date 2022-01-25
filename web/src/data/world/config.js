const config = {
  weapons_range: [
    { id: "WeaponLaser", name: "Laser" },
    { id: "WeaponRocket", name: "Rocket" },
    { id: "WeaponFist", name: "Fist Full Of Nuts" },
    { id: "WeaponFlamethrower", name: "Flamethrower" },
    { id: "WeaponAceed", name: "Aceed" },
  ],
  weapons_melee: [
    { id: "WeaponFlipper", name: "Flipper" },
    { id: "WeaponSword", name: "Sword" },
    { id: "WeaponAxe", name: "Axe" },
    { id: "WeaponHammer", name: "Hammer" },
  ],
  shields_side: [
    { id: "ShieldFluffyKitten", name: "Fluffy Kitten"},
    { id: "ShieldStrong", name: "Kevlar"},
  ],
  skin: [
    { id: "SkinPlastic", name: "Plastic" },
    { id: "SkinCarbonFibre", name: "Carbon Fibre" },
    { id: "SkinAluminium", name: "Aluminium" },
    { id: "SkinSteel", name: "Steel" }
  ],
  transport: [
    { id: "BotTransportWheels", name: "Wheels" },
    { id: "BotTransportTracks", name: "Tracks" },
    { id: "BotTransportDoubleTracks", name: "Double Tracks" },
  ],
  start_hidden: [ 'BotTransport', 'BotTurret', 'Weapon', 'Shield']
}

export default config;