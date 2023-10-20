import { Injectable } from '@nestjs/common'
import StorageUtils from 'commons/lib/storageUtils'
import ConfigModel from 'models/config/ConfigModel.dto'

@Injectable()
export class IdentityService
{
    config : ConfigModel

    constructor()
    {
        const configFile = StorageUtils.getFile('config.json')
        this.config = JSON.parse(configFile) as ConfigModel

        const tokens = this.getTokens()

        for(const id of Object.keys(this.config.signals)){
            const signalConfig = this.config.signals[id]
            if (!signalConfig["host"]){
                this.config.signals[id]["host"] = "http://localhost"
            }
            if (!signalConfig["tokens"]){
                this.config.signals[id]["tokens"] = tokens
            }
            if (!signalConfig["intervals"]){
                this.config.signals[id]["intervals"] = this.config.intervals
            }
        }
    }

    getConfig() : ConfigModel
    {
        return this.config
    }

    getMinAmounts() : { [key:string] : string }
    {
        return this.config.minimum_amounts
    }

    getTokens() : string[]
    {
        return Object.keys(this.config.prices)
    }
}
