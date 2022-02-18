# Near Karts

Battle Kart dynamic NFTs on NEAR blockchain.

A submission for the [NEAR MetaBuild hackathon](https://metabuild.devpost.com/) running in alpha on testnet.

Demo App: https://near-karts.web.app/

Demo Video: https://youtu.be/AINOyA30sX8

## Concept

Equip and pimp a 3D NEAR Kart NFT and mint it on the NEAR blockchain.

NFT is upgradable as the Kart rises through the levels.

#### Battles

* Each battle won increases your NEAR Kart level by 1  
* Win items as your level increases  
* Upgrade and save your NEAR Kart once every **5** levels  
* The name of your NEAR Kart cannot be changed so choose wisely! 

## Sponsor Challenges

#### Paras Decentralized App using NFT NEP-171 standard! 

NEAR Karts NFTs are NEP-171 NFTs on the NEAR blockchain.

non_fungible_token_core, non_fungible_token_approval and impl_non_fungible_token_enumeration are implemented for the NEAR Kart NFTs.

**nft_mint** is modified to allow minting only when with verified nft data is provided.

[NEAR Kart NEP-171 Implementation](https://github.com/ben-razor/near-karts/blob/main/contracts/near/nft/src/lib.rs)

#### The Graph Integration

The Graph is integrated into the application to provide daily and monthly leaderboards.

The [NEAR Karts Subgraph](https://thegraph.com/hosted-service/subgraph/ben-razor/near-karts) also provides:

* A historical record of the NFT for each kart as they are upgraded
* Battle details that can be used to replay previous battles
* Records of minting and upgrading events

#### NEAR Foundation - Calling all Liberal Artists

As part of the development of the demo video, a collection of 4 artworks were created focussing on the effiency and speed of NEAR blockchain.

The artwork is styled as promos / posters for automobile products.

![Artwork collection](https://github.com/ben-razor/near-karts/blob/main/artwork/images/game/collection/combined-1.png)

The full size renders are located in [https://github.com/ben-razor/near-karts/tree/main/artwork/images/game/collection](https://github.com/ben-razor/near-karts/tree/main/artwork/images/game/collection)

## Important Files

[Kart NFT Contract on NEAR](https://github.com/ben-razor/near-karts/blob/main/contracts/near/nft/src/lib.rs)

[Front end code](https://github.com/ben-razor/near-karts/tree/main/web/src)  
[App / Wallet / Contract front end ReactJS](https://github.com/ben-razor/near-karts/blob/main/web/src/App.js)  
[NEAR Karts front end ReactJS](https://github.com/ben-razor/near-karts/blob/main/web/src/js/components/NearKarts.js)  
