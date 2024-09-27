// Only run this as a WASM if the export-abi feature is not set.
#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
extern crate alloc;

// Modules and imports
use alloy_primitives::{Address, U256};
use stylus_sdk::{
    prelude::*
};

/// Initializes a custom, global allocator for Rust programs compiled to WASM.
#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;


sol_storage! {
    #[entrypoint]
    pub struct L2 {
        #[borrow]
        uint256 total_supply;
    }
}

#[external]
impl L2 {
    pub fn get_balance(&self, owner: Address) -> U256 {
        owner.balance()
    }
}