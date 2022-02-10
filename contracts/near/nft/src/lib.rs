/*
Non-Fungible Token implementation with JSON serialization.
NOTES:
  - The maximum balance value is limited by U128 (2**128 - 1).
  - JSON calls should pass U128 as a base-10 string. E.g. "100".
  - The contract optimizes the inner trie structure by hashing account IDs. It will prevent some
    abuse of deep tries. Shouldn't be an issue, once NEAR clients implement full hashing of keys.
  - The contract tracks the change in storage before and after the call. If the storage increases,
    the contract requires the caller of the contract to attach enough deposit to the function call
    to cover the storage cost.
    This is done to prevent a denial of service attack on the contract by taking all available storage.
    If the storage decreases, the contract will issue a refund for the cost of the released storage.
    The unused tokens from the attached deposit are also refunded, so it's safe to
    attach more deposit than required.
  - To prevent the deployed contract from being modified or deleted, it should not have any access
    keys on its account.
*/
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_contract_standards::non_fungible_token::NonFungibleToken;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{ LazyOption, UnorderedSet, Vector, LookupMap };
use near_sdk::json_types::ValidAccountId;
use near_sdk::{
    env, near_bindgen, log, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseOrValue
};
use serde::{Serialize, Deserialize};
use rmp_serde;
use hex; 
use ed25519_dalek::{ Signature, Verifier, PublicKey};

near_sdk::setup_alloc!();

const NUM_DECALS: u32 = 7;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    signer_pub_keys: UnorderedSet<String>,
    prev_block_index: near_sdk::BlockHeight,
    random_buffer: Vector<u8>,
    random_index: u8,
    last_battle: LookupMap<AccountId, SimpleBattle>
}

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct NearKart {
    version: u8,
    level: u32,
    left: u8,
    right: u8,
    top: u8,
    front: u8,
    skin: u8,
    transport: u8,
    color1: u32,
    color2: u32,
    ex1: u8,
    ex2: u32,
    decal1: String,
    decal2: String,
    decal3: String,
    extra1: String,
    extra2: String,
    extra3: String
}

#[derive(Default, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize, Debug)]
pub struct SimpleBattle {
    home_token_id: String,
    away_token_id: String,
    winner: u8,
    battle: u32,
    prize: u32,
    extra: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BattleLog {
    pub event: String,
    pub data: SimpleBattle
}

impl NearKart {
    pub fn new() -> Self {
        let mut kart = Self::default();
        kart.level = 1;
        return kart;
    }
  
    pub fn from_data(data: &String) -> Self {
        let mut s = Self::default();
        s.deserialize(data);
        s
    }

    pub fn serialize(&self) -> String{
        let sj_message_pack = rmp_serde::encode::to_vec(self).unwrap();
        let sj_hex = hex::encode(&sj_message_pack);
        return sj_hex;
    } 

    pub fn deserialize(&mut self, data: &String) -> &Self {
        if String::len(data) > 16 {
            let sj_vec = hex::decode(data).unwrap_or(Vec::new());
            let sj_old: NearKart = rmp_serde::decode::from_slice(&sj_vec).unwrap();
            self.clone_from(&sj_old);
        }
        self
    }
  }

const DATA_IMAGE_SVG_NEAR_ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 288 288'%3E%3Cg id='l' data-name='l'%3E%3Cpath d='M187.58,79.81l-30.1,44.69a3.2,3.2,0,0,0,4.75,4.2L191.86,103a1.2,1.2,0,0,1,2,.91v80.46a1.2,1.2,0,0,1-2.12.77L102.18,77.93A15.35,15.35,0,0,0,90.47,72.5H87.34A15.34,15.34,0,0,0,72,87.84V201.16A15.34,15.34,0,0,0,87.34,216.5h0a15.35,15.35,0,0,0,13.08-7.31l30.1-44.69a3.2,3.2,0,0,0-4.75-4.2L96.14,186a1.2,1.2,0,0,1-2-.91V104.61a1.2,1.2,0,0,1,2.12-.77l89.55,107.23a15.35,15.35,0,0,0,11.71,5.43h3.13A15.34,15.34,0,0,0,216,201.16V87.84A15.34,15.34,0,0,0,200.66,72.5h0A15.35,15.35,0,0,0,187.58,79.81Z'/%3E%3C/g%3E%3C/svg%3E";

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
    SignerKey,
    RandomBufferKey,
    LastBattleKey
}

