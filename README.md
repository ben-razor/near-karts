# Near Karts

Battle Kart dynamic NFTs on NEAR blockchain.

A submission for the [NEAR MetaBuild hackathon](https://metabuild.devpost.com/). Currently running in alpha on testnet.

Demo App: https://near-karts.web.app/

Demo Video: https://youtu.be/AINOyA30sX8

## Concept

Equip and pimp your 3D NEAR Kart NFT in the garage  
Mint it on the NEAR blockchain for 0.1 NEAR  

**Battles**

Each battle won increases your NEAR Kart level by 1  
Win items as your level increases  
You can upgrade and save your NEAR Kart once every **5** levels  
The name of your NEAR Kart cannot be changed so choose wisely! 

## Near Kart NFT

NFTs are NEP-171 NFTs on the NEAR blockchain.

nft_mint is modified to support minting only with verified nft data.

## The Graph Integration

The Graph is integrated into the application to provide daily and monthly leaderboards.

The [NEAR Karts Subgraph](https://thegraph.com/hosted-service/subgraph/ben-razor/near-karts) also provides:

* A historical record of the NFT image for each kart as they are upgraded
* Battle details that can be used to replay previous battles
* Records of minting and upgrading events

## Important Files

[Kart NFT Contract on NEAR](https://github.com/ben-razor/near-karts/blob/main/contracts/near/nft/src/lib.rs)

[Front end code](https://github.com/ben-razor/near-karts/tree/main/web/src)
[App front end ReactJS](https://github.com/ben-razor/near-karts/blob/main/web/src/App.js)
[NEAR Karts front end ReactJS](https://github.com/ben-razor/near-karts/blob/main/web/src/js/components/NearKarts.js)
