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
    }

    getConfig() : ConfigModel
    {
        return this.config
    }

    getMinAmounts() : { [key:string] : string }
    {
        return this.config.minimum_amounts
    }
}
