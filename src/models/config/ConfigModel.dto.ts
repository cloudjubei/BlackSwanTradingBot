import ConfigSignalModel from "./ConfigSignalModel.dto"

export default class ConfigModel
{
    minimum_amounts: { [key:string] : string } = {}
    prices: { [key:string] : number } = {}
    signals: { [key:string] : ConfigSignalModel } = {}
}