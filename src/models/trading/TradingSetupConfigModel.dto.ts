import TradingTakeProfitConfigModel from './takeprofit/TradingTakeProfitConfigModel.dto'
import TradingStopLossConfigModel from './stoploss/TradingStopLossConfigModel.dto'

export default class TradingSetupConfigModel
{
    firstToken: string
    secondToken: string
    updateInterval: string

    terminationPercentageLoss?: number = undefined
    takeProfit?: TradingTakeProfitConfigModel = undefined
    stopLoss?: TradingStopLossConfigModel = undefined

    signals: string[] = []
    signalThreshold: number = 0

    useLimitOrders: boolean = false
    limitOrderBuyOffset: number = 0
    limitOrderSellOffset: number = 0
    limitOrderCancelDueToChecksElapsed: number = 10000
    limitOrderCancelDueToTimeElapsed?: number = undefined
    limitOrderCancelDueToPriceDivergence?: string = undefined
}

export class TradingSetupConfigModelUtils
{
    static GetTokenPair(m: TradingSetupConfigModel) : string
    {
        return m.firstToken + m.secondToken
    }
}