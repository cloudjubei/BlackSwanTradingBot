import TradingTakeProfitTrailingStopConfigModel from './TradingTakeProfitTrailingStopConfigModel.dto'

export default class TradingTakeProfitConfigModel
{
    percentage : number
    trailingStop?: TradingTakeProfitTrailingStopConfigModel = undefined
}