import ConfigConnectionInputModel from 'commons/models/config/ConfigConnectionInputModel.dto'
import ConfigSignalInputModel from 'commons/models/config/ConfigSignalInputModel.dto'

export default class ConfigModel
{
    minimum_amounts: { [key:string] : string } = {}
    default_host: string
    socket_timeout: number = 1000
    prices: { [key:string] : ConfigConnectionInputModel } = {}
    intervals: string[] = []
    signals: { [key:string] : ConfigSignalInputModel } = {}
}