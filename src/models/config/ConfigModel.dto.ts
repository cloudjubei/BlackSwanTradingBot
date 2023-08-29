import ConfigSignalModel from "./ConfigSignalModel.dto"

export default class ConfigModel
{
    prices: { [key:string] : number } = {}
    signals: { [key:string] : ConfigSignalModel } = {}
}