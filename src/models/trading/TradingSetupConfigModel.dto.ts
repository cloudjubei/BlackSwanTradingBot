import TradingTakeProfitConfigModel from './takeprofit/TradingTakeProfitConfigModel.dto'
import TradingStopLossConfigModel from './stoploss/TradingStopLossConfigModel.dto'

export default class TradingSetupConfigModel
{
    tokenPair: string
    updateInterval: string

    terminationPercentageLoss?: number = undefined
    takeProfit?: TradingTakeProfitConfigModel = undefined
    stopLoss?: TradingStopLossConfigModel = undefined

    signals: string[] = []
}