#[near_bindgen]
impl Contract {
    /// Initializes the contract owned by `owner_id` with
    /// default metadata (for example purposes only).
    #[init]
    pub fn new_default_meta(owner_id: ValidAccountId) -> Self {
        Self::new(
            owner_id,
            NFTContractMetadata {
                spec: NFT_METADATA_SPEC.to_string(),
                name: "NEAR Karts".to_string(),
                symbol: "NEARKARTS".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
        )
    }

    #[init]
    pub fn new(owner_id: ValidAccountId, metadata: NFTContractMetadata) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        metadata.assert_valid();
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            signer_pub_keys: UnorderedSet::new(StorageKey::SignerKey),
            prev_block_index: 0,
            random_buffer: Vector::new(StorageKey::RandomBufferKey),
            random_index:0,
            last_battle: LookupMap::<AccountId, SimpleBattle>::new(StorageKey::LastBattleKey)
        }
    }

    pub fn add_signer_key(&mut self, pub_key: String) {
        Contract::assert_contract_owner();
        self.signer_pub_keys.insert(&pub_key);
    }

    pub fn remove_signer_key(&mut self, pub_key: String) {
        Contract::assert_contract_owner();
        self.signer_pub_keys.remove(&pub_key);
    }

    fn _is_signer(&self, pub_key: String) -> bool {
        return self.signer_pub_keys.contains(&pub_key);
    }

    #[payable]
    pub fn nft_mint_with_verified_image(
        &mut self,
        token_id: TokenId,
        receiver_id: ValidAccountId,
        token_metadata: TokenMetadata,
        mut near_kart_new: NearKart,
        cid: String,
        sig: String,
        pub_key: String
    ) -> Token {
        if env::attached_deposit() < 1e23 as u128 {
            panic!("Minting requires an attached deposit of at least 0.1 NEAR");
        }
        let token = self.tokens.mint(token_id.clone(), receiver_id, Some(token_metadata));

        near_kart_new.version = 0;
        near_kart_new.level = 1;
        near_kart_new.ex1 = 0;
        near_kart_new.ex2 = 0;
        near_kart_new.decal1 = String::new();
        near_kart_new.decal2 = String::new();
        near_kart_new.decal3 = String::new();
        near_kart_new.extra1 = String::new();
        near_kart_new.extra2 = String::new();
        near_kart_new.extra3 = String::new();

        self.nft_configure(token_id.clone(), near_kart_new);
        self.nft_update_media(token_id.clone(), cid, sig, pub_key);
        return token;
    }

    pub fn nft_delete(&self, token_id: TokenId) {
        Contract::assert_contract_owner();
        self.assert_nft_owner(token_id);
    }

    pub fn nft_count(&self, account_id: ValidAccountId) -> u64 {
        let count;

        let lookup_map = self.tokens.tokens_per_owner.as_ref().unwrap();
        let token_set = lookup_map.get(&account_id.to_string());
        
        match token_set {
            Some(token_set) => count = token_set.len(),
            None => count = 1
        }

        return count;
    }

    pub fn nft_get_a_token_id(&self, account_id: ValidAccountId) -> Option<TokenId> {
        let token_id;

        let lookup_map = self.tokens.tokens_per_owner.as_ref().unwrap();
        let token_set = lookup_map.get(&account_id.to_string());
        match token_set {
            Some(token_set) => token_id = Some(token_set.to_vec()[0].to_string()),
            None => token_id = None
        }

        token_id
    }

    pub fn nft_get_token_metadata(&self, token_id: TokenId) -> TokenMetadata {
        let lookup_map = self.tokens.token_metadata_by_id.as_ref().unwrap();
        let metadata = lookup_map.get(&token_id.to_string()).unwrap();
        return metadata;
    }

    pub fn nft_get_metadata_title(&self, token_id: TokenId) -> String {
        let lookup_map = self.tokens.token_metadata_by_id.as_ref().unwrap();
        let metadata = lookup_map.get(&token_id.to_string()).unwrap();
        return metadata.title.unwrap_or("".to_string());
    }

    pub fn nft_get_metadata_extra(&self, token_id: TokenId) -> String {
        let lookup_map = self.tokens.token_metadata_by_id.as_ref().unwrap();
        let metadata = lookup_map.get(&token_id.to_string()).unwrap();
        return metadata.extra.unwrap_or("".to_string());
    }

    pub fn nft_get_near_kart(&self, token_id: TokenId) -> NearKart {
        let extra = self.nft_get_metadata_extra(token_id);
        let sj = NearKart::from_data(&extra);
        return sj;
    }

    fn assert_nft_owner(&self, token_id: TokenId) {
        //get the token object from the token ID
        let account_id = self.tokens.owner_by_id.get(&token_id).expect("No token");

        //make sure that the person calling the function is the owner of the token
        assert_eq!(
            &env::predecessor_account_id(),
            &account_id,
            "Caller must be the token owner."
        );
    }

    fn token_owner(&self, token_id: TokenId) -> Option<String> {
        let account_id = self.tokens.owner_by_id.get(&token_id);
        return account_id;
    }

    fn assert_contract_owner() {
        let valid = Contract::is_sub_account(env::predecessor_account_id(), env::current_account_id());
        println!("{} {}", env::current_account_id(), env::predecessor_account_id());
        assert_eq!( valid, true, "Caller must be relative of contract owner");
    }

    pub fn nft_configure(&mut self, token_id: TokenId, near_kart_new: NearKart) {
        self.assert_nft_owner(token_id.clone());
        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();
        let extra = metadata.extra.unwrap_or(String::from(""));
        let mut nk = NearKart::from_data(&extra);

        nk.clone_from(&near_kart_new); 

        let max_index = Contract::get_max_weapon_index_for_level(nk.level);

        if nk.front > max_index {
            panic!("error_level_not_high_enough_to_equip_front_weapon");
        }
        else if nk.left > max_index {
            panic!("error_level_not_high_enough_to_equip_left_weapon");
        }
        else if nk.right > max_index {
            panic!("error_level_not_high_enough_to_equip_right_weapon");
        }
        else if nk.transport > max_index {
            panic!("error_level_not_high_enough_to_use_transport");
        }
        else if nk.skin > max_index {
            panic!("error_level_not_high_enough_to_use_skin");
        }

        let extra = nk.serialize();
        metadata.extra = Some(extra);
        lookup_map.insert(&token_id, &metadata);
    }

    pub fn nft_update_media(&mut self, token_id: TokenId, cid: String, sig: String, pub_key: String) {
        let is_signer = self._is_signer(pub_key.clone());
        assert_eq!( is_signer, true, "Pub Key is not a registered signer");

        let verified = Contract::verify_sig(cid.clone(), sig.clone(), pub_key.clone());
        assert_eq!( verified, true, "Signature verification of cid failed");

        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();

        metadata.media = Some(cid.clone());
        lookup_map.insert(&token_id, &metadata);
    }

    pub fn get_num_karts(&self) -> u32 {
        let tokens_owner = self.tokens.owner_by_id.to_vec();
        return tokens_owner.len() as u32;
    }

    pub fn get_token_id_by_index(&self, index: u32) -> TokenId {
        let tokens_owner = self.tokens.owner_by_id.to_vec();
        let token_info = tokens_owner[index as usize].clone();
        return token_info.0;
    }

    pub fn get_random_opponent(&mut self, token_id: TokenId) -> TokenId {
        let mut opponent_id = token_id.clone(); // In case there is only one token return it
        let tokens_owner = self.tokens.owner_by_id.to_vec();
        let num_tokens = tokens_owner.len() as u32;

        if num_tokens > 1 {
            let mut rand_index = self.get_random_u32() % num_tokens;
            let mut token_info = tokens_owner[rand_index as usize].clone();
            opponent_id = token_info.0; 

            if opponent_id == token_id {
                rand_index = rand_index + 1;

                if rand_index > num_tokens - 1 {
                    rand_index = 0;
                }

                token_info = tokens_owner[rand_index as usize].clone();
                opponent_id = token_info.0;
            } 
        }

        return opponent_id;
    }

    fn nft_set_extra1(&mut self, token_id: TokenId, extra1: &String) {
        self.assert_nft_owner(token_id.clone());
        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();
        let extra = metadata.extra.unwrap_or(String::from(""));
        let mut nk = NearKart::from_data(&extra);

        nk.extra1 = extra1.clone();

        let extra = nk.serialize();
        metadata.extra = Some(extra);
        lookup_map.insert(&token_id, &metadata);
    }

    fn nft_level_up(&mut self, token_id: TokenId) {
        self.assert_nft_owner(token_id.clone());
        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();
        let extra = metadata.extra.unwrap_or(String::from(""));
        let mut nk = NearKart::from_data(&extra);

        nk.level = nk.level + 1;

        let extra = nk.serialize();
        metadata.extra = Some(extra);
        lookup_map.insert(&token_id, &metadata);
    }

    pub fn game_simple_battle(&mut self, token_id: TokenId) -> SimpleBattle {
        self.assert_nft_owner(token_id.clone());

        let mut prize = 0;
        let opponent_token_id = self.get_random_opponent(token_id.clone());

        let battle_rand = self.get_random_u32();
        let winner = (battle_rand % 2) as u8;
        let won_battle = winner == 0;

        if won_battle {
            let won_prize_rand = self.get_random_u32();
            let won_prize = won_prize_rand % 2 != 0;

            if won_prize {
                let prize_rand = self.get_random_u32();
                prize = prize_rand % NUM_DECALS + 1;

                let near_kart = self.nft_get_near_kart(token_id.clone());
                let unlocks_str = near_kart.extra1;
                let mut unlocks: Vec<String> = unlocks_str.split(",").map(|s| s.to_string()).collect();
                let mut has_already_unlocked = false;

                for unlock in unlocks.iter() {
                    if unlock == &prize.to_string() {
                        has_already_unlocked = true;
                        break;
                    }
                }

                if !has_already_unlocked {
                    if unlocks.len() == 1 && unlocks[0] == "" {
                        unlocks[0] = prize.to_string();
                    }
                    else {
                        unlocks.push(prize.to_string());
                    }
                    let new_unlocks_str = unlocks.join(",");
                    self.nft_set_extra1(token_id.clone(), &new_unlocks_str);
                }
                else {
                    prize = 0;
                }
            }

            self.nft_level_up(token_id.clone());
        }

        let result = SimpleBattle {
            home_token_id: token_id, 
            away_token_id: opponent_token_id, 
            winner: winner, 
            battle: battle_rand,
            prize: prize,
            extra: "".to_string()
        };

        self.last_battle.insert(&env::predecessor_account_id(), &result.clone());

        let b: BattleLog = BattleLog {
            event: "game_simple_battle".to_string(),
            data: result.clone()
        };
        log!("EVENT_JSON:{}", serde_json::to_string(&b).unwrap());

        return result;
    }

    pub fn get_last_battle(&self, account_id: ValidAccountId) -> SimpleBattle {
        let result = self.last_battle.get(&account_id.to_string()).expect("error_no_last_battle");
        return result;
    }

    fn verify_sig(message: String, sig: String, pub_key: String) -> bool {
        let sig_bytes = hex::decode(sig).unwrap();
        let s = Signature::from_bytes(&sig_bytes).unwrap();
        let pub_key_bytes = hex::decode(pub_key).unwrap();
        let pub_key_obj = PublicKey::from_bytes(&pub_key_bytes).unwrap(); 
      
        let ok = pub_key_obj.verify(message.as_bytes(), &s).is_ok();

        return ok;
    }

    pub fn get_random_u32(&mut self) -> u32 {
        let is_new_block = self.prev_block_index != env::block_index();
        let mut rand_bytes = self.random_buffer.to_vec();
        let mut rand_index = self.random_index;

        if rand_index == 0 {
            if is_new_block {
                let random_seed : &[u8] = &env::random_seed();
                rand_bytes = env::sha256(random_seed);
                self.prev_block_index = env::block_index();
            }
            else {
                rand_bytes = env::sha256(&rand_bytes);
            }

            self.random_buffer.clear();
            self.random_buffer.extend(rand_bytes.clone().into_iter());
        }

        let random_u32:u32 = Contract::read_u32(rand_bytes.clone(), rand_index);
        
        rand_index = rand_index + 1;

        if rand_index == 8 {
            rand_index = 0;
        }
        
        self.random_index = rand_index;

        return random_u32;
    }

    fn read_u32(bytes: Vec<u8>, index: u8) -> u32 {
        let mut raw_bytes: [u8; 4] = [ 0, 0, 0, 0];

        for x in 0..4 {
            let offset = (index * 4) as usize;
            raw_bytes[x] = bytes[offset + x];
        }

        let num = u32::from_be_bytes(raw_bytes);

        return num;
    }

    fn get_pub_key(&self) -> String {
        let pub_key = near_sdk::env::signer_account_pk();
        return hex::encode(pub_key);
    }

    fn get_max_weapon_index_for_level(level: u32) -> u8 {
        let weapon_index = ((level as u8 / 5) + 1) * 5;
        return weapon_index;
    }

    fn get_random_u8() -> u8 {
        let rand = near_sdk::env::random_seed()[0];
        return rand;
    }

    fn get_new_from_vec(mut r: Vec<u8>, current: u8) -> u8 {
        r.retain(|v| *v != current);
        let new_index = Contract::get_random_u8() % r.len() as u8;
        return r[new_index as usize];
    }

    fn get_new_color(old_color: u8) -> u8 {
        let mut new_color = Contract::get_random_u8() % 9;

        if old_color == new_color {
            new_color = (new_color + 1) % 9;
        }

        new_color
    }

    fn is_sub_account(main_account: String, sub_account: String) -> bool{
        let main_parts_vec = main_account.split(".").collect::<Vec<&str>>();
    
        let mut is_sub_account = false;
        if main_parts_vec.len() >= 2  {
            if sub_account.ends_with(&main_account) {
                is_sub_account = true
            }
        }
    
        return is_sub_account;
    }
}

