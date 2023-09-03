import TradingTakeProfitConfigModel from './takeprofit/TradingTakeProfitConfigModel.dto'
import TradingStopLossConfigModel from './stoploss/TradingStopLossConfigModel.dto'

export default class TradingSetupConfigModel
{
    tokenFirst: string
    tokenSecond: string
    updateInterval: string

    terminationPercentageLoss?: number = undefined
    takeProfit?: TradingTakeProfitConfigModel = undefined
    stopLoss?: TradingStopLossConfigModel = undefined

    signals: string[] = []
    useLimitOrders: boolean = false
}

export class TradingSetupConfigModelUtils
{
    static GetTokenPair(m: TradingSetupConfigModel) : string
    {
        return m.tokenFirst + m.tokenSecond
    }
}