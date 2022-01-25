const config = [
  {
    sceneName: "SceneRoomZero",
    obstacles: [ ],
    triggers: [
      { id: 'door', positionType: 'object', objId: 'SceneRoomZeroDoor', geometry: { type: "sphere", radius: 0.5 } }
    ],
    bounds: { z: [-1.8, 0.8], x: [-3, 3] },
    startPos: { x: 0, y: 0, z: 0}
  },
  {
    sceneName: "SceneBeach",
    obstacles: [
      { pos: [1, 0, -1], geometry: { type: "sphere", radius: 0.4 } },
      { pos: [-1, 0, -1], geometry: { type: "sphere", radius: 0.4 } }
    ],
    triggers: [
      { id: 'door', positionType: 'object', objId: 'SceneBeachDoor', geometry: { type: "sphere", radius: 0.5 } }
    ],
    bounds: { z: [-1.8, 0.8], x: [-3, 3] },
    startPos: { x: 0, y: 0, z: 0 }
  }
]

export default config;