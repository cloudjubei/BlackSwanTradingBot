import ConfigPriceInputModel from 'commons/models/config/ConfigPriceInputModel.dto'
import ConfigSignalInputModel from 'commons/models/config/ConfigSignalInputModel.dto'

export default class ConfigModel
{
    minimum_amounts: { [key:string] : string } = {}
    prices: { [key:string] : ConfigPriceInputModel } = {}
    intervals: string[] = []
    signals: { [key:string] : ConfigSignalInputModel } = {}
}