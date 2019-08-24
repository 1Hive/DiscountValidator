import { call, all } from "cofx";
import { Stopwatch } from "./utils/stopwatch";
import * as eth from "./eth";
import * as discounts from "./discounts";
import {
  persistGas,
  resetGasDiscount,
  gasUsedOnBlock,
  gasUsedByAddresses
} from "./discounts/addressGas";

export const CHECKPOINT_DURATION = 10 * 1000;
export const PERIOD_RESET = 5;

export const CERTIFIER_ADDRESS = "0x00";
export const MINIME_TOKEN_ADDRESS = "0x00";

export function* root(ctx) {
  const stopwatch = new Stopwatch();
  const startBlock = process.env.START_BLOCK || 6592900;
  const targetBlock = process.env.TARGET_BLOCK || 6592906;
  let block_counter = 0;

  let block = yield call(eth.fetchBlockUntil, ctx, startBlock, targetBlock);

  const certifierABI = require(`./abis/HiveCertifier.json`).abi;
  const miniMeABI = require(`./abis/MiniMeToken.json`).abi;

  const Certifier = new web3.eth.Contract(certifierABI, CERTIFIER_ADDRESS);
  const MiniMe = new web3.eth.Contract(miniMeABI, MINIME_TOKEN_ADDRESS);

  // TODO: fetch address from certifier contract

  // TODO: Los validator se agregan solo al bridgear tokens o quitarlos del bridge..transfer eventualy. Para los casos de certificar esos casos si vamos quitarlos unicamente

  // const addressWithDiscount = web3.geet
  const addressWithDiscount = [
    "0xD64644e3cC1Be0Ce686c5883c9a1f99C7dC6128C",
    "0xF3fe7508318d7309f235776f7a462CF75803816C",
    "0x4a7618f4229617D91C6289cb813E2e7292Bd2eFC",
    "0x0FB166dd6Ea14BCbd688419EB23325B6c2BdF76B",
    "0xF96D424c1B422E7d6af4369B8304C6860B29235b"
  ];

  // Fetch transactions and logs
  ctx.log.info(
    {
      startBlock,
      targetBlock
    },
    "Worker started."
  );

  while (block) {
    // TODO:  Traer de la base todos los registrors elimnar los que son en cero o negativo

    // Eliminar el conjunto de address del certifier

    ctx.log.debug(
      {
        block: block.number
      },
      `Processing block #${block.number}`
    );
    console.log("BLOOOOOCK ", block);

    const transactions = yield call(eth.fetchTransactions, ctx, block);
    const agregateGasUsage = gasUsedOnBlock(transactions);

    if (block_counter == PERIOD_RESET) {
      block_counter = 0;
      console.log(
        "********************** REEEEESEEEEEETTTTTTTTTT ***********************"
      );

      // TODO: Agregar batch the personas que se sumaron en el periodo anterior y resetear el batch

      agregateGasUsage += gasUsedOnBlock(transactions);

      // const honeySupply = web3.call('total_balance', { address })
      // const minGasPrice = web3.call('gas_price', { address })

      //Reset gas discount from DB
      yield discounts.processDiscountReset(
        ctx,
        addressWithDiscount,
        transactions,
        agregateGasUsage,
        honeySupply,
        minGasPrice,
        resetGasDiscount
      );
      agregateGasUsage = 0;
    } else {
      agregateGasUsage += gasUsedOnBlock(transactions);

      const gasUsed = gasUsedByAddresses(addressWithDiscount, transactions);

      // Persist Address - gas
      yield eth.processTransactions(
        ctx,
        addressWithDiscount,
        gasUsed,
        persistGas
      );

      block = yield call(
        eth.fetchBlockUntil,
        ctx,
        block.number + 1,
        targetBlock
      );
      block_counter = block_counter + 1;
    }
  }
}
