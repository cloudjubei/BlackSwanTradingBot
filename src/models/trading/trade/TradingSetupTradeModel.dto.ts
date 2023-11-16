import { Prop, Schema, raw } from '@nestjs/mongoose'
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger"
import TradingSetupConfigModel from '../TradingSetupConfigModel.dto'
import TradingTransactionModel from '../transaction/TradingTransactionModel.dto'
import TradingSetupStatusType, { TradingSetupStatusTypeAPI } from '../TradingSetupStatusType.dto'
import MathUtils from "commons/lib/mathUtils"
import SignalModel from "commons/models/signal/SignalModel.dto"
import { StringMap, Timestamp } from "commons/models/swagger.consts"
import TradingSetupTradeTransactionStatus from './TradingSetupTradeTransactionStatus.dto'
import TradingSetupModel from '../TradingSetupModel.dto'
import TradingSetupActionModel from '../action/TradingSetupActionModel.dto'
import TradingSetupActionType from '../action/TradingSetupActionType.dto'

export default class TradingSetupTradeModel
{
    @ApiProperty() id: string

    @ApiProperty() startingFirstAmount: string
    @ApiProperty() startingSecondAmount: string
    @ApiProperty() firstAmount: string
    @ApiProperty() secondAmount: string

    @ApiProperty() entryPriceAmount: string = "0"
    @ApiProperty() lowestPriceAmount: string = "99999999999"
    @ApiProperty() highestPriceAmount: string = "0"

    @ApiProperty() currentAction: TradingSetupActionModel = new TradingSetupActionModel(TradingSetupActionType.MANUAL, 0)
    @ApiProperty() status: TradingSetupTradeTransactionStatus = TradingSetupTradeTransactionStatus.BUY_PENDING
    @ApiProperty() buyTransaction: TradingTransactionModel
    @ApiProperty() sellTransactions: TradingTransactionModel[] = []

    @ApiProperty() failedDueToMarketMaking: number = 0
}

export class TradingSetupTradeModelUtils
{
    static FromTransaction(transaction: TradingTransactionModel) : TradingSetupTradeModel
    {
        const trade = new TradingSetupTradeModel()
        trade.id = transaction.transactionId
        trade.startingFirstAmount = '0'
        trade.startingSecondAmount = transaction.offeredAmount
        trade.firstAmount = transaction.firstAmount
        trade.secondAmount = transaction.secondAmount
        trade.buyTransaction = transaction
        trade.entryPriceAmount = transaction.priceAmount
        trade.lowestPriceAmount = transaction.priceAmount
        trade.highestPriceAmount = transaction.priceAmount
        trade.status = transaction.complete ? TradingSetupTradeTransactionStatus.BUY_DONE : TradingSetupTradeTransactionStatus.BUY_PENDING
        return trade
    }

    static UpdateBuyTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        if (transaction.complete){
            trade.entryPriceAmount = transaction.priceAmount
            trade.lowestPriceAmount = transaction.priceAmount
            trade.highestPriceAmount = transaction.priceAmount

            trade.firstAmount = transaction.firstAmount
            trade.secondAmount = transaction.secondAmount

            setup.firstAmount = MathUtils.AddNumbers(setup.firstAmount, trade.firstAmount)
            setup.secondAmount = MathUtils.SubtractNumbers(MathUtils.AddNumbers(setup.secondAmount, trade.startingSecondAmount), trade.secondAmount)

            trade.status = MathUtils.IsZero(trade.firstAmount) && MathUtils.IsZero(trade.secondAmount) ? TradingSetupTradeTransactionStatus.COMPLETE : TradingSetupTradeTransactionStatus.BUY_DONE
            
            console.log('UpdateBuyTransaction id: ' + trade.id + " BUY " + setup.config.firstToken + ': ' + trade.firstAmount, ' | ' + setup.config.secondToken + ' : ' + trade.secondAmount + ' avgPrice: ' + MathUtils.Shorten(transaction.priceAmount) + ' vs currentPrice: ' + MathUtils.Shorten(setup.currentPriceAmount))
            console.log('UpdateBuyTransaction transaction: ' + setup.config.firstToken + ': ' + transaction.firstAmount, ' | ' + setup.config.secondToken + ' : ' + transaction.secondAmount + ' wantedPriceAmount: ' + MathUtils.Shorten(transaction.wantedPriceAmount))
        }
    }

    static UpdateSellTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        trade.status = TradingSetupTradeTransactionStatus.SELL_PENDING
        if (transaction.complete){
            trade.firstAmount = MathUtils.SubtractNumbers(trade.firstAmount, transaction.firstAmount)
            trade.secondAmount = MathUtils.AddNumbers(trade.secondAmount, transaction.secondAmount)

            setup.firstAmount = MathUtils.SubtractNumbers(setup.firstAmount, transaction.firstAmount)
            setup.secondAmount = MathUtils.AddNumbers(setup.secondAmount, transaction.secondAmount)

            console.log('UpdateSellTransaction id: ' + trade.id + " SELL " + setup.config.firstToken + ': ' + trade.firstAmount, ' | ' + setup.config.secondToken + ' : ' + trade.secondAmount + ' avgPrice: ' + MathUtils.Shorten(transaction.priceAmount) + ' vs currentPrice: ' + MathUtils.Shorten(setup.currentPriceAmount))
            console.log('UpdateSellTransaction transaction: ' + setup.config.firstToken + ': ' + transaction.firstAmount, ' | ' + setup.config.secondToken + ' : ' + transaction.secondAmount + ' wantedPriceAmount: ' + MathUtils.Shorten(transaction.wantedPriceAmount))
        }
    }

    static UpdateSellTransactionsStatus(trade: TradingSetupTradeModel)
    {
        const isSellComplete = !trade.sellTransactions.find(t => !t.complete)
        if (isSellComplete) {
            if (!MathUtils.IsZero(trade.firstAmount)){
                trade.status = TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE
            }else{
                trade.firstAmount = 
                trade.status = TradingSetupTradeTransactionStatus.COMPLETE
            }
        } 
    }

    static UpdateTakeProfit(trade: TradingSetupTradeModel, setup: TradingSetupModel, minAmount: string) : TradingSetupActionModel
    {
        if (MathUtils.IsLessThan(trade.firstAmount, minAmount)) { return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT) }

        const takeProfit = setup.config.takeProfit
        if (takeProfit){
            const trailingStop = takeProfit.trailingStop
            if (trailingStop){
                const hardLimitPercentage = trailingStop.hardLimitPercentage
                if (hardLimitPercentage){
                    const triggerAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + hardLimitPercentage))
                    if (MathUtils.IsGreaterThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                    }
                }
                const activationAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(trade.highestPriceAmount, activationAmount)){
                    const triggerAmount = MathUtils.MultiplyNumbers(trade.highestPriceAmount, "" + (1.0 - trailingStop.deltaPercentage))
                    if (MathUtils.IsLessThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                    }
                }
            }else{
                const triggerAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                    return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                }
            }
        }
        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT)
    }

    static UpdateStopLoss(trade: TradingSetupTradeModel, setup: TradingSetupModel, minAmount: string) : TradingSetupActionModel
    {
        if (MathUtils.IsLessThan(trade.firstAmount, minAmount)) { return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS) }
        
        const stopLoss = setup.config.stopLoss
        if (stopLoss){
            const triggerAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 - stopLoss.percentage))
            if (MathUtils.IsLessThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS, -1)
            }
        }
        return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS)
    }
}