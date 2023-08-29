import { Injectable } from '@nestjs/common'
import MathUtils from 'src/lib/mathUtils'
import TradingSetupModel from 'src/models/trading/TradingSetupModel.dto'
import TradingTransactionModel from 'src/models/trading/transaction/TradingTransactionModel.dto'

@Injectable()
export class TransactionService
{
    setup()
    {
        //TODO: connect to binance API
    }
    
    async makeTransaction(setup: TradingSetupModel, action: number) : Promise<TradingTransactionModel> | undefined
    {
        console.log("makeTransaction for action: " + action + " and setup: ", setup)
        return 
        // if (action > 0){ //BUY
        //     if (MathUtils.IsBiggerThanZero(setup.secondAmount)){
        //         const binanceTransaction = await this.makeBuyTransaction(setup.config.tokenPair, setup.secondAmount)
                
        //         //TODO:
        //         return {
        //             buy: true,
        //             boughtAmount: "",
        //             priceAmount: "",
        //             boughtForAmount: ""
        //         } as TradingTransactionModel
        //     } 
        // }else if (action < 0){ //SELL  
        //     if (MathUtils.IsBiggerThanZero(setup.firstAmount)){
        //         const binanceTransaction = await this.makeSellTransaction(setup.config.tokenPair, setup.secondAmount)
                
        //         //TODO:
        //         return {
        //             buy: false,
        //             boughtAmount: "",
        //             priceAmount: "",
        //             boughtForAmount: ""
        //         } as TradingTransactionModel
        //     } 
        // }
        // return
    }

    // private async makeBuyTransaction(tokenPair: string, buyForAmount: string) : Promise<boolean>
    // {
        
    // }

    // private async makeSellTransaction(tokenPair: string, buyForAmount: string) : Promise<boolean>
    // {
        
    // }
}