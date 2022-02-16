import { near, BigInt, JSONValue, json, log } from "@graphprotocol/graph-ts"
import { NearKartsSimpleBattle, ScoreDaily, ScoreMonthly, NearKart } from "../generated/schema"

export function handleReceipt(
  receiptWithOutcome: near.ReceiptWithOutcome
): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  //let entity = NearKartsSimpleBattle.load(receiptWithOutcome.receipt.id.toHex())

  receiptWithOutcome.block.header
  let logs = receiptWithOutcome.outcome.logs;
  let homeAccount = receiptWithOutcome.receipt.predecessorId;
  let tsStr = receiptWithOutcome.block.header.timestampNanosec.toString();
  log.info('ts {}', [tsStr]);
  let msInDay = BigInt.fromI32(86400000)
  let msInMonth = BigInt.fromI32(2592000000);
  let timestampNano = BigInt.fromString(tsStr);
  let timestamp = timestampNano.div(BigInt.fromU64(1e6 as u64));
  log.info('ts2 {}', [timestamp.toString()]);

  let period = timestamp.div(msInDay);
  log.info('period {}', [period.toString()]);

  let periodMonth = timestamp.div(msInMonth);
  log.info('period month {}', [periodMonth.toString()]);

  for(let i = 0; i < logs.length; i++) {
    let l = logs[i];
    let obj = json.fromString(l.replace('EVENT_JSON:', ''));
    let jo = obj.toObject();
    let event = jo.get('event');
    let eventStr = event ? event.toString() : '';

    log.info('ev {}', [eventStr]);
    if(eventStr == 'nft_mint') {
      let data = jo.get('data');
      let dataObj = data ? data.toArray() : null;
      let mintInfoJsonValue = dataObj ? dataObj[0] : null;
      let mintInfo = mintInfoJsonValue ? mintInfoJsonValue.toObject() : null;

      if(mintInfo) {
        log.info('In mint info', []);
        let tokenIdJsonValue = mintInfo.get('token_ids');
        let tokenId = tokenIdJsonValue ? tokenIdJsonValue.toArray()[0].toString() : '';

        if(tokenId) {
          log.info('In create mint: {}', [tokenId]);
          let entity = new NearKart(tokenId)

          entity.ownerId = homeAccount;
          entity.tokenId = tokenId;
          entity.save();
        }
      }
    }
    else if(eventStr == 'game_simple_battle') {
      let data = jo.get('data');
      let dataObj = data ? data.toObject() : null;

      if(dataObj) {
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

        entity.save();

        let nearKart = NearKart.load(entity.homeTokenId);

        log.info('Pre score', []);
        if(nearKart) {
          let scoreDailyId = entity.homeTokenId + '_' + period.toString();
          let scoreDailyEntity = ScoreDaily.load(scoreDailyId);

          log.info('score daily: ', [scoreDailyId]);
          if(!scoreDailyEntity) {
            scoreDailyEntity = new ScoreDaily(scoreDailyId);
          }

          scoreDailyEntity.period = period;
          if(entity.winner == 0) {
            scoreDailyEntity.numWins++;
          }
          else {
            scoreDailyEntity.numLosses++;
          }

          scoreDailyEntity.nearKart = entity.homeTokenId;
          scoreDailyEntity.save();

          let scoreMonthlyId = entity.homeTokenId + '_' + periodMonth.toString();
          let scoreMonthlyEntity = ScoreMonthly.load(scoreMonthlyId);

          log.info('score monthly: ', [scoreMonthlyId]);
          if(!scoreMonthlyEntity) {
            scoreMonthlyEntity = new ScoreMonthly(scoreMonthlyId);
          }

          scoreMonthlyEntity.period = periodMonth;
          if(entity.winner == 0) {
            scoreMonthlyEntity.numWins++;
          }
          else {
            scoreMonthlyEntity.numLosses++;
          }

          scoreMonthlyEntity.nearKart = entity.homeTokenId;
          scoreMonthlyEntity.save();
        }
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