near_contract_standards::impl_non_fungible_token_core!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_approval!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_enumeration!(Contract, tokens);

#[near_bindgen]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, MockedBlockchain};
    use more_asserts::{assert_gt, assert_lt};
    use core::convert::TryFrom;

    use super::*;

    const MINT_STORAGE_COST: u128 = 1e23 as u128;

    fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    fn get_context_br(creator_account_id: ValidAccountId, predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let pub_key = Vec::from(hex::decode("c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462").unwrap());
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(creator_account_id.clone())
            .signer_account_pk(pub_key)
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    //const BOATLOAD_OF_GAS: u64 = u64::MAX;
    fn configure_env_for_storage_br(account_id: ValidAccountId, mut context: VMContextBuilder) {
        testing_env!(context.build());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
    //        .prepaid_gas(BOATLOAD_OF_GAS)
            .predecessor_account_id(account_id)
            .build());
    }

    fn sample_token_metadata() -> TokenMetadata {
        TokenMetadata {
            title: Some("Olympus Mons".into()),
            description: Some("The tallest mountain in the charted solar system".into()),
            media: None,
            media_hash: None,
            copies: Some(1u64),
            issued_at: None,
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: Some("dc0012000100000000000000000000a0a0a0a0a0a0".to_string()),
            reference: None,
            reference_hash: None,
        }
    }

    #[test]
    fn test_get_random() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let mut i = 0;
        while i < 16 {
            let val = contract.get_random_u32();
            let val2 = contract.get_random_u32();
            assert_ne!(val, val2);
            i += 1;
            println!("Number run {}", i);
        }
    }

    #[test]
    fn test_new() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(1).into());
        testing_env!(context.is_view(true).build());
        assert_eq!(contract.nft_token("1".to_string()), None);
    }

    #[test]
    #[should_panic(expected = "The contract is not initialized")]
    fn test_default() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        let _contract = Contract::default();
    }

    #[test]
    fn test_near_kart() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let mut starting_near_kart = NearKart::new();
        starting_near_kart.level = 1;
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc, sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);
        let nk1 = contract.nft_get_near_kart(token_id.clone());
        assert_eq!(nk1.front, 0);
        assert_eq!(nk1.level, 1);

        let mut new_near_kart = NearKart::new();
        new_near_kart.front = 2;
        contract.nft_configure(token_id.clone(), new_near_kart);

        let nk = contract.nft_get_near_kart(token_id.clone());
        assert_eq!(nk.front, 2);
    }

    #[test]
    fn test_mint() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);
        assert_eq!(token.owner_id, br_acc.to_string());
        assert_eq!(token.metadata.unwrap(), sample_token_metadata());
        assert_eq!(token.approved_account_ids.unwrap(), HashMap::new());
    }

    #[test]
    fn test_mint_verified_image() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();

        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc, sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);
        assert_eq!(token.owner_id, "benrazor.testnet".to_string());
        assert_eq!(token.approved_account_ids.unwrap(), HashMap::new());
        let md = contract.nft_get_token_metadata(token_id.clone());
        assert_eq!(cid.to_string(), md.media.unwrap_or("".to_string()));
    }


    #[test]
    fn test_media_update() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc, sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);

        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        
        contract.add_signer_key(t_pub_key_1.to_string());

        contract.nft_update_media(token_id.clone(), cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string());

        let md = contract.nft_get_token_metadata(token_id.clone());
        assert_eq!(cid.to_string(), md.media.unwrap_or("".to_string()));
    }

    #[test]
    fn test_get_random_opponent() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "megakart".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);

        let token_id_away = "fluffykart".to_string();
        let starting_near_kart = NearKart::new();
        let token_away = contract.nft_mint_with_verified_image(
            token_id_away.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token_away.token_id, token_id_away);

        let num_karts = contract.get_num_karts();
        assert_eq!(num_karts, 2);

        let sel_id = contract.get_token_id_by_index(0);
        assert_eq!(sel_id, token_id_away.clone());

        let opponent_id = contract.get_random_opponent("megakart".to_string());
        assert_eq!(opponent_id, "fluffykart".to_string());

        let opponent_id = contract.get_random_opponent("megakart".to_string());
        assert_eq!(opponent_id, "fluffykart".to_string());
    }

    #[test]
    fn test_simple_battle() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "megakart".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token.token_id, token_id);

        let token_id_away = "fluffykart".to_string();
        let starting_near_kart = NearKart::new();
        let token_away = contract.nft_mint_with_verified_image(
            token_id_away.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        assert_eq!(token_away.token_id, token_id_away);

        let battle_result = contract.game_simple_battle(token_id.clone());
        let battle_1 = battle_result.battle;
        assert_eq!(battle_result.home_token_id, "megakart");
        assert_eq!(battle_result.away_token_id, "fluffykart");
        assert_gt!(battle_result.battle, 0);
        let nk1 = contract.nft_get_near_kart(token_id.clone());
        assert_eq!(battle_result.winner, 0);
        assert_eq!(nk1.level, 2);

        let battle_result_2 = contract.game_simple_battle(token_id.clone());
        let battle_2 = battle_result_2.battle;
        assert_ne!(battle_1, battle_2);

        let last_battle = contract.get_last_battle(br_acc.clone());
        assert_eq!(last_battle.home_token_id, token_id.clone());
        assert_eq!(last_battle.battle, battle_result_2.battle);

        let battle_result_3 = contract.game_simple_battle(token_id.clone());
        assert_ne!(battle_result_3.battle, battle_2);
        let battle_result_4 = contract.game_simple_battle(token_id.clone());
        assert_ne!(battle_result_4.battle, battle_result_3.battle);
        let battle_result_5 = contract.game_simple_battle(token_id.clone());
        assert_gt!(battle_result_5.prize, 0);
        let nk1 = contract.nft_get_near_kart(token_id.clone());
        assert_gt!(nk1.extra1.len(), 0);
        assert_eq!(nk1.extra1, "3");
        contract.game_simple_battle(token_id.clone());
        contract.game_simple_battle(token_id.clone());
        contract.game_simple_battle(token_id.clone());
        contract.game_simple_battle(token_id.clone());
        let battle_result_6 = contract.game_simple_battle(token_id.clone());
        assert_eq!(battle_result_6.prize, 1);
        let nk1 = contract.nft_get_near_kart(token_id.clone());
        assert_gt!(nk1.extra1.len(), 0);
        assert_eq!(nk1.extra1, "3,1");

    }

    #[test]
    fn test_random() {
        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());

        let pub_key = contract.get_pub_key();
        assert_eq!(pub_key, "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462");

        let rand_1 = contract.get_random_u32();
        let rand_2 = contract.get_random_u32();

        assert_ne!(rand_1, rand_2);
    }

    #[test]
    fn test_transfer() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(0).into());

        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_transfer(accounts(1), token_id.clone(), None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        if let Some(token) = contract.nft_token(token_id.clone()) {
            assert_eq!(token.token_id, token_id);
            assert_eq!(token.owner_id, accounts(1).to_string());
            assert_eq!(token.metadata.unwrap().extra, sample_token_metadata().extra);
            assert_eq!(token.approved_account_ids.unwrap(), HashMap::new());
        } else {
            panic!("token not correctly created, or not found by nft_token");
        }
    }

    #[test]
    fn test_approve() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(0).into());

        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_approve(token_id.clone(), accounts(1), None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert!(contract.nft_is_approved(token_id.clone(), accounts(1), Some(1)));
    }

    #[test]
    fn test_revoke() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(0).into());

        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_approve(token_id.clone(), accounts(1), None);

        // alice revokes bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_revoke(token_id.clone(), accounts(1));
        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert!(!contract.nft_is_approved(token_id.clone(), accounts(1), None));
    }

    #[test]
    fn test_revoke_all() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(0).into());

        let br_nk_acc = ValidAccountId::try_from("near_karts.benrazor.testnet".to_string()).unwrap();
        let br_acc = ValidAccountId::try_from("benrazor.testnet".to_string()).unwrap();
        configure_env_for_storage_br(br_acc.clone(), get_context_br(br_nk_acc.clone(), br_acc.clone()));
        let mut contract = Contract::new_default_meta(br_acc.clone());
        
        let token_id = "0".to_string();
        let starting_near_kart = NearKart::new();
        let cid = "bafkreic6ngsuiw43wzwrp6ocvd5zpddyac55ll6pbkhuqlwo7zft2g6bcm";
        let t_sig_1 = "43e2e88d7286e4aa26450f5167fb8c8718817832313938c532351d261e711d13926eb1ad847d3e7a81461bd7b0ee7da702fbcd45e1bad025c7b1378e66f6030d";
        let t_pub_key_1 = "c58b29b2a183a22fca6e6503e30d61a0ac3e36dbcfb946eb59fbb9d76876a462";
        contract.add_signer_key(t_pub_key_1.to_string());
        let token = contract.nft_mint_with_verified_image(
            token_id.clone(), br_acc.clone(), sample_token_metadata(), starting_near_kart,
            cid.to_string(), t_sig_1.to_string(), t_pub_key_1.to_string()
        );

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_approve(token_id.clone(), accounts(1), None);

        // alice revokes bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(br_acc.clone())
            .build());
        contract.nft_revoke_all(token_id.clone());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert!(!contract.nft_is_approved(token_id.clone(), accounts(1), Some(1)));
    }
}