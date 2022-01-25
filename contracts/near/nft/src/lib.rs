/*!
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
use near_sdk::collections::LazyOption;
use near_sdk::json_types::ValidAccountId;
use near_sdk::{
    env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseOrValue,
};
use serde::{Serialize, Deserialize};
use std::cmp;
use rmp_serde;
use hex;

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
}

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct NearKart {
    level: u8,
    left: u8,
    right: u8,
    top: u8,
    front: u8,
    skin: u8,
    transport: u8,
    color1: u32,
    color2: u32,
    decal1: String,
    decal2: String,
    decal3: String,
    extra1: String,
    extra2: String,
    extra3: String
}

impl NearKart {
    pub fn new() -> Self {
        Self::default()
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
        }
    }

    /// Mint a new token with ID=`token_id` belonging to `receiver_id`.
    ///
    /// Since this example implements metadata, it also requires per-token metadata to be provided
    /// in this call. `self.tokens.mint` will also require it to be Some, since
    /// `StorageKey::TokenMetadata` was provided at initialization.
    ///
    /// `self.tokens.mint` will enforce `predecessor_account_id` to equal the `owner_id` given in
    /// initialization call to `new`.
    #[payable]
    pub fn nft_mint(
        &mut self,
        token_id: TokenId,
        receiver_id: ValidAccountId,
        token_metadata: TokenMetadata,
    ) -> Token {
        self.tokens.mint(token_id, receiver_id, Some(token_metadata))
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

    fn assert_contract_owner() {
        let valid = Contract::is_sub_account(env::predecessor_account_id(), env::current_account_id());
        println!("{} {}", env::current_account_id(), env::predecessor_account_id());
        assert_eq!( valid, true, "Caller must be relative of contract owner");
    }

    pub fn configure(&mut self, token_id: TokenId, near_kart_new: NearKart) {
        self.assert_nft_owner(token_id.clone());
        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();
        let extra = metadata.extra.unwrap_or(String::from(""));
        let mut nk = NearKart::from_data(&extra);

        nk.clone_from(&near_kart_new);

        let extra = nk.serialize();
        metadata.extra = Some(extra);
        lookup_map.insert(&token_id, &metadata);
    }

    /*
    pub fn do_action(&mut self, token_id: TokenId, action: String) {
        self.assert_nft_owner(token_id.clone());
        let lookup_map = self.tokens.token_metadata_by_id.as_mut().unwrap();
        let mut metadata = lookup_map.get(&token_id.to_string()).unwrap();
        let extra = metadata.extra.unwrap_or(String::from(""));
        let mut sj = NearKart::from_data(&extra);

        if action == "configure" {
            if sj.room != 0 {
                panic!("Lifeforms may only get electrified in room zero");
            }
            else if sj.evolution < 1 {
                panic!("Lifeforms may only get electrified after drinking strange juice");
            }
            else {
                sj.evolution = cmp::max(2, sj.evolution);
                sj.style_head_wear = Contract::get_new_from_vec((1..5).collect(), sj.style_head_wear);
                sj.color_head_wear = Contract::get_new_color(sj.color_head_wear);
            }
        }
        else if action == "scavenge_in_bin" {
            if sj.room != 0 {
                panic!("Lifeforms may only scavenge in room zero");
            }
            else if sj.evolution < 2 {
                panic!("Lifeforms may only scavenge in bins after being electrocuted");
            }
            else {
                sj.evolution = cmp::max(3, sj.evolution);
                sj.style_legs = Contract::get_new_from_vec((1..5).collect(), sj.style_legs);
                sj.style_arms = sj.style_legs;
            }
        }
        else if action == "leave_room_zero" {
            if sj.room != 0 {
                panic!("Lifeform is not in room zero");
            }
            else if sj.evolution < 3 {
                panic!("Lifeforms may only leave room zero if they have legs");
            }
            else {
                sj.room = 1;
            }
        }
        else if action == "do_naughty_reset" {
            Contract::assert_contract_owner();
            sj = StrangeJuice::default();
        }
        else {
            panic!("Lifeforms do not know how to perform this action");
        }

        let extra = sj.serialize();
        metadata.extra = Some(extra);
        lookup_map.insert(&token_id, &metadata);
    }
    */

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

    use super::*;

    const MINT_STORAGE_COST: u128 = 5870000000000000000000;

    fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
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
            extra: None,
            reference: None,
            reference_hash: None,
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
        configure_env_for_storage(get_context(accounts(0)));
        let mut contract = Contract::new_default_meta(accounts(0).into());
        
        let token_id = "0".to_string();
        let token = contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());
        assert_eq!(token.token_id, token_id);

        let mut new_near_kart = NearKart::new();
        new_near_kart.front = 2;
        contract.configure(token_id.clone(), new_near_kart);

        let nk = contract.nft_get_near_kart(token_id.clone());
        assert_eq!(nk.front, 2);
    }

    fn configure_env_for_storage(mut context: VMContextBuilder) {
        testing_env!(context.build());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());
    }

    #[test]
    fn test_mint() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(0).into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());

        let token_id = "0".to_string();
        let token = contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());
        assert_eq!(token.token_id, token_id);
        assert_eq!(token.owner_id, accounts(0).to_string());
        assert_eq!(token.metadata.unwrap(), sample_token_metadata());
        assert_eq!(token.approved_account_ids.unwrap(), HashMap::new());
    }

    #[test]
    fn test_transfer() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(0).into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());
        let token_id = "0".to_string();
        contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(0))
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
            assert_eq!(token.metadata.unwrap(), sample_token_metadata());
            assert_eq!(token.approved_account_ids.unwrap(), HashMap::new());
        } else {
            panic!("token not correctly created, or not found by nft_token");
        }
    }

    #[test]
    fn test_approve() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(0).into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());
        let token_id = "0".to_string();
        contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(accounts(0))
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
        let mut contract = Contract::new_default_meta(accounts(0).into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());
        let token_id = "0".to_string();
        contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(accounts(0))
            .build());
        contract.nft_approve(token_id.clone(), accounts(1), None);

        // alice revokes bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(0))
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
        let mut contract = Contract::new_default_meta(accounts(0).into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(MINT_STORAGE_COST)
            .predecessor_account_id(accounts(0))
            .build());
        let token_id = "0".to_string();
        contract.nft_mint(token_id.clone(), accounts(0), sample_token_metadata());

        // alice approves bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(150000000000000000000)
            .predecessor_account_id(accounts(0))
            .build());
        contract.nft_approve(token_id.clone(), accounts(1), None);

        // alice revokes bob
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(0))
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
