import { near, BigInt, JSONValue, json, log } from "@graphprotocol/graph-ts"
import { NearKartsSimpleBattle } from "../generated/schema"

export function handleReceipt(
  receiptWithOutcome: near.ReceiptWithOutcome
): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  //let entity = NearKartsSimpleBattle.load(receiptWithOutcome.receipt.id.toHex())

  let logs = receiptWithOutcome.outcome.logs;
  let homeAccount = receiptWithOutcome.receipt.predecessorId;
  let tsStr = receiptWithOutcome.block.header.timestampNanosec.toString();
  log.info('ts {}', [tsStr]);
  let timestamp = BigInt.fromString(tsStr);
  timestamp = timestamp.div(BigInt.fromU64(1e6 as u64));
  log.info('ts2 {}', [timestamp.toString()]);

  for(let i = 0; i < logs.length; i++) {
    let l = logs[i];
    let obj = json.fromString(l.replace('EVENT_JSON:', ''));
    let jo = obj.toObject();
    let event = jo.get('event');
    let eventStr = event ? event.toString() : '';

    if(eventStr == 'game_simple_battle') {
      let data = jo.get('data');
      let dataObj = data ? data.toObject() : null;

      if(dataObj) {
        // Entities only exist after they have been saved to the store;
        // `null` checks allow to create entities on demand
          let entity = new NearKartsSimpleBattle(receiptWithOutcome.receipt.id.toHex())

          entity.homeAccount = homeAccount;
          entity.timestamp = timestamp;

          let homeTokenId = dataObj.get('home_token_id');
          entity.homeTokenId = homeTokenId ? homeTokenId.toString() : '';

          let awayTokenId = dataObj.get('away_token_id');
          entity.awayTokenId = awayTokenId ? awayTokenId.toString() : '';

          let winner = dataObj.get('winner');
          entity.winner = winner ? winner.toI64() as i32 : 0;
          
          let battle = dataObj.get('battle');
          entity.battle = battle ? battle.toBigInt() : new BigInt(0);

          let prize = dataObj.get('prize');
          entity.prize = prize ? prize.toString() : '';

          let extra = dataObj.get('extra');
          entity.extra = extra ? extra.toString() : '';

          entity.save()
          break;
        }

    }
  }




  // BigInt and BigDecimal math are supported
  // entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on receipt information
  // entity.block = receiptWithOutcome.block.header.hash

  // Entities can be written to the store with `.save()`

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.
}
