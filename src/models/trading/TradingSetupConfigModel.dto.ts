import TradingTakeProfitConfigModel from './takeprofit/TradingTakeProfitConfigModel.dto'
import TradingStopLossConfigModel from './stoploss/TradingStopLossConfigModel.dto'

export default class TradingSetupConfigModel
{
    firstToken: string
    secondToken: string
    interval: string
    signal: string

    terminationPercentageLoss?: number = undefined
    takeProfit?: TradingTakeProfitConfigModel = undefined
    stopLoss?: TradingStopLossConfigModel = undefined

    useLimitOrders: boolean = false
    useLimitMakerOrders: boolean = false
    limitOrderBuyOffset: number = 0
    limitOrderSellOffset: number = 0
    limitOrderCancelDueToChecksElapsed: number = 10000
    limitOrderCancelDueToTimeElapsed?: number = undefined
    limitOrderCancelDueToPriceDivergence?: string = undefined

    isMarginAccount: boolean = false
}

export class TradingSetupConfigModelUtils
{
    static GetTokenPair(m: TradingSetupConfigModel) : string
    {
        return m.firstToken + m.secondToken
    }
}