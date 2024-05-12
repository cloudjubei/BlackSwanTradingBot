
export default class TradingStopLossConfigModel
{
    percentage: number
    timeout: number = 0
    isBasedOnMaxPrice: boolean = true
    retriesBeforeHardSell: number = 3
